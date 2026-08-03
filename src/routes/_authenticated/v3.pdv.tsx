import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useSellerSession } from "@/hooks/use-seller-session";
import { useCart, type CartItem, type CartTipo, cartEffectiveSubtotal, effectiveUnitPrice, tierFor, TIER_2_MIN, TIER_3_MIN } from "@/hooks/use-cart";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { useCreateOrder, useConfirmPayment } from "@/hooks/use-orders";
import { useBankAccounts } from "@/hooks/use-bank-accounts";
import {
  Search, Plus, Minus, Trash2, Pencil, ShoppingCart, ArrowLeft, User,
  QrCode, CreditCard, Banknote, Loader2, CheckCircle2, Package, CalendarClock,
} from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const Route = createFileRoute("/_authenticated/v3/pdv")({
  head: () => ({ meta: [{ title: "PDV — Venda rápida" }] }),
  component: PdvPage,
});

type Product = {
  id: string; nome: string; sku: string; tipo: string;
  preco_unitario: number | string; preco_pacote: number | string | null;
  preco_nivel_1: number | string | null; preco_nivel_2: number | string | null; preco_nivel_3: number | string | null;
  quantidade_pacote: number | null; estoque: number | null;
  categoria_id: string | null; marca_id: string | null;
  brands?: { nome: string } | null; categories?: { nome: string } | null;
  product_images?: { image_url: string; tipo_imagem: string | null; ordem: number | null }[];
};

const GROUPS: { label: string; tipo: string }[] = [
  { label: "Todos", tipo: "" },
  { label: "Capas", tipo: "carcaca" },
  { label: "Chaves", tipo: "chave" },
  { label: "Controles", tipo: "controle" },
];

