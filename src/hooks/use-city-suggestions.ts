import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CityOption = { cidade: string; estado: string | null };

/**
 * Fetches distinct city/UF pairs already used in the system (companies + trips + trip destinations).
 * Used to power city autocomplete so users don't retype/misspell cities.
 */
export function useCitySuggestions() {
  return useQuery<CityOption[]>({
    queryKey: ["city-suggestions"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [companiesRes, tripsRes] = await Promise.all([
        supabase.from("companies").select("cidade, estado").not("cidade", "is", null).limit(2000),
        supabase.from("trips").select("cidade, estado, destinos").not("cidade", "is", null).limit(500),
      ]);

      const map = new Map<string, CityOption>();
      const push = (cidade: unknown, estado: unknown) => {
        if (typeof cidade !== "string") return;
        const c = cidade.trim().toUpperCase();
        if (!c) return;
        const uf = typeof estado === "string" ? estado.trim().toUpperCase() || null : null;
        const key = `${c}|${uf ?? ""}`;
        if (!map.has(key)) map.set(key, { cidade: c, estado: uf });
      };

      (companiesRes.data ?? []).forEach((r) => push(r.cidade, r.estado));
      (tripsRes.data ?? []).forEach((r) => {
        push(r.cidade, r.estado);
        if (Array.isArray(r.destinos)) {
          (r.destinos as Array<{ cidade?: unknown; estado?: unknown }>).forEach((d) =>
            push(d?.cidade, d?.estado),
          );
        }
      });

      return Array.from(map.values()).sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR"));
    },
  });
}
