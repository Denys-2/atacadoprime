import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Package, Printer, TrendingUp } from "lucide-react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/v3/relatorios/abc")({
  head: () => ({ meta: [{ title: "Curva ABC — Prime Automotive" }] }),
  component: AbcReportPage,
});

type Row = {
  product_id: string;
  nome: string;
  sku: string | null;
  quantidade: number;
  receita: number;
  custo: number;
  margem: number;
  pctReceita: number;
  pctAcum: number;
  classe: "A" | "B" | "C";
};

type Period = "7d" | "30d" | "90d" | "180d" | "365d" | "all";

const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Últimos 7 dias",
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

function AbcReportPage() {
  const [period, setPeriod] = useState<Period>("90d");
  const [search, setSearch] = useState("");
  const [criteria, setCriteria] = useState<"receita" | "quantidade" | "margem">("receita");

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["abc-report", period],
    queryFn: async () => {
      const start = periodStart(period);
      let q = supabase
        .from("order_items")
        .select("product_id, quantidade, preco_final, custo_unitario, orders!inner(status,created_at), products(nome,sku)")
        .neq("orders.status", "CANCELADO");
      if (start) q = q.gte("orders.created_at", start);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { rows, totals } = useMemo(() => {
    const map = new Map<string, Row>();
    for (const it of raw as any[]) {
      const pid = it.product_id as string;
      const qtd = Number(it.quantidade) || 0;
      const preco = Number(it.preco_final) || 0;
      const custo = Number(it.custo_unitario) || 0;
      const cur = map.get(pid) || {
        product_id: pid,
        nome: it.products?.nome || "—",
        sku: it.products?.sku || null,
        quantidade: 0,
        receita: 0,
        custo: 0,
        margem: 0,
        pctReceita: 0,
        pctAcum: 0,
        classe: "C" as const,
      };
      cur.quantidade += qtd;
      cur.receita += qtd * preco;
      cur.custo += qtd * custo;
      map.set(pid, cur);
    }
    const arr = Array.from(map.values()).map((r) => ({ ...r, margem: r.receita - r.custo }));

    const getKey = (r: Row) => (criteria === "receita" ? r.receita : criteria === "quantidade" ? r.quantidade : r.margem);
    arr.sort((a, b) => getKey(b) - getKey(a));

    const totalCrit = arr.reduce((s, r) => s + Math.max(getKey(r), 0), 0);
    let acum = 0;
    for (const r of arr) {
      const v = Math.max(getKey(r), 0);
      const pct = totalCrit > 0 ? (v / totalCrit) * 100 : 0;
      acum += pct;
      r.pctReceita = pct;
      r.pctAcum = acum;
      r.classe = acum <= 80 ? "A" : acum <= 95 ? "B" : "C";
    }

    const totRec = arr.reduce((s, r) => s + r.receita, 0);
    const totCusto = arr.reduce((s, r) => s + r.custo, 0);
    const totQtd = arr.reduce((s, r) => s + r.quantidade, 0);
    const skus = arr.length;
    const grupos = arr.reduce(
      (acc, r) => {
        acc[r.classe].count += 1;
        acc[r.classe].receita += r.receita;
        acc[r.classe].quantidade += r.quantidade;
        acc[r.classe].margem += r.margem;
        return acc;
      },
      {
        A: { count: 0, receita: 0, quantidade: 0, margem: 0 },
        B: { count: 0, receita: 0, quantidade: 0, margem: 0 },
        C: { count: 0, receita: 0, quantidade: 0, margem: 0 },
      },
    );

    return {
      rows: arr,
      totals: { receita: totRec, custo: totCusto, quantidade: totQtd, margem: totRec - totCusto, skus, grupos },
    };
  }, [raw, criteria]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.nome.toLowerCase().includes(q) || (r.sku || "").toLowerCase().includes(q));
  }, [rows, search]);

  const classeColor = (c: "A" | "B" | "C") =>
    c === "A" ? V2.TEAL : c === "B" ? V2.TEAL_DARK : V2.MUTED;


  return (
    <V2InternalShell
      title="Curva ABC de produtos"
      eyebrow="Relatórios"
      description="Classificação das peças mais vendidas por receita, quantidade ou margem."
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
        <Select value={criteria} onValueChange={(v) => setCriteria(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="receita">Classificar por receita</SelectItem>
            <SelectItem value="quantidade">Classificar por quantidade</SelectItem>
            <SelectItem value="margem">Classificar por margem</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar produto ou SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="p-8 text-center" style={{ color: V2.MUTED }}>Carregando…</div>
      ) : rows.length === 0 ? (
        <div
          className="p-8 text-center rounded-2xl border"
          style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}
        >
          Sem vendas no período selecionado.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <Kpi label="Receita total" value={brl(totals.receita)} icon={<TrendingUp className="h-4 w-4" />} />
            <Kpi label="Itens vendidos" value={totals.quantidade.toLocaleString("pt-BR")} icon={<Package className="h-4 w-4" />} />
            <Kpi label="Margem bruta" value={brl(totals.margem)} />
            <Kpi label="SKUs distintos" value={String(totals.skus)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            {(["A", "B", "C"] as const).map((c) => {
              const g = totals.grupos[c];
              const pct = totals.receita > 0 ? (g.receita / totals.receita) * 100 : 0;
              const help =
                c === "A"
                  ? "Top ~80% do critério — foque atenção, estoque e negociação"
                  : c === "B"
                  ? "Próximos ~15% — importantes, revisar mix"
                  : "Últimos ~5% — avaliar descontinuar ou reduzir compra";
              return (
                <div
                  key={c}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full font-bold text-white"
                      style={{ background: classeColor(c) }}
                    >
                      {c}
                    </span>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: V2.TEXT }}>Classe {c}</div>
                      <div className="text-xs" style={{ color: V2.MUTED }}>{g.count} SKU{g.count === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold" style={{ color: V2.TEXT }}>{brl(g.receita)}</div>
                  <div className="text-xs" style={{ color: V2.MUTED }}>{pct.toFixed(1)}% da receita · {g.quantidade} un</div>
                  <div className="mt-2 text-xs" style={{ color: V2.MUTED }}>{help}</div>
                </div>
              );
            })}
          </div>

          <div
            className="overflow-x-auto rounded-2xl border"
            style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: V2.GRAPHITE, color: V2.TEXT }}>
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-right">Qtd</th>
                  <th className="p-3 text-right">Receita</th>
                  <th className="p-3 text-right">Margem</th>
                  <th className="p-3 text-right">% {criteria}</th>
                  <th className="p-3 text-right">% acum.</th>
                  <th className="p-3 text-center">Classe</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.product_id} className="border-t" style={{ borderColor: V2.GRAPHITE }}>
                    <td className="p-3" style={{ color: V2.MUTED }}>{i + 1}</td>
                    <td className="p-3" style={{ color: V2.TEXT }}>{r.nome}</td>
                    <td className="p-3" style={{ color: V2.MUTED }}>{r.sku || "—"}</td>
                    <td className="p-3 text-right">{r.quantidade}</td>
                    <td className="p-3 text-right">{brl(r.receita)}</td>
                    <td className="p-3 text-right">{brl(r.margem)}</td>
                    <td className="p-3 text-right">{r.pctReceita.toFixed(1)}%</td>
                    <td className="p-3 text-right">{r.pctAcum.toFixed(1)}%</td>
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center" style={{ color: V2.MUTED }}>
                      Nenhum produto encontrado com esse filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
