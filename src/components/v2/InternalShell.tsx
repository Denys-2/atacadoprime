import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useMemo, type ReactNode, useCallback } from "react";
import {
  LogOut,
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cog,
  Globe,
  Handshake,
  HandCoins,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Map as MapIcon,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  Navigation,
  PackageSearch,
  Percent,
  ScanLine,
  Search,
  Settings,
  Smartphone,

  ShieldCheck,
  Sparkles,
  Target,
  Truck,
  Users,
  Wallet,
  Workflow,
  X,
} from "lucide-react";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

import { V2 } from "./theme";
import brandLogo from "@/assets/brand-logo.png.asset.json";
import { GuidedTour } from "./GuidedTour";

export type V2InternalLink = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  section?: string;
};

export const V2_INTERNAL_LINKS: V2InternalLink[] = [
  { to: "/v3/hoje", label: "Hoje", icon: LayoutDashboard, section: "Geral" },
  { to: "/v3/dashboard", label: "Cockpit", icon: BarChart3, section: "Geral" },
  { to: "/v3", label: "Ver o site", icon: Globe, section: "Geral" },

  { to: "/v3/pedidos", label: "Pedidos", icon: ClipboardList, section: "Vender" },
  { to: "/v3/vendas/nova", label: "Venda em visita", icon: Briefcase, section: "Vender" },
  { to: "/v3/pdv", label: "PDV rápido", icon: ScanLine, section: "Vender" },
  { to: "/pos", label: "PDV Móvel", icon: Smartphone, section: "Vender" },
  { to: "/v3/viagens", label: "Viagens", icon: Truck, section: "Vender" },

  { to: "/v3/despesas", label: "Despesas viagem", icon: Wallet, section: "Vender" },
  { to: "/v3/despesa-empresa", label: "Despesa empresa", icon: Building2, section: "Vender" },
  { to: "/v3/campo", label: "Campo", icon: Navigation, section: "Vender" },
  { to: "/v3/rotas", label: "Rotas & mapa", icon: MapIcon, section: "Vender" },

  { to: "/v3/crm", label: "CRM — Leads", icon: Handshake, section: "Clientes" },
  { to: "/v3/crm/agenda", label: "Agenda", icon: CalendarClock, section: "Clientes" },
  { to: "/v3/prospeccao", label: "Prospecção", icon: Search, section: "Clientes" },
  { to: "/v3/empresas", label: "Clientes & empresas", icon: Building2, section: "Clientes" },
  { to: "/v3/portal", label: "Portal do cliente", icon: LifeBuoy, section: "Clientes" },

  { to: "/v3/catalogo-admin", label: "Produtos", icon: LayoutGrid, section: "Operação" },
  { to: "/v3/compras", label: "Compra de material", icon: Boxes, section: "Operação" },
  { to: "/v3/demandas", label: "Demanda de produtos", icon: PackageSearch, section: "Operação" },
  { to: "/v3/estoque", label: "Estoque", icon: Boxes, section: "Operação" },
  { to: "/v3/estoque/alertas", label: "Alertas de estoque", icon: PackageSearch, section: "Operação" },
  { to: "/v3/estoque/contagens", label: "Contagens", icon: ScanLine, section: "Operação" },
  { to: "/v3/financeiro", label: "Financeiro", icon: Wallet, section: "Operação" },
  { to: "/v3/fechamento", label: "Fechamento", icon: HandCoins, section: "Operação" },
  { to: "/v3/financeiro/conciliacao", label: "Conciliação bancária", icon: Wallet, section: "Operação" },
  { to: "/v3/admin/carrinhos", label: "Carrinhos abandonados", icon: ClipboardList, section: "Operação" },

  { to: "/v3/relatorios", label: "Relatórios", icon: BarChart3, section: "Crescer" },
  { to: "/v3/campanhas", label: "Campanhas", icon: Megaphone, section: "Crescer" },
  { to: "/v3/whatsapp", label: "Inbox WhatsApp", icon: MessageCircle, section: "Crescer" },
  { to: "/v3/whatsapp/campanhas", label: "Campanhas WhatsApp", icon: MessageSquare, section: "Crescer" },
  { to: "/v3/whatsapp/templates", label: "Templates WhatsApp", icon: MessageSquare, section: "Crescer" },
  { to: "/v3/whatsapp/pos-venda", label: "Pós-venda", icon: MessageCircle, section: "Crescer" },
  { to: "/v3/admin/promocoes", label: "Promoções", icon: Percent, section: "Crescer" },
  { to: "/v3/admin/banners", label: "Banners", icon: ImageIcon, section: "Crescer" },
  { to: "/v3/admin/push", label: "Push", icon: Bell, section: "Crescer" },
  { to: "/v3/admin/metas", label: "Metas de vendas", icon: Target, section: "Crescer" },
  { to: "/v3/bi", label: "Business Intelligence", icon: BarChart3, section: "Crescer" },
  { to: "/v3/ia", label: "Inteligência artificial", icon: Sparkles, section: "Crescer" },
  { to: "/v3/automacao", label: "Automação", icon: Workflow, section: "Crescer" },

  { to: "/v3/particular", label: "Meu financeiro", icon: Wallet, section: "Particular" },

  { to: "/v3/aprovacoes", label: "Aprovações", icon: ShieldCheck, section: "Ajustes" },
  { to: "/v3/admin/usuarios", label: "Usuários & permissões", icon: Users, section: "Ajustes" },
  { to: "/v3/configuracoes", label: "Configurações", icon: Cog, section: "Ajustes" },
];


