import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Campaign = Database["public"]["Tables"]["commercial_campaigns"]["Row"];
export type CampaignContact = Database["public"]["Tables"]["campaign_contacts"]["Row"];
export type CampaignMessage = Database["public"]["Tables"]["campaign_messages"]["Row"];
export type CampaignResponse = Database["public"]["Tables"]["campaign_responses"]["Row"];

export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];
export type CampaignModel = Database["public"]["Enums"]["campaign_model"];
export type CampaignStage = Database["public"]["Enums"]["campaign_contact_stage"];
export type CampaignClass = Database["public"]["Enums"]["campaign_response_class"];

export const STAGES: { key: CampaignStage; label: string }[] = [
  { key: "ENVIADA", label: "Enviadas" },
  { key: "VISUALIZADA", label: "Visualizadas" },
  { key: "RESPONDEU", label: "Respondeu" },
  { key: "INTERESSADO", label: "Interessados" },
  { key: "PRE_PEDIDO", label: "Pré-pedidos" },
  { key: "VISITA_AGENDADA", label: "Visita agendada" },
  { key: "PEDIDO", label: "Pedido" },
];

export const MODELS: { key: CampaignModel; label: string }[] = [
  { key: "VISITA", label: "Visita comercial" },
  { key: "REPOSICAO", label: "Reposição de estoque" },
  { key: "REATIVACAO", label: "Reativação" },
  { key: "LANCAMENTO", label: "Lançamento" },
  { key: "PROMOCAO", label: "Promoção" },
  { key: "POS_VENDA", label: "Pós-venda" },
];

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_campaigns")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useCampaignContacts(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "contacts"],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_contacts")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCampaignFunnel(campaignId: string | undefined) {
  const { data: contacts = [] } = useCampaignContacts(campaignId);
  const total = contacts.length;
  const byStage = STAGES.map((s) => ({
    ...s,
    count: contacts.filter((c) => c.stage === s.key).length,
    pct: total ? Math.round((contacts.filter((c) => c.stage === s.key).length / total) * 100) : 0,
  }));
  return { total, byStage };
}

export function useUpsertCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Campaign> & { id?: string }) => {
      const { id, ...rest } = input;
      const payload = { ...rest, nome: rest.nome ?? "Nova campanha" };
      if (id) {
        const { error } = await supabase.from("commercial_campaigns").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("commercial_campaigns")
        .insert({ ...payload, created_by: u.user?.id, responsavel_id: payload.responsavel_id ?? u.user?.id } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commercial_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

// Segmentação inteligente — busca contatos elegíveis (leads + empresas)
export type SegmentFilters = {
  cidade?: string;
  estado?: string;
  segmento?: string;
  semCompraDias?: number; // 30/60/90/120
  leadScoreMin?: number;
  vipMin?: number;
};

export async function searchSegmentTargets(f: SegmentFilters) {
  // Leads
  let leadsQ = supabase.from("leads").select("id,nome,whatsapp,cidade,estado,segmento,score").not("whatsapp", "is", null);
  if (f.cidade) leadsQ = leadsQ.ilike("cidade", `%${f.cidade}%`);
  if (f.estado) leadsQ = leadsQ.ilike("estado", `%${f.estado}%`);
  if (f.segmento) leadsQ = leadsQ.ilike("segmento", `%${f.segmento}%`);
  if (f.leadScoreMin) leadsQ = leadsQ.gte("score", f.leadScoreMin);
  const { data: leads = [] } = await leadsQ.limit(200);

  // Empresas (clientes)
  let cQ = supabase
    .from("companies")
    .select("id,trade_name,legal_name,phone,cidade,estado")
    .not("phone", "is", null);
  if (f.cidade) cQ = cQ.ilike("cidade", `%${f.cidade}%`);
  if (f.estado) cQ = cQ.ilike("estado", `%${f.estado}%`);
  const { data: companies = [] } = await cQ.limit(200);

  return {
    leads: (leads ?? []).map((l: any) => ({
      kind: "lead" as const,
      lead_id: l.id,
      name: l.nome,
      phone: l.whatsapp,
      cidade: l.cidade,
      estado: l.estado,
    })),
    companies: (companies ?? []).map((c: any) => ({
      kind: "company" as const,
      company_id: c.id,
      name: c.trade_name ?? c.legal_name,
      phone: c.phone,
      cidade: c.cidade,
      estado: c.estado,
    })),
  };
}

export function useAddCampaignContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      campaignId: string;
      contacts: Array<{
        lead_id?: string;
        company_id?: string;
        name?: string | null;
        phone: string;
        cidade?: string | null;
        estado?: string | null;
      }>;
    }) => {
      if (!input.contacts.length) return;
      const rows = input.contacts.map((c) => ({
        campaign_id: input.campaignId,
        lead_id: c.lead_id ?? null,
        company_id: c.company_id ?? null,
        contact_name: c.name ?? null,
        phone: c.phone,
        cidade: c.cidade ?? null,
        estado: c.estado ?? null,
      }));
      const { error } = await supabase.from("campaign_contacts").insert(rows);
      if (error) throw error;
      await supabase.from("campaign_history").insert({
        campaign_id: input.campaignId,
        evento: "CONTATOS_ADICIONADOS",
        descricao: `${rows.length} contatos adicionados`,
      });
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["campaigns", v.campaignId] }),
  });
}

export function useUpdateContactStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; stage: CampaignStage; classification?: CampaignClass | null }) => {
      const { error } = await supabase
        .from("campaign_contacts")
        .update({ stage: input.stage, classification: input.classification ?? null })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useCampaignStats() {
  return useQuery({
    queryKey: ["campaigns", "stats"],
    queryFn: async () => {
      const { count: ativas } = await supabase
        .from("commercial_campaigns")
        .select("*", { count: "exact", head: true })
        .in("status", ["AGENDADA", "EM_EXECUCAO"]);
      const { count: total } = await supabase
        .from("commercial_campaigns")
        .select("*", { count: "exact", head: true });
      const { count: contatos } = await supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true });
      const { count: interessados } = await supabase
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .in("stage", ["INTERESSADO", "PRE_PEDIDO", "VISITA_AGENDADA", "PEDIDO"]);
      return {
        ativas: ativas ?? 0,
        total: total ?? 0,
        contatos: contatos ?? 0,
        interessados: interessados ?? 0,
      };
    },
  });
}
