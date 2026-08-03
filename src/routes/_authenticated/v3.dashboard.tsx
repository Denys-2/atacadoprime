import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Briefcase,
  Building2,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  Flag,
  Gauge,
  Globe,
  LayoutGrid,
  Map as MapIcon,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Navigation,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  Zap,
  PackageSearch,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDate } from "@/lib/format";
import { orderCodeHash } from "@/lib/order-code";
import { V2 } from "@/components/v2/theme";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { Money, MoneyMasterToggle } from "@/components/ui/money";

export const Route = createFileRoute("/_authenticated/v3/dashboard")({
  head: () => ({
    meta: [
      { title: "Cockpit — Prime Automotive" },
      { name: "description", content: "Dashboard interno v3 dark/orange com dados reais do sistema." },
    ],
  }),
  component: V3Dashboard,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen grid place-items-center p-8" style={{ background: V2.BG, color: V2.TEXT }}>
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold">Erro ao carregar o cockpit v3</h1>
        <p className="text-sm" style={{ color: V2.MUTED }}>{error instanceof Error ? error.message : String(error)}</p>
        <button onClick={reset} className="px-4 py-2 rounded-full text-sm font-semibold" style={{ background: V2.TEAL, color: "#fff" }}>Tentar novamente</button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div style={{ background: V2.BG, color: V2.TEXT }} className="min-h-screen grid place-items-center">Página não encontrada</div>,
});

const DANGER = "#dc2626";

type RecentOrder = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  companies: { legal_name: string; trade_name: string | null } | null;
};

type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  tone: string;
};

type DashboardData = {
  revenueToday: number;
  revenueYesterday: number;
  revenueMonth: number;
  revenuePreviousMonth: number;
  avgDailyMonth: number;
  daysElapsedMonth: number;
  daysInMonth: number;
  projectedMonth: number;
  ordersToday: number;
  ordersMonth: number;
  avgTicketMonth: number;
  pendingOrders: number;
  recentOrders: RecentOrder[];
  activities: ActivityItem[];
  salesBars: number[];
};

const QUICK_ACTIONS = [
  { to: "/v3/viagens", label: "Viagens", desc: "Estoque da rota", icon: Truck },
  { to: "/v3/despesas", label: "Despesas viagem", desc: "Gastos de rota", icon: FileText },
  { to: "/v3/despesa-empresa", label: "Despesa empresa", desc: "Fora de viagem", icon: Building2 },
  { to: "/v3/vendas/nova", label: "Venda em visita", desc: "Atender cliente", icon: Briefcase },
  { to: "/v3/pedidos", label: "Pedidos", desc: "Vendas & entregas", icon: ClipboardList },
  { to: "/v3/catalogo-admin", label: "Catálogo", desc: "Produtos & preços", icon: LayoutGrid },
  { to: "/v3/compras", label: "Compra material", desc: "Entrada de nota", icon: Truck },
  { to: "/v3/demandas", label: "Demanda de produtos", desc: "Lista a comprar", icon: PackageSearch },
  { to: "/v3/prospeccao", label: "Prospecção", desc: "Novos leads", icon: Search },
  { to: "/v3/campanhas", label: "Campanhas", desc: "Marketing", icon: Megaphone },
  { to: "/v3/whatsapp/campanhas", label: "WhatsApp", desc: "Disparos", icon: MessageSquare },
  { to: "/v3/campo", label: "Campo", desc: "Equipe externa", icon: Navigation },
  { to: "/v3/rotas", label: "Rotas & mapa", desc: "Planejamento", icon: MapIcon },
  { to: "/v3/financeiro", label: "Financeiro", desc: "Caixa & contas", icon: Wallet },
  { to: "/v3/aprovacoes", label: "Aprovações", desc: "Pendências", icon: ShieldCheck },
  { to: "/v3", label: "Ver o site", desc: "Visão do cliente", icon: Globe },
  { to: "/v3/relatorios", label: "Relatórios", desc: "Central de relatórios", icon: BarChart3 },
] as const;