export interface V2InternalShellProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}

export function V2InternalShell({ children, title, eyebrow = "Painel de comando", description, actions }: V2InternalShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { data: profile } = useProfile(user);
  const firstName = profile?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Usuário";

  return (
    <div className="min-h-screen w-full flex" style={{ background: V2.LIGHT_BG, color: V2.LIGHT_TEXT }}>
      {/* Sidebar: escondida em mobile e tablet (iPad usa drawer), full em desktop ≥lg. */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE, color: V2.TEXT }}>
        <ShellBrand />
        <ShellNav pathname={pathname} onNavigate={undefined} />
        <ShellFooter />
      </aside>


      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">

          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative flex flex-col w-64 max-w-[78%] border-r" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE, color: V2.TEXT }}>
            <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: V2.GRAPHITE }}>
              <ShellBrand compact />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 rounded-lg grid place-items-center border"
                style={{ borderColor: V2.GRAPHITE, color: V2.MUTED }}
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ShellNav pathname={pathname} onNavigate={() => setMobileOpen(false)} compact />
            <ShellFooter compact />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header sticky: em iPad/mobile o conteúdo rola por baixo da barra. */}
        <header
          className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 safe-x h-16 border-b backdrop-blur supports-[backdrop-filter]:bg-opacity-80"
          style={{ background: `${V2.LIGHT_SURFACE}f2`, borderColor: V2.LIGHT_BORDER }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden h-11 w-11 shrink-0 rounded-lg grid place-items-center border"
            style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0 max-w-md flex items-center gap-2 rounded-full px-4 h-10 border" style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: V2.LIGHT_MUTED }} />
            <input placeholder="Buscar pedido, cliente, SKU..." className="flex-1 min-w-0 bg-transparent outline-none text-sm" style={{ color: V2.LIGHT_TEXT }} />
          </div>


          <GuidedTour />

          <button type="button" className="h-10 w-10 rounded-full grid place-items-center border relative" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }} aria-label="Notificações">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full" style={{ background: V2.TEAL, boxShadow: `0 0 0 2px ${V2.LIGHT_SURFACE}` }} />
          </button>

          <div className="flex items-center gap-3 pl-3 border-l" style={{ borderColor: V2.LIGHT_BORDER }}>
            <div className="text-right leading-tight hidden md:block">
              <div className="text-sm font-semibold" style={{ color: V2.LIGHT_TEXT }}>{firstName}</div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: V2.LIGHT_MUTED }}>Conta ativa</div>
            </div>
            <div className="h-10 w-10 rounded-full grid place-items-center font-semibold" style={{ background: V2.TEAL, color: "#fff" }}>
              {firstName.slice(0, 1).toUpperCase()}
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 safe-x py-5 lg:py-8 overflow-y-auto overflow-x-hidden" style={{ background: V2.LIGHT_BG, color: V2.LIGHT_TEXT }}>
          {(title || description || actions) && (
            <section
              className="relative overflow-hidden rounded-3xl border p-6 lg:p-8 mb-6"
              style={{
                background: `radial-gradient(120% 100% at 100% 0%, ${V2.TEAL}22 0%, transparent 55%), linear-gradient(135deg, ${V2.SURFACE} 0%, ${V2.DARK} 100%)`,
                borderColor: V2.GRAPHITE,
              }}
            >
              <div aria-hidden className="absolute -top-16 -right-16 h-64 w-64 rounded-full blur-3xl pointer-events-none" style={{ background: `${V2.TEAL}33` }} />
              <div className="relative flex items-end justify-between flex-wrap gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: V2.TEAL }}>{eyebrow}</div>
                  {title && <h1 className="mt-2 font-semibold text-fluid-title tracking-tight truncate" style={{ color: V2.TEXT }}>{title}</h1>}
                  {description && <p className="text-sm mt-1" style={{ color: V2.MUTED }}>{description}</p>}
                </div>
                {actions}
              </div>
            </section>
          )}
          {children}
        </main>
      </div>
      
    </div>
  );
}

function ShellBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "px-3 py-2.5" : "p-5"}`} style={compact ? undefined : { borderBottom: `1px solid ${V2.GRAPHITE}` }}>
      <img src="/brand-logo.png" alt="Atacado Prime" className={compact ? "h-8 w-8 object-contain" : "h-10 w-10 object-contain"} />
      <div className="leading-tight">
        <div className={`font-semibold tracking-tight ${compact ? "text-sm" : "text-base"}`}>
          Atacado <span style={{ color: V2.TEAL }}>Prime</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: V2.MUTED }}>Painel</div>
      </div>
    </div>
  );
}

function ShellNav({ pathname, onNavigate, compact = false }: { pathname: string; onNavigate?: () => void; compact?: boolean }) {
  const grouped = useMemo(() => {
    return V2_INTERNAL_LINKS.reduce<Record<string, V2InternalLink[]>>((acc, item) => {
      const key = item.section ?? "Outros";
      (acc[key] ??= []).push(item);
      return acc;
    }, {});
  }, []);

  const order = useMemo(() => ["Geral", "Vender", "Clientes", "Operação", "Crescer", "Ajustes", "Particular"], []);
  const sections = useMemo(() => order.filter((k) => grouped[k]), [order, grouped]);

  const activeSections = useMemo(() => {
    const active = new Set<string>();
    for (const section of sections) {
      if (grouped[section].some((it) => pathname === it.to || (it.to !== "/v3" && it.to !== "/v3" && pathname.startsWith(`${it.to}/`)))) {
        active.add(section);
      }
    }
    return active;
  }, [pathname, sections, grouped]);

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of sections) initial[section] = activeSections.has(section);
    return initial;
  });

  const toggle = (section: string) => setOpen((prev) => ({ ...prev, [section]: !prev[section] }));

  return (
    <nav className={`flex-1 overflow-y-auto ${compact ? "p-2 space-y-1.5" : "p-3 space-y-4"}`}>
      {sections.map((section) => {
        const isOpen = open[section] ?? activeSections.has(section);
        return (
          <div key={section}>
            <button
              type="button"
              onClick={() => toggle(section)}
              className={`w-full flex items-center justify-between rounded-lg transition ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}
              style={{ color: V2.MUTED }}
              aria-expanded={isOpen}
              aria-controls={`nav-section-${section}`}
            >
              <span className={`uppercase tracking-[0.2em] font-semibold ${compact ? "text-[10px]" : "text-[10px]"}`}>{section}</span>
              {isOpen ? <ChevronDown className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} /> : <ChevronRight className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />}
            </button>
            {isOpen && (
              <div id={`nav-section-${section}`} className={`space-y-0.5 ${compact ? "mt-1" : "mt-1"}`}>
                {grouped[section].map((it) => {
                  const active = pathname === it.to || (it.to !== "/v3" && it.to !== "/v3" && pathname.startsWith(`${it.to}/`));
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      onClick={onNavigate}
                      className={`w-full flex items-center gap-2 rounded-lg font-medium transition ${compact ? "px-2 h-8 text-xs" : "px-3 h-10 text-sm"}`}
                      style={active ? { background: V2.TEAL, color: "#fff" } : { color: V2.MUTED }}
                    >
                      <it.icon className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
                      <span className="flex-1 text-left truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function LogoutButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleLogout = useCallback(async () => {
    setBusy(true);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }, [navigate]);

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="h-10 w-10 rounded-full grid place-items-center border transition hover:opacity-80 disabled:opacity-50"
      style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}
      aria-label="Sair e ir para a home"
      title="Sair e ir para a home"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}

function ShellFooter({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`border-t space-y-0.5 ${compact ? "p-2" : "p-3"}`} style={{ borderColor: V2.GRAPHITE }}>
      <Link to="/v3/aprovacoes" className={`w-full flex items-center gap-2 rounded-lg font-medium transition ${compact ? "px-2 h-8 text-xs" : "px-3 h-10 text-sm"}`} style={{ color: V2.MUTED }}>
        <Settings className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} /> Configurações
      </Link>
    </div>
  );
}