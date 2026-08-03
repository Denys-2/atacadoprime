import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LogOut, LayoutDashboard, Building2, MapPin, Users, ShieldCheck, Settings as SettingsIcon,
  Store, Package, Heart, BoxSelect, ShoppingCart, ClipboardList, Target, MessageCircle,
  Megaphone, FileText, Navigation, Calendar, Rocket, Map as MapIcon, Brain, DollarSign,
  Warehouse, TrendingUp, Shield, Workflow, UserCircle, ChevronDown, ChevronRight, Sparkles, Menu, Search,
  UserCheck, Briefcase, X, Bell, Pencil, AlertTriangle, Landmark, Activity, CloudOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import brandLogo from "@/assets/brand-logo.png.asset.json";
import { useAuth, useProfile, useRoles } from "@/hooks/use-auth";
import { useSellerSession } from "@/hooks/use-seller-session";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { SoulPageHeader } from "@/components/soul-page-header";
import { OfflinePendingBadge } from "@/components/offline-pending-badge";
import { toast } from "sonner";

type Icon = typeof LayoutDashboard;
type NavLeaf = { to: string; label: string; icon: Icon };
type NavGroup = { label: string; icon: Icon; items: NavLeaf[] };
type NavSection = NavLeaf | NavGroup;

const isGroup = (n: NavSection): n is NavGroup => "items" in n;

const customerNav: NavSection[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/portal", label: "Portal do Cliente", icon: UserCircle },
  {
    label: "Compras", icon: Package, items: [
      { to: "/v3", label: "Catálogo", icon: Package },
      { to: "/cart", label: "Carrinho", icon: ShoppingCart },
      { to: "/favorites", label: "Favoritos", icon: Heart },
    ],
  },
  {
    label: "Pedidos", icon: ClipboardList, items: [
      { to: "/orders", label: "Meus pedidos", icon: ClipboardList },
    ],
  },
  {
    label: "Minha Conta", icon: Building2, items: [
      { to: "/companies", label: "Minha empresa", icon: Building2 },
      { to: "/addresses", label: "Endereços", icon: MapPin },
      { to: "/settings", label: "Configurações", icon: SettingsIcon },
    ],
  },
];