function V3Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["v3-dashboard-real"], queryFn: fetchDashboardData });

  return (
    <V2InternalShell
      title="Cockpit"
      eyebrow="Painel de comando"
      description={isLoading ? "Carregando dados reais do banco..." : "Dark mode oficial · métricas ao vivo"}
      actions={
        <div className="flex items-center gap-2">
          <MoneyMasterToggle style={{ borderColor: V2.GRAPHITE, color: V2.TEXT, background: V2.SURFACE }} />
          <Link
            to="/v3/viagens"
            className="h-11 px-4 rounded-full font-semibold text-sm flex items-center gap-2 transition active:scale-95 border"
            style={{ borderColor: V2.GRAPHITE, color: V2.TEXT, background: V2.SURFACE }}
          >
            <Truck className="h-4 w-4" /> Despesa viagem
          </Link>
          <Link
            to="/v3/despesa-empresa"
            className="h-11 px-4 rounded-full font-semibold text-sm flex items-center gap-2 transition active:scale-95 border"
            style={{ borderColor: V2.GRAPHITE, color: V2.TEXT, background: V2.SURFACE }}
          >
            <Building2 className="h-4 w-4" /> Despesa empresa
          </Link>
          <Link
            to="/v3/vendas/nova"
            className="h-11 px-5 rounded-full font-semibold text-sm flex items-center gap-2 transition active:scale-95"
            style={{ background: V2.TEAL, color: "#fff", boxShadow: `0 10px 30px -8px ${V2.TEAL}66` }}
          >
            <Zap className="h-4 w-4" /> Nova venda
          </Link>
        </div>
      }
    >
      {error ? (
        <StateCard title="Não foi possível carregar o dashboard" description={error instanceof Error ? error.message : "Falha ao consultar o banco."} />
      ) : (
        <div className="grid gap-6">
          <HeroBanner data={data} loading={isLoading} />
          <KpiGrid data={data} loading={isLoading} />
          <QuickAccess />
          <MainGrid data={data} loading={isLoading} />
          <RecentOrders data={data?.recentOrders ?? []} loading={isLoading} />
        </div>
      )}
    </V2InternalShell>
  );
}

function HeroBanner({ data, loading }: { data: DashboardData | undefined; loading: boolean }) {
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
          <div className="text-[10px] uppercase tracking-[0.3em] font-semibold" style={{ color: V2.TEAL }}>Boas-vindas de volta</div>
          <h2 className="mt-2 text-2xl lg:text-3xl font-semibold" style={{ color: V2.TEXT }}>
            Sua operação em <span style={{ color: V2.TEAL }}>tempo real</span>
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

function KpiGrid({ data, loading }: { data: DashboardData | undefined; loading: boolean }) {
  const dayVsYesterday = compareToPrevious(data?.revenueToday ?? 0, data?.revenueYesterday ?? 0);
  const monthVsPrevious = compareToPrevious(data?.revenueMonth ?? 0, data?.revenuePreviousMonth ?? 0);
  const projection = projectMonth(data);
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
        label="Vendas mês atual"
        value={data?.revenueMonth}
        previousValue={data?.revenuePreviousMonth}
        previousLabel="Mês anterior"
        loading={loading}
        tone={monthVsPrevious.tone}
        icon={Wallet}
        helper={monthVsPrevious.helper}
      />
      <ProjectionCard data={data} loading={loading} projection={projection} />
      <div className="rounded-2xl p-5 border relative overflow-hidden transition hover:-translate-y-0.5" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
        <div aria-hidden className="absolute top-0 left-0 h-1 w-full" style={{ background: V2.TEAL }} />
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
            <ShoppingCart className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-semibold flex items-center gap-0.5 px-2 py-1 rounded-full" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
            <TrendingUp className="h-3 w-3" />
            {loading ? "—" : `${data?.pendingOrders ?? 0} pendentes`}
          </span>
        </div>
        <div className="mt-4 text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.LIGHT_MUTED }}>Pedidos no mês</div>
        <div className="mt-1 font-semibold text-2xl lg:text-3xl" style={{ color: V2.LIGHT_TEXT }}>{loading ? "—" : String(data?.ordersMonth ?? 0)}</div>
      </div>
    </section>
  );
}

function compareToPrevious(current: number, previous: number) {
  if (previous === 0) return { tone: "neutral" as const, helper: "Sem base de comparação" };
  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);
  const tone = diff >= 0 ? ("positive" as const) : ("negative" as const);
  const helper = `${diff >= 0 ? "+" : ""}${brl(diff)} (${percent >= 0 ? "+" : ""}${percent}%) vs anterior`;
  return { tone, helper };
}

