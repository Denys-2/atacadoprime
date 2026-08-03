// Camada de armazenamento offline (IndexedDB via idb-keyval)
// Guarda catálogo completo (produtos, marcas, categorias), lista de clientes
// e a fila de vendas pendentes de sincronização.

import { get, set, del } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/hooks/use-cart";

// ------- Chaves -------
const K = {
  products: "offline:catalog:products",
  categories: "offline:catalog:categories",
  brands: "offline:catalog:brands",
  companies: "offline:catalog:companies",
  leads: "offline:catalog:leads",
  syncedAt: "offline:catalog:syncedAt",
  imagesPrewarmed: "offline:catalog:imagesPrewarmed",
  salesQueue: "offline:sales:queue",
};

// ------- Tipos -------
export type OfflineProduct = {
  id: string;
  nome: string;
  sku: string | null;
  preco: number;
  preco_pacote: number | null;
  quantidade_pacote: number | null;
  estoque: number | null;
  tipo: string | null;
  categoria_id: string | null;
  marca_id: string | null;
  categoria_nome: string | null;
  marca_nome: string | null;
  imagem_url: string | null;
};

export type OfflineCategory = { id: string; nome: string };
export type OfflineBrand = { id: string; nome: string };
export type OfflineCompany = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  phone: string | null;
  cidade: string | null;
  estado: string | null;
};
export type OfflineLead = {
  id: string;
  empresa: string;
  contato: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  company_id: string | null;
};

export type NewClientDraft = {
  legal_name: string;
  phone: string;
  cidade?: string | null;
  estado?: string | null;
};

export type OfflineSale = {
  local_id: string;
  created_at: number;
  status: "pending" | "sending" | "sent" | "error";
  error?: string | null;
  remote_order_id?: string | null;
  // cliente: pelo menos um destes 3
  company_id?: string | null;
  lead_id?: string | null;
  new_client?: NewClientDraft | null;
  visit_id?: string | null;
  // pedido
  items: CartItem[];
  frete: number;
  desconto: number;
  acrescimo: number;
  observacao?: string | null;
  pagamento: "DINHEIRO" | "PIX" | "CARTAO";
  origem: "VISITA" | "PORTAL" | "WHATSAPP";
  subtotal: number;
  total: number;
};

// ------- Catálogo: leitura -------
export async function loadCachedCatalog() {
  const [products, categories, brands, companies, leads, syncedAt] = await Promise.all([
    get<OfflineProduct[]>(K.products),
    get<OfflineCategory[]>(K.categories),
    get<OfflineBrand[]>(K.brands),
    get<OfflineCompany[]>(K.companies),
    get<OfflineLead[]>(K.leads),
    get<number>(K.syncedAt),
  ]);
  return {
    products: products ?? [],
    categories: categories ?? [],
    brands: brands ?? [],
    companies: companies ?? [],
    leads: leads ?? [],
    syncedAt: syncedAt ?? null,
  };
}

// ------- Catálogo: sincronização (baixa tudo do servidor) -------
export async function syncCatalogFromServer(): Promise<{ count: number }> {
  const [prod, cat, br, comp, lds] = await Promise.all([
    supabase
      .from("products")
      .select("id,nome,sku,preco_unitario,preco_pacote,quantidade_pacote,estoque,tipo,categoria_id,marca_id,brands(nome),categories(nome),product_images(image_url,ordem)")
      .eq("status", true)
      .order("nome"),
    supabase.from("categories").select("id,nome").order("nome"),
    supabase.from("brands").select("id,nome").order("nome"),
    supabase.from("companies").select("id,legal_name,trade_name,phone,cidade,estado").order("legal_name"),
    supabase.from("leads").select("id,empresa,contato,telefone,cidade,estado,company_id").order("empresa"),
  ]);
  if (prod.error) throw prod.error;

  const products: OfflineProduct[] = (prod.data ?? []).map((p: any) => {
    const imgs = (p.product_images ?? []).slice().sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return {
      id: p.id,
      nome: p.nome,
      sku: p.sku ?? null,
      preco: Number(p.preco_unitario ?? p.preco ?? 0),
      preco_pacote: p.preco_pacote != null ? Number(p.preco_pacote) : null,
      quantidade_pacote: p.quantidade_pacote != null ? Number(p.quantidade_pacote) : null,
      estoque: p.estoque != null ? Number(p.estoque) : null,
      tipo: p.tipo ?? null,
      categoria_id: p.categoria_id ?? null,
      marca_id: p.marca_id ?? null,
      categoria_nome: p.categories?.nome ?? null,
      marca_nome: p.brands?.nome ?? null,
      imagem_url: imgs[0]?.image_url ?? null,
    };
  });

  await Promise.all([
    set(K.products, products),
    set(K.categories, (cat.data ?? []) as OfflineCategory[]),
    set(K.brands, (br.data ?? []) as OfflineBrand[]),
    set(K.companies, (comp.data ?? []) as OfflineCompany[]),
    set(K.leads, (lds.data ?? []) as OfflineLead[]),
    set(K.syncedAt, Date.now()),
  ]);

  // Prewarm de imagens em background (não bloqueia)
  void prewarmImages(products.map((p) => p.imagem_url).filter(Boolean) as string[]);

  return { count: products.length };
}

async function prewarmImages(urls: string[]) {
  if (typeof window === "undefined") return;
  const already = await get<Record<string, true>>(K.imagesPrewarmed).catch(() => undefined);
  const done = new Set(Object.keys(already ?? {}));
  const todo = urls.filter((u) => !done.has(u));
  // Limita concorrência p/ não travar
  const batchSize = 6;
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (u) => {
        try {
          await fetch(u, { mode: "no-cors", cache: "force-cache" });
          done.add(u);
        } catch { /* offline / falha */ }
      }),
    );
  }
  const map: Record<string, true> = {};
  for (const u of done) map[u] = true;
  await set(K.imagesPrewarmed, map).catch(() => {});
}

// ------- Fila de vendas -------
export async function loadSalesQueue(): Promise<OfflineSale[]> {
  return (await get<OfflineSale[]>(K.salesQueue)) ?? [];
}
export async function saveSalesQueue(list: OfflineSale[]) {
  await set(K.salesQueue, list);
}
export async function enqueueOfflineSale(sale: OfflineSale) {
  const list = await loadSalesQueue();
  list.push(sale);
  await saveSalesQueue(list);
}
export async function removeOfflineSale(local_id: string) {
  const list = await loadSalesQueue();
  await saveSalesQueue(list.filter((s) => s.local_id !== local_id));
}
export async function updateOfflineSale(local_id: string, patch: Partial<OfflineSale>) {
  const list = await loadSalesQueue();
  const next = list.map((s) => (s.local_id === local_id ? { ...s, ...patch } : s));
  await saveSalesQueue(next);
}

export async function clearOfflineStore() {
  await Promise.all([
    del(K.products),
    del(K.categories),
    del(K.brands),
    del(K.companies),
    del(K.leads),
    del(K.syncedAt),
    del(K.imagesPrewarmed),
    del(K.salesQueue),
  ]);
}
