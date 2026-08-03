import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck, TrendingUp, TrendingDown, Receipt, Package, Printer } from "lucide-react";
import { brl, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/v3/relatorios/viagem")({
  head: () => ({ meta: [{ title: "Relatório de viagem — Prime Automotive" }] }),
  component: TripReportPage,
});

type TripOption = {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

type ItemRow = {
  product_id: string;
  nome: string;
  sku: string | null;
  quantidade: number;
  preco_final: number;
  custo_unitario: number;
  receita: number;
  custo: number;
  margem: number;
  margemPct: number;
};

type ExpenseRow = {
  id: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  data: string;
};

function TripReportPage() {
  const [tripId, setTripId] = useState<string>("");

  const { data: trips = [] } = useQuery({
    queryKey: ["trip-report-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("id,nome,cidade,estado,status,opened_at,closed_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as TripOption[];
    },
  });

  const trip = trips.find((t) => t.id === tripId) || null;

  const { data: itemsRaw = [], isLoading: loadingItems } = useQuery({
    queryKey: ["trip-report-items", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("product_id, quantidade, preco_final, custo_unitario, orders!inner(trip_id,status), products(nome,sku)")
        .eq("orders.trip_id", tripId)
        .neq("orders.status", "CANCELADO");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ordersTotals = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["trip-report-orders", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,total,status")
        .eq("trip_id", tripId)
        .neq("status", "CANCELADO");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["trip-report-expenses", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_expenses")
        .select("id,categoria,descricao,valor,data")
        .eq("trip_id", tripId)
        .order("valor", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
  });

  const items: ItemRow[] = useMemo(() => {
    const map = new Map<string, ItemRow>();
    for (const it of itemsRaw as any[]) {
      const pid = it.product_id as string;
      const qtd = Number(it.quantidade) || 0;
      const preco = Number(it.preco_final) || 0;
      const custo = Number(it.custo_unitario) || 0;
      const cur = map.get(pid) || {
        product_id: pid,
        nome: it.products?.nome || "—",
        sku: it.products?.sku || null,
        quantidade: 0,
        preco_final: preco,
        custo_unitario: custo,
        receita: 0,
        custo: 0,
        margem: 0,
        margemPct: 0,
      };
      cur.quantidade += qtd;
      cur.receita += qtd * preco;
      cur.custo += qtd * custo;
      map.set(pid, cur);
    }
    const arr = Array.from(map.values()).map((r) => {
      r.margem = r.receita - r.custo;
      r.margemPct = r.receita > 0 ? (r.margem / r.receita) * 100 : 0;
      return r;
    });
    arr.sort((a, b) => b.receita - a.receita);
    return arr;
  }, [itemsRaw]);

  const totals = useMemo(() => {
    // Receita real = soma de orders.total (líquido de descontos, com frete/acréscimos)
    const receita = (ordersTotals as any[]).reduce((s, o) => s + Number(o.total || 0), 0);
    const custo = items.reduce((s, i) => s + i.custo, 0);
    const margem = receita - custo;
    const despesas = expenses.reduce((s, e) => s + Number(e.valor || 0), 0);
    const liquido = margem - despesas;
    const margemPct = receita > 0 ? (margem / receita) * 100 : 0;
    const despesasPct = receita > 0 ? (despesas / receita) * 100 : 0;
    const liquidoPct = receita > 0 ? (liquido / receita) * 100 : 0;
    const qtdVendida = items.reduce((s, i) => s + i.quantidade, 0);
    return { receita, custo, margem, despesas, liquido, margemPct, despesasPct, liquidoPct, qtdVendida };
  }, [items, expenses, ordersTotals]);


  const isLoading = loadingItems || loadingExpenses || loadingOrders;

  return (
    <V2InternalShell
      title="Relatório de viagem"
      eyebrow="Relatórios"
      description="Selecione uma viagem para ver produtos, custos, despesas e resultado líquido."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/v3/relatorios">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
        <div className="min-w-[260px] flex-1 max-w-md">
          <Select value={tripId} onValueChange={setTripId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha a viagem…" />
            </SelectTrigger>
            <SelectContent>
              {trips.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome} {t.cidade ? `— ${t.cidade}${t.estado ? "/" + t.estado : ""}` : ""}{" "}
                  {t.status === "open" ? "· ABERTA" : "· ENCERRADA"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tripId && (
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        )}
      </div>

      {!tripId && (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}
        >
          <Truck className="mx-auto h-10 w-10 mb-2 opacity-40" />
          Escolha uma viagem no seletor acima para gerar o relatório.
        </div>
      )}

      {tripId && trip && (
        <div className="space-y-4">
          {/* Header */}
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
          >
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider" style={{ color: V2.MUTED }}>
                  Viagem
                </div>
                <div className="text-lg font-semibold" style={{ color: V2.TEXT }}>
                  {trip.nome}
                </div>
                <div className="text-sm" style={{ color: V2.MUTED }}>
                  {trip.cidade ? `${trip.cidade}${trip.estado ? "/" + trip.estado : ""} · ` : ""}
                  Aberta {formatDate(trip.opened_at)}
                  {trip.closed_at ? ` · Encerrada ${formatDate(trip.closed_at)}` : " · em andamento"}
                </div>
              </div>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{
                  background: trip.status === "open" ? "#10B98122" : "#6B728022",
                  color: trip.status === "open" ? "#059669" : "#4B5563",
                }}
              >
                {trip.status === "open" ? "ABERTA" : "ENCERRADA"}
              </span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Receita (vendas)"
              value={brl(totals.receita)}
              hint={`${totals.qtdVendida} un vendidas`}
              color={V2.TEAL}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <Kpi
              label="Custo das peças"
              value={brl(totals.custo)}
              hint={`Margem bruta ${brl(totals.margem)} (${totals.margemPct.toFixed(1)}%)`}
              color="#6366F1"
              icon={<Package className="h-5 w-5" />}
            />
            <Kpi
              label="Despesas da viagem"
              value={brl(totals.despesas)}
              hint={`${totals.despesasPct.toFixed(1)}% da receita`}
              color="#EF4444"
              icon={<Receipt className="h-5 w-5" />}
            />
            <Kpi
              label={totals.liquido >= 0 ? "Lucro líquido" : "Prejuízo"}
              value={brl(totals.liquido)}
              hint={`${totals.liquidoPct.toFixed(1)}% da receita`}
              color={totals.liquido >= 0 ? "#10B981" : "#EF4444"}
              icon={totals.liquido >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              highlight
            />
          </div>

          {/* Verdict */}
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: totals.liquido >= 0 ? "#10B98155" : "#EF444455",
              background: totals.liquido >= 0 ? "#10B98111" : "#EF444411",
            }}
          >
            <div className="text-sm" style={{ color: V2.TEXT }}>
              <strong>Resultado:</strong>{" "}
              {isLoading ? (
                "Calculando…"
              ) : totals.receita === 0 ? (
                "Nenhuma venda registrada nesta viagem ainda."
              ) : totals.liquido >= 0 ? (
                <>
                  Viagem <span style={{ color: "#059669" }}>LUCRATIVA</span>. Você faturou{" "}
                  {brl(totals.receita)}, gastou {brl(totals.custo)} em peças e {brl(totals.despesas)} em
                  despesas, sobrando <strong>{brl(totals.liquido)}</strong> ({totals.liquidoPct.toFixed(1)}%).
                </>
              ) : (
                <>
                  Viagem com <span style={{ color: "#DC2626" }}>PREJUÍZO</span> de{" "}
                  <strong>{brl(Math.abs(totals.liquido))}</strong>. As despesas ({brl(totals.despesas)})
                  superaram a margem bruta ({brl(totals.margem)}).
                </>
              )}
            </div>
          </div>

          {/* Produtos vendidos */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
          >
            <div className="p-3 border-b" style={{ borderColor: V2.GRAPHITE }}>
              <div className="font-semibold" style={{ color: V2.TEXT }}>
                Produtos vendidos ({items.length})
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: `${V2.MUTED}11` }}>
                  <tr className="text-left" style={{ color: V2.MUTED }}>
                    <th className="p-3">Produto</th>
                    <th className="p-3 text-right">Qtd</th>
                    <th className="p-3 text-right">Custo un.</th>
                    <th className="p-3 text-right">Venda un.</th>
                    <th className="p-3 text-right">Receita</th>
                    <th className="p-3 text-right">Custo tot.</th>
                    <th className="p-3 text-right">Margem</th>
                    <th className="p-3 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center" style={{ color: V2.MUTED }}>
                        Carregando…
                      </td>
                    </tr>
                  )}
                  {!isLoading && items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center" style={{ color: V2.MUTED }}>
                        Nenhuma venda nesta viagem.
                      </td>
                    </tr>
                  )}
                  {items.map((r) => (
                    <tr key={r.product_id} className="border-t" style={{ borderColor: V2.GRAPHITE }}>
                      <td className="p-3">
                        <div style={{ color: V2.TEXT }}>{r.nome}</div>
                        {r.sku && <div className="text-xs" style={{ color: V2.MUTED }}>{r.sku}</div>}
                      </td>
                      <td className="p-3 text-right">{r.quantidade}</td>
                      <td className="p-3 text-right">{brl(r.custo_unitario)}</td>
                      <td className="p-3 text-right">{brl(r.preco_final)}</td>
                      <td className="p-3 text-right">{brl(r.receita)}</td>
                      <td className="p-3 text-right">{brl(r.custo)}</td>
                      <td
                        className="p-3 text-right font-medium"
                        style={{ color: r.margem >= 0 ? "#059669" : "#DC2626" }}
                      >
                        {brl(r.margem)}
                      </td>
                      <td
                        className="p-3 text-right"
                        style={{ color: r.margemPct >= 0 ? "#059669" : "#DC2626" }}
                      >
                        {r.margemPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr className="border-t font-semibold" style={{ borderColor: V2.GRAPHITE, background: `${V2.MUTED}11` }}>
                      <td className="p-3" style={{ color: V2.TEXT }}>Total</td>
                      <td className="p-3 text-right">{totals.qtdVendida}</td>
                      <td className="p-3"></td>
                      <td className="p-3"></td>
                      <td className="p-3 text-right">{brl(totals.receita)}</td>
                      <td className="p-3 text-right">{brl(totals.custo)}</td>
                      <td className="p-3 text-right" style={{ color: totals.margem >= 0 ? "#059669" : "#DC2626" }}>
                        {brl(totals.margem)}
                      </td>
                      <td className="p-3 text-right" style={{ color: totals.margemPct >= 0 ? "#059669" : "#DC2626" }}>
                        {totals.margemPct.toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Despesas */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
          >
            <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: V2.GRAPHITE }}>
              <div className="font-semibold" style={{ color: V2.TEXT }}>
                Despesas da viagem ({expenses.length})
              </div>
              <div className="text-sm" style={{ color: V2.MUTED }}>
                Total: <strong style={{ color: V2.TEXT }}>{brl(totals.despesas)}</strong>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: `${V2.MUTED}11` }}>
                  <tr className="text-left" style={{ color: V2.MUTED }}>
                    <th className="p-3">Data</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-right">% receita</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center" style={{ color: V2.MUTED }}>
                        Nenhuma despesa lançada.
                      </td>
                    </tr>
                  )}
                  {expenses.map((e) => {
                    const pct = totals.receita > 0 ? (Number(e.valor) / totals.receita) * 100 : 0;
                    return (
                      <tr key={e.id} className="border-t" style={{ borderColor: V2.GRAPHITE }}>
                        <td className="p-3">{formatDate(e.data)}</td>
                        <td className="p-3">{e.categoria}</td>
                        <td className="p-3" style={{ color: V2.MUTED }}>{e.descricao || "—"}</td>
                        <td className="p-3 text-right font-medium">{brl(Number(e.valor))}</td>
                        <td className="p-3 text-right" style={{ color: V2.MUTED }}>{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </V2InternalShell>
  );
}

function Kpi({
  label,
  value,
  hint,
  color,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: highlight ? color : V2.GRAPHITE,
        background: highlight ? `${color}11` : V2.SURFACE,
        borderWidth: highlight ? 2 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase tracking-wider" style={{ color: V2.MUTED }}>
          {label}
        </div>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="text-2xl font-bold" style={{ color: V2.TEXT }}>
        {value}
      </div>
      {hint && (
        <div className="text-xs mt-1" style={{ color: V2.MUTED }}>
          {hint}
        </div>
      )}
    </div>
  );
}
