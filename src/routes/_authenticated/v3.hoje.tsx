import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  Briefcase,
  ClipboardList,
  DollarSign,
  Package,
  Receipt,
  ShoppingCart,
  Smartphone,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { orderCodeHash } from "@/lib/order-code";
import { V2 } from "@/components/v2/theme";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { Money } from "@/components/ui/money";

export const Route = createFileRoute("/_authenticated/v3/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — Prime Automotive" },
      { name: "description", content: "Painel comercial do dia com métricas reais, comparativos e ações pendentes." },
    ],
  }),
  component: V3HojePage,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen grid place-items-center p-8" style={{ background: V2.BG, color: V2.TEXT }}>
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold">Erro ao carregar o painel Hoje</h1>
        <p className="text-sm" style={{ color: V2.MUTED }}>{error instanceof Error ? error.message : String(error)}</p>
        <button onClick={reset} className="px-4 py-2 rounded-full text-sm font-semibold" style={{ background: V2.TEAL, color: "#fff" }}>Tentar novamente</button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div style={{ background: V2.BG, color: V2.TEXT }} className="min-h-screen grid place-items-center">Página não encontrada</div>,
});

const DANGER = "#dc2626";
const SUCCESS = "#10b981";
const WARNING = "#f59e0b";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  companies: { legal_name: string; trade_name: string | null } | null;
};

type TripRow = {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  status: string;
  opened_at: string;
};

type ProductAlert = {
  id: string;
  nome: string;
  sku: string | null;
  estoque: number;
  estoque_minimo: number;
};

type HojeData = {
  revenueToday: number;
  revenueYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  revenueMonth: number;
  revenuePreviousMonth: number;
  ordersMonth: number;
  ordersPreviousMonth: number;
  avgTicketMonth: number;
  avgTicketToday: number;
  pendingOrders: number;
  pendingOrdersValue: number;
  openTrips: TripRow[];
  lowStock: ProductAlert[];
  recentOrders: OrderRow[];
  salesBars: { label: string; value: number }[];
};

const QUICK_ACTIONS = [
  { to: "/v3/pdv", label: "Venda rápida", desc: "Atendimento no balcão", icon: Zap },
  { to: "/v3/vendas/nova", label: "Venda em visita", desc: "Cliente na rota", icon: Briefcase },
  { to: "/v3/pedidos", label: "Pedidos", desc: "Lista de vendas", icon: ClipboardList },
  { to: "/v3/viagens", label: "Viagens", desc: "Rotas em aberto", icon: Truck },
  { to: "/v3/despesas", label: "Despesas", desc: "Gastos por viagem", icon: Receipt },
  { to: "/v3/prospeccao", label: "Prospecção", desc: "Novos leads", icon: ShoppingCart },
];

function V3HojePage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["v3-hoje"], queryFn: fetchHojeData, staleTime: 1000 * 60 });

  return (
    <V2InternalShell
      title="Hoje"
      eyebrow="Painel comercial"
      description={isLoading ? "Carregando dados do dia..." : "Resumo do dia, comparativos e o que precisa de atenção"}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/v3/viagens"
            className="h-11 px-4 rounded-full font-semibold text-sm flex items-center gap-2 transition active:scale-95 border"
            style={{ borderColor: V2.GRAPHITE, color: V2.TEXT, background: V2.SURFACE }}
          >
            <Receipt className="h-4 w-4" /> Lançar despesa
          </Link>
          <Link
            to="/v3/pdv"
            className="h-11 px-5 rounded-full font-semibold text-sm flex items-center gap-2 transition active:scale-95"
            style={{ background: V2.TEAL, color: "#fff", boxShadow: `0 10px 30px -8px ${V2.TEAL}66` }}
          >
            <Zap className="h-4 w-4" /> Nova venda
          </Link>
        </div>
      }
    >
      {error ? (
        <StateCard title="Não foi possível carregar o painel" description={error instanceof Error ? error.message : "Falha ao consultar o banco."} />
      ) : (
        <div className="grid gap-6">
          <HeroBanner data={data} loading={isLoading} />
          <KpiGrid data={data} loading={isLoading} />
          <QuickActions />
          <NeedsAttention data={data} loading={isLoading} />
          <MainGrid data={data} loading={isLoading} />
        </div>
      )}
    </V2InternalShell>
  );
}