function projectMonth(data: DashboardData | undefined) {
  if (!data || data.daysInMonth === 0) return { percent: 0, label: "—", status: "neutral" as const };
  const ratio = data.revenuePreviousMonth === 0 ? 1 : data.projectedMonth / data.revenuePreviousMonth;
  const percent = Math.round((ratio - 1) * 100);
  const status = percent >= 0 ? ("positive" as const) : ("negative" as const);
  const label = `${data.daysElapsedMonth}/${data.daysInMonth} dias · média ${brl(data.avgDailyMonth)}/dia`;
  return { percent, label, status };
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
}: {
  label: string;
  value: number | undefined;
  previousValue: number | undefined;
  previousLabel: string;
  loading: boolean;
  tone: "positive" | "negative" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  helper: string;
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
      <div className="mt-1 font-semibold text-2xl lg:text-3xl" style={{ color: V2.LIGHT_TEXT }}>{loading ? "—" : <Money value={value} />}</div>
      <div className="mt-3 pt-3 border-t text-[11px] font-medium" style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}>
        {previousLabel}: {loading ? "—" : <Money value={previousValue} className="inline" />}
      </div>
    </div>
  );
}

function ProjectionCard({
  data,
  loading,
  projection,
}: {
  data: DashboardData | undefined;
  loading: boolean;
  projection: ReturnType<typeof projectMonth>;
}) {
  const color = projection.status === "positive" ? V2.TEAL : projection.status === "negative" ? DANGER : V2.LIGHT_MUTED;
  return (
    <div className="rounded-2xl p-5 border relative overflow-hidden transition hover:-translate-y-0.5" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      <div aria-hidden className="absolute top-0 left-0 h-1 w-full" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
          <Gauge className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-semibold flex items-center gap-0.5 px-2 py-1 rounded-full" style={{ background: projection.status === "positive" ? "#10b98122" : projection.status === "negative" ? "#dc262622" : V2.TEAL_LIGHT, color }}>
          <TrendingUp className="h-3 w-3" />
          {loading ? "—" : projection.status === "positive" ? "Acima do mês anterior" : projection.status === "negative" ? "Abaixo do mês anterior" : "Sem projeção"}
        </span>
      </div>
      <div className="mt-4 text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.LIGHT_MUTED }}>Projeção final do mês</div>
      <div className="mt-1 font-semibold text-2xl lg:text-3xl" style={{ color: V2.LIGHT_TEXT }}>{loading ? "—" : <Money value={data?.projectedMonth} />}</div>
      <div className="mt-3 pt-3 border-t text-[11px] font-medium" style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}>
        {loading ? "—" : projection.label}
      </div>
    </div>
  );
}

