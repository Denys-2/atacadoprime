import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { runOrQueue } from "@/lib/offline-mutations";

export type Visit = Database["public"]["Tables"]["visits"]["Row"];
export type RoutePlan = Database["public"]["Tables"]["route_plans"]["Row"];
export type RouteItem = Database["public"]["Tables"]["route_items"]["Row"];
export type VisitTask = Database["public"]["Tables"]["visit_tasks"]["Row"];
export type VisitPhoto = Database["public"]["Tables"]["visit_photos"]["Row"];
export type SharedCart = Database["public"]["Tables"]["shared_carts"]["Row"];
export type PublicSharedCart = Pick<SharedCart, "items" | "subtotal" | "observacoes" | "status" | "expires_at">;

export type VisitResultado = Database["public"]["Enums"]["visit_resultado"];

export const VISIT_RESULTS: { value: VisitResultado; label: string }[] = [
  { value: "COMPROU", label: "Cliente comprou" },
  { value: "NEGOCIACAO", label: "Em negociação" },
  { value: "RETORNAR", label: "Retornar depois" },
  { value: "SEM_INTERESSE", label: "Sem interesse" },
  { value: "AUSENTE", label: "Cliente ausente" },
  { value: "OUTRO", label: "Outro" },
];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ----- Routes -----
export function useTodayRoute(userId: string | undefined) {
  return useQuery({
    queryKey: ["route-today", userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = todayISO();
      const { data: plan } = await supabase
        .from("route_plans")
        .select("*")
        .eq("user_id", userId!)
        .eq("data", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!plan) return { plan: null, items: [] as (RouteItem & { company: any; lead: any })[] };
      const { data: items = [] } = await supabase
        .from("route_items")
        .select("*, company:companies(id,legal_name,trade_name,cidade,estado,phone), lead:leads(id,empresa,contato,cidade,estado,telefone)")
        .eq("route_id", plan.id)
        .order("ordem", { ascending: true });
      return { plan, items: (items ?? []) as any[] };
    },
  });
}

export function useRoutes(userId: string | undefined) {
  return useQuery({
    queryKey: ["routes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("route_plans")
        .select("*")
        .eq("user_id", userId!)
        .order("data", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RoutePlan> & { user_id: string; nome: string }) => {
      const { data, error } = await supabase.from("route_plans").insert(input as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useAddRouteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { route_id: string; company_id?: string | null; lead_id?: string | null; ordem?: number }) => {
      const { data, error } = await supabase.from("route_items").insert(input as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-today"] }),
  });
}

// ----- Visits -----
export function useVisits(userId: string | undefined) {
  return useQuery({
    queryKey: ["visits", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("visits")
        .select("*, company:companies(id,legal_name,trade_name), lead:leads(id,empresa,contato)")
        .order("checkin_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
}

async function getPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000 },
    );
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; company_id?: string | null; lead_id?: string | null; route_item_id?: string | null }) => {
      const pos = await getPosition();
      const payload = {
        user_id: input.user_id,
        company_id: input.company_id ?? null,
        lead_id: input.lead_id ?? null,
        checkin_at: new Date().toISOString(),
        checkin_lat: pos?.lat ?? null,
        checkin_lng: pos?.lng ?? null,
        route_item_id: input.route_item_id ?? null,
      };
      const res = await runOrQueue(
        "visit_checkin",
        payload,
        async () => {
          const { route_item_id, ...rest } = payload;
          const { data, error } = await supabase
            .from("visits")
            .insert(rest as any)
            .select()
            .single();
          if (error) throw error;
          if (route_item_id) {
            await supabase.from("route_items").update({ visit_id: data.id, visitado: true }).eq("id", route_item_id);
          }
          return data;
        },
        "Check-in de visita",
      );
      return res.data ?? { id: res.id, ...payload };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["route-today"] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { visit_id: string; resultado: VisitResultado; observacoes?: string }) => {
      const pos = await getPosition();
      const now = new Date();
      let dur: number | null = null;
      try {
        const { data: visit } = await supabase.from("visits").select("checkin_at").eq("id", input.visit_id).single();
        dur = visit?.checkin_at ? Math.max(1, Math.round((now.getTime() - new Date(visit.checkin_at).getTime()) / 60000)) : null;
      } catch { /* offline: sem duração */ }
      const patch = {
        checkout_at: now.toISOString(),
        checkout_lat: pos?.lat ?? null,
        checkout_lng: pos?.lng ?? null,
        resultado: input.resultado,
        observacoes: input.observacoes ?? null,
        duracao_min: dur,
      };
      await runOrQueue(
        "visit_checkout",
        { visit_id: input.visit_id, patch },
        async () => {
          const { error } = await supabase.from("visits").update(patch as any).eq("id", input.visit_id);
          if (error) throw error;
          return input.visit_id;
        },
        "Check-out de visita",
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["route-today"] });
    },
  });
}

