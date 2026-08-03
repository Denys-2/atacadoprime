import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, TrendingUp, TrendingDown, DollarSign, Package, Wallet } from "lucide-react";
import { brl } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/v3/relatorios/resultado")({
  head: () => ({ meta: [{ title: "Resultado do período — Prime Automotive" }] }),
  component: ResultadoPage,
});

type Periodo = "hoje" | "7d" | "30d" | "mes" | "mes_ant" | "ano" | "custom";

function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function rangeFor(p: Periodo, from: string, to: string): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endPrev = new Date(today.getFullYear(), today.getMonth(), 0);
  const startYear = new Date(today.getFullYear(), 0, 1);
  const d7 = new Date(today); d7.setDate(d7.getDate() - 6);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
  switch (p) {
    case "hoje": return { from: isoDay(today), to: isoDay(today) };
    case "7d": return { from: isoDay(d7), to: isoDay(today) };
    case "30d": return { from: isoDay(d30), to: isoDay(today) };
    case "mes": return { from: isoDay(startMonth), to: isoDay(endMonth) };
    case "mes_ant": return { from: isoDay(startPrev), to: isoDay(endPrev) };
    case "ano": return { from: isoDay(startYear), to: isoDay(today) };
    case "custom": return { from, to };
  }
}

type OrderAgg = {
  id: string;
  created_at: string;
  status: string;
  total: number;
  order_items: { quantidade: number; custo_unitario: number | null; preco_final: number | null; subtotal: number | null }[];
};

