import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCanSeePrices } from "@/hooks/use-catalog";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favoritos — Atacado" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();
  const { canSeePrices } = useCanSeePrices();
  const { data = [], isLoading } = useQuery({
    queryKey: ["favorites-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("product_id, products(*, brands(nome), product_images(image_url, ordem))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((f) => f.products).filter(Boolean);
    },
  });

  return (
    <AppShell title="Favoritos" description="Produtos que você salvou.">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você ainda não favoritou nenhum produto.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {data.map((p) => {
            if (!p) return null;
            const img = (p.product_images ?? []).sort((a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem)[0];
            return (
              <Link key={p.id} to="/v3" search={{ produto: p.id }} className="bg-card border border-border rounded-xl overflow-hidden shadow-soft hover:shadow-md transition-shadow">
                <div className="aspect-square bg-muted">
                  {img && <img src={img.image_url} alt={p.nome} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.brands?.nome ?? "—"}</p>
                  <p className="font-medium text-sm line-clamp-2 mt-0.5">{p.nome}</p>
                  {canSeePrices && <p className="text-sm font-semibold mt-2">{brl(p.preco_unitario)}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
