import { useCallback, useEffect, useState } from "react";
import {
  useCart as useRealCart,
  cartSubtotal,
  cartUnitCount,
  type CartItem as RealCartItem,
  type CartTipo,
} from "@/hooks/use-cart";

const FAV_KEY = "v2:favoritos";

/* ================ FAVORITOS (localStorage por enquanto) ================
   Fase 2 sincroniza com a tabela `favorites` do Supabase quando logado. */

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  emit();
}

function useLocal<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    setValue(read<T>(key, fallback));
    const l: Listener = () => setValue(read<T>(key, fallback));
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) l();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (v: T) => {
      write(key, v);
      setValue(v);
    },
    [key],
  );
  return [value, set];
}

export function useFavorites() {
  const [ids, setIds] = useLocal<string[]>(FAV_KEY, []);
  const toggle = useCallback(
    (id: string) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      setIds(next);
    },
    [ids, setIds],
  );
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const clear = useCallback(() => setIds([]), [setIds]);
  return { ids, toggle, has, clear, count: ids.length };
}

/* ================ CARRINHO (wrapper do carrinho real) ================ */

export type CartAddInput = {
  id: string;
  nome: string;
  sku?: string | null;
  preco: number | null;
  image?: string | null;
  quantidade_pacote?: number | null;
  preco_pacote?: number | null;
  tipo?: CartTipo;
};

export type V2CartLine = {
  id: string;
  tipo: CartTipo;
  nome: string;
  sku: string;
  image: string | null;
  preco: number;
  qty: number;
  raw: RealCartItem;
};

function toLine(i: RealCartItem): V2CartLine {
  const preco =
    i.tipo_compra === "PACOTE" && i.preco_pacote != null
      ? Number(i.preco_pacote)
      : Number(i.preco_unitario);
  return {
    id: i.product_id,
    tipo: i.tipo_compra,
    nome: i.nome,
    sku: i.sku,
    image: i.image_url,
    preco,
    qty: i.quantidade,
    raw: i,
  };
}

export function useCart() {
  const rawItems = useRealCart((s) => s.items);
  const addReal = useRealCart((s) => s.add);
  const removeReal = useRealCart((s) => s.remove);
  const setQtyReal = useRealCart((s) => s.setQty);
  const clear = useRealCart((s) => s.clear);

  const items: V2CartLine[] = rawItems.map(toLine);

  const add = useCallback(
    (item: CartAddInput, qty = 1) => {
      const tipo: CartTipo = item.tipo ?? "UNITARIO";
      addReal({
        product_id: item.id,
        nome: item.nome,
        sku: item.sku ?? "",
        image_url: item.image ?? null,
        tipo_compra: tipo,
        preco_unitario: Number(item.preco ?? 0),
        quantidade_pacote: Number(item.quantidade_pacote ?? 1) || 1,
        preco_pacote: item.preco_pacote != null ? Number(item.preco_pacote) : null,
        quantidade: qty,
      });
    },
    [addReal],
  );

  const remove = useCallback(
    (id: string, tipo?: CartTipo) => {
      rawItems
        .filter((i) => i.product_id === id && (tipo ? i.tipo_compra === tipo : true))
        .forEach((i) => removeReal(i.product_id, i.tipo_compra));
    },
    [rawItems, removeReal],
  );

  const setQty = useCallback(
    (id: string, qty: number, tipo?: CartTipo) => {
      const line = rawItems.find(
        (i) => i.product_id === id && (tipo ? i.tipo_compra === tipo : true),
      );
      if (!line) return;
      if (qty <= 0) {
        removeReal(line.product_id, line.tipo_compra);
        return;
      }
      setQtyReal(line.product_id, line.tipo_compra, qty);
    },
    [rawItems, removeReal, setQtyReal],
  );

  const count = cartUnitCount(rawItems);
  const total = cartSubtotal(rawItems);

  return { items, add, remove, setQty, clear, count, total };
}
