import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyCompany, useRoles } from "@/hooks/use-auth";
import { useSellerSession } from "@/hooks/use-seller-session";

export function useCanSeePrices() {
  const { user } = useAuth();
  const { data: company } = useMyCompany(user);
  const { data: roles = [] } = useRoles(user);
  const sellerCustomer = useSellerSession((s) => s.customer);
  const isStaff = roles.some((r) => r === "admin" || r === "vendedor" || r === "gerente");
  // Equipe de vendas vê preços sempre que logada (pode iniciar venda em visita pelo topo).
  const canSeePrices =
    !!user && (isStaff || company?.status === "approved");
  return { canSeePrices, isAuthenticated: !!user };
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type InstallmentPlan = { id: string; parcelas: number; multiplicador: number; ativo: boolean };
export function useInstallmentPlans() {
  return useQuery({
    queryKey: ["installment-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installment_plans" as never)
        .select("*")
        .eq("ativo", true)
        .order("parcelas");
      if (error) throw error;
      return (data ?? []) as unknown as InstallmentPlan[];
    },
  });
}

export type PaymentFee = { id: string; bandeira: string; credito_avista: number; credito_2_6: number; credito_7_12: number; ativo: boolean };
export function usePaymentFees() {
  return useQuery({
    queryKey: ["payment-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_fees" as never)
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as PaymentFee[];
    },
  });
}

export function usePaymentSettings() {
  return useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_settings" as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; key: string; value: number; label: string }[];
    },
  });
}

/** Generates plans 1..12. For N <= parcelasSemJuros, taxa is zeroed (merchant absorbs). */
export function buildPlansFromFees(fees: PaymentFee[], parcelasSemJuros = 0, antecipacaoMensal = 0): InstallmentPlan[] {
  if (fees.length === 0) return [{ id: "1", parcelas: 1, multiplicador: 1, ativo: true }];
  const avg = (k: keyof PaymentFee) => fees.reduce((s, f) => s + Number(f[k] ?? 0), 0) / fees.length;
  const avista = avg("credito_avista");
  const m26 = avg("credito_2_6");
  const m712 = avg("credito_7_12");
  const antec = antecipacaoMensal;
  const taxaFor = (n: number) => n === 1 ? avista : n <= 6 ? m26 : m712;
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    // 1x sempre = preço cheio (o preço exibido é o que o cliente paga à vista).
    // Parcelas até parcelasSemJuros também = preço cheio (loja absorve a taxa).
    if (n === 1 || n <= parcelasSemJuros) {
      return { id: String(n), parcelas: n, multiplicador: 1, ativo: true };
    }
    const taxa = taxaFor(n);
    if (taxa >= 100) {
      return { id: String(n), parcelas: n, multiplicador: 1, ativo: true };
    }
    const A = 1 - taxa / 100;
    const iRate = antec / 100;
    // S = Σ 1/(1+i)^k, k=1..N  (antecipação de todas as parcelas)
    let S = 0;
    for (let k = 1; k <= n; k++) S += 1 / Math.pow(1 + iRate, k);
    // X tal que (X*A/N) * S = preço  →  multiplicador = N / (A * S)
    const mult = n / (A * S);
    return { id: String(n), parcelas: n, multiplicador: Number(mult.toFixed(6)), ativo: true };
  });
}



export type CatalogFilters = {
  q?: string;
  categoria_id?: string | null;
  marca_id?: string | null;
  tipo?: string | null;
};

export function useProducts(filters: CatalogFilters = {}) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*, brands(nome), categories(nome), product_images(image_url, tipo_imagem, ordem)")
        .eq("status", true)
        .order("nome");

      if (filters.categoria_id) q = q.eq("categoria_id", filters.categoria_id);
      if (filters.marca_id) q = q.eq("marca_id", filters.marca_id);
      if (filters.tipo) q = q.eq("tipo", filters.tipo as never);

      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];

      if (filters.q?.trim()) {
        const stripHyphen = (s: string) => s.toLowerCase().replace(/-/g, "");
        const needle = stripHyphen(filters.q.trim());
        // also search compatibilities
        const { data: compat } = await supabase
          .from("compatibilities")
          .select("product_id, descricao")
          .ilike("descricao", `%${filters.q.trim()}%`);
        const compatIds = new Set((compat ?? []).map((c) => c.product_id));
        rows = rows.filter((p) => {
          const hay = stripHyphen(
            [p.nome, p.sku, p.codigo_fabricante, p.modelo, p.frequencia, p.tipo, p.brands?.nome, p.categories?.nome]
              .filter(Boolean)
              .join(" "),
          );
          return hay.includes(needle) || compatIds.has(p.id);
        });
      }

      return rows;
    },
  });
}

export function useAllProductsAdmin() {
  return useQuery({
    queryKey: ["products-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, brands(nome), categories(nome), product_images(image_url, tipo_imagem, ordem)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, brands(id, nome), categories(id, nome), product_images(*), compatibilities(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((f) => f.product_id);
    },
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, on }: { productId: string; on: boolean }) => {
      if (!user) throw new Error("Faça login para favoritar.");
      if (on) {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, product_id: productId });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });
}

export function useCatalogStats() {
  return useQuery({
    queryKey: ["catalog-stats"],
    queryFn: async () => {
      const [total, ativos, sem, marcas, cats, low] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("status", true),
        supabase.from("products").select("*", { count: "exact", head: true }).lte("estoque", 0),
        supabase.from("brands").select("*", { count: "exact", head: true }),
        supabase.from("categories").select("*", { count: "exact", head: true }),
        supabase.from("products").select("id, estoque, estoque_minimo"),
      ]);
      const lowCount = (low.data ?? []).filter((p) => p.estoque > 0 && p.estoque <= p.estoque_minimo).length;
      return {
        total: total.count ?? 0,
        ativos: ativos.count ?? 0,
        baixo: lowCount,
        sem: sem.count ?? 0,
        marcas: marcas.count ?? 0,
        cats: cats.count ?? 0,
      };
    },
  });
}
