import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function geocodeOne(query: string): Promise<{ lat: number; lng: number } | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !gmapsKey) throw new Error("Google Maps connector not configured");
  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=br&language=pt-BR`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmapsKey,
      },
    },
  );
  if (!res.ok) return null;
  const json: any = await res.json();
  const loc = json?.results?.[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

/** Geocode a single free-form query (used by the map UI to center on a city). */
export const geocodeQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => {
    if (!input?.query || typeof input.query !== "string") throw new Error("query required");
    return { query: input.query.slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const result = await geocodeOne(data.query);
    return { result };
  });

/** Backfill latitude/longitude on companies+leads that have cidade/estado but no coords. */
export const backfillGeocodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: companies = [] }, { data: leads = [] }] = await Promise.all([
      supabase
        .from("companies")
        .select("id,cidade,estado")
        .is("latitude", null)
        .not("cidade", "is", null)
        .limit(100),
      supabase
        .from("leads")
        .select("id,cidade,estado")
        .is("latitude", null)
        .not("cidade", "is", null)
        .limit(100),
    ]);

    let updated = 0;
    let failed = 0;
    const cache = new Map<string, { lat: number; lng: number } | null>();

    const lookup = async (cidade: string | null, estado: string | null) => {
      if (!cidade) return null;
      const key = `${cidade}|${estado ?? ""}`.toLowerCase();
      if (cache.has(key)) return cache.get(key)!;
      const q = [cidade, estado, "Brasil"].filter(Boolean).join(", ");
      const r = await geocodeOne(q);
      cache.set(key, r);
      return r;
    };

    for (const c of companies ?? []) {
      const loc = await lookup(c.cidade, c.estado);
      if (loc) {
        const { error } = await supabase
          .from("companies")
          .update({ latitude: loc.lat, longitude: loc.lng } as any)
          .eq("id", c.id);
        if (error) failed++; else updated++;
      } else failed++;
    }
    for (const l of leads ?? []) {
      const loc = await lookup(l.cidade, l.estado);
      if (loc) {
        const { error } = await supabase
          .from("leads")
          .update({ latitude: loc.lat, longitude: loc.lng } as any)
          .eq("id", l.id);
        if (error) failed++; else updated++;
      } else failed++;
    }

    return {
      updated,
      failed,
      pending: { companies: companies?.length ?? 0, leads: leads?.length ?? 0 },
    };
  });