function QuickAccess() {
  return (
    <section className="rounded-2xl border p-5 lg:p-6" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.TEAL }}>Acesso rápido</div>
          <h3 className="mt-1 font-semibold text-lg" style={{ color: V2.LIGHT_TEXT }}>Áreas do sistema</h3>
        </div>
        <span className="text-xs font-medium" style={{ color: V2.LIGHT_MUTED }}>Layout v3 · dark/orange</span>
      </div>
      {/* Escada: 2 (mobile) → 3 (sm) → 4 (tablet md) → 6 (desktop lg).
          Evita cards espremidos em tablet portrait e strip fina em landscape. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">

        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="group flex flex-col items-start gap-3 rounded-xl border p-3 transition hover:-translate-y-0.5"
            style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER }}
          >
            <div className="h-10 w-10 rounded-xl grid place-items-center transition group-hover:scale-110" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
              <action.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate" style={{ color: V2.LIGHT_TEXT }}>{action.label}</p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: V2.LIGHT_MUTED }}>{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MainGrid({ data, loading }: { data: DashboardData | undefined; loading: boolean }) {
  const bars = data?.salesBars ?? [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...bars, 1);
  return (
    /* Antes: xl (>=1280) → chart+atividade lado a lado só em desktop grande.
       Agora: lg (>=1024) já divide, aproveitando tablet landscape. */
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-2xl p-5 border" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.TEAL }}>Volume de vendas</div>
            <h3 className="mt-1 font-semibold text-lg" style={{ color: V2.LIGHT_TEXT }}>Últimos 7 dias</h3>
          </div>
          <div className="text-xs font-medium" style={{ color: V2.LIGHT_MUTED }}>{loading ? "Carregando" : <Money value={data?.revenueMonth} />}</div>
        </div>
        <div className="h-52 flex items-end gap-3 px-1">
          {bars.map((value, index) => (
            <div key={`${index}-${value}`} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg relative min-h-2 transition hover:opacity-80"
                style={{
                  height: `${Math.max(6, (value / max) * 100)}%`,
                  background: index === bars.length - 1 ? V2.TEAL : V2.LIGHT_SURFACE_2,
                  border: `1px solid ${index === bars.length - 1 ? V2.TEAL : V2.LIGHT_BORDER}`,
                  boxShadow: index === bars.length - 1 ? `0 -6px 16px -4px ${V2.TEAL}66` : "none",
                }}
                title={brl(value)}
              />
              <div className="text-[10px] font-semibold" style={{ color: V2.LIGHT_MUTED }}>{["S", "T", "Q", "Q", "S", "S", "D"][index]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-5 border" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.TEAL }}>Atividade</div>
            <h3 className="mt-1 font-semibold text-lg" style={{ color: V2.LIGHT_TEXT }}>Registros recentes</h3>
          </div>
          <button type="button" className="h-8 w-8 rounded-full grid place-items-center border" style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }} aria-label="Mais opções">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-4">
          {(data?.activities ?? []).map((item) => (
            <li key={item.id} className="flex gap-3">
              <div className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: item.tone }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight truncate" style={{ color: V2.LIGHT_TEXT }}>{item.title}</div>
                <div className="text-xs truncate" style={{ color: V2.LIGHT_MUTED }}>{item.subtitle}</div>
              </div>
              <div className="text-[10px] font-mono self-start" style={{ color: V2.LIGHT_MUTED }}>{item.time}</div>
            </li>
          ))}
          {!loading && (data?.activities.length ?? 0) === 0 && <li className="text-sm text-center py-6" style={{ color: V2.LIGHT_MUTED }}>Nenhuma atividade encontrada.</li>}
        </ul>
      </div>
    </section>
  );
}

function RecentOrders({ data, loading }: { data: RecentOrder[]; loading: boolean }) {
  return (
    <section className="rounded-2xl border overflow-hidden" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: V2.LIGHT_BORDER }}>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.TEAL }}>Últimos pedidos</div>
          <h3 className="mt-1 font-semibold text-lg" style={{ color: V2.LIGHT_TEXT }}>Pedidos reais</h3>
        </div>
        <Link to="/v3/pedidos" className="text-xs font-semibold flex items-center gap-1" style={{ color: V2.TEAL }}>Ver tudo <ChevronRight className="h-3 w-3" /></Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: V2.LIGHT_MUTED, background: V2.LIGHT_SURFACE_2 }}>
              <th className="text-left px-5 py-3">#</th>
              <th className="text-left px-5 py-3">Cliente</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Valor</th>
              <th className="text-right px-5 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t transition hover:bg-white/[0.02]" style={{ borderColor: V2.LIGHT_BORDER }}>
                <td className="px-5 py-4 font-mono font-semibold" style={{ color: V2.TEAL }}>{orderCodeHash(row.id, row.companies?.trade_name ?? row.companies?.legal_name)}</td>
                <td className="px-5 py-4 font-medium" style={{ color: V2.LIGHT_TEXT }}>{row.companies?.trade_name ?? row.companies?.legal_name ?? "Cliente"}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border" style={{ borderColor: V2.TEAL, color: V2.TEAL, background: V2.TEAL_LIGHT }}>
                    <Flag className="h-3 w-3" /> {row.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-semibold" style={{ color: V2.LIGHT_TEXT }}><Money value={Number(row.total)} /></td>
                <td className="px-5 py-4 text-right font-mono text-xs" style={{ color: V2.LIGHT_MUTED }}>{formatDate(row.created_at)}</td>
              </tr>
            ))}
            {!loading && data.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center" style={{ color: V2.LIGHT_MUTED }}>Nenhum pedido encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StateCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl p-8 border text-center" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
      <Gauge className="h-8 w-8 mx-auto mb-3" style={{ color: V2.TEAL }} />
      <h2 className="font-semibold text-lg" style={{ color: V2.TEXT }}>{title}</h2>
      <p className="text-sm mt-1" style={{ color: V2.MUTED }}>{description}</p>
    </div>
  );
}