// Admin nav agrupado por área de negócio (Midnight Executive)
const adminNav: NavSection[] = [
  { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/bi", label: "BI Executivo", icon: TrendingUp },
  {
    label: "Comercial", icon: Target, items: [
      { to: "/vendas/nova", label: "Venda em Visita", icon: Briefcase },
      { to: "/crm", label: "CRM", icon: Target },
      { to: "/crm/prospeccao", label: "Prospecção", icon: Search },
      { to: "/ai", label: "IA Comercial", icon: Brain },
      { to: "/campaigns", label: "Campanhas", icon: Rocket },
    ],
  },

  {
    label: "Operações", icon: Navigation, items: [
      { to: "/field", label: "Campo", icon: Navigation },
      { to: "/vendas-offline", label: "Venda Offline", icon: CloudOff },
      { to: "/field/agenda", label: "Agenda", icon: Calendar },
      { to: "/routes", label: "Rotas & Mapa", icon: MapIcon },
    ],
  },
  {
    label: "Catálogo", icon: BoxSelect, items: [
      { to: "/admin/catalog", label: "Produtos", icon: BoxSelect },
      { to: "/inventory", label: "Estoque", icon: Warehouse },
      { to: "/inventory/alerts", label: "Alertas de estoque", icon: AlertTriangle },
      { to: "/inventory/counts", label: "Inventário cíclico", icon: ClipboardList },
      { to: "/admin/labels", label: "Etiquetas / Cód. Barras", icon: FileText },
    ],
  },
  {
    label: "Pedidos & Financeiro", icon: ClipboardList, items: [
      { to: "/admin/orders", label: "Pedidos", icon: ClipboardList },
      { to: "/admin/abandoned-carts", label: "Carrinhos abandonados", icon: ShoppingCart },
      { to: "/finance", label: "Financeiro", icon: DollarSign },
      { to: "/finance/reconciliation", label: "Conciliação bancária", icon: Landmark },
      { to: "/admin/fees", label: "Taxas & Parcelamento", icon: DollarSign },
    ],
  },
  {
    label: "Comunicação", icon: MessageCircle, items: [
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/whatsapp/campaigns", label: "Campanhas WhatsApp", icon: Megaphone },
      { to: "/whatsapp/templates", label: "Templates", icon: FileText },
      { to: "/admin/push", label: "Push de Ofertas", icon: Bell },
    ],
  },
  {
    label: "Automações", icon: Workflow, items: [
      { to: "/automation", label: "Workflows", icon: Workflow },
    ],
  },
  {
    label: "Administração", icon: Shield, items: [
      { to: "/admin/companies", label: "Clientes / Aprovações", icon: ShieldCheck },
      { to: "/admin/users", label: "Usuários", icon: Users },
      { to: "/admin/sales-targets", label: "Metas de vendas", icon: Target },
      { to: "/admin/observability", label: "Observabilidade & LGPD", icon: Activity },
      { to: "/admin/promotions", label: "Promoções", icon: Megaphone },
      { to: "/admin/banners", label: "Banners da loja", icon: Megaphone },
      { to: "/admin/system", label: "Sistema", icon: Shield },
      { to: "/settings", label: "Configurações", icon: SettingsIcon },
    ],
  },
];

const segmentLabels: Record<string, string> = {
  admin: "Admin",
  companies: "Empresas",
  catalog: "Catálogo",
  orders: "Pedidos",
  users: "Usuários",
  system: "Sistema",
  dashboard: "Dashboard",
  whatsapp: "WhatsApp",
  campaigns: "Campanhas",
  templates: "Templates",
  field: "Campo",
  "venda-offline": "Venda Offline",
  agenda: "Agenda",
  routes: "Rotas",
  inventory: "Estoque",
  finance: "Financeiro",
  crm: "CRM",
  ai: "IA Comercial",
  bi: "BI Executivo",
  automation: "Automações",
  settings: "Configurações",
  portal: "Portal",
  cart: "Carrinho",
  favorites: "Favoritos",
  addresses: "Endereços",
};

export function AppShell({ children, title, description }: { children: ReactNode; title: string; description?: string }) {
  const { user } = useAuth();
  const { data: profile } = useProfile(user);
  const { data: roles = [] } = useRoles(user);
  const isAdmin = roles.includes("admin");
  const isStaff = isAdmin || roles.includes("vendedor") || roles.includes("gerente");
  const sellerCustomer = useSellerSession((s) => s.customer);
  const endSellerSale = useSellerSession((s) => s.endSale);
  const clearCart = useCart((s) => s.clear);
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.quantidade, 0));
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onCheckout = pathname.startsWith("/checkout");
  const cartEmpty = cartCount === 0;

  function encerrarVenda() {
    endSellerSale();
    clearCart();
    toast.success("Venda encerrada");
    router.navigate({ to: "/vendas/nova" });
  }

  const initials = (profile?.full_name ?? user?.email ?? "?")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", search: { mode: "login" as const, redirect: undefined }, replace: true });
  }

  const sections = isStaff ? adminNav : customerNav;
  const segments = pathname.split("/").filter(Boolean);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Renderiza top-level leafs direto e grupos como submenus colapsáveis
  // (abrem só quando a rota ativa pertence ao grupo). Evita rolagem
  // infinita em mobile.
  function renderNav() {
    return sections.map((s) =>
      isGroup(s)
        ? <NavGroupItem key={s.label} group={s} pathname={pathname} />
        : <FlatNavLink key={s.to} item={s} />
    );
  }


  return (
    <div className="min-h-dvh bg-[#f4f6fb] text-foreground flex selection:bg-primary/15">
      {/* ===== Sidebar (Navy) ===== */}
      <aside className="hidden lg:flex w-[240px] flex-col bg-[#2b3a8c] text-white shrink-0 pt-[var(--app-safe-top)]">
        <div className="px-5 h-16 flex items-center">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center overflow-hidden">
              <img src="/brand-logo.png" alt="Prime" className="h-6 w-6 object-contain" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-extrabold tracking-tight text-white">Atacado <span className="text-white/60">Prime</span></p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/60 font-semibold">{isAdmin ? "Painel Admin" : "Painel B2B"}</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {renderNav()}
        </nav>


        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 transition-colors">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-white/15 text-white text-[12px] font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white truncate leading-tight">{profile?.full_name ?? (isAdmin ? "Admin" : "Usuário")}</p>
              <p className="text-[10px] text-white/60 truncate">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ===== Mobile drawer ===== */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[272px] p-0 bg-[#2b3a8c] text-white border-0 pt-[var(--app-safe-top)]">
          <VisuallyHidden>
            <SheetTitle>Menu de navegação</SheetTitle>
            <SheetDescription>Navegação principal do sistema</SheetDescription>
          </VisuallyHidden>
          <div className="px-5 h-16 flex items-center">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center overflow-hidden">
                <img src="/brand-logo.png" alt="Prime" className="h-6 w-6 object-contain" />
              </div>
              <span className="font-display text-[15px] font-extrabold tracking-tight text-white">Atacado <span className="text-white/60">Prime</span></span>
            </div>
          </div>
          <nav className="px-3 py-4 space-y-1 overflow-y-auto h-[calc(100dvh_-_64px_-_var(--app-safe-top))]">
            {renderNav()}
          </nav>

        </SheetContent>
      </Sheet>

      {/* ===== Main column ===== */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-primary border-b border-primary-foreground/10 pt-[var(--app-safe-top)]">
          <div className="px-4 lg:px-8 h-16 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="lg:hidden shrink-0 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden md:flex flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
                <input
                  type="search"
                  placeholder="Buscar…"
                  className="w-full h-10 pl-10 pr-3 rounded-full bg-primary-foreground/10 border border-primary-foreground/10 text-[13px] text-primary-foreground placeholder:text-primary-foreground/60 focus:outline-none focus:bg-primary-foreground/20 focus:border-primary-foreground/20 transition-colors"
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <OfflinePendingBadge />
              <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1 text-[12px] font-medium text-primary-foreground/70">
                {segments.map((seg, idx) => {
                  const label = segmentLabels[seg] ?? decodeURIComponent(seg).replace(/-/g, " ");
                  const last = idx === segments.length - 1;
                  return (
                    <span key={idx} className="flex items-center gap-1 capitalize">
                      {idx > 0 && <ChevronRight className="h-3 w-3 text-primary-foreground/40 shrink-0" />}
                      <span className={cn(last ? "text-primary-foreground" : "text-primary-foreground/70")}>{label}</span>
                    </span>
                  );
                })}
              </nav>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair" className="lg:hidden text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="bg-slate-50 flex-1 flex flex-col">
          <div className="px-4 lg:px-10 pt-10 pb-2">
            <SoulPageHeader title={title} description={description} />
          </div>

          {sellerCustomer && (
            <div className="px-4 lg:px-10 pt-4">
              <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3 flex flex-wrap items-center gap-3">
                <UserCheck className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0 text-sm">
                  <span className="text-muted-foreground">Venda em andamento para </span>
                  <strong className="text-foreground">{sellerCustomer.trade_name ?? sellerCustomer.legal_name}</strong>
                  {sellerCustomer.tax_id && <span className="text-muted-foreground"> · CNPJ {sellerCustomer.tax_id}</span>}
                </div>
                {onCheckout ? (
                  cartEmpty ? (
                    <Link to="/v3"><Button size="sm">Adicionar produtos</Button></Link>
                  ) : null
                ) : (
                  <Link to="/v3">
                    <Button size="sm" variant={cartEmpty ? "default" : "outline"}>
                      {cartEmpty ? "Adicionar produtos" : "Continuar comprando"}
                    </Button>
                  </Link>
                )}
                {!cartEmpty && (
                  <Link to="/cart">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Editar preços
                    </Button>
                  </Link>
                )}
                {!onCheckout && !cartEmpty && (
                  <Link to="/checkout"><Button size="sm">Ir ao checkout ({cartCount})</Button></Link>
                )}
                <Button size="sm" variant="ghost" onClick={encerrarVenda} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4 mr-1" />Encerrar
                </Button>
              </div>
            </div>
          )}

          <div className="px-4 lg:px-10 py-8 flex-1">
            <div className="max-w-7xl">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

// === Flat nav (sidebar navy com pill ativo branco) =========================
function FlatNavLink({ item }: { item: NavLeaf }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: false }}
      className={cn(
        "group flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors",
        "text-white/70 hover:text-white hover:bg-white/10",
        "data-[status=active]:bg-white data-[status=active]:text-[#2b3a8c] data-[status=active]:font-semibold data-[status=active]:shadow-sm",
      )}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavGroupItem({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActive = group.items.some((it) => pathname.startsWith(it.to));
  const [open, setOpen] = useState(hasActive);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        aria-expanded={open}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        <span className="truncate">{group.label}</span>
        <ChevronDown className={cn("h-4 w-4 ml-auto opacity-60 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="pl-3 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {group.items.map((it) => <FlatNavLink key={it.to} item={it} />)}
        </div>
      )}
    </div>
  );
}


export function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending: "bg-warning/15 text-warning border-warning/30",
    approved: "bg-success/15 text-success border-success/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  } as const;
  const dot = {
    pending: "bg-warning",
    approved: "bg-success",
    rejected: "bg-destructive",
  } as const;
  const label = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" }[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border", map[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full status-dot-glow", dot[status])} />
      {label}
    </span>
  );
}