function ResultadoPage() {
  
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const today = isoDay(new Date());
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const range = useMemo(() => rangeFor(periodo, from, to), [periodo, from, to]);




  const { data, isLoading } = useQuery({
    queryKey: ["resultado-report", range.from, range.to],
    queryFn: async () => {
      const startISO = new Date(range.from + "T00:00:00").toISOString();
      const endISO = new Date(range.to + "T23:59:59.999").toISOString();

      const [ordersRes, tripExpRes, finTxRes, finEntRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id,created_at,status,total,order_items(quantidade,custo_unitario,preco_final,subtotal)")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .neq("status", "CANCELADO"),
        supabase
          .from("trip_expenses")
          .select("id,data,valor,categoria,descricao")
          .gte("data", range.from)
          .lte("data", range.to),
        supabase
          .from("financial_transactions")
          .select("id,tipo,valor,status,descricao,pagamento,vencimento,order_id")
          .eq("tipo", "DESPESA")
          .gte("created_at", startISO)
          .lte("created_at", endISO),
        supabase
          .from("financial_entries")
          .select("id,tipo,valor,data,descricao")
          .eq("tipo", "DESPESA")
          .gte("data", range.from)
          .lte("data", range.to),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (tripExpRes.error) throw tripExpRes.error;
      if (finTxRes.error) throw finTxRes.error;
      if (finEntRes.error) throw finEntRes.error;

      return {
        orders: (ordersRes.data ?? []) as unknown as OrderAgg[],
        tripExpenses: (tripExpRes.data ?? []) as Array<{ id: string; data: string; valor: number; categoria: string | null; descricao: string | null }>,
        finTx: (finTxRes.data ?? []) as Array<{ id: string; valor: number; descricao: string | null; order_id: string | null }>,
        finEnt: (finEntRes.data ?? []) as Array<{ id: string; valor: number; descricao: string | null; data: string }>,
      };
    },
  });

  const calc = useMemo(() => {
    const orders = data?.orders ?? [];
    const receita = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const custoPecas = orders.reduce(
      (s, o) => s + (o.order_items || []).reduce((a, i) => a + Number(i.quantidade || 0) * Number(i.custo_unitario || 0), 0),
      0,
    );
    const pedidos = orders.length;

    const despViagem = (data?.tripExpenses ?? []).reduce((s, e) => s + Number(e.valor || 0), 0);

    // Despesas do financeiro — exclui as linhas "Custos das peças/custo peças" para não duplicar com custoPecas
    const isCogsLine = (d?: string | null) => !!d && /custo.*pe[çc]a/i.test(d);
    const despFinanceiro = (data?.finTx ?? []).filter((t) => !isCogsLine(t.descricao)).reduce((s, t) => s + Number(t.valor || 0), 0);
    const despLancadas = (data?.finEnt ?? []).reduce((s, e) => s + Number(e.valor || 0), 0);

    const despesasOperacionais = despViagem + despFinanceiro + despLancadas;
    const custoTotal = custoPecas + despesasOperacionais;
    const lucroBruto = receita - custoPecas;
    const resultado = receita - custoTotal;
    const margemBruta = receita > 0 ? (lucroBruto / receita) * 100 : 0;
    const margemLiquida = receita > 0 ? (resultado / receita) * 100 : 0;
    const pct = (n: number) => (receita > 0 ? (n / receita) * 100 : 0);

    return {
      receita, custoPecas, despViagem, despFinanceiro, despLancadas,
      despesasOperacionais, custoTotal, lucroBruto, resultado,
      margemBruta, margemLiquida, pedidos, pct,
    };
  }, [data]);


  const rangeLabel = `${range.from.split("-").reverse().join("/")} → ${range.to.split("-").reverse().join("/")}`;

  return (
    <V2InternalShell
      title="Resultado do período"
      eyebrow="Relatórios"
      description="Receita, custos, despesas e lucro líquido — com percentual de cada item sobre a venda total."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <Link to="/v3/relatorios">
            <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
          </Link>
        </div>
      }
    >
      {/* Filtros */}
      <div className="rounded-2xl border p-4 mb-4 flex flex-wrap items-end gap-3" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
        <div>
          <div className="text-xs mb-1" style={{ color: V2.MUTED }}>Período</div>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="mes_ant">Mês anterior</SelectItem>
              <SelectItem value="ano">Este ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodo === "custom" && (
          <>
            <div>
              <div className="text-xs mb-1" style={{ color: V2.MUTED }}>De</div>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: V2.MUTED }}>Até</div>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </>
        )}
        <div className="ml-auto text-xs" style={{ color: V2.MUTED }}>
          A reserva da empresa e a transferência ficam em{" "}
          <Link to="/v3/fechamento" className="underline" style={{ color: V2.TEAL }}>Fechamento</Link>.
        </div>
      </div>


      <div className="text-xs mb-3 px-1" style={{ color: V2.MUTED }}>
        {rangeLabel} · {calc.pedidos} pedidos
      </div>

      {isLoading ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}>
          Carregando...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
            <KpiCard label="Receita (vendas)" value={brl(calc.receita)} sub={`${calc.pedidos} pedidos`} icon={DollarSign} accent={V2.TEAL} />
            <KpiCard label="Custo das peças" value={brl(calc.custoPecas)} sub={`${calc.pct(calc.custoPecas).toFixed(1)}% da venda`} icon={Package} accent="#f59e0b" />
            <KpiCard label="Despesas operacionais" value={brl(calc.despesasOperacionais)} sub={`${calc.pct(calc.despesasOperacionais).toFixed(1)}% da venda`} icon={Wallet} accent="#ef4444" />
            <KpiCard
              label="Resultado líquido"
              value={brl(calc.resultado)}
              sub={`Margem ${calc.margemLiquida.toFixed(1)}%`}
              icon={calc.resultado >= 0 ? TrendingUp : TrendingDown}
              accent={calc.resultado >= 0 ? "#16a34a" : "#dc2626"}
            />
          </div>





          {/* Demonstrativo */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
            <div className="px-4 py-3 border-b font-semibold" style={{ borderColor: V2.GRAPHITE, color: V2.TEXT }}>
              Demonstrativo de resultado
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: V2.GRAPHITE, color: V2.MUTED }}>
                  <th className="px-4 py-2">Linha</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-right w-32">% da venda</th>
                </tr>
              </thead>
              <tbody>
                <RowLine label="(+) Receita bruta de vendas" valor={calc.receita} pct={100} bold />
                <RowLine label="(−) Custo das peças vendidas" valor={-calc.custoPecas} pct={-calc.pct(calc.custoPecas)} />
                <RowLine label="(=) Lucro bruto" valor={calc.lucroBruto} pct={calc.margemBruta} bold accent={calc.lucroBruto >= 0 ? "#16a34a" : "#dc2626"} />
                <RowLine label="(−) Despesas de viagem" valor={-calc.despViagem} pct={-calc.pct(calc.despViagem)} muted />
                <RowLine label="(−) Despesas financeiras/contas" valor={-calc.despFinanceiro} pct={-calc.pct(calc.despFinanceiro)} muted />
                <RowLine label="(−) Despesas lançadas manualmente" valor={-calc.despLancadas} pct={-calc.pct(calc.despLancadas)} muted />
                <RowLine label="(=) Total de despesas operacionais" valor={-calc.despesasOperacionais} pct={-calc.pct(calc.despesasOperacionais)} />
                <tr style={{ background: `${V2.TEAL}10` }}>
                  <td className="px-4 py-3 font-bold" style={{ color: V2.TEXT }}>(=) Resultado líquido</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: calc.resultado >= 0 ? "#16a34a" : "#dc2626" }}>{brl(calc.resultado)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: calc.resultado >= 0 ? "#16a34a" : "#dc2626" }}>{calc.margemLiquida.toFixed(1)}%</td>
                </tr>


              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoCard title="Composição do custo" >
              <Bar label="Custo das peças" value={calc.custoPecas} total={calc.receita} color="#f59e0b" />
              <Bar label="Despesas de viagem" value={calc.despViagem} total={calc.receita} color="#f97316" />
              <Bar label="Despesas financeiras" value={calc.despFinanceiro} total={calc.receita} color="#ef4444" />
              <Bar label="Despesas manuais" value={calc.despLancadas} total={calc.receita} color="#dc2626" />
            </InfoCard>
            <InfoCard title="Indicadores">
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: V2.GRAPHITE }}>
                <span style={{ color: V2.MUTED }}>Ticket médio</span>
                <span style={{ color: V2.TEXT }}>{brl(calc.pedidos ? calc.receita / calc.pedidos : 0)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: V2.GRAPHITE }}>
                <span style={{ color: V2.MUTED }}>Margem bruta</span>
                <span style={{ color: V2.TEXT }}>{calc.margemBruta.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: V2.GRAPHITE }}>
                <span style={{ color: V2.MUTED }}>Margem líquida</span>
                <span style={{ color: calc.margemLiquida >= 0 ? "#16a34a" : "#dc2626" }}>{calc.margemLiquida.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span style={{ color: V2.MUTED }}>Custo total / venda</span>
                <span style={{ color: V2.TEXT }}>{calc.pct(calc.custoTotal).toFixed(2)}%</span>
              </div>
            </InfoCard>
          </div>
        </>
      )}
    </V2InternalShell>
  );
}

function KpiCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: V2.MUTED }}>{label}</span>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}22`, color: accent }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color: V2.TEXT }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: V2.MUTED }}>{sub}</div>
    </div>
  );
}

function RowLine({ label, valor, pct, bold, muted, accent }: { label: string; valor: number; pct: number; bold?: boolean; muted?: boolean; accent?: string }) {
  return (
    <tr className="border-b" style={{ borderColor: V2.GRAPHITE }}>
      <td className="px-4 py-2" style={{ color: muted ? V2.MUTED : V2.TEXT, fontWeight: bold ? 600 : 400, paddingLeft: muted ? 24 : 16 }}>{label}</td>
      <td className="px-4 py-2 text-right" style={{ color: accent || (muted ? V2.MUTED : V2.TEXT), fontWeight: bold ? 600 : 400 }}>{brl(valor)}</td>
      <td className="px-4 py-2 text-right" style={{ color: accent || (muted ? V2.MUTED : V2.TEXT), fontWeight: bold ? 600 : 400 }}>{pct.toFixed(1)}%</td>
    </tr>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
      <div className="font-semibold mb-3" style={{ color: V2.TEXT }}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: V2.MUTED }}>{label}</span>
        <span style={{ color: V2.TEXT }}>{brl(value)} · {pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: `${color}22` }}>
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
