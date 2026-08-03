import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, ChevronRight, Truck, ShieldCheck, Phone, Gauge, Menu, X, Home, Heart, ShoppingBag, LogIn, LayoutGrid, Tag, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCanSeePrices } from "@/hooks/use-catalog";
import { useCart } from "@/components/v2/store";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { productImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import v3HeroWarm from "@/assets/v3-hero-warm.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atacado Prime — Chaves, capas e controles automotivos no atacado" },
      { name: "description", content: "Chaves, capas e controles Pósitron, Olimpus, Sistec, Hinor, Bravo e mais — preço de atacado para revendedores em todo o Brasil." },
      { property: "og:title", content: "Atacado Prime — Chaves, capas e controles automotivos no atacado" },
      { property: "og:description", content: "Chaves, capas e controles Pósitron, Olimpus, Sistec, Hinor, Bravo e mais — preço de atacado para revendedores." },
      { property: "og:url", content: "https://primeautomotive.app/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://primeautomotive.app/" }],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(categoriesQueryOptions());
    await context.queryClient.ensureQueryData(productsQueryOptions());
  },
  component: RootHome,
  errorComponent: ({ error }) => (
    <div style={{ padding: 24, color: "#3d2b1f", background: "#faf8f5", minHeight: "100vh" }}>
      <h1>Erro ao carregar página inicial</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>{String(error?.message ?? error)}</pre>
    </div>
  ),
  notFoundComponent: () => (
    <div style={{ padding: 24, color: "#3d2b1f", background: "#faf8f5", minHeight: "100vh" }}>
      Página não encontrada
    </div>
  ),
});

