import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, Printer, Users, TrendingUp } from "lucide-react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/v3/relatorios/abc-clientes")({
  head: () => ({ meta: [{ title: "Curva ABC de clientes — Prime Automotive" }] }),
  component: AbcCustomersPage,
});

type Period = "30d" | "90d" | "180d" | "365d" | "all";
const PERIOD_LABEL: Record<Period, string> = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "180d": "Últimos 6 meses",
  "365d": "Últimos 12 meses",
  all: "Todo o período",
};

function periodStart(p: Period): string | null {
  if (p === "all") return null;
  const days = Number(p.replace("d", ""));
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

type Row = {
  company_id: string;
  nome: string;
  cidade: string;
  estado: string;
  pedidos: number;
  receita: number;
  ticket: number;
  ultima: string | null;
  pctCidade: number;
  pctAcumCidade: number;
  classe: "A" | "B" | "C";
};

function AbcCustomersPage() {
  const [period, setPeriod] = useState<Period>("180d");
  const [search, setSearch] = useState("");
  const [topN, setTopN] = useState<"5" | "10" | "all">("5");

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["abc-customers", period],
    queryFn: async () => {
      const start = periodStart(period);
      let q = supabase
        .from("orders")
        .select("id,total,created_at,status,company_id,companies!inner(legal_name,trade_name,cidade,estado)")
        .neq("status", "CANCELADO")
        .not("company_id", "is", null);
      if (start) q = q.gte("created_at", start);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { cidades, totals } = useMemo(() => {
    const byCliente = new Map<string, Row>();
    for (const o of raw as any[]) {
      const c = o.companies || {};
      const cid = o.company_id as string;
      const total = Number(o.total || 0);
      const cur = byCliente.get(cid) || {
        company_id: cid,
        nome: c.trade_name || c.legal_name || "Cliente",
        cidade: (c.cidade || "SEM CIDADE").toString(),
        estado: (c.estado || "").toString(),
        pedidos: 0,
        receita: 0,
        ticket: 0,
        ultima: null,
        pctCidade: 0,
        pctAcumCidade: 0,
        classe: "C" as const,
      };
      cur.pedidos += 1;
      cur.receita += total;
      if (!cur.ultima || o.created_at > cur.ultima) cur.ultima = o.created_at;
      byCliente.set(cid, cur);
    }
    for (const r of byCliente.values()) {
      r.ticket = r.pedidos > 0 ? r.receita / r.pedidos : 0;
    }

    // Agrupa por cidade
    const byCidade = new Map<string, Row[]>();
    for (const r of byCliente.values()) {
      const key = `${r.cidade}|${r.estado}`;
      if (!byCidade.has(key)) byCidade.set(key, []);
      byCidade.get(key)!.push(r);
    }

    const cidades = Array.from(byCidade.entries()).map(([key, list]) => {
      const [cidade, estado] = key.split("|");
      list.sort((a, b) => b.receita - a.receita);
      const totalCidade = list.reduce((s, r) => s + r.receita, 0);
      let acum = 0;
      for (const r of list) {
        const pct = totalCidade > 0 ? (r.receita / totalCidade) * 100 : 0;
        acum += pct;
        r.pctCidade = pct;
        r.pctAcumCidade = acum;
        r.classe = acum <= 80 ? "A" : acum <= 95 ? "B" : "C";
      }
      const totalPedidos = list.reduce((s, r) => s + r.pedidos, 0);
      return { cidade, estado, clientes: list, totalReceita: totalCidade, totalPedidos };
    });

    cidades.sort((a, b) => b.totalReceita - a.totalReceita);

    const totals = {
      cidades: cidades.length,
      clientes: byCliente.size,
      receita: cidades.reduce((s, c) => s + c.totalReceita, 0),
      pedidos: cidades.reduce((s, c) => s + c.totalPedidos, 0),
    };

    return { cidades, totals };
  }, [raw]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cidades;
    return cidades.filter(
      (c) =>
        c.cidade.toLowerCase().includes(q) ||
        c.estado.toLowerCase().includes(q) ||
        c.clientes.some((cl) => cl.nome.toLowerCase().includes(q)),
    );
  }, [cidades, search]);

  const limit = topN === "all" ? Infinity : Number(topN);

  const classeColor = (c: "A" | "B" | "C") =>
    c === "A" ? V2.TEAL : c === "B" ? V2.TEAL_DARK : V2.MUTED;

  return (
    <V2InternalShell
      title="Curva ABC de clientes"
      eyebrow="Relatórios"
      description="Melhores clientes por cidade, classificados por receita."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/v3/relatorios">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Relatórios
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={topN} onValueChange={(v) => setTopN(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Top 5 por cidade</SelectItem>
            <SelectItem value="10">Top 10 por cidade</SelectItem>
            <SelectItem value="all">Todos por cidade</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar cidade, UF ou cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="p-8 text-center" style={{ color: V2.MUTED }}>Carregando…</div>
      ) : cidades.length === 0 ? (
        <div
          className="p-8 text-center rounded-2xl border"
          style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}
        >
          Sem vendas com cliente vinculado no período.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <Kpi label="Receita total" value={brl(totals.receita)} icon={<TrendingUp className="h-4 w-4" />} />
            <Kpi label="Pedidos" value={totals.pedidos.toLocaleString("pt-BR")} />
            <Kpi label="Clientes distintos" value={String(totals.clientes)} icon={<Users className="h-4 w-4" />} />
            <Kpi label="Cidades" value={String(totals.cidades)} icon={<MapPin className="h-4 w-4" />} />
          </div>

          <div className="space-y-4">
            {filtered.map((c) => {
              const list = c.clientes.slice(0, limit);
              return (
                <div
                  key={`${c.cidade}-${c.estado}`}
                  className="rounded-2xl border overflow-hidden"
                  style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
                >
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b"
                    style={{ borderColor: V2.GRAPHITE, background: V2.GRAPHITE }}
                  >
                    <div className="flex items-center gap-2" style={{ color: V2.TEXT }}>
                      <MapPin className="h-4 w-4" style={{ color: V2.TEAL }} />
                      <span className="font-semibold">{c.cidade}</span>
                      {c.estado && <span className="text-xs" style={{ color: V2.MUTED }}>{c.estado}</span>}
                    </div>
                    <div className="text-sm flex items-center gap-4" style={{ color: V2.MUTED }}>
                      <span>{c.clientes.length} cliente{c.clientes.length === 1 ? "" : "s"}</span>
                      <span>{c.totalPedidos} pedido{c.totalPedidos === 1 ? "" : "s"}</span>
                      <span className="font-semibold" style={{ color: V2.TEXT }}>{brl(c.totalReceita)}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ color: V2.MUTED }}>
                          <th className="p-3 text-left">#</th>
                          <th className="p-3 text-left">Cliente</th>
                          <th className="p-3 text-right">Pedidos</th>
                          <th className="p-3 text-right">Ticket médio</th>
                          <th className="p-3 text-right">Receita</th>
                          <th className="p-3 text-right">% cidade</th>
                          <th className="p-3 text-right">% acum.</th>
                          <th className="p-3 text-center">Classe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((r, i) => (
                          <tr key={r.company_id} className="border-t" style={{ borderColor: V2.GRAPHITE }}>
                            <td className="p-3" style={{ color: V2.MUTED }}>{i + 1}</td>
                            <td className="p-3" style={{ color: V2.TEXT }}>{r.nome}</td>
                            <td className="p-3 text-right">{r.pedidos}</td>
                            <td className="p-3 text-right">{brl(r.ticket)}</td>
                            <td className="p-3 text-right font-semibold" style={{ color: V2.TEXT }}>{brl(r.receita)}</td>
                            <td className="p-3 text-right">{r.pctCidade.toFixed(1)}%</td>
                            <td className="p-3 text-right">{r.pctAcumCidade.toFixed(1)}%</td>
                            <td className="p-3 text-center">
                              <span
                                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold text-white"
                                style={{ background: classeColor(r.classe) }}
                              >
                                {r.classe}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {c.clientes.length > list.length && (
                          <tr>
                            <td colSpan={8} className="p-3 text-center text-xs" style={{ color: V2.MUTED }}>
                              +{c.clientes.length - list.length} cliente{c.clientes.length - list.length === 1 ? "" : "s"} não exibido{c.clientes.length - list.length === 1 ? "" : "s"} — mude o filtro para ver mais.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm" style={{ color: V2.MUTED }}>
                Nenhuma cidade/cliente corresponde à busca.
              </div>
            )}
          </div>
        </>
      )}
    </V2InternalShell>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
      <div className="flex items-center gap-2 text-xs mb-1" style={{ color: V2.MUTED }}>
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold" style={{ color: V2.TEXT }}>{value}</div>
    </div>
  );
}