async function fetchDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(startOfMonth);
  const month = new Date(); month.setMonth(month.getMonth() - 1);
  const sevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsedMonth = Math.max(1, Math.min(now.getDate(), daysInMonth));

  const [todayRows, yesterdayRows, monthRows, previousMonthRows, pendingOrders, recentOrders, recentLeads, recentVisits] = await Promise.all([
    supabase.from("orders").select("total,created_at,status").neq("status", "CANCELADO").gte("created_at", today.toISOString()),
    supabase.from("orders").select("total,created_at,status").neq("status", "CANCELADO").gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString()),
    supabase.from("orders").select("total,created_at,status").neq("status", "CANCELADO").gte("created_at", startOfMonth.toISOString()),
    supabase.from("orders").select("total,created_at,status").neq("status", "CANCELADO").gte("created_at", startOfPreviousMonth.toISOString()).lt("created_at", endOfPreviousMonth.toISOString()),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["PENDENTE", "AGUARDANDO_PAGAMENTO"]),
    supabase.from("orders").select("id,status,total,created_at,companies(legal_name,trade_name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("leads").select("id,empresa,status,created_at").order("created_at", { ascending: false }).limit(3),
    supabase.from("visits").select("id,created_at,resultado,leads(empresa)").order("created_at", { ascending: false }).limit(3),
  ]);

  const firstError = todayRows.error ?? yesterdayRows.error ?? monthRows.error ?? previousMonthRows.error ?? pendingOrders.error ?? recentOrders.error ?? recentLeads.error ?? recentVisits.error;
  if (firstError) throw firstError;

  const monthData = monthRows.data ?? [];
  const todayData = todayRows.data ?? [];
  const yesterdayData = yesterdayRows.data ?? [];
  const previousMonthData = previousMonthRows.data ?? [];
  const revenueToday = todayData.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const revenueYesterday = yesterdayData.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const revenueMonth = monthData.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const revenuePreviousMonth = previousMonthData.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const avgDailyMonth = revenueMonth / daysElapsedMonth;
  const projectedMonth = avgDailyMonth * daysInMonth;
  const salesBars = sevenDays.map((date) => {
    const next = new Date(date); next.setDate(next.getDate() + 1);
    return monthData.filter((row) => row.created_at >= date.toISOString() && row.created_at < next.toISOString()).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  });

  type VisitRow = { id: string; created_at: string; resultado: string | null; leads: { empresa: string } | null };
  const orderActivities: ActivityItem[] = ((recentOrders.data ?? []) as unknown as RecentOrder[]).slice(0, 3).map((row) => ({ id: `order-${row.id}`, title: `Pedido ${orderCodeHash(row.id, row.companies?.trade_name ?? row.companies?.legal_name)}`, subtitle: `${row.companies?.trade_name ?? row.companies?.legal_name ?? "Cliente"} · ${brl(Number(row.total))}`, time: formatDate(row.created_at), tone: V2.TEAL }));
  const leadActivities: ActivityItem[] = (recentLeads.data ?? []).slice(0, 2).map((row) => ({ id: `lead-${row.id}`, title: row.empresa, subtitle: `Lead · ${row.status}`, time: formatDate(row.created_at), tone: "#e11d48" }));
  const visitActivities: ActivityItem[] = ((recentVisits.data ?? []) as unknown as VisitRow[]).slice(0, 2).map((row) => ({ id: `visit-${row.id}`, title: row.leads?.empresa ?? "Visita registrada", subtitle: row.resultado ?? "Campo", time: formatDate(row.created_at), tone: "#14b8a6" }));

  return {
    revenueToday,
    revenueYesterday,
    revenueMonth,
    revenuePreviousMonth,
    avgDailyMonth,
    daysElapsedMonth,
    daysInMonth,
    projectedMonth,
    ordersToday: todayData.length,
    ordersMonth: monthData.length,
    avgTicketMonth: monthData.length ? revenueMonth / monthData.length : 0,
    pendingOrders: pendingOrders.count ?? 0,
    recentOrders: (recentOrders.data ?? []) as unknown as RecentOrder[],
    activities: [...orderActivities, ...leadActivities, ...visitActivities].slice(0, 5),
    salesBars,
  };
}