function categoriesQueryOptions() {
  return {
    queryKey: ["v3-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  };
}

function productsQueryOptions() {
  return {
    queryKey: ["v3-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, brands(nome), categories(nome), product_images(image_url, tipo_imagem, ordem)")
        .eq("status", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  };
}

const BG = "#faf8f5";
const SURFACE = "#ffffff";
const SURFACE_2 = "#f5f0e8";
const BORDER = "#e8e2d8";
const ORANGE = "#c9a96e";
const TEXT = "#3d2b1f";
const MUTED = "#8b7355";

type CategoryRow = { id: string; nome: string; parent_id?: string | null };

function RootHome() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { data: cats = [] } = useSuspenseQuery(categoriesQueryOptions());
  const { data: products = [] } = useSuspenseQuery(productsQueryOptions());
  const { canSeePrices } = useCanSeePrices();
  const { add: addToCart } = useCart();

  const GROUPS: { label: string; tipo: string }[] = [
    { label: "Capas", tipo: "carcaca" },
    { label: "Chaves", tipo: "chave" },
    { label: "Controles", tipo: "controle" },
  ];

  const catIds = cat
    ? new Set<string>([cat, ...cats.filter((c: CategoryRow) => c.parent_id === cat).map((c: CategoryRow) => c.id)])
    : null;
  const groups = GROUPS.map(({ label, tipo }) => {
    const items = products.filter(
      (p: any) => p.tipo === tipo && (!catIds || (p.categoria_id && catIds.has(p.categoria_id))),
    );
    return { label, id: null as string | null, items };
  }).filter((g) => g.items.length > 0);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate({ to: "/", search: term ? { q: term } : {} });
  };

  const rootCats = cats.filter((c: CategoryRow) => !c.parent_id).slice(0, 12);

  return (
    <div className="min-h-screen w-full" style={{ background: BG, color: TEXT }}>
      {/* Header V3 */}
      <header
        className="sticky top-0 z-30 backdrop-blur border-b"
        style={{ background: "rgba(255,255,255,0.92)", borderColor: BORDER }}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="Atacado Prime">
            <img src="/brand-logo.png" alt="Atacado Prime" width={48} height={48} className="h-11 w-11 object-contain transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-base sm:text-lg leading-none" style={{ color: TEXT }}>
                Atacado <span style={{ color: ORANGE }}>Prime</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-amber-700/80 mt-0.5">
                Distribuidor B2B
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/5534998651112?text=Ol%C3%A1!%20Gostaria%20de%20atendimento%20para%20revendedor%20no%20Atacado%20Prime."
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3.5 rounded-full text-xs font-bold hidden md:inline-flex items-center gap-1.5 transition-colors border"
              style={{ borderColor: "#25D366", color: "#1b8a43", background: "rgba(37, 211, 102, 0.08)" }}
            >
              <MessageCircle className="h-3.5 w-3.5 fill-current" />
              WhatsApp
            </a>
            <Link
              to="/cart"
              className="h-9 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-transform active:scale-95 shadow-sm"
              style={{ background: ORANGE, color: "#fff" }}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Pedido</span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              className="h-10 w-10 grid place-items-center rounded-full border transition-colors hover:bg-black/5"
              style={{ borderColor: BORDER, color: TEXT, background: SURFACE }}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer / Menu sanduíche */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <button
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="flex-1"
            style={{ background: "rgba(61,43,31,0.4)" }}
          />
          <aside
            className="w-[82%] max-w-sm h-full flex flex-col"
            style={{ background: SURFACE, borderLeft: `1px solid ${BORDER}` }}
          >
            <div className="h-14 px-5 flex items-center justify-between border-b" style={{ borderColor: BORDER }}>
              <span className="text-xs font-black tracking-[0.25em] uppercase" style={{ color: TEXT }}>
                Menu
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                className="h-9 w-9 grid place-items-center rounded-full"
                style={{ color: TEXT }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              {[
                { to: "/", label: "Home", icon: Home },
                { to: "/v3/descontos", label: "Como funcionam os descontos", icon: Tag },
                { to: "/favorites", label: "Favoritos", icon: Heart },
                { to: "/cart", label: "Meu carrinho", icon: ShoppingBag },
                { to: "/auth", label: "Entrar / Cadastrar", icon: LogIn },
              ].map((i) => (
                <Link
                  key={i.to + i.label}
                  to={i.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-5 py-3 text-sm font-semibold"
                  style={{ color: TEXT }}
                >
                  <span
                    className="h-9 w-9 grid place-items-center rounded-lg"
                    style={{ background: "rgba(201,169,110,0.12)", color: ORANGE }}
                  >
                    <i.icon className="h-4 w-4" />
                  </span>
                  {i.label}
                </Link>
              ))}
            </nav>
            <div className="p-5 border-t text-[11px]" style={{ borderColor: BORDER, color: MUTED }}>
              (34) 99865-1112 · Uberlândia-MG
            </div>
          </aside>
        </div>
      )}

      {/* Hero Banner Lançamento */}
      <section className="relative overflow-hidden" style={{ background: "#faf8f5" }}>
        <img
          src={v3HeroWarm}
          alt=""
          aria-hidden
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover object-right"
        />
        <div
          aria-hidden
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(250,248,245,0.96) 0%, rgba(250,248,245,0.88) 55%, rgba(250,248,245,0.75) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(90deg, rgba(250,248,245,0.95) 0%, rgba(250,248,245,0.80) 45%, rgba(250,248,245,0.15) 85%, transparent 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-32"
          style={{ background: `linear-gradient(180deg, transparent, ${BG})` }}
        />

        <div className="relative max-w-6xl mx-auto px-5 py-14 lg:py-20">
          <div className="max-w-2xl">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-[0.15em] mb-5 shadow-sm"
              style={{ background: ORANGE, color: "#ffffff" }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Lançamento Oficial · Catálogo B2B
            </div>
            <h1 className="font-black text-fluid-hero text-balance leading-[1.1]" style={{ color: TEXT }}>
              Chaves, Capas e Controles.{" "}
              <span style={{ color: ORANGE }}>Direto de quem distribui.</span>
            </h1>
            <p className="mt-4 text-fluid-body max-w-xl font-medium leading-relaxed" style={{ color: "#5a4633" }}>
              Linha completa Pósitron, Olimpus, Sistec, Hinor, Bravo e modelos originais. Tabela especial para revendedores, chaveiros e lojas automotivas em todo o Brasil.
            </p>

            <form
              onSubmit={submitSearch}
              className="mt-8 flex items-center gap-2 max-w-md rounded-full px-3 py-2 border shadow-xl transition-all focus-within:ring-2 focus-within:ring-[#c9a96e]"
              style={{ background: SURFACE, borderColor: BORDER }}
            >
              <div className="flex-1 flex items-center gap-2 px-2">
                <Search className="h-5 w-5 shrink-0" style={{ color: MUTED }} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar modelo de chave, capa ou controle..."
                  className="flex-1 outline-none bg-transparent text-sm font-medium"
                  style={{ color: TEXT }}
                />
              </div>
              <button
                type="submit"
                className="h-11 px-6 rounded-full font-extrabold text-sm transition-transform active:scale-95 shadow"
                style={{ background: ORANGE, color: "#fff" }}
              >
                Buscar
              </button>
            </form>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-5 pb-32 -mt-12 relative z-10">
        {/* Benefícios */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Truck, t: "Entrega rápida", s: "Enviamos em até 24h" },
            { icon: ShieldCheck, t: "Garantia real", s: "Troca sem burocracia" },
            { icon: Phone, t: "Suporte especializado", s: "Atendimento técnico" },
          ].map((b) => (
            <div
              key={b.t}
              className="rounded-2xl p-5 border flex items-center gap-4"
              style={{ background: SURFACE, borderColor: BORDER }}
            >
              <div
                className="h-12 w-12 rounded-xl grid place-items-center shrink-0"
                style={{ background: "rgba(201,169,110,0.12)", color: ORANGE }}
              >
                <b.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: TEXT }}>
                  {b.t}
                </div>
                <div className="text-xs" style={{ color: MUTED }}>
                  {b.s}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Banner descontos */}
        <Link
          to="/v3/descontos"
          className="mt-6 rounded-2xl p-5 sm:p-6 flex items-center gap-4 border transition hover:shadow-md"
          style={{ background: SURFACE, borderColor: ORANGE }}
        >
          <div
            className="h-12 w-12 rounded-xl grid place-items-center shrink-0"
            style={{ background: ORANGE, color: "#fff" }}
          >
            <Tag className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm sm:text-base font-black" style={{ color: TEXT }}>
              Quanto mais você leva, mais barato fica
            </div>
            <div className="text-xs sm:text-sm mt-0.5" style={{ color: MUTED }}>
              Entenda as três tabelas de desconto em 30 segundos.
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0" style={{ color: ORANGE }} />
        </Link>

        {/* Categorias */}
        {rootCats.length > 0 && (
          <section className="mt-10">
            <div className="flex items-end justify-between mb-4">
              <h2 className="font-bold text-xl" style={{ color: TEXT }}>
                Categorias
              </h2>
              <button
                onClick={() => setCat(null)}
                className="text-xs font-semibold flex items-center gap-0.5"
                style={{ color: ORANGE }}
              >
                Ver tudo <ChevronRight className="inline h-3 w-3" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 snap-x">
              {rootCats.map((c: CategoryRow) => {
                const active = cat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCat(active ? null : c.id)}
                    className={cn("shrink-0 snap-start px-5 h-11 rounded-full text-sm font-semibold transition border")}
                    style={
                      active
                        ? { background: ORANGE, color: "#fff", borderColor: ORANGE }
                        : { background: SURFACE, color: TEXT, borderColor: BORDER }
                    }
                  >
                    {c.nome}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Produtos por categoria */}
        {groups.map((group) => (
          <section key={group.label} className="mt-12">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h2 className="font-bold text-xl" style={{ color: TEXT }}>
                  {group.label}
                </h2>
                <p className="text-xs" style={{ color: MUTED }}>
                  {group.items.length} {group.items.length === 1 ? "produto" : "produtos"} disponíveis
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {group.items.map((p: any) => {
                const price = Number(p.preco_unitario ?? 0);
                const pkgPrice = p.preco_pacote != null ? Number(p.preco_pacote) : null;
                const pkgQty = Number(p.quantidade_pacote ?? 1);
                const hasPkg = pkgPrice != null && pkgQty > 1;
                const imgs = (p.product_images ?? []).slice().sort(
                  (a: { ordem: number }, b: { ordem: number }) => (a.ordem ?? 0) - (b.ordem ?? 0),
                );
                const image: string | undefined = imgs[0]?.image_url;
                return (
                  <article
                    key={p.id}
                    className="rounded-2xl border overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                    style={{ background: SURFACE, borderColor: BORDER }}
                  >
                    <div className="block aspect-square relative overflow-hidden" style={{ background: SURFACE }}>
                      {image ? (
                        <img
                          src={productImageUrl(image)}
                          alt={p.nome}
                          loading="lazy"
                          className="w-full h-full object-contain p-3"
                        />
                      ) : (
                        <span
                          className="absolute inset-0 grid place-items-center text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: MUTED }}
                        >
                          {p.categories?.nome ?? "sem foto"}
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <div
                        className="text-[10px] font-mono font-bold uppercase tracking-wider"
                        style={{ color: ORANGE }}
                      >
                        {p.sku ?? p.codigo_fabricante ?? "—"}
                      </div>
                      <h3 className="mt-1 font-bold text-sm leading-tight line-clamp-2" style={{ color: TEXT }}>
                        {p.nome}
                      </h3>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[9px] uppercase tracking-wider" style={{ color: MUTED }}>
                            unitário
                          </span>
                          <span className="font-black text-base" style={{ color: TEXT }}>
                            R$ {price.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                        {hasPkg && (
                          <div
                            className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1"
                            style={{ background: SURFACE_2 }}
                          >
                            <span className="text-[9px] uppercase tracking-wider" style={{ color: MUTED }}>
                              pacote {pkgQty}un
                            </span>
                            <span className="font-bold text-sm" style={{ color: ORANGE }}>
                              R$ {pkgPrice!.toFixed(2).replace(".", ",")}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!canSeePrices) {
                            navigate({
                              to: "/auth",
                              search: { mode: "signup", redirect: "/" } as any,
                            });
                            return;
                          }
                          addToCart({
                            id: p.id,
                            nome: p.nome,
                            sku: p.sku,
                            preco: price,
                            image: image ?? null,
                            quantidade_pacote: pkgQty,
                            preco_pacote: pkgPrice,
                          });
                        }}
                        className="mt-3 w-full h-11 rounded-full font-bold text-xs sm:text-sm active:scale-[0.98] transition shadow"
                        style={{ background: ORANGE, color: "#fff" }}
                        title={canSeePrices ? "Adicionar ao carrinho" : "Cadastre-se para comprar"}
                      >
                        {canSeePrices ? "Adicionar ao Pedido" : "Entrar para comprar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {/* Banner CTA */}
        <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-3xl p-8 lg:p-10 overflow-hidden relative shadow-lg" style={{ background: ORANGE }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">
              // Primeira Compra B2B
            </div>
            <h3 className="mt-2 font-bold text-2xl lg:text-3xl leading-tight text-white">
              Cadastre sua empresa e receba a <span className="font-black">tabela exclusiva</span>.
            </h3>
            <Link
              to="/auth"
              search={{ mode: "signup" } as any}
              className="mt-5 inline-flex h-12 px-6 rounded-full font-bold text-sm items-center shadow"
              style={{ background: "#faf8f5", color: TEXT }}
            >
              Criar conta de revendedor →
            </Link>
          </div>

          <div
            className="rounded-3xl p-8 lg:p-10 relative overflow-hidden border-2"
            style={{ background: SURFACE, borderColor: ORANGE }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: ORANGE }}
            >
              // Promoções & Lançamentos
            </div>
            <h3 className="mt-2 font-bold text-2xl lg:text-3xl leading-tight" style={{ color: TEXT }}>
              Receba ofertas antes de todo mundo.
            </h3>
            <p className="mt-3 text-sm" style={{ color: MUTED }}>
              Ative as notificações para saber quando uma nova linha de chaves ou controles chegar.
            </p>
            <button
              onClick={async () => {
                if (typeof window === "undefined" || !("Notification" in window)) {
                  alert("Seu navegador não suporta notificações.");
                  return;
                }
                const perm = await Notification.requestPermission();
                if (perm === "granted") {
                  new Notification("Prime Automotive", {
                    body: "Pronto! Você receberá as promoções em primeira mão.",
                  });
                }
              }}
              className="mt-5 h-12 px-6 rounded-full font-bold text-sm text-white inline-flex items-center gap-2 shadow"
              style={{ background: ORANGE }}
            >
              Ativar notificações <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="max-w-6xl mx-auto px-5 py-8 text-xs" style={{ color: MUTED }}>
          <div className="font-black text-sm tracking-[0.2em] uppercase mb-2" style={{ color: TEXT }}>
            Atacado Prime
          </div>
          <div>Uberlândia-MG · (34) 99865-1112 · contato@primeautomotive.app</div>
          <div className="mt-3 opacity-60">© {new Date().getFullYear()} Prime Automotive · Distribuidor B2B</div>
        </div>
      </footer>

      {/* Botão Flutuante do WhatsApp */}
      <WhatsAppFab />
    </div>
  );
}
