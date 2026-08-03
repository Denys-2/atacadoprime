import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart, cartSubtotal, itemLineTotal, type CartItem } from "@/hooks/use-cart";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { useSellerSession } from "@/hooks/use-seller-session";
import { brl } from "@/lib/format";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { productImageUrl } from "@/lib/storage";
import {
  Trash2,
  ArrowRight,
  ShoppingCart,
  Pencil,
  ArrowLeft,
  MessageCircle,
  Plus,
  Minus,
  ShieldCheck,
  Truck,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const BG = "#faf8f5";
const SURFACE = "#ffffff";
const SURFACE_2 = "#f5f0e8";
const BORDER = "#e8e2d8";
const ORANGE = "#c9a96e";
const TEXT = "#3d2b1f";
const MUTED = "#8b7355";

export const Route = createFileRoute("/_authenticated/cart")({
  head: () => ({ meta: [{ title: "Meu Carrinho — Atacado Prime B2B" }] }),
  component: CartPageV3,
});

function CartPageV3() {
  const { user } = useAuth();
  const { data: roles = [] } = useRoles(user);
  const isStaff = roles.some((r) => r === "admin" || r === "vendedor" || r === "gerente");
  const sellerCustomer = useSellerSession((s) => s.customer);
  const canEditPrice = isStaff && !!sellerCustomer;

  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const setTipo = useCart((s) => s.setTipo);
  const setPreco = useCart((s) => s.setPreco);
  const setDesconto = useCart((s) => s.setDesconto);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const navigate = useNavigate();

  const subtotal = cartSubtotal(items);
  const totalItemsCount = items.reduce(
    (n, i) => n + i.quantidade * (i.tipo_compra === "PACOTE" && i.quantidade_pacote ? i.quantidade_pacote : 1),
    0
  );
  const [editing, setEditing] = useState<CartItem | null>(null);

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: BG, color: TEXT }}>
      {/* Header V3 */}
      <header
        className="sticky top-0 z-30 backdrop-blur border-b"
        style={{ background: "rgba(255,255,255,0.92)", borderColor: BORDER }}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/v3" className="flex items-center gap-2.5 group" aria-label="Atacado Prime">
            <img
              src="/brand-logo.png"
              alt="Atacado Prime"
              width={44}
              height={44}
              className="h-11 w-11 object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-base sm:text-lg leading-none" style={{ color: TEXT }}>
                Atacado <span style={{ color: ORANGE }}>Prime</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-amber-700/80 mt-0.5">
                Meu Carrinho
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/5534998651112?text=Ol%C3%A1!%20Estou%20no%20carrinho%20do%20site%20e%20preciso%20de%20ajuda."
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3.5 rounded-full text-xs font-bold hidden sm:inline-flex items-center gap-1.5 transition-colors border"
              style={{ borderColor: "#25D366", color: "#1b8a43", background: "rgba(37, 211, 102, 0.08)" }}
            >
              <MessageCircle className="h-3.5 w-3.5 fill-current" />
              WhatsApp
            </a>
            <Link
              to="/v3"
              className="h-9 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-colors hover:bg-black/5"
              style={{ borderColor: BORDER, color: TEXT }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Continuar comprando
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8 sm:py-12">
        {/* Banner Vendedor em Visita */}
        {sellerCustomer && (
          <div
            className="mb-6 rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3"
            style={{ background: SURFACE, borderColor: ORANGE }}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: ORANGE }}>
                Venda em Visita (Vendedor)
              </span>
              <p className="font-bold text-sm sm:text-base" style={{ color: TEXT }}>
                Cliente: {sellerCustomer.trade_name ?? sellerCustomer.legal_name}
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: SURFACE_2, color: MUTED }}>
              Modo Edição de Preços Ativo
            </span>
          </div>
        )}

        {items.length === 0 ? (
          /* Estado Vazio V3 */
          <div
            className="rounded-3xl border p-12 text-center max-w-lg mx-auto my-8 shadow-sm"
            style={{ background: SURFACE, borderColor: BORDER }}
          >
            <div
              className="h-20 w-20 rounded-full mx-auto grid place-items-center mb-5"
              style={{ background: SURFACE_2, color: ORANGE }}
            >
              <ShoppingCart className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: TEXT }}>
              Seu carrinho está vazio
            </h2>
            <p className="mt-2 text-sm max-w-xs mx-auto font-medium" style={{ color: MUTED }}>
              Navegue pelo nosso catálogo de chaves, capas e controles para adicionar produtos com preço de atacado.
            </p>
            <Link
              to="/v3"
              className="mt-6 inline-flex h-12 px-8 rounded-full font-black text-sm items-center gap-2 shadow-lg transition-transform active:scale-95"
              style={{ background: ORANGE, color: "#ffffff" }}
            >
              <ShoppingBag className="h-4 w-4" /> Ir ao Catálogo B2B
            </Link>
          </div>
        ) : (
          /* Grid de Itens e Resumo V3 */
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Lista de Produtos (8 colunas) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: BORDER }}>
                <h1 className="text-xl sm:text-2xl font-black" style={{ color: TEXT }}>
                  Itens do Pedido ({items.length})
                </h1>
                <button
                  onClick={clear}
                  className="text-xs font-bold transition-colors hover:underline"
                  style={{ color: "#dc2626" }}
                >
                  Esvaziar carrinho
                </button>
              </div>

              {items.map((i) => {
                const unitPrice =
                  i.tipo_compra === "PACOTE" && i.preco_pacote
                    ? Number(i.preco_pacote)
                    : Number(i.preco_unitario);
                const lineTotal = itemLineTotal(i);

                return (
                  <div
                    key={`${i.product_id}-${i.tipo_compra}`}
                    className="rounded-2xl border p-4 sm:p-5 flex gap-4 transition-shadow hover:shadow-md"
                    style={{ background: SURFACE, borderColor: BORDER }}
                  >
                    {/* Thumbnail */}
                    <div
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border shrink-0 overflow-hidden relative grid place-items-center"
                      style={{ background: SURFACE_2, borderColor: BORDER }}
                    >
                      {i.image_url ? (
                        <img
                          src={productImageUrl(i.image_url)}
                          alt={i.nome}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-[10px] font-mono text-center uppercase" style={{ color: MUTED }}>
                          sem foto
                        </span>
                      )}
                    </div>

                    {/* Detalhes do Produto */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span
                              className="text-[10px] font-mono font-bold uppercase tracking-wider block"
                              style={{ color: ORANGE }}
                            >
                              SKU: {i.sku || "—"}
                            </span>
                            <h3 className="font-bold text-sm sm:text-base leading-tight mt-0.5 line-clamp-2" style={{ color: TEXT }}>
                              {i.nome}
                            </h3>
                          </div>
                          <button
                            onClick={() => remove(i.product_id, i.tipo_compra)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                            title="Remover produto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Controles de Quantidade e Tipo */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: BORDER }}>
                        <div className="flex items-center gap-2">
                          {/* Seletor de Tipo (Unitário / Pacote) */}
                          {i.preco_pacote && (
                            <select
                              value={i.tipo_compra}
                              onChange={(e) =>
                                setTipo(i.product_id, i.tipo_compra, e.target.value as "UNITARIO" | "PACOTE")
                              }
                              className="h-9 px-3 rounded-lg border text-xs font-semibold bg-white outline-none"
                              style={{ borderColor: BORDER, color: TEXT }}
                            >
                              <option value="UNITARIO">Unitário</option>
                              <option value="PACOTE">Pacote ({i.quantidade_pacote}un)</option>
                            </select>
                          )}

                          {/* Seletor de Quantidade (+ e -) */}
                          <div
                            className="flex items-center rounded-lg border overflow-hidden"
                            style={{ borderColor: BORDER, background: SURFACE }}
                          >
                            <button
                              onClick={() => setQty(i.product_id, i.tipo_compra, Math.max(1, i.quantidade - 1))}
                              className="h-9 w-9 grid place-items-center hover:bg-black/5 transition-colors"
                              style={{ color: TEXT }}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={i.quantidade}
                              onChange={(e) =>
                                setQty(i.product_id, i.tipo_compra, Math.max(1, Number(e.target.value)))
                              }
                              className="w-12 h-9 text-center font-bold text-sm outline-none bg-transparent"
                              style={{ color: TEXT }}
                            />
                            <button
                              onClick={() => setQty(i.product_id, i.tipo_compra, i.quantidade + 1)}
                              className="h-9 w-9 grid place-items-center hover:bg-black/5 transition-colors"
                              style={{ color: TEXT }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Preço e Total da Linha */}
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-semibold block" style={{ color: MUTED }}>
                            {i.tipo_compra === "PACOTE" ? `Pacote (${i.quantidade_pacote}un)` : "Unitário"} · {brl(unitPrice)}
                          </span>
                          <span className="font-black text-base sm:text-lg" style={{ color: TEXT }}>
                            {brl(lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumo do Pedido V3 (4 colunas) */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-24">
              <div
                className="rounded-3xl border p-6 shadow-lg space-y-5"
                style={{ background: SURFACE, borderColor: BORDER }}
              >
                <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: BORDER }}>
                  <h2 className="font-extrabold text-lg" style={{ color: TEXT }}>
                    Resumo do Pedido
                  </h2>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: SURFACE_2, color: ORANGE }}
                  >
                    {totalItemsCount} peças
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between font-medium">
                    <span style={{ color: MUTED }}>Subtotal dos produtos</span>
                    <span className="font-bold" style={{ color: TEXT }}>
                      {brl(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span style={{ color: MUTED }}>Frete de envio</span>
                    <span className="text-xs font-semibold text-amber-700">Calculado no Checkout</span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-1" style={{ borderColor: BORDER }}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-black text-lg" style={{ color: TEXT }}>
                      Total Estimado
                    </span>
                    <span className="font-black text-2xl" style={{ color: ORANGE }}>
                      {brl(subtotal)}
                    </span>
                  </div>
                  <p className="text-[11px] text-right" style={{ color: MUTED }}>
                    Condições de pagamento selecionáveis na próxima etapa
                  </p>
                </div>

                {/* Botão Finalizar Pedido V3 */}
                <button
                  onClick={() => navigate({ to: "/checkout" })}
                  className="w-full h-14 rounded-full font-black text-base flex items-center justify-center gap-2 shadow-xl transition-transform active:scale-95"
                  style={{ background: ORANGE, color: "#ffffff" }}
                >
                  <span>Avançar para o Checkout</span>
                  <ArrowRight className="h-5 w-5" />
                </button>

                {/* Badges de Confiança V3 */}
                <div className="pt-4 space-y-2.5 border-t text-xs font-medium" style={{ borderColor: BORDER, color: MUTED }}>
                  <div className="flex items-center gap-2.5">
                    <Truck className="h-4 w-4 shrink-0" style={{ color: ORANGE }} />
                    <span>Despachamos em até 24 horas úteis</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: ORANGE }} />
                    <span>Garantia de fábrica e troca descompllicada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer V3 */}
      <footer className="border-t mt-auto" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="max-w-6xl mx-auto px-5 py-8 text-xs" style={{ color: MUTED }}>
          <div className="font-black text-sm tracking-[0.2em] uppercase mb-2" style={{ color: TEXT }}>
            Atacado Prime
          </div>
          <div>Uberlândia-MG · (34) 99865-1112 · contato@primeautomotive.app</div>
          <div className="mt-3 opacity-60">© {new Date().getFullYear()} Prime Automotive · Distribuidor B2B</div>
        </div>
      </footer>

      {/* Botão Flutuante do WhatsApp */}
      <WhatsAppFab message="Olá! Estou montando um pedido no carrinho do Atacado Prime e gostaria de suporte." />
    </div>
  );
}