export function useVisit(id: string | undefined) {
  return useQuery({
    queryKey: ["visit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("visits")
        .select("*, company:companies(*), lead:leads(*), photos:visit_photos(*), tasks:visit_tasks(*)")
        .eq("id", id!)
        .single();
      return data;
    },
  });
}

// ----- Field stats -----
export function useFieldStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["field-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: visits = [] } = await supabase
        .from("visits")
        .select("id,resultado,checkin_at,checkout_at,duracao_min,company_id,lead_id")
        .gte("checkin_at", since.toISOString());
      const list = visits ?? [];
      const today = todayISO();
      const todayVisits = list.filter((v: any) => (v.checkin_at ?? "").slice(0, 10) === today);
      const conv = list.filter((v: any) => v.resultado === "COMPROU").length;
      const durs = list.map((v: any) => v.duracao_min).filter(Boolean) as number[];
      const avgDur = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
      return {
        todayCount: todayVisits.length,
        monthCount: list.length,
        conversions: conv,
        avgDuration: avgDur,
        companies: new Set(list.map((v: any) => v.company_id).filter(Boolean)).size,
        leads: new Set(list.map((v: any) => v.lead_id).filter(Boolean)).size,
      };
    },
  });
}

// ----- Nearby -----
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function useNearby(pos: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ["nearby", pos?.lat, pos?.lng],
    enabled: !!pos,
    queryFn: async () => {
      const [{ data: companies = [] }, { data: leads = [] }] = await Promise.all([
        supabase.from("companies").select("id,legal_name,trade_name,cidade,estado,latitude,longitude,phone").not("latitude", "is", null),
        supabase.from("leads").select("id,empresa,contato,cidade,estado,latitude,longitude,telefone").not("latitude", "is", null),
      ]);
      const withDist = <T extends { latitude: any; longitude: any }>(arr: T[]) =>
        arr
          .map((x) => ({ ...x, distance: haversine(pos!, { lat: Number(x.latitude), lng: Number(x.longitude) }) }))
          .sort((a, b) => a.distance - b.distance);
      return { companies: withDist(companies ?? []), leads: withDist(leads ?? []) };
    },
  });
}

export async function getCurrentPosition() {
  return getPosition();
}

// ----- Shared cart -----
export function useCreateSharedCart() {
  return useMutation({
    mutationFn: async (input: {
      created_by: string;
      company_id?: string | null;
      lead_id?: string | null;
      visit_id?: string | null;
      items: { product_id: string; nome: string; quantidade: number; preco: number }[];
      observacoes?: string;
    }) => {
      const subtotal = input.items.reduce((s, i) => s + i.quantidade * i.preco, 0);
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const { data, error } = await supabase
        .from("shared_carts")
        .insert({
          created_by: input.created_by,
          company_id: input.company_id ?? null,
          lead_id: input.lead_id ?? null,
          visit_id: input.visit_id ?? null,
          items: input.items as any,
          subtotal,
          observacoes: input.observacoes ?? null,
          expires_at: expires.toISOString(),
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSharedCart(token: string | undefined) {
  return useQuery({
    queryKey: ["shared-cart", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shared_cart", { _token: token! });
      if (error) throw error;
      return (data?.[0] ?? null) as PublicSharedCart | null;
    },
  });
}
