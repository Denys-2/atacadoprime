import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartTipo = "UNITARIO" | "PACOTE";

export type CartItem = {
  product_id: string;
  nome: string;
  sku: string;
  image_url: string | null;
  tipo_compra: CartTipo;
  quantidade: number;
  preco_unitario: number;
  quantidade_pacote: number;
  preco_pacote: number | null;
  desconto_pct?: number;
  // Preços por faixa (nível 1 = cheio, 2 = carrinho ≥ R$500, 3 = ≥ R$1000)
  preco_nivel_1?: number | null;
  preco_nivel_2?: number | null;
  preco_nivel_3?: number | null;
};

export const TIER_2_MIN = 500;
export const TIER_3_MIN = 1000;

export function tierFor(listSubtotal: number): 1 | 2 | 3 {
  if (listSubtotal >= TIER_3_MIN) return 3;
  if (listSubtotal >= TIER_2_MIN) return 2;
  return 1;
}

/** Preço unitário efetivo conforme a faixa (só afeta venda UNITÁRIA). */
export function effectiveUnitPrice(i: CartItem, tier: 1 | 2 | 3): number {
  if (i.tipo_compra === "PACOTE") return Number(i.preco_pacote ?? 0);
  const n1 = Number(i.preco_nivel_1 ?? i.preco_unitario);
  const n2 = Number(i.preco_nivel_2 ?? n1);
  const n3 = Number(i.preco_nivel_3 ?? n2);
  return tier === 3 ? n3 : tier === 2 ? n2 : n1;
}

/** Subtotal usando a lista (nível 1) — usado para decidir a faixa vigente. */
export function cartListSubtotal(items: CartItem[]) {
  return items.reduce((s, i) => {
    const p = i.tipo_compra === "PACOTE"
      ? Number(i.preco_pacote ?? 0)
      : Number(i.preco_nivel_1 ?? i.preco_unitario);
    const desc = i.desconto_pct ?? 0;
    return s + p * i.quantidade * (1 - desc / 100);
  }, 0);
}

/** Subtotal efetivo aplicando a faixa. */
export function cartEffectiveSubtotal(items: CartItem[]): { subtotal: number; tier: 1 | 2 | 3 } {
  const list = cartListSubtotal(items);
  const tier = tierFor(list);
  const subtotal = items.reduce((s, i) => {
    const unit = effectiveUnitPrice(i, tier);
    const desc = i.desconto_pct ?? 0;
    return s + unit * i.quantidade * (1 - desc / 100);
  }, 0);
  return { subtotal, tier };
}


type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantidade"> & { quantidade?: number }) => void;
  remove: (product_id: string, tipo: CartTipo) => void;
  setQty: (product_id: string, tipo: CartTipo, qty: number) => void;
  setDesconto: (product_id: string, tipo: CartTipo, pct: number) => void;
  setPreco: (product_id: string, tipo: CartTipo, preco: number) => void;
  setTipo: (product_id: string, from: CartTipo, to: CartTipo) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => {
          const idx = s.items.findIndex((i) => i.product_id === item.product_id && i.tipo_compra === item.tipo_compra);
          if (idx >= 0) {
            const next = [...s.items];
            next[idx] = { ...next[idx], quantidade: next[idx].quantidade + (item.quantidade ?? 1) };
            return { items: next };
          }
          return { items: [...s.items, { ...item, quantidade: item.quantidade ?? 1 }] };
        }),
      remove: (product_id, tipo) =>
        set((s) => ({ items: s.items.filter((i) => !(i.product_id === product_id && i.tipo_compra === tipo)) })),
      setQty: (product_id, tipo, qty) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.product_id === product_id && i.tipo_compra === tipo ? { ...i, quantidade: Math.max(1, qty) } : i,
          ),
        })),
      setDesconto: (product_id, tipo, pct) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.product_id === product_id && i.tipo_compra === tipo
              ? { ...i, desconto_pct: Math.min(100, Math.max(0, pct)) }
              : i,
          ),
        })),
      setPreco: (product_id, tipo, preco) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.product_id !== product_id || i.tipo_compra !== tipo) return i;
            const v = Math.max(0, Number.isFinite(preco) ? preco : 0);
            if (tipo === "PACOTE") return { ...i, preco_pacote: v };
            // Edição manual: sobrescreve os 3 níveis, desativando o auto-tier deste item
            return { ...i, preco_unitario: v, preco_nivel_1: v, preco_nivel_2: v, preco_nivel_3: v };
          }),
        })),
      setTipo: (product_id, from, to) =>
        set((s) => {
          const it = s.items.find((i) => i.product_id === product_id && i.tipo_compra === from);
          if (!it) return s;
          // convert: PACOTE qty -> UNITARIO qty * quantidade_pacote and vice-versa
          let qty = it.quantidade;
          if (from === "UNITARIO" && to === "PACOTE") qty = Math.max(1, Math.floor(it.quantidade / it.quantidade_pacote));
          if (from === "PACOTE" && to === "UNITARIO") qty = it.quantidade * it.quantidade_pacote;
          const others = s.items.filter((i) => !(i.product_id === product_id && i.tipo_compra === from));
          const existing = others.find((i) => i.product_id === product_id && i.tipo_compra === to);
          if (existing) {
            return {
              items: others.map((i) =>
                i.product_id === product_id && i.tipo_compra === to ? { ...i, quantidade: i.quantidade + qty } : i,
              ),
            };
          }
          return { items: [...others, { ...it, tipo_compra: to, quantidade: qty }] };
        }),
      clear: () => set({ items: [] }),
    }),
    { name: "cart-v1" },
  ),
);

// Cross-tab sync: if another preview/tab adds or clears items, keep this tab's
// cart state in sync before rendering the editable cart list.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "cart-v1") {
      useCart.persist.rehydrate();
    }
  });
}

export function itemLineTotal(i: CartItem) {
  const unit = i.tipo_compra === "PACOTE" && i.preco_pacote ? Number(i.preco_pacote) : Number(i.preco_unitario);
  const desc = i.desconto_pct ?? 0;
  return unit * i.quantidade * (1 - desc / 100);
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((s, i) => s + itemLineTotal(i), 0);
}

export function cartUnitCount(items: CartItem[]) {
  return items.reduce((s, i) => s + i.quantidade * (i.tipo_compra === "PACOTE" ? i.quantidade_pacote : 1), 0);
}
