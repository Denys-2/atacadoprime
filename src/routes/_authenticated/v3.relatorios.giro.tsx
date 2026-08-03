import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Package, AlertTriangle, TrendingDown, TrendingUp, Boxes } from "lucide-react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/v3/relatorios/giro")({
  head: () => ({ meta: [{ title: "Giro de estoque — Prime Automotive" }] }),
  component: GiroPage,
});

type Period = "30d" | "60d" | "90d" | "180d" | "365d";
const PERIOD_LABEL: Record<Period, string> = {
  "30d": "Últimos 30 dias",
  "60d": "Últimos 60 dias",
  "90d": "Últimos 90 dias",
  "180d": "Últimos 6 meses",
  "365d": "Últimos 12 meses",
};
const PERIOD_DAYS: Record<Period, number> = { "30d": 30, "60d": 60, "90d": 90, "180d": 180, "365d": 365 };

type Row = {
  product_id: string;
  nome: string;
  sku: string | null;
  estoque: number;
  custoUnit: number;
  precoUnit: number;
  vendidoQtd: number;
  vendidoReceita: number;
  capitalParado: number;
  giro: number; // vezes no período
  diasCobertura: number | null; // null = infinito (sem venda)
  status: "PARADO" | "LENTO" | "SAUDAVEL" | "RAPIDO" | "RUPTURA";
};

function statusMeta(s: Row["status"]) {
  switch (s) {
    case "PARADO": return { label: "Parado", color: "#6b7280", help: "Zero vendas no período" };
    case "LENTO": return { label: "Lento", color: "#d97706", help: "Cobertura > 180 dias" };
    case "SAUDAVEL": return { label: "Saudável", color: V2.TEAL, help: "Cobertura 30–180 dias" };
    case "RAPIDO": return { label: "Rápido", color: "#0ea5e9", help: "Cobertura < 30 dias — repor logo" };
    case "RUPTURA": return { label: "Ruptura", color: "#dc2626", help: "Estoque zerado com histórico de venda" };
  }
}