function HeroBanner({ data, loading }: { data: HojeData | undefined; loading: boolean }) {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const capitalized = today.charAt(0).toUpperCase() + today.slice(1);
  return (
    <section
      className="relative overflow-hidden rounded-3xl border p-6 lg:p-8"
      style={{
        background: `radial-gradient(120% 100% at 100% 0%, ${V2.TEAL}22 0%, transparent 55%), linear-gradient(135deg, ${V2.SURFACE} 0%, ${V2.DARK} 100%)`,
        borderColor: V2.GRAPHITE,
      }}
    >
      <div aria-hidden className="absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl" style={{ background: `${V2.TEAL}33` }} />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="text-[10px] uppercase tracking-[0.3em] font-semibold" style={{ color: V2.TEAL }}>{capitalized}</div>
          <h2 className="mt-2 text-2xl lg:text-3xl font-semibold" style={{ color: V2.TEXT }}>
            Sua operação comercial em <span style={{ color: V2.TEAL }}>tempo real</span>
          </h2>
          <p className="mt-2 text-sm" style={{ color: V2.MUTED }}>
            Hoje: <strong style={{ color: V2.TEXT }}>{loading ? "—" : <Money value={data?.revenueToday} />}</strong> em {loading ? "—" : data?.ordersToday ?? 0} pedidos ·
            Mês: <strong style={{ color: V2.TEXT }}>{loading ? "—" : <Money value={data?.revenueMonth} />}</strong>
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/v3/pedidos" className="px-4 py-2.5 rounded-full text-sm font-semibold border transition hover:-translate-y-0.5" style={{ borderColor: V2.GRAPHITE, color: V2.TEXT, background: V2.SURFACE }}>
            Ver pedidos
          </Link>
          <Link to="/v3/prospeccao" className="px-4 py-2.5 rounded-full text-sm font-semibold transition hover:-translate-y-0.5" style={{ background: V2.TEAL, color: "#fff", boxShadow: `0 10px 24px -8px ${V2.TEAL}80` }}>
            Prospectar
          </Link>
        </div>
      </div>
    </section>
  );
}

function KpiGrid({ data, loading }: { data: HojeData | undefined; loading: boolean }) {
  const dayVsYesterday = compareToPrevious(data?.revenueToday ?? 0, data?.revenueYesterday ?? 0, "revenue");
  const monthVsPrevious = compareToPrevious(data?.revenueMonth ?? 0, data?.revenuePreviousMonth ?? 0, "revenue");
  const ordersDayVsYesterday = compareToPrevious(data?.ordersToday ?? 0, data?.ordersYesterday ?? 0, "orders");
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <ComparisonCard
        label="Vendas hoje"
        value={data?.revenueToday}
        previousValue={data?.revenueYesterday}
        previousLabel="Ontem"
        loading={loading}
        tone={dayVsYesterday.tone}
        icon={DollarSign}
        helper={dayVsYesterday.helper}
      />
      <ComparisonCard
        label="Pedidos hoje"
        value={data?.ordersToday}
        previousValue={data?.ordersYesterday}
        previousLabel="Ontem"
        loading={loading}
        tone={ordersDayVsYesterday.tone}
        icon={ShoppingCart}
        helper={ordersDayVsYesterday.helper}
        isNumber
      />
      <ComparisonCard
        label="Vendas mês atual"
        value={data?.revenueMonth}
        previousValue={data?.revenuePreviousMonth}
        previousLabel="Mês anterior"
        loading={loading}
        tone={monthVsPrevious.tone}
        icon={Wallet}
        helper={monthVsPrevious.helper}
      />
      <div className="rounded-2xl p-5 border relative overflow-hidden transition hover:-translate-y-0.5" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
        <div aria-hidden className="absolute top-0 left-0 h-1 w-full" style={{ background: V2.TEAL }} />
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
            <BarChart3 className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-semibold flex items-center gap-0.5 px-2 py-1 rounded-full" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
            <TrendingUp className="h-3 w-3" />
            {loading ? "—" : `${data?.ordersMonth ?? 0} pedidos`}
          </span>
        </div>
        <div className="mt-4 text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.LIGHT_MUTED }}>Ticket médio do mês</div>
        <div className="mt-1 font-semibold text-2xl lg:text-3xl" style={{ color: V2.LIGHT_TEXT }}>{loading ? "—" : <Money value={data?.avgTicketMonth} />}</div>
        <div className="mt-3 pt-3 border-t text-[11px] font-medium" style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}>
          Hoje: {loading ? "—" : <Money value={data?.avgTicketToday} className="inline" />}
        </div>
      </div>
    </section>
  );
}