function PdvPage() {
  const { user } = useAuth();
  const { data: roles = [] } = useRoles(user);
  const isStaff = roles.some((r) => r === "admin" || r === "vendedor" || r === "gerente");

  const navigate = useNavigate();
  const customer = useSellerSession((s) => s.customer);
  const tripId = useSellerSession((s) => s.tripId);
  const endSale = useSellerSession((s) => s.endSale);

  const items = useCart((s) => s.items);
  const addToCart = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const setPreco = useCart((s) => s.setPreco);
  const removeItem = useCart((s) => s.remove);
  const clearCart = useCart((s) => s.clear);

  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [cartOpen, setCartOpen] = useState(false);
  const [descontoPct, setDescontoPct] = useState(0);
  const [descontoRs, setDescontoRs] = useState(0);
  const [frete, setFrete] = useState(0);
  const [quickAdd, setQuickAdd] = useState<Product | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["pdv-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, sku, tipo, preco_unitario, preco_pacote, preco_nivel_1, preco_nivel_2, preco_nivel_3, quantidade_pacote, estoque, categoria_id, marca_id, brands(nome), categories(nome), product_images(image_url, tipo_imagem, ordem)")
        .eq("status", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Atalhos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (tipo && p.tipo !== tipo) return false;
      if (!term) return true;
      return (
        p.nome?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.brands?.nome?.toLowerCase().includes(term)
      );
    });
  }, [products, q, tipo]);

  function primaryImage(p: Product) {
    const list = (p.product_images ?? []).slice().sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
    return list[0]?.image_url ?? null;
  }

  function addProduct(p: Product, mode: CartTipo) {
    const hasPkg = !!(p.preco_pacote && (p.quantidade_pacote ?? 1) > 1);
    if (mode === "PACOTE" && !hasPkg) mode = "UNITARIO";
    addToCart({
      product_id: p.id,
      nome: p.nome,
      sku: p.sku,
      image_url: primaryImage(p),
      tipo_compra: mode,
      preco_unitario: Number(p.preco_nivel_1 ?? p.preco_unitario),
      quantidade_pacote: Number(p.quantidade_pacote ?? 1),
      preco_pacote: p.preco_pacote != null ? Number(p.preco_pacote) : null,
      preco_nivel_1: p.preco_nivel_1 != null ? Number(p.preco_nivel_1) : Number(p.preco_unitario),
      preco_nivel_2: p.preco_nivel_2 != null ? Number(p.preco_nivel_2) : Number(p.preco_unitario),
      preco_nivel_3: p.preco_nivel_3 != null ? Number(p.preco_nivel_3) : Number(p.preco_unitario),
    });
    if (!cartOpen && window.innerWidth < 1024) toast.success(`${p.nome} adicionado`, { duration: 900 });
  }

  function handleSearchEnter(e: React.FormEvent) {
    e.preventDefault();
    if (filtered.length > 0) {
      setQuickAdd(filtered[0]);
      setQ("");
    }
  }

  // Subtotal aplica automaticamente a faixa (nível) pelo total do carrinho
  const { subtotal, tier } = cartEffectiveSubtotal(items);
  const descontoTotal = Math.min(subtotal, descontoRs + (subtotal * descontoPct) / 100);
  const total = Math.max(0, subtotal - descontoTotal + frete);
  const totalUnidades = items.reduce((s, it) => s + (it.tipo_compra === "PACOTE" ? it.quantidade * (it.quantidade_pacote ?? 1) : it.quantidade), 0);

  // Alerta: quanto falta pra próxima faixa (só quando há economia real)
  const nextTierGap = (() => {
    if (items.length === 0) return null;
    const anyTiered = items.some((i) =>
      i.tipo_compra === "UNITARIO" &&
      i.preco_nivel_2 != null && i.preco_nivel_3 != null &&
      (Number(i.preco_nivel_2) < Number(i.preco_nivel_1 ?? i.preco_unitario) ||
        Number(i.preco_nivel_3) < Number(i.preco_nivel_1 ?? i.preco_unitario))
    );
    if (!anyTiered) return null;
    if (tier === 1 && subtotal < TIER_2_MIN) return { falta: TIER_2_MIN - subtotal, proxNivel: 2 as const };
    if (tier === 2 && subtotal < TIER_3_MIN) return { falta: TIER_3_MIN - subtotal, proxNivel: 3 as const };
    return null;
  })();

  if (!isStaff) {
    return (
      <V2InternalShell title="PDV" eyebrow="Venda rápida" description="Área exclusiva da equipe de vendas.">
        <div className="rounded-2xl border p-6 text-sm" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}>
          Esta área é exclusiva da equipe de vendas.
        </div>
      </V2InternalShell>
    );
  }

  return (
    <V2InternalShell
      title="PDV — Venda rápida"
      eyebrow="Atendimento em campo"
      description={customer ? `Cliente: ${customer.trade_name ?? customer.legal_name}` : "Selecione um cliente para iniciar."}
      actions={
        <div className="flex items-center gap-2">
          <Link to="/v3/vendas/nova" className="h-10 px-4 rounded-full text-sm font-medium grid place-items-center border" style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT, background: V2.LIGHT_SURFACE }}>
            <ArrowLeft className="h-4 w-4 mr-1.5 inline" /> Trocar cliente
          </Link>
          {/* Botão flutuante do carrinho no mobile */}
          <Dialog open={cartOpen} onOpenChange={setCartOpen}>
            <Button onClick={() => setCartOpen(true)} className="lg:hidden h-10 px-4 rounded-full relative" style={{ background: V2.TEAL, color: "#fff" }}>
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              {items.length > 0 && <span className="mr-1 font-bold">{items.length}</span>}
              {brl(total)}
            </Button>
            <DialogContent className="p-0 gap-0 overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto] max-w-2xl w-[96vw] h-[92dvh] sm:h-[88vh]" style={{ background: V2.LIGHT_BG, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }}>
              <DialogHeader className="px-4 py-2.5 border-b shrink-0 pr-11" style={{ borderColor: V2.LIGHT_BORDER, background: V2.LIGHT_SURFACE }}>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 shrink-0" style={{ color: V2.TEAL }} />
                  <DialogTitle className="text-base leading-tight" style={{ color: V2.LIGHT_TEXT }}>Carrinho</DialogTitle>
                  {items.length > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
                      {items.length} {items.length === 1 ? "item" : "itens"}
                    </span>
                  )}
                  <button
                    onClick={() => setCartOpen(false)}
                    className="ml-auto h-8 px-3 rounded-full text-xs font-semibold border transition-all hover:opacity-90"
                    style={{ background: V2.LIGHT_SURFACE_2, color: V2.TEAL, borderColor: V2.LIGHT_BORDER }}
                  >
                    Continuar
                  </button>
                </div>
              </DialogHeader>
              <CartPanel
                items={items}
                setQty={setQty}
                setPreco={setPreco}
                removeItem={removeItem}
                clearCart={clearCart}
                customer={customer}
                tripId={tripId}
                subtotal={subtotal}
                descontoPct={descontoPct}
                setDescontoPct={setDescontoPct}
                descontoRs={descontoRs}
                setDescontoRs={setDescontoRs}
                descontoTotal={descontoTotal}
                frete={frete}
                setFrete={setFrete}
                total={total}
                totalUnidades={totalUnidades}
                tier={tier}
                nextTierGap={nextTierGap}
                onFinalized={() => { setCartOpen(false); endSale(); navigate({ to: "/v3/hoje" }); }}
              />
            </DialogContent>
          </Dialog>

        </div>
      }
    >
      {!customer && (
        <div className="rounded-2xl border p-4 mb-4 flex items-center gap-3" style={{ background: V2.TEAL_LIGHT, borderColor: V2.TEAL, color: V2.LIGHT_TEXT }}>
          <User className="h-5 w-5 shrink-0" style={{ color: V2.TEAL }} />
          <p className="flex-1 text-sm">Nenhum cliente selecionado. Escolha um cliente antes de finalizar a venda.</p>
          <Link to="/v3/vendas/nova" className="h-9 px-4 rounded-full text-xs font-semibold grid place-items-center" style={{ background: V2.TEAL, color: "#fff" }}>Escolher cliente</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        {/* ESQUERDA: busca + chips + grade */}
        <div className="min-w-0 space-y-3">
          <form onSubmit={handleSearchEnter} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: V2.LIGHT_MUTED }} />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar peça ou SKU… (Enter adiciona a primeira, / foca aqui)"
              className="pl-10 h-12 rounded-full border"
              style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
            />
          </form>

          <div className="flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <button
                key={g.tipo || "all"}
                onClick={() => setTipo(g.tipo)}
                className="h-9 px-4 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors"
                style={
                  tipo === g.tipo
                    ? { background: V2.TEAL, color: "#fff", borderColor: V2.TEAL }
                    : { background: V2.LIGHT_SURFACE, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }
                }
              >
                {g.label}
              </button>
            ))}
            <span className="ml-auto text-xs self-center" style={{ color: V2.LIGHT_MUTED }}>{filtered.length} produtos</span>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border p-10 text-center text-sm" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}>
              Carregando peças…
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const hasPkg = !!(p.preco_pacote && (p.quantidade_pacote ?? 1) > 1);
                const img = primaryImage(p);
                const already = items.find((it) => it.product_id === p.id);
                const qtyInCart = items
                  .filter((it) => it.product_id === p.id)
                  .reduce((s, it) => s + (it.tipo_compra === "PACOTE" ? it.quantidade * (it.quantidade_pacote ?? 1) : it.quantidade), 0);
                return (
                  <button
                    key={p.id}
                    onClick={() => setQuickAdd(p)}
                    className="text-left rounded-2xl border-2 p-2.5 flex flex-col transition-all active:scale-[0.98] touch-manipulation"
                    style={{
                      background: already ? V2.TEAL_LIGHT : V2.LIGHT_SURFACE,
                      borderColor: already ? V2.TEAL : V2.LIGHT_BORDER,
                    }}
                  >
                    <div
                      className="relative aspect-square rounded-xl mb-2 overflow-hidden grid place-items-center"
                      style={{ background: V2.LIGHT_SURFACE_2 }}
                    >
                      {img ? (
                        <img src={img} alt={p.nome} className="max-w-full max-h-full object-contain pointer-events-none" />
                      ) : (
                        <Package className="h-8 w-8" style={{ color: V2.LIGHT_MUTED }} />
                      )}
                      {already && (
                        <>
                          <div className="absolute inset-0" style={{ background: "rgba(13,115,119,0.15)" }} />
                          <span className="absolute top-1.5 right-1.5 h-7 min-w-7 px-2 rounded-full text-xs font-bold grid place-items-center shadow" style={{ background: V2.TEAL, color: "#fff" }}>
                            {qtyInCart}
                          </span>
                          <span className="absolute bottom-1.5 left-1.5 h-6 w-6 rounded-full grid place-items-center shadow" style={{ background: "#16a34a", color: "#fff" }}>
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs font-semibold line-clamp-2 min-h-[2rem]" style={{ color: V2.LIGHT_TEXT }}>{p.nome}</p>
                    <p className="text-[10px]" style={{ color: V2.LIGHT_MUTED }}>{p.brands?.nome ?? p.sku}</p>
                    <div className="mt-1.5 flex items-baseline justify-between gap-1">
                      <span className="text-sm font-bold tabular-nums" style={{ color: V2.LIGHT_TEXT }}>{brl(Number(p.preco_nivel_1 ?? p.preco_unitario))}</span>
                      {hasPkg && (
                        <span className="text-[10px] tabular-nums" style={{ color: V2.TEAL }}>
                          pct {brl(Number(p.preco_pacote))}
                        </span>
                      )}
                    </div>
                    <span
                      className="mt-2 w-full h-9 rounded-full font-bold text-xs grid place-items-center"
                      style={{ background: V2.TEAL, color: "#fff" }}
                    >
                      + Adicionar
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full rounded-2xl border p-10 text-center text-sm" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}>
                  Nada encontrado para "{q}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* DIREITA: carrinho fixo (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-2xl border overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
            <div className="p-4 border-b" style={{ borderColor: V2.LIGHT_BORDER }}>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" style={{ color: V2.TEAL }} />
                <p className="font-bold" style={{ color: V2.LIGHT_TEXT }}>Carrinho</p>
                <span className="text-xs ml-auto" style={{ color: V2.LIGHT_MUTED }}>{totalUnidades} un</span>
              </div>
            </div>
            <CartPanel
              items={items}
              setQty={setQty}
              setPreco={setPreco}
              removeItem={removeItem}
              clearCart={clearCart}
              customer={customer}
              tripId={tripId}
              subtotal={subtotal}
              descontoPct={descontoPct}
              setDescontoPct={setDescontoPct}
              descontoRs={descontoRs}
              setDescontoRs={setDescontoRs}
              descontoTotal={descontoTotal}
              frete={frete}
              setFrete={setFrete}
              total={total}
              totalUnidades={totalUnidades}
              tier={tier}
              nextTierGap={nextTierGap}
              onFinalized={() => { endSale(); navigate({ to: "/v3/hoje" }); }}
            />
          </div>
        </aside>
      </div>

      <QuickAddDialog
        product={quickAdd}
        onClose={() => setQuickAdd(null)}
        existing={items.filter((it) => it.product_id === quickAdd?.id)}
        onConfirm={(mode, qty, preco) => {
          if (!quickAdd) return;
          addToCart({
            product_id: quickAdd.id,
            nome: quickAdd.nome,
            sku: quickAdd.sku,
            image_url: primaryImage(quickAdd),
            tipo_compra: mode,
            preco_unitario: mode === "UNITARIO" ? preco : Number(quickAdd.preco_nivel_1 ?? quickAdd.preco_unitario),
            quantidade_pacote: Number(quickAdd.quantidade_pacote ?? 1),
            preco_pacote: mode === "PACOTE" ? preco : (quickAdd.preco_pacote != null ? Number(quickAdd.preco_pacote) : null),
            preco_nivel_1: quickAdd.preco_nivel_1 != null ? Number(quickAdd.preco_nivel_1) : Number(quickAdd.preco_unitario),
            preco_nivel_2: quickAdd.preco_nivel_2 != null ? Number(quickAdd.preco_nivel_2) : Number(quickAdd.preco_unitario),
            preco_nivel_3: quickAdd.preco_nivel_3 != null ? Number(quickAdd.preco_nivel_3) : Number(quickAdd.preco_unitario),
            quantidade: qty,
          });
          // Se o usuário editou manualmente, força o preço (e desativa auto-tier desta linha)
          const nivel1 = Number(quickAdd.preco_nivel_1 ?? quickAdd.preco_unitario);
          if (mode === "UNITARIO" && Math.abs(preco - nivel1) > 0.001) setPreco(quickAdd.id, mode, preco);
          if (mode === "PACOTE") setPreco(quickAdd.id, mode, preco);
          toast.success(`${quickAdd.nome} · ${qty}× lançado`, { duration: 1200 });
        }}
      />
    </V2InternalShell>
  );
}

/* ================= QUICK-ADD DIALOG (Tablet-friendly) ================= */

function QuickAddDialog(props: {
  product: Product | null;
  existing: CartItem[];
  onClose: () => void;
  onConfirm: (mode: CartTipo, qty: number, preco: number) => void;
}) {
  const { product, existing, onClose, onConfirm } = props;
  const hasPkg = !!(product?.preco_pacote && (product?.quantidade_pacote ?? 1) > 1);
  const [mode, setMode] = useState<CartTipo>("UNITARIO");
  const [qty, setQty] = useState(1);
  const [preco, setPreco] = useState(0);

  useEffect(() => {
    if (!product) return;
    setMode("UNITARIO");
    setQty(1);
    setPreco(Number(product.preco_unitario));
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    setPreco(mode === "PACOTE" ? Number(product.preco_pacote ?? 0) : Number(product.preco_unitario));
  }, [mode, product?.id]);

  if (!product) return null;

  const totalLinha = preco * qty;
  const jaLancado = existing.reduce((s, it) => s + it.quantidade, 0);

  return (
    <Dialog open={!!product} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden" style={{ background: V2.LIGHT_SURFACE, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }}>
        <DialogHeader className="p-4 border-b" style={{ borderColor: V2.LIGHT_BORDER }}>
          <DialogTitle style={{ color: V2.LIGHT_TEXT }} className="text-base">{product.nome}</DialogTitle>
          <DialogDescription style={{ color: V2.LIGHT_MUTED }}>
            {product.brands?.nome ? `${product.brands.nome} · ` : ""}SKU {product.sku}
            {jaLancado > 0 && <span className="ml-2 font-semibold" style={{ color: V2.TEAL }}>· {jaLancado} já no carrinho</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Modo Unit / Pacote */}
          {hasPkg && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("UNITARIO")}
                className="h-14 rounded-xl border-2 text-sm font-bold flex flex-col items-center justify-center"
                style={mode === "UNITARIO"
                  ? { background: V2.TEAL, color: "#fff", borderColor: V2.TEAL }
                  : { background: V2.LIGHT_SURFACE_2, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }}
              >
                <span>Unidade</span>
                <span className="text-[10px] opacity-80 tabular-nums">{brl(Number(product.preco_unitario))}</span>
              </button>
              <button
                onClick={() => setMode("PACOTE")}
                className="h-14 rounded-xl border-2 text-sm font-bold flex flex-col items-center justify-center"
                style={mode === "PACOTE"
                  ? { background: V2.TEAL, color: "#fff", borderColor: V2.TEAL }
                  : { background: V2.LIGHT_SURFACE_2, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }}
              >
                <span>Pacote · {product.quantidade_pacote} un</span>
                <span className="text-[10px] opacity-80 tabular-nums">{brl(Number(product.preco_pacote ?? 0))}</span>
              </button>
            </div>
          )}

          {/* Quantidade — botões grandes p/ tablet */}
          <div>
            <Label className="text-xs uppercase tracking-wider" style={{ color: V2.LIGHT_MUTED }}>Quantidade</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-16 w-16 rounded-2xl grid place-items-center text-2xl font-bold border-2 active:scale-95"
                style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
              >
                <Minus className="h-6 w-6" />
              </button>
              <Input
                type="number"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-16 text-3xl font-black text-center tabular-nums flex-1"
                style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
              />
              <button
                onClick={() => setQty((q) => q + 1)}
                className="h-16 w-16 rounded-2xl grid place-items-center text-2xl font-bold border-2 active:scale-95"
                style={{ background: V2.TEAL, borderColor: V2.TEAL, color: "#fff" }}
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Preço editável */}
          <div>
            <Label className="text-xs uppercase tracking-wider" style={{ color: V2.LIGHT_MUTED }}>
              Preço {mode === "PACOTE" ? "do pacote" : "unitário"}
            </Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={preco}
              onChange={(e) => setPreco(Number(e.target.value) || 0)}
              className="mt-1.5 h-14 text-2xl font-bold text-center tabular-nums"
              style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
            />
          </div>

          {/* Total linha */}
          <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: V2.TEAL_LIGHT }}>
            <span className="text-sm font-semibold" style={{ color: V2.LIGHT_TEXT }}>Total desta linha</span>
            <span className="text-2xl font-black tabular-nums" style={{ color: V2.TEAL }}>{brl(totalLinha)}</span>
          </div>
        </div>

        <DialogFooter className="p-4 border-t grid grid-cols-2 gap-2" style={{ borderColor: V2.LIGHT_BORDER }}>
          <Button
            onClick={onClose}
            className="h-14 rounded-2xl text-base font-bold"
            style={{ background: V2.LIGHT_SURFACE_2, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => { onConfirm(mode, qty, preco); onClose(); }}
            className="h-14 rounded-2xl text-base font-bold"
            style={{ background: V2.TEAL, color: "#fff" }}
          >
            <Plus className="h-5 w-5 mr-1" /> Lançar {qty}×
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================= CARRINHO ================= */

function CartPanel(props: {
  items: CartItem[];
  setQty: (id: string, tipo: CartTipo, qty: number) => void;
  setPreco: (id: string, tipo: CartTipo, preco: number) => void;
  removeItem: (id: string, tipo: CartTipo) => void;
  clearCart: () => void;
  customer: ReturnType<typeof useSellerSession.getState>["customer"];
  tripId: string | null;
  subtotal: number;
  descontoPct: number;
  setDescontoPct: (v: number) => void;
  descontoRs: number;
  setDescontoRs: (v: number) => void;
  descontoTotal: number;
  frete: number;
  setFrete: (v: number) => void;
  total: number;
  totalUnidades: number;
  tier: 1 | 2 | 3;
  nextTierGap: { falta: number; proxNivel: 2 | 3 } | null;
  onFinalized: () => void;
}) {
  const {
    items, setQty, setPreco, removeItem, clearCart, customer, tripId,
    subtotal, descontoPct, setDescontoPct, descontoRs, setDescontoRs, descontoTotal,
    frete, setFrete, total, tier, nextTierGap, onFinalized,
  } = props;

  const [payOpen, setPayOpen] = useState(false);

  return (
    <>
      <div className="min-h-0 overflow-y-auto no-scrollbar" style={{ background: V2.LIGHT_BG }}>
        {nextTierGap && (
          <div className="mx-2.5 mt-2 px-3 py-2 rounded-lg text-[11px] flex items-center gap-2 border" style={{ background: V2.TEAL_LIGHT, borderColor: V2.TEAL, color: V2.LIGHT_TEXT }}>
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: V2.TEAL }} aria-hidden />
            <span className="flex-1 leading-snug truncate">
              Faltam <span className="tabular-nums font-bold" style={{ color: V2.TEAL }}>{brl(nextTierGap.falta)}</span> para a faixa N{nextTierGap.proxNivel}.
            </span>
          </div>
        )}
        {items.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-3" style={{ color: V2.LIGHT_MUTED }}>
            <div className="h-16 w-16 rounded-full grid place-items-center" style={{ background: V2.LIGHT_SURFACE_2 }}>
              <ShoppingCart className="h-7 w-7" />
            </div>
            <div className="text-sm">
              <p className="font-semibold" style={{ color: V2.LIGHT_TEXT }}>Carrinho vazio</p>
              <p className="text-xs mt-0.5">Toque em uma peça para adicionar.</p>
            </div>
          </div>
        ) : (
          <div className="p-2.5 space-y-1.5">
            {items.map((it) => {
              const precoEfetivo = effectiveUnitPrice(it, tier);
              const precoBase = it.tipo_compra === "PACOTE" ? Number(it.preco_pacote ?? 0) : Number(it.preco_nivel_1 ?? it.preco_unitario);
              const lineTotal = precoEfetivo * it.quantidade;
              const tierAtivo = it.tipo_compra === "UNITARIO" && tier > 1 && precoEfetivo < precoBase;
              return (
                <div
                  key={`${it.product_id}-${it.tipo_compra}`}
                  className="px-2.5 py-2 rounded-lg border grid grid-cols-[36px_minmax(0,1fr)_28px] gap-x-2 gap-y-1.5"
                  style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
                >
                  <div className="h-9 w-9 rounded-md shrink-0 grid place-items-center overflow-hidden" style={{ background: V2.LIGHT_SURFACE_2 }}>
                    {it.image_url ? <img src={it.image_url} alt={it.nome} className="max-w-full max-h-full object-contain" /> : <Package className="h-5 w-5" style={{ color: V2.LIGHT_MUTED }} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate" style={{ color: V2.LIGHT_TEXT }}>{it.nome}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]" style={{ color: V2.LIGHT_MUTED }}>
                      <span>{it.tipo_compra === "PACOTE" ? `Pacote c/ ${it.quantidade_pacote}` : "Unitário"}</span>
                      {tierAtivo && <span className="px-1 py-0.5 rounded text-[9px] font-bold" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>N{tier}</span>}
                    </div>
                  </div>
                  <button onClick={() => removeItem(it.product_id, it.tipo_compra)} className="h-7 w-7 rounded-md grid place-items-center transition-colors hover:bg-red-50" style={{ color: V2.LIGHT_MUTED }} title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="col-start-2 col-span-2 flex items-center gap-1.5 justify-between min-w-0">
                    <div className="inline-flex items-center rounded-md border overflow-hidden" style={{ borderColor: V2.LIGHT_BORDER, background: V2.LIGHT_SURFACE_2 }}>
                      <button onClick={() => setQty(it.product_id, it.tipo_compra, Math.max(1, it.quantidade - 1))} className="h-7 w-7 grid place-items-center transition-colors hover:bg-black/5" style={{ color: V2.LIGHT_TEXT }}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={it.quantidade}
                        onChange={(e) => setQty(it.product_id, it.tipo_compra, Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-7 w-9 text-xs text-center tabular-nums bg-transparent outline-none font-semibold"
                        style={{ color: V2.LIGHT_TEXT }}
                      />
                      <button onClick={() => setQty(it.product_id, it.tipo_compra, it.quantidade + 1)} className="h-7 w-7 grid place-items-center transition-colors hover:bg-black/5" style={{ color: V2.LIGHT_TEXT }}>
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <PricePopover
                      value={precoEfetivo}
                      onChange={(v) => setPreco(it.product_id, it.tipo_compra, v)}
                    />
                    <div className="w-[82px] text-right">
                      <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: V2.LIGHT_TEXT }}>{brl(lineTotal)}</p>
                      {tierAtivo && (
                        <p className="text-[9px] tabular-nums line-through" style={{ color: V2.LIGHT_MUTED }}>{brl(precoBase * it.quantidade)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 border-t space-y-2 shrink-0" style={{ borderColor: V2.LIGHT_BORDER, background: V2.LIGHT_SURFACE }}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.LIGHT_MUTED }}>Desconto R$</Label>
            <Input type="number" min={0} value={descontoRs || ""} onChange={(e) => { setDescontoRs(Math.max(0, parseFloat(e.target.value) || 0)); setDescontoPct(0); }} placeholder="0,00" className="h-9 text-sm mt-1 rounded-lg" style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.LIGHT_MUTED }}>Frete</Label>
            <Input type="number" min={0} value={frete || ""} onChange={(e) => setFrete(Math.max(0, parseFloat(e.target.value) || 0))} placeholder="0,00" className="h-9 text-sm mt-1 rounded-lg" style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }} />
          </div>
        </div>

        <div className="rounded-xl px-3 py-2 space-y-1" style={{ background: V2.LIGHT_SURFACE_2 }}>
          <div className="text-[11px] flex flex-wrap gap-x-3 gap-y-1" style={{ color: V2.LIGHT_MUTED }}>
            <span>Subtotal <b className="tabular-nums" style={{ color: V2.LIGHT_TEXT }}>{brl(subtotal)}</b></span>
            {descontoTotal > 0 && <span>Desconto <b className="tabular-nums" style={{ color: V2.TEAL }}>- {brl(descontoTotal)}</b></span>}
            {frete > 0 && <span>Frete <b className="tabular-nums" style={{ color: V2.LIGHT_TEXT }}>{brl(frete)}</b></span>}
          </div>
          <div className="flex items-baseline justify-between pt-1 border-t" style={{ borderColor: V2.LIGHT_BORDER }}>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: V2.LIGHT_MUTED }}>Total</span>
            <span className="text-xl font-extrabold tabular-nums tracking-tight" style={{ color: V2.TEAL }}>{brl(total)}</span>
          </div>
        </div>

        <Button
          disabled={items.length === 0 || !customer}
          onClick={() => setPayOpen(true)}
          className="w-full h-11 rounded-xl text-sm font-bold transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: V2.TEAL, color: "#fff" }}
        >
          Finalizar venda
        </Button>
        {items.length > 0 && (
          <button
            onClick={() => { if (confirm("Limpar carrinho?")) clearCart(); }}
            className="w-full text-[11px] text-center hover:underline"
            style={{ color: V2.LIGHT_MUTED }}
          >
            Limpar carrinho
          </button>
        )}
      </div>

      <FinalizeDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        items={items}
        customer={customer}
        tripId={tripId}
        total={total}
        desconto={descontoTotal}
        frete={frete}
        tier={tier}
        onFinalized={() => { clearCart(); setDescontoPct(0); setDescontoRs(0); setFrete(0); onFinalized(); }}
      />
    </>
  );
}

function PricePopover({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value, open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-7 px-2 rounded text-[10px] font-semibold flex items-center gap-1 border shrink-0"
          style={{ background: V2.LIGHT_SURFACE_2, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }}
        >
          <Pencil className="h-3 w-3" /> {brl(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}>
        <Label className="text-[10px] uppercase" style={{ color: V2.LIGHT_MUTED }}>Novo preço unitário</Label>
        <Input
          autoFocus
          type="number"
          step="0.01"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onChange(parseFloat(v) || 0); setOpen(false); }
          }}
          className="h-9 mt-1"
          style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
        />
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" className="flex-1" style={{ background: V2.TEAL, color: "#fff" }} onClick={() => { onChange(parseFloat(v) || 0); setOpen(false); }}>OK</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ================= FINALIZAÇÃO ================= */

function FinalizeDialog({
  open, onOpenChange, items, customer, tripId, total, desconto, frete, tier, onFinalized,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: CartItem[];
  customer: ReturnType<typeof useSellerSession.getState>["customer"];
  tripId: string | null;
  total: number;
  desconto: number;
  frete: number;
  tier: 1 | 2 | 3;
  onFinalized: () => void;
}) {
  const [tipo, setTipo] = useState<"PIX" | "CARTAO" | "DINHEIRO" | "FATURADO">("PIX");
  const [modalidade, setModalidade] = useState<"CREDITO" | "DEBITO">("CREDITO");
  const [bandeira, setBandeira] = useState<string>("");
  const [parcelas, setParcelas] = useState<number>(1);
  const [prazo, setPrazo] = useState<"30" | "30-60" | "30-60-90">("30");

  const [antecipar, setAntecipar] = useState<boolean>(false);
  const [accountId, setAccountId] = useState<string>("");
  const [obs, setObs] = useState("");
  const { data: accounts = [] } = useBankAccounts();
  const create = useCreateOrder();
  const confirmPay = useConfirmPayment();
  const [saving, setSaving] = useState(false);
  const [dupWarn, setDupWarn] = useState<{ id: string; total: number; created_at: string } | null>(null);
  const [forceSave, setForceSave] = useState(false);

  // Bandeiras + taxa aplicada
  const { data: fees = [] } = useQuery({
    queryKey: ["payment_fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_fees")
        .select("bandeira,credito_avista,credito_2_6,credito_7_12,debito")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: antecTaxa = 2.09 } = useQuery({
    queryKey: ["setting", "antecipacao_taxa"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings").select("valor")
        .eq("categoria", "financeiro").eq("chave", "antecipacao_taxa_percentual").maybeSingle();
      const v = data?.valor as unknown;
      return typeof v === "number" ? v : Number(v ?? 2.09);
    },
  });

  const feeInfo = useMemo(() => {
    if (tipo !== "CARTAO" || modalidade !== "CREDITO" || !bandeira) return null;
    const b = fees.find((f) => f.bandeira.toLowerCase() === bandeira.toLowerCase());
    if (!b) return null;
    const marca = parcelas === 1
      ? Number(b.credito_avista ?? 0)
      : parcelas === 2
      ? Number(b.credito_2_6 ?? 0)
      : Number(b.credito_7_12 ?? 0);
    const antec = antecipar ? Number(antecTaxa) : 0;
    const totalPct = marca + antec;
    const taxaValor = Math.round((total * totalPct) / 100 * 100) / 100;
    return { marca, antec, totalPct, taxaValor, liquido: total - taxaValor };
  }, [tipo, modalidade, bandeira, parcelas, antecipar, fees, antecTaxa, total]);

  useEffect(() => {
    if (open && !accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [open, accounts, accountId]);

  async function checkDuplicate(): Promise<boolean> {
    if (!customer) return false;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("orders")
      .select("id, total, created_at, status")
      .eq("company_id", customer.id)
      .neq("status", "CANCELADO")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());
    const match = (data ?? []).find((o) => Math.abs(Number(o.total) - total) < 0.01);
    if (match) { setDupWarn({ id: match.id, total: Number(match.total), created_at: match.created_at }); return true; }
    return false;
  }

  const submittingRef = useRef(false);

  async function finalizar() {
    if (submittingRef.current) return;
    if (!customer) { toast.error("Sem cliente."); return; }
    if (items.length === 0) { toast.error("Carrinho vazio."); return; }
    if (!forceSave && await checkDuplicate()) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const itemsPriced: CartItem[] = items.map((i) => ({
        ...i,
        preco_unitario: i.tipo_compra === "UNITARIO" ? effectiveUnitPrice(i, tier) : i.preco_unitario,
      }));
      const orderId = await create.mutateAsync({
        company_id: customer.id,
        address_id: null,
        origem: tripId ? "VISITA" : "VISITA",
        items: itemsPriced,
        frete,
        desconto,
        observacao: obs || undefined,
        pagamento: tipo === "CARTAO" ? "CARTAO" : "PIX",
        trip_id: tripId ?? null,
      });
      const account = accounts.find((a) => a.id === accountId);
      const isCartao = tipo === "CARTAO";
      await confirmPay.mutateAsync({
        order_id: orderId,
        company_id: customer.id,
        total,
        tipo,
        modalidade: isCartao ? modalidade : undefined,
        bandeira: isCartao ? (bandeira || null) : null,
        antecipado: isCartao && modalidade === "CREDITO" ? antecipar : false,
        conta: account?.nome ?? "—",
        account_id: accountId || null,
        parcelas: isCartao && modalidade === "CREDITO" ? parcelas : 1,
        prazos: tipo === "FATURADO" ? prazo.split("-").map(Number) : undefined,
        observacao: obs || undefined,

      });
      toast.success("Venda finalizada!");
      setForceSave(false);
      onOpenChange(false);
      onFinalized();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao finalizar");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar venda</DialogTitle>
          <DialogDescription>
            Cliente: <strong>{customer?.trade_name ?? customer?.legal_name ?? "—"}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([
                { k: "PIX", icon: QrCode, label: "PIX" },
                { k: "CARTAO", icon: CreditCard, label: "Cartão" },
                { k: "DINHEIRO", icon: Banknote, label: "Dinheiro" },
                { k: "FATURADO", icon: CalendarClock, label: "Faturado" },
              ] as const).map((p) => {

                const Icon = p.icon;
                const active = tipo === p.k;
                return (
                  <button
                    key={p.k}
                    onClick={() => setTipo(p.k)}
                    className={cn("h-16 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors")}
                    style={
                      active
                        ? { background: V2.TEAL, color: "#fff", borderColor: V2.TEAL }
                        : { background: V2.LIGHT_SURFACE_2, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {tipo === "CARTAO" && (
            <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: V2.LIGHT_BORDER, background: V2.LIGHT_SURFACE_2 }}>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Modalidade</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(["CREDITO", "DEBITO"] as const).map((m) => {
                    const active = modalidade === m;
                    return (
                      <button
                        key={m}
                        onClick={() => { setModalidade(m); if (m === "DEBITO") { setParcelas(1); setAntecipar(false); } }}
                        className="h-10 rounded-md border text-xs font-semibold"
                        style={active
                          ? { background: V2.TEAL, color: "#fff", borderColor: V2.TEAL }
                          : { background: "#fff", color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }}
                      >
                        {m === "CREDITO" ? "Crédito" : "Débito (sem taxa)"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Bandeira</Label>
                  <select
                    value={bandeira}
                    onChange={(e) => setBandeira(e.target.value)}
                    className="w-full h-10 rounded-md border px-2 text-sm mt-1"
                    style={{ background: "#fff", borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
                  >
                    <option value="">— Selecione —</option>
                    {fees.map((f) => <option key={f.bandeira} value={f.bandeira}>{f.bandeira}</option>)}
                  </select>
                </div>
                {modalidade === "CREDITO" && (
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground">Parcelas</Label>
                    <select
                      value={parcelas}
                      onChange={(e) => setParcelas(Number(e.target.value))}
                      className="w-full h-10 rounded-md border px-2 text-sm mt-1"
                      style={{ background: "#fff", borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n}>{n}x</option>
                      ))}

                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-md border p-2 text-xs" style={{ borderColor: V2.LIGHT_BORDER, background: "#fff" }}>
                Todos os recebimentos no cartão caem em <b>D+1</b> na conta <b>TON</b>.
              </div>

              {feeInfo && (
                <div className="rounded-md bg-white border p-2 text-xs space-y-1" style={{ borderColor: V2.LIGHT_BORDER }}>
                  <div className="flex justify-between"><span>Taxa Ton ({modalidade === "CREDITO" ? `${parcelas}x` : "Débito"})</span><span>{feeInfo.marca.toFixed(2)}%</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Taxa total</span><span>{brl(feeInfo.taxaValor)} ({feeInfo.totalPct.toFixed(2)}%)</span></div>
                  <div className="flex justify-between" style={{ color: V2.TEAL }}><span>Líquido a receber (D+1)</span><span className="font-bold">{brl(feeInfo.liquido)}</span></div>
                </div>
              )}

            </div>
          )}

          {tipo === "FATURADO" && (
            <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: V2.LIGHT_BORDER, background: V2.LIGHT_SURFACE_2 }}>
              <Label className="text-xs uppercase text-muted-foreground">Prazo de recebimento</Label>
              <select
                value={prazo}
                onChange={(e) => setPrazo(e.target.value as "30" | "30-60" | "30-60-90")}
                className="w-full h-10 rounded-md border px-2 text-sm"
                style={{ background: "#fff", borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
              >
                <option value="30">30 dias — 1x de {brl(total)}</option>
                <option value="30-60">30/60 dias — 2x de {brl(total / 2)}</option>
                <option value="30-60-90">30/60/90 dias — 3x de {brl(total / 3)}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Gera contas a receber em aberto no Financeiro, com os vencimentos escolhidos.
              </p>
            </div>
          )}




          <div>
            <Label className="text-xs uppercase text-muted-foreground">Conta / caixa</Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full h-10 rounded-md border px-3 text-sm mt-1"
              style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
            >
              <option value="">— Selecione —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>

          <div>
            <Label className="text-xs uppercase text-muted-foreground">Observação (opcional)</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} className="mt-1" />
          </div>

          <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: V2.LIGHT_SURFACE_2, color: V2.LIGHT_TEXT }}>
            <span className="text-sm">Total a receber</span>
            <span className="text-2xl font-extrabold tabular-nums" style={{ color: V2.TEAL }}>{brl(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={finalizar} disabled={saving || !accountId || (tipo === "CARTAO" && !bandeira)} style={{ background: V2.TEAL, color: "#fff" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Confirmar e concluir
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={!!dupWarn} onOpenChange={(v) => !v && setDupWarn(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Venda duplicada?</DialogTitle>
            <DialogDescription>
              Já existe uma venda de <strong>{brl(dupWarn?.total ?? 0)}</strong> para <strong>{customer?.trade_name ?? customer?.legal_name}</strong> hoje
              {dupWarn ? ` às ${new Date(dupWarn.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}.
              Deseja lançar mesmo assim?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupWarn(null)}>Cancelar</Button>
            <Button
              style={{ background: V2.TEAL, color: "#fff" }}
              onClick={() => { setDupWarn(null); setForceSave(true); setTimeout(finalizar, 0); }}
            >
              Lançar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