function GiroPage() {
  const [period, setPeriod] = useState<Period>("90d");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | Row["status"]>("todos");

  const startISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PERIOD_DAYS[period]);
    return d.toISOString();
  }, [period]);

  const { data: products = [], isLoading: loadingP } = useQuery({
    queryKey: ["giro-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, sku, estoque, preco_custo, preco_unitario, status")
        .eq("status", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sales = [], isLoading: loadingS } = useQuery({
    queryKey: ["giro-sales", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("product_id, quantidade, preco_final, orders!inner(status,created_at)")
        .neq("orders.status", "CANCELADO")
        .gte("orders.created_at", startISO);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { rows, totals } = useMemo(() => {
    const salesMap = new Map<string, { qtd: number; receita: number }>();
    for (const it of sales as any[]) {
      const pid = it.product_id as string;
      const cur = salesMap.get(pid) || { qtd: 0, receita: 0 };
      cur.qtd += Number(it.quantidade) || 0;
      cur.receita += (Number(it.quantidade) || 0) * (Number(it.preco_final) || 0);
      salesMap.set(pid, cur);
    }

    const days = PERIOD_DAYS[period];
    const arr: Row[] = (products as any[]).map((p) => {
      const s = salesMap.get(p.id) || { qtd: 0, receita: 0 };
      const estoque = Number(p.estoque) || 0;
      const custo = Number(p.preco_custo) || 0;
      const vendaDia = s.qtd / days;
      const diasCobertura = vendaDia > 0 ? estoque / vendaDia : null;
      // Estoque médio aproximado: estoque atual + metade do vendido no período
      const estoqueMedio = estoque + s.qtd / 2;
      const giro = estoqueMedio > 0 ? s.qtd / estoqueMedio : 0;

      let status: Row["status"];
      if (s.qtd === 0) status = "PARADO";
      else if (estoque === 0) status = "RUPTURA";
      else if (diasCobertura !== null && diasCobertura < 30) status = "RAPIDO";
      else if (diasCobertura !== null && diasCobertura > 180) status = "LENTO";
      else status = "SAUDAVEL";

      return {
        product_id: p.id,
        nome: p.nome,
        sku: p.sku,
        estoque,
        custoUnit: custo,
        precoUnit: Number(p.preco_unitario) || 0,
        vendidoQtd: s.qtd,
        vendidoReceita: s.receita,
        capitalParado: estoque * custo,
        giro,
        diasCobertura,
        status,
      };
    });

    // ordena: PARADO (com capital parado) primeiro, depois LENTO, depois demais por cobertura desc
    arr.sort((a, b) => {
      const order: Record<Row["status"], number> = { PARADO: 0, LENTO: 1, RUPTURA: 2, SAUDAVEL: 3, RAPIDO: 4 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.capitalParado - a.capitalParado;
    });

    const grupos = arr.reduce(
      (acc, r) => {
        acc[r.status].count += 1;
        acc[r.status].capital += r.capitalParado;
        acc[r.status].receita += r.vendidoReceita;
        return acc;
      },
      {
        PARADO: { count: 0, capital: 0, receita: 0 },
        LENTO: { count: 0, capital: 0, receita: 0 },
        SAUDAVEL: { count: 0, capital: 0, receita: 0 },
        RAPIDO: { count: 0, capital: 0, receita: 0 },
        RUPTURA: { count: 0, capital: 0, receita: 0 },
      },
    );

    const capitalTotal = arr.reduce((s, r) => s + r.capitalParado, 0);
    const receitaTotal = arr.reduce((s, r) => s + r.vendidoReceita, 0);
    const skus = arr.length;

    return {
      rows: arr,
      totals: { capitalTotal, receitaTotal, skus, grupos },
    };
  }, [products, sales, period]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (statusFilter !== "todos") out = out.filter((r) => r.status === statusFilter);
    if (q) out = out.filter((r) => r.nome.toLowerCase().includes(q) || (r.sku || "").toLowerCase().includes(q));
    return out;
  }, [rows, search, statusFilter]);

  const isLoading = loadingP || loadingS;

  return (
    <V2InternalShell
      title="Giro de estoque"
      eyebrow="Relatórios"
      description="Identifique produtos parados, capital empatado e itens que precisam de reposição."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/v3/relatorios">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Relatórios</Button>
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
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="PARADO">Parado</SelectItem>
            <SelectItem value="LENTO">Lento</SelectItem>
            <SelectItem value="SAUDAVEL">Saudável</SelectItem>
            <SelectItem value="RAPIDO">Rápido</SelectItem>
            <SelectItem value="RUPTURA">Ruptura</SelectItem>
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
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <Kpi label="Capital em estoque" value={brl(totals.capitalTotal)} icon={<Boxes className="h-4 w-4" />} />
            <Kpi label="Receita no período" value={brl(totals.receitaTotal)} icon={<TrendingUp className="h-4 w-4" />} />
            <Kpi label="SKUs ativos" value={String(totals.skus)} icon={<Package className="h-4 w-4" />} />
            <Kpi
              label="Capital parado"
              value={brl(totals.grupos.PARADO.capital + totals.grupos.LENTO.capital)}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
            {(["PARADO", "LENTO", "SAUDAVEL", "RAPIDO", "RUPTURA"] as const).map((s) => {
              const m = statusMeta(s);
              const g = totals.grupos[s];
              return (
                <div key={s} className="rounded-2xl border p-4" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: m.color }} />
                    <div className="text-sm font-semibold" style={{ color: V2.TEXT }}>{m.label}</div>
                  </div>
                  <div className="text-lg font-bold" style={{ color: V2.TEXT }}>{g.count}</div>
                  <div className="text-xs" style={{ color: V2.MUTED }}>{brl(g.capital)} parado</div>
                  <div className="mt-2 text-xs" style={{ color: V2.MUTED }}>{m.help}</div>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: V2.GRAPHITE, color: V2.TEXT }}>
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-right">Estoque</th>
                  <th className="p-3 text-right">Vendido</th>
                  <th className="p-3 text-right">Receita</th>
                  <th className="p-3 text-right">Capital parado</th>
                  <th className="p-3 text-right">Giro</th>
                  <th className="p-3 text-right">Cobertura</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const m = statusMeta(r.status);
                  return (
                    <tr key={r.product_id} className="border-t" style={{ borderColor: V2.GRAPHITE }}>
                      <td className="p-3" style={{ color: V2.TEXT }}>{r.nome}</td>
                      <td className="p-3" style={{ color: V2.MUTED }}>{r.sku || "—"}</td>
                      <td className="p-3 text-right">{r.estoque}</td>
                      <td className="p-3 text-right">{r.vendidoQtd}</td>
                      <td className="p-3 text-right">{brl(r.vendidoReceita)}</td>
                      <td className="p-3 text-right">{brl(r.capitalParado)}</td>
                      <td className="p-3 text-right">{r.giro.toFixed(2)}x</td>
                      <td className="p-3 text-right">
                        {r.diasCobertura === null ? "—" : `${Math.round(r.diasCobertura)} d`}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                          style={{ background: m.color }}
                        >
                          {m.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center" style={{ color: V2.MUTED }}>
                      Nenhum produto encontrado com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div
            className="mt-4 rounded-2xl border p-4 text-xs"
            style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}
          >
            <div className="flex items-center gap-2 mb-2" style={{ color: V2.TEXT }}>
              <TrendingDown className="h-4 w-4" />
              <strong>Como lemos os números</strong>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Giro</b> = vendas do período ÷ estoque médio (estoque atual + metade do vendido). Quanto maior, mais rápido o produto rotaciona.</li>
              <li><b>Cobertura</b> = estoque atual ÷ venda média diária. Diz quantos dias o estoque atual dura no ritmo atual de venda.</li>
              <li><b>Capital parado</b> = estoque × preço de custo. É quanto dinheiro está imobilizado naquele SKU.</li>
              <li><b>Status</b>: Parado (0 vendas), Lento (&gt; 180 d de cobertura), Saudável (30–180 d), Rápido (&lt; 30 d — repor logo), Ruptura (estoque 0 com histórico de venda).</li>
            </ul>
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