function compareToPrevious(current: number, previous: number, kind: "revenue" | "orders") {
  if (previous === 0) return { tone: "neutral" as const, helper: "Sem base de comparação" };
  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);
  const tone = diff >= 0 ? ("positive" as const) : ("negative" as const);
  const helper = `${diff >= 0 ? "+" : ""}${kind === "revenue" ? brl(diff) : diff} (${percent >= 0 ? "+" : ""}${percent}%) vs anterior`;
  return { tone, helper };
}

function ComparisonCard({
  label,
  value,
  previousValue,
  previousLabel,
  loading,
  tone,
  icon: Icon,
  helper,
  isNumber = false,
}: {
  label: string;
  value: number | undefined;
  previousValue: number | undefined;
  previousLabel: string;
  loading: boolean;
  tone: "positive" | "negative" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  helper: string;
  isNumber?: boolean;
}) {
  const toneColor = tone === "positive" ? V2.TEAL : tone === "negative" ? DANGER : V2.LIGHT_MUTED;
  const Trend = tone === "positive" ? TrendingUp : tone === "negative" ? TrendingDown : Timer;
  return (
    <div className="rounded-2xl p-5 border relative overflow-hidden transition hover:-translate-y-0.5" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      <div aria-hidden className="absolute top-0 left-0 h-1 w-full" style={{ background: toneColor }} />
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-semibold flex items-center gap-0.5 px-2 py-1 rounded-full" style={{ background: tone === "positive" ? "#10b98122" : tone === "negative" ? "#dc262622" : V2.TEAL_LIGHT, color: toneColor }}>
          <Trend className="h-3 w-3" /> {loading ? "—" : helper}
        </span>
      </div>
      <div className="mt-4 text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.LIGHT_MUTED }}>{label}</div>
      <div className="mt-1 font-semibold text-2xl lg:text-3xl" style={{ color: V2.LIGHT_TEXT }}>
        {loading ? "—" : isNumber ? String(value ?? 0) : <Money value={value} />}
      </div>
      <div className="mt-3 pt-3 border-t text-[11px] font-medium" style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}>
        {previousLabel}: {loading ? "—" : isNumber ? String(previousValue ?? 0) : <Money value={previousValue} className="inline" />}
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <section className="rounded-2xl border p-5 lg:p-6" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.TEAL }}>Acesso rápido</div>
          <h3 className="mt-1 font-semibold text-lg" style={{ color: V2.LIGHT_TEXT }}>Ações comerciais</h3>
        </div>
      </div>

      {/* Card destaque: PDV Móvel */}
      <Link
        to="/pos"
        className="group flex items-center gap-4 sm:gap-5 rounded-2xl border p-4 sm:p-5 mb-4 transition hover:-translate-y-0.5 active:scale-[0.98]"
        style={{ background: V2.TEAL, borderColor: V2.TEAL, color: "#fff" }}
      >
        <div className="h-14 w-14 rounded-xl grid place-items-center shrink-0 transition group-hover:scale-110" style={{ background: "rgba(255,255,255,0.18)" }}>
          <Smartphone className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg leading-tight">PDV Móvel</p>
          <p className="text-sm mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.85)" }}>Venda rápida no tablet, imprima etiquetas e feche o caixa.</p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 opacity-80 group-hover:translate-x-1 transition" />
      </Link>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="group flex flex-col items-start gap-3 rounded-2xl border p-4 min-h-[128px] transition hover:-translate-y-0.5 active:scale-[0.98]"
            style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER }}
          >
            <div className="h-12 w-12 rounded-xl grid place-items-center transition group-hover:scale-110 shrink-0" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
              <action.icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 w-full">
              <p className="font-semibold text-[15px] leading-tight break-words" style={{ color: V2.LIGHT_TEXT }}>{action.label}</p>
              <p className="text-xs mt-1 leading-snug break-words" style={{ color: V2.LIGHT_MUTED }}>{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NeedsAttention({ data, loading }: { data: HojeData | undefined; loading: boolean }) {
  const pendingOrders = data?.pendingOrders ?? 0;
  const pendingValue = data?.pendingOrdersValue ?? 0;
  const openTrips = data?.openTrips ?? [];
  const lowStock = data?.lowStock ?? [];

  return (
    <section className="rounded-2xl border p-5 lg:p-6" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.TEAL }}>Precisa de você agora</div>
          <h3 className="mt-1 font-semibold text-lg" style={{ color: V2.LIGHT_TEXT }}>Ações pendentes</h3>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
          {loading ? "—" : pendingOrders + openTrips.length + lowStock.length} itens
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <ActionCard
          to="/v3/pedidos"
          icon={ClipboardList}
          title={`${loading ? "—" : pendingOrders} pedidos aguardando pagamento`}
          subtitle={loading ? "Carregando..." : `Valor total: ${brl(pendingValue)}`}
          tone={pendingOrders > 0 ? "warning" : "neutral"}
        />
        <ActionCard
          to="/v3/viagens"
          icon={Truck}
          title={`${loading ? "—" : openTrips.length} viagem${openTrips.length === 1 ? "" : "ns"} em aberto`}
          subtitle={loading ? "Carregando..." : openTrips.length > 0 ? `Última: ${openTrips[0].nome}${openTrips[0].cidade ? ` — ${openTrips[0].cidade}` : ""}` : "Nenhuma viagem ativa"}
          tone={openTrips.length > 0 ? "positive" : "neutral"}
        />
        <ActionCard
          to="/v3/estoque/alertas"
          icon={Package}
          title={`${loading ? "—" : lowStock.length} produto${lowStock.length === 1 ? "" : "s"} com estoque baixo`}
          subtitle={loading ? "Carregando..." : lowStock.length > 0 ? `Primeiro: ${lowStock[0].nome}` : "Estoque saudável"}
          tone={lowStock.length > 0 ? "danger" : "neutral"}
        />
      </div>
    </section>
  );
}

