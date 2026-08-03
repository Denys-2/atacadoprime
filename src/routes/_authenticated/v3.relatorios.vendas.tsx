import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, TrendingUp, ShoppingCart, DollarSign, Package, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { brl, formatDate } from "@/lib/format";
import { orderCodeHash } from "@/lib/order-code";

export const Route = createFileRoute("/_authenticated/v3/relatorios/vendas")({
  head: () => ({ meta: [{ title: "Relatório de vendas — Prime Automotive" }] }),
  component: SalesReportPage,
});

type Periodo = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mes_ant" | "custom";

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
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const d7 = new Date(today); d7.setDate(d7.getDate() - 6);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 29);

  switch (p) {
    case "hoje": return { from: isoDay(today), to: isoDay(today) };
    case "ontem": return { from: isoDay(yest), to: isoDay(yest) };
    case "7d": return { from: isoDay(d7), to: isoDay(today) };
    case "30d": return { from: isoDay(d30), to: isoDay(today) };
    case "mes": return { from: isoDay(startMonth), to: isoDay(endMonth) };
    case "mes_ant": return { from: isoDay(startPrev), to: isoDay(endPrev) };
    case "custom": return { from, to };
  }
}

type OrderRow = {
  id: string;
  created_at: string;
  status: string;
  total: number;
  origem: string | null;
  company_id: string | null;
  companies: { legal_name: string | null; trade_name: string | null; cidade: string | null; estado: string | null } | null;
  order_items: { quantidade: number }[];
  payments: { tipo: string | null; status: string | null }[];
};

function SalesReportPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const today = isoDay(new Date());
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const [incluirCancelados, setIncluirCancelados] = useState(false);

  const range = useMemo(() => rangeFor(periodo, from, to), [periodo, from, to]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales-report", range.from, range.to, incluirCancelados],
    queryFn: async () => {
      const startISO = new Date(range.from + "T00:00:00").toISOString();
      const endISO = new Date(range.to + "T23:59:59.999").toISOString();
      let q = supabase
        .from("orders")
        .select("id,created_at,status,total,origem,company_id,companies(legal_name,trade_name,cidade,estado),order_items(quantidade),payments(tipo,status)")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false });
      if (!incluirCancelados) q = q.neq("status", "CANCELADO");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const totals = useMemo(() => {
    const receita = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const qtdItens = orders.reduce((s, o) => s + (o.order_items || []).reduce((a, i) => a + Number(i.quantidade || 0), 0), 0);
    const pedidos = orders.length;
    const pagos = orders.filter((o) => ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"].includes(o.status));
    const receitaPaga = pagos.reduce((s, o) => s + Number(o.total || 0), 0);
    const pendentes = orders.filter((o) => ["PENDENTE", "AGUARDANDO_PAGAMENTO"].includes(o.status)).length;
    const cancelados = orders.filter((o) => o.status === "CANCELADO").length;
    const ticket = pedidos > 0 ? receita / pedidos : 0;
    return { receita, qtdItens, pedidos, receitaPaga, pendentes, cancelados, ticket };
  }, [orders]);

  const porDia = useMemo(() => {
    const map = new Map<string, { data: string; pedidos: number; receita: number }>();
    for (const o of orders) {
      const d = o.created_at.slice(0, 10);
      const cur = map.get(d) || { data: d, pedidos: 0, receita: 0 };
      cur.pedidos += 1;
      cur.receita += Number(o.total || 0);
      map.set(d, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.data.localeCompare(a.data));
  }, [orders]);

  const porPagamento = useMemo(() => {
    const map = new Map<string, { tipo: string; pedidos: number; receita: number }>();
    for (const o of orders) {
      const tipo = o.payments?.[0]?.tipo || "—";
      const cur = map.get(tipo) || { tipo, pedidos: 0, receita: 0 };
      cur.pedidos += 1;
      cur.receita += Number(o.total || 0);
      map.set(tipo, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.receita - a.receita);
  }, [orders]);

  return (
    <V2InternalShell
      title="Relatório de vendas"
      eyebrow="Relatórios"
      description="Filtre por período e analise pedidos, receita, ticket médio e formas de pagamento."
    >
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <Link to="/v3/relatorios">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </Link>

        <div className="min-w-[180px]">
          <label className="text-xs mb-1 block" style={{ color: V2.MUTED }}>Período</label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="ontem">Ontem</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="mes_ant">Mês anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodo === "custom" && (
          <>
            <div>
              <label className="text-xs mb-1 block" style={{ color: V2.MUTED }}>De</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: V2.MUTED }}>Até</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}

        <label className="flex items-center gap-2 text-sm" style={{ color: V2.TEXT }}>
          <input type="checkbox" checked={incluirCancelados} onChange={(e) => setIncluirCancelados(e.target.checked)} />
          Incluir cancelados
        </label>

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="mb-4 text-sm" style={{ color: V2.MUTED }}>
        {formatDate(range.from)} — {formatDate(range.to)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Kpi label="Receita" value={brl(totals.receita)} hint={`${totals.pedidos} pedidos`} color={V2.TEAL} icon={<DollarSign className="h-5 w-5" />} highlight />
        <Kpi label="Ticket médio" value={brl(totals.ticket)} hint={`${totals.qtdItens} itens vendidos`} color="#6366F1" icon={<TrendingUp className="h-5 w-5" />} />
        <Kpi label="Receita paga" value={brl(totals.receitaPaga)} hint={`Pendentes: ${totals.pendentes}`} color="#059669" icon={<ShoppingCart className="h-5 w-5" />} />
        <Kpi label="Cancelados" value={String(totals.cancelados)} hint={incluirCancelados ? "Incluídos no total" : "Excluídos"} color="#EF4444" icon={<Package className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card title={`Vendas por dia (${porDia.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: `${V2.MUTED}11` }}>
                <tr className="text-left" style={{ color: V2.MUTED }}>
                  <th className="p-3">Data</th>
                  <th className="p-3 text-right">Pedidos</th>
                  <th className="p-3 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {porDia.length === 0 && (
                  <tr><td colSpan={3} className="p-6 text-center" style={{ color: V2.MUTED }}>Sem vendas no período.</td></tr>
                )}
                {porDia.map((d) => (
                  <tr key={d.data} className="border-t" style={{ borderColor: V2.GRAPHITE }}>
                    <td className="p-3">{formatDate(d.data)}</td>
                    <td className="p-3 text-right">{d.pedidos}</td>
                    <td className="p-3 text-right font-medium">{brl(d.receita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Formas de pagamento (${porPagamento.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: `${V2.MUTED}11` }}>
                <tr className="text-left" style={{ color: V2.MUTED }}>
                  <th className="p-3">Forma</th>
                  <th className="p-3 text-right">Pedidos</th>
                  <th className="p-3 text-right">Receita</th>
                  <th className="p-3 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {porPagamento.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center" style={{ color: V2.MUTED }}>—</td></tr>
                )}
                {porPagamento.map((p) => {
                  const pct = totals.receita > 0 ? (p.receita / totals.receita) * 100 : 0;
                  return (
                    <tr key={p.tipo} className="border-t" style={{ borderColor: V2.GRAPHITE }}>
                      <td className="p-3">{p.tipo}</td>
                      <td className="p-3 text-right">{p.pedidos}</td>
                      <td className="p-3 text-right font-medium">{brl(p.receita)}</td>
                      <td className="p-3 text-right" style={{ color: V2.MUTED }}>{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <OrdersTable orders={orders} isLoading={isLoading} totals={totals} />
    </V2InternalShell>
  );
}

type SortKey = "data" | "pedido" | "cliente" | "cidade" | "status" | "pagamento" | "itens" | "total";
type SortDir = "asc" | "desc";

function OrdersTable({
  orders, isLoading, totals,
}: { orders: OrderRow[]; isLoading: boolean; totals: { qtdItens: number; receita: number } }) {
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggle(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "data" || k === "itens" || k === "total" ? "desc" : "asc"); }
  }

  const sorted = useMemo(() => {
    const arr = [...orders];
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (o: OrderRow): string | number => {
      switch (sortKey) {
        case "data": return new Date(o.created_at).getTime();
        case "pedido": return orderCodeHash(o.id, o.companies?.trade_name || o.companies?.legal_name);
        case "cliente": return (o.companies?.trade_name || o.companies?.legal_name || "").toLowerCase();
        case "cidade": return `${o.companies?.cidade ?? ""}-${o.companies?.estado ?? ""}`.toLowerCase();
        case "status": return o.status;
        case "pagamento": return o.payments?.[0]?.tipo || "";
        case "itens": return (o.order_items || []).reduce((a, i) => a + Number(i.quantidade || 0), 0);
        case "total": return Number(o.total || 0);
      }
    };
    arr.sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true }) * dir;
    });
    return arr;
  }, [orders, sortKey, sortDir]);

  const Th = ({ k, label, align }: { k: SortKey; label: string; align?: "right" }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th className={`p-3 ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          onClick={() => toggle(k)}
          className={`inline-flex items-center gap-1 hover:opacity-80 ${align === "right" ? "flex-row-reverse" : ""}`}
          style={{ color: active ? V2.TEXT : V2.MUTED, fontWeight: active ? 600 : 500 }}
        >
          {label} <Icon className="h-3.5 w-3.5" />
        </button>
      </th>
    );
  };

  return (
    <Card title={`Pedidos (${orders.length})`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: `${V2.MUTED}11` }}>
            <tr>
              <Th k="data" label="Data" />
              <Th k="pedido" label="Pedido" />
              <Th k="cliente" label="Cliente" />
              <Th k="cidade" label="Cidade" />
              <Th k="status" label="Status" />
              <Th k="pagamento" label="Pagamento" />
              <Th k="itens" label="Itens" align="right" />
              <Th k="total" label="Total" align="right" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="p-6 text-center" style={{ color: V2.MUTED }}>Carregando…</td></tr>
            )}
            {!isLoading && sorted.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center" style={{ color: V2.MUTED }}>Nenhum pedido no período.</td></tr>
            )}
            {sorted.map((o) => {
              const cliente = o.companies?.trade_name || o.companies?.legal_name || "—";
              const cidade = o.companies?.cidade
                ? `${o.companies.cidade}${o.companies.estado ? " - " + o.companies.estado : ""}`
                : "—";
              const itens = (o.order_items || []).reduce((a, i) => a + Number(i.quantidade || 0), 0);
              const pag = o.payments?.[0]?.tipo || "—";
              return (
                <tr key={o.id} className="border-t" style={{ borderColor: V2.GRAPHITE }}>
                  <td className="p-3">{formatDate(o.created_at)}</td>
                  <td className="p-3 font-mono text-xs">
                    <Link to="/orders/$id" params={{ id: o.id }} search={{ edit: false }} className="underline">
                      {orderCodeHash(o.id, cliente)}
                    </Link>
                  </td>
                  <td className="p-3">{cliente}</td>
                  <td className="p-3 text-xs">{cidade}</td>
                  <td className="p-3 text-xs">{o.status}</td>
                  <td className="p-3 text-xs">{pag}</td>
                  <td className="p-3 text-right">{itens}</td>
                  <td className="p-3 text-right font-medium">{brl(Number(o.total))}</td>
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t font-semibold" style={{ borderColor: V2.GRAPHITE, background: `${V2.MUTED}11` }}>
                <td className="p-3" colSpan={6} style={{ color: V2.TEXT }}>Total</td>
                <td className="p-3 text-right">{totals.qtdItens}</td>
                <td className="p-3 text-right">{brl(totals.receita)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
      <div className="p-3 border-b font-semibold" style={{ borderColor: V2.GRAPHITE, color: V2.TEXT }}>{title}</div>
      {children}
    </div>
  );
}

function Kpi({
  label, value, hint, color, icon, highlight,
}: {
  label: string; value: string; hint?: string; color: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: highlight ? color : V2.GRAPHITE,
        background: highlight ? `${color}11` : V2.SURFACE,
      }}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider" style={{ color: V2.MUTED }}>
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold" style={{ color: V2.TEXT }}>{value}</div>
      {hint && <div className="text-xs" style={{ color: V2.MUTED }}>{hint}</div>}
    </div>
  );
}
