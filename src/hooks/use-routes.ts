import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MapMarker = {
  id: string;
  kind: "company" | "lead" | "vip" | "inactive";
  name: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  meta?: Record<string, any>;
};

export type MapMarkersResult = {
  markers: MapMarker[];
  pending: MapMarker[];
  total: number;
};

const normalizeSearchValue = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const matchesLocationFilter = (
  row: { cidade: string | null; estado: string | null },
  filters?: { cidade?: string; estado?: string },
) => {
  const cityFilter = normalizeSearchValue(filters?.cidade);
  const stateFilter = normalizeSearchValue(filters?.estado);
  const rowCity = normalizeSearchValue(row.cidade);
  const rowState = normalizeSearchValue(row.estado);

  return (!cityFilter || rowCity.includes(cityFilter)) && (!stateFilter || rowState.includes(stateFilter));
};

export function useMapMarkers(filters?: { cidade?: string; estado?: string }) {
  const hasFilter = Boolean(filters?.cidade?.trim() || filters?.estado?.trim());
  return useQuery({
    queryKey: ["map-markers", filters?.cidade ?? "", filters?.estado ?? ""],
    queryFn: async () => {
      let cq = supabase
        .from("companies")
        .select("id,legal_name,trade_name,cidade,estado,latitude,longitude,phone,status");
      let lq = supabase
        .from("leads")
        .select("id,empresa,contato,cidade,estado,latitude,longitude,telefone,status");
      // Sem filtro: só pontos geocodificados (visão geral do mapa).
      // Com filtro: traz todos os matches, mesmo sem coordenadas.
      if (!hasFilter) {
        cq = cq.not("latitude", "is", null);
        cq = cq.not("longitude", "is", null);
        lq = lq.not("latitude", "is", null);
        lq = lq.not("longitude", "is", null);
      }
      const [{ data: companies = [], error: companiesError }, { data: leads = [], error: leadsError }] = await Promise.all([cq, lq]);
      if (companiesError) throw companiesError;
      if (leadsError) throw leadsError;
      const markers: MapMarker[] = [];
      const pending: MapMarker[] = [];
      const add = (m: MapMarker, hasCoords: boolean) =>
        hasCoords ? markers.push(m) : pending.push(m);
      const filteredCompanies = hasFilter ? (companies ?? []).filter((c) => matchesLocationFilter(c, filters)) : (companies ?? []);
      const filteredLeads = hasFilter ? (leads ?? []).filter((l) => matchesLocationFilter(l, filters)) : (leads ?? []);
      for (const c of filteredCompanies) {
        const hasCoords = c.latitude != null && c.longitude != null;
        add(
          {
            id: `c-${c.id}`,
            kind: c.status === "approved" ? "company" : "inactive",
            name: c.trade_name || c.legal_name,
            city: c.cidade,
            state: c.estado,
            phone: c.phone,
            lat: hasCoords ? Number(c.latitude) : NaN,
            lng: hasCoords ? Number(c.longitude) : NaN,
            meta: { company_id: c.id, status: c.status },
          },
          hasCoords,
        );
      }
      for (const l of filteredLeads) {
        const hasCoords = l.latitude != null && l.longitude != null;
        add(
          {
            id: `l-${l.id}`,
            kind: "lead",
            name: l.empresa,
            city: l.cidade,
            state: l.estado,
            phone: l.telefone,
            lat: hasCoords ? Number(l.latitude) : NaN,
            lng: hasCoords ? Number(l.longitude) : NaN,
            meta: { lead_id: l.id, status: l.status },
          },
          hasCoords,
        );
      }
      return { markers, pending, total: markers.length + pending.length } satisfies MapMarkersResult;
    },
  });
}

export function useRoutePlans() {
  return useQuery({
    queryKey: ["route-plans-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateRoutePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string; cidade?: string | null; data_planejada?: string | null; responsavel_id: string }) => {
      const { data, error } = await supabase.from("route_plans").insert(input as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-plans-all"] }),
  });
}

export function useAddRouteStops() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { route_id: string; stops: Array<{ company_id?: string | null; lead_id?: string | null; latitude: number; longitude: number; ordem: number }> }) => {
      const rows = input.stops.map((s) => ({ route_id: input.route_id, ...s }));
      const { error } = await supabase.from("route_items").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-plans-all"] }),
  });
}

export function useUpdateRoutePlanStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { route_id: string; status: "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA" }) => {
      const { error } = await supabase.from("route_plans").update({ status: input.status } as any).eq("id", input.route_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route-plans-all"] });
      qc.invalidateQueries({ queryKey: ["route-dashboard"] });
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["route-today"] });
    },
  });
}

export function useDeleteRoutePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (route_id: string) => {
      await supabase.from("route_items").delete().eq("route_id", route_id);
      const { error } = await supabase.from("route_plans").delete().eq("id", route_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route-plans-all"] });
      qc.invalidateQueries({ queryKey: ["route-dashboard"] });
    },
  });
}

export async function loadRouteItems(route_id: string) {
  const { data, error } = await supabase
    .from("route_items")
    .select("*, companies(trade_name,legal_name,latitude,longitude,cidade,estado), leads(empresa,latitude,longitude,cidade,estado)")
    .eq("route_id", route_id)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useRouteDashboard() {
  return useQuery({
    queryKey: ["route-dashboard"],
    queryFn: async () => {
      const [plans, items, execs, metrics] = await Promise.all([
        supabase.from("route_plans").select("id,status", { count: "exact" }),
        supabase.from("route_items").select("id", { count: "exact" }),
        supabase.from("route_execution").select("distancia_real,tempo_real"),
        supabase.from("route_metrics").select("visitas,pedidos,valor_vendido"),
      ]);
      const totals = (metrics.data ?? []).reduce(
        (acc, m: any) => ({
          visitas: acc.visitas + (m.visitas ?? 0),
          pedidos: acc.pedidos + (m.pedidos ?? 0),
          valor: acc.valor + Number(m.valor_vendido ?? 0),
        }),
        { visitas: 0, pedidos: 0, valor: 0 }
      );
      const km = (execs.data ?? []).reduce((s, e: any) => s + Number(e.distancia_real ?? 0), 0);
      const minutos = (execs.data ?? []).reduce((s, e: any) => s + Number(e.tempo_real ?? 0), 0);
      return {
        rotas_criadas: plans.count ?? 0,
        rotas_executadas: (plans.data ?? []).filter((p: any) => p.status === "DONE").length,
        visitas: totals.visitas,
        pedidos: totals.pedidos,
        valor: totals.valor,
        km,
        minutos,
        paradas: items.count ?? 0,
      };
    },
  });
}

// Simple nearest-neighbor route optimization
export function optimizeRoute(start: { lat: number; lng: number }, stops: Array<{ lat: number; lng: number; id: string }>) {
  const remaining = [...stops];
  const ordered: typeof stops = [];
  let cur = start;
  const R = 6371;
  const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  };
  let total = 0;
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = dist(cur, remaining[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    total += bestD;
    cur = remaining[best];
    ordered.push(remaining.splice(best, 1)[0]);
  }
  return { ordered, distance_km: total };
}