function ActionCard({ to, icon: Icon, title, subtitle, tone }: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tone: "positive" | "warning" | "danger" | "neutral";
}) {
  const color = tone === "positive" ? SUCCESS : tone === "warning" ? WARNING : tone === "danger" ? DANGER : V2.LIGHT_MUTED;
  const bg = tone === "positive" ? "#10b98111" : tone === "warning" ? "#f59e0b11" : tone === "danger" ? "#dc262611" : V2.LIGHT_SURFACE_2;
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border p-4 transition hover:-translate-y-0.5"
      style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER }}
    >
      <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: bg, color: color }}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm" style={{ color: V2.LIGHT_TEXT }}>{title}</div>
        <div className="text-[11px] mt-0.5" style={{ color: V2.LIGHT_MUTED }}>{subtitle}</div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition" style={{ color: V2.TEAL }} />
    </Link>
  );
}

function MainGrid({ data, loading }: { data: HojeData | undefined; loading: boolean }) {
  return (
    <section className="grid grid-cols-1 gap-4">


      <div className="rounded-2xl p-5 border" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.TEAL }}>Últimas vendas</div>
            <h3 className="mt-1 font-semibold text-lg" style={{ color: V2.LIGHT_TEXT }}>Pedidos recentes</h3>
          </div>
          <Link to="/v3/pedidos" className="text-xs font-semibold flex items-center gap-1" style={{ color: V2.TEAL }}>Ver tudo <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <ul className="space-y-4">
          {(data?.recentOrders ?? []).map((row) => (
            <li key={row.id} className="flex gap-3">
              <div className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: V2.TEAL }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight truncate" style={{ color: V2.LIGHT_TEXT }}>Pedido {orderCodeHash(row.id, row.companies?.trade_name ?? row.companies?.legal_name)}</div>
                <div className="text-xs truncate" style={{ color: V2.LIGHT_MUTED }}>{row.companies?.trade_name ?? row.companies?.legal_name ?? "Cliente"} · {row.status}</div>
              </div>
              <div className="text-xs font-semibold self-start" style={{ color: V2.LIGHT_TEXT }}><Money value={Number(row.total)} /></div>
            </li>
          ))}
          {!loading && (data?.recentOrders.length ?? 0) === 0 && <li className="text-sm text-center py-6" style={{ color: V2.LIGHT_MUTED }}>Nenhum pedido recente.</li>}
        </ul>
      </div>
    </section>
  );
}

function StateCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl p-8 border text-center" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
      <AlertTriangle className="h-8 w-8 mx-auto mb-3" style={{ color: V2.TEAL }} />
      <h2 className="font-semibold text-lg" style={{ color: V2.TEXT }}>{title}</h2>
      <p className="text-sm mt-1" style={{ color: V2.MUTED }}>{description}</p>
    </div>
  );
}

async function fetchHojeData(): Promise<HojeData> {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(startOfMonth);
  const thirtyDays = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const [
    todayRows,
    yesterdayRows,
    monthRows,
    previousMonthRows,
    pendingOrdersRes,
    recentOrders,
    openTrips,
    lowStock,
  ] = await Promise.all([
    supabase.from("orders").select("total,created_at,status").neq("status", "CANCELADO").gte("created_at", today.toISOString()),
    supabase.from("orders").select("total,created_at,status").neq("status", "CANCELADO").gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString()),
    supabase.from("orders").select("total,created_at,status").neq("status", "CANCELADO").gte("created_at", startOfMonth.toISOString()),
    supabase.from("orders").select("total,created_at,status").neq("status", "CANCELADO").gte("created_at", startOfPreviousMonth.toISOString()).lt("created_at", endOfPreviousMonth.toISOString()),
    supabase.from("orders").select("total,status").in("status", ["PENDENTE", "AGUARDANDO_PAGAMENTO"]),
    supabase.from("orders").select("id,status,total,created_at,companies(legal_name,trade_name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("trips").select("id,nome,cidade,estado,status,opened_at").eq("status", "open").order("opened_at", { ascending: false }).limit(5),
    supabase.from("products").select("id,nome,sku,estoque,estoque_minimo").lte("estoque", 5).order("estoque", { ascending: true }).limit(5),
  ]);

  const firstError = todayRows.error ?? yesterdayRows.error ?? monthRows.error ?? previousMonthRows.error ?? pendingOrdersRes.error ?? recentOrders.error ?? openTrips.error ?? lowStock.error;
  if (firstError) throw firstError;

  const monthData = monthRows.data ?? [];
  const todayData = todayRows.data ?? [];
  const yesterdayData = yesterdayRows.data ?? [];
  const previousMonthData = previousMonthRows.data ?? [];
  const revenueToday = todayData.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const revenueYesterday = yesterdayData.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const revenueMonth = monthData.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const revenuePreviousMonth = previousMonthData.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const ordersMonth = monthData.length;
  const ordersPreviousMonth = previousMonthData.length;
  const avgTicketMonth = ordersMonth ? revenueMonth / ordersMonth : 0;
  const avgTicketToday = todayData.length ? revenueToday / todayData.length : 0;
  const pendingOrders = pendingOrdersRes.data ?? [];
  const pendingOrdersValue = pendingOrders.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

  const salesBars = thirtyDays.map((date) => {
    const next = new Date(date); next.setDate(next.getDate() + 1);
    const value = monthData.filter((row) => row.created_at >= date.toISOString() && row.created_at < next.toISOString()).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
    const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return { label, value };
  });

  return {
    revenueToday,
    revenueYesterday,
    ordersToday: todayData.length,
    ordersYesterday: yesterdayData.length,
    revenueMonth,
    revenuePreviousMonth,
    ordersMonth,
    ordersPreviousMonth,
    avgTicketMonth,
    avgTicketToday,
    pendingOrders: pendingOrders.length,
    pendingOrdersValue,
    openTrips: (openTrips.data ?? []) as TripRow[],
    lowStock: (lowStock.data ?? []) as ProductAlert[],
    recentOrders: (recentOrders.data ?? []) as unknown as OrderRow[],
    salesBars,
  };
}
