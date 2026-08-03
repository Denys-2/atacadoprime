import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { parseLeadAddress } from "@/lib/lead-address";
import { runOrQueue } from "@/lib/offline-mutations";

export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type LeadSegmento = Database["public"]["Enums"]["lead_segmento"];
export type LeadActivityTipo = Database["public"]["Enums"]["lead_activity_tipo"];
export type LeadTaskStatus = Database["public"]["Enums"]["lead_task_status"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
export type LeadTask = Database["public"]["Tables"]["lead_tasks"]["Row"];
export type LeadActivity = Database["public"]["Tables"]["lead_activities"]["Row"];
export type LeadNote = Database["public"]["Tables"]["lead_notes"]["Row"];
export type LeadStageHistory = Database["public"]["Tables"]["lead_stage_history"]["Row"];

export const LEAD_STAGES: { id: LeadStatus; label: string; tone: string }[] = [
  { id: "NOVO_LEAD", label: "Novo Lead", tone: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { id: "CONTATO_FEITO", label: "Contato Feito", tone: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
  { id: "NEGOCIACAO", label: "Negociação", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { id: "AGUARDANDO_RETORNO", label: "Aguardando Retorno", tone: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  { id: "CLIENTE", label: "Cliente", tone: "bg-success/15 text-success border-success/40" },
  { id: "PEDIDO", label: "Pedido", tone: "bg-primary/15 text-primary border-primary/40" },
];

export const SEGMENTOS: { id: LeadSegmento; label: string }[] = [
  { id: "CHAVEIRO", label: "Chaveiro" },
  { id: "AUTO_ELETRICA", label: "Auto Elétrica" },
  { id: "CENTRO_AUTOMOTIVO", label: "Centro Automotivo" },
  { id: "LOJA_DE_SOM", label: "Loja de Som" },
  { id: "AUTO_PECAS", label: "Auto Peças" },
  { id: "INSTALADOR_DE_ALARMES", label: "Instalador de Alarmes" },
  { id: "OUTRO", label: "Outro" },
];

export function useLeads(search?: string) {
  return useQuery({
    queryKey: ["crm", "leads", search ?? ""],
    queryFn: async () => {
      let q = supabase.from("leads").select("*").order("position", { ascending: true });
      if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`empresa.ilike.${s},contato.ilike.${s},whatsapp.ilike.${s},cidade.ilike.${s},email.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ["crm", "lead", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useLeadActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: ["crm", "activities", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLeadTasks(leadId?: string) {
  return useQuery({
    queryKey: ["crm", "tasks", leadId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("lead_tasks").select("*").order("data", { ascending: true });
      if (leadId) q = q.eq("lead_id", leadId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<LeadInsert, "created_by">) => {
      const res = await runOrQueue(
        "lead_insert",
        input,
        async () => {
          const { data: userData } = await supabase.auth.getUser();
          const { data, error } = await supabase
            .from("leads")
            .insert({ ...input, created_by: userData.user?.id })
            .select()
            .single();
          if (error) throw error;
          return data;
        },
        `Lead: ${input.empresa}`,
      );
      return res.data ?? { id: res.id, ...input };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LeadInsert> }) => {
      const res = await runOrQueue(
        "lead_update",
        { id, patch },
        async () => {
          const { data, error } = await supabase.from("leads").update(patch).eq("id", id).select().single();
          if (error) throw error;
          return data;
        },
        `Lead #${id.slice(0, 8)}`,
      );
      return res.data ?? { id, ...patch };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, texto }: { leadId: string; texto: string }) => {
      await runOrQueue(
        "lead_note",
        { leadId, texto },
        async () => {
          const { data: u } = await supabase.auth.getUser();
          const { error: e1 } = await supabase.from("lead_notes").insert({ lead_id: leadId, texto, created_by: u.user?.id });
          if (e1) throw e1;
          await supabase.from("lead_activities").insert({ lead_id: leadId, tipo: "OBSERVACAO", descricao: texto, created_by: u.user?.id });
          return leadId;
        },
        "Nova anotação",
      );
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["crm", "activities", v.leadId] }),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["lead_tasks"]["Insert"]) => {
      await runOrQueue(
        "lead_task_insert",
        input,
        async () => {
          const { data: u } = await supabase.auth.getUser();
          const { error } = await supabase.from("lead_tasks").insert({ ...input, created_by: u.user?.id });
          if (error) throw error;
          return input.lead_id ?? "";
        },
        input.titulo ?? "Nova tarefa",
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "tasks"] }),
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadTaskStatus }) => {
      await runOrQueue(
        "lead_task_toggle",
        { id, status },
        async () => {
          const { error } = await supabase.from("lead_tasks").update({ status }).eq("id", id);
          if (error) throw error;
          return id;
        },
        "Atualização de tarefa",
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "tasks"] }),
  });
}

export function useConvertToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Lead) => {
      await runOrQueue(
        "lead_convert",
        { lead },
        async () => {
          let companyId = lead.company_id;
          if (!companyId) {
            const { data: u } = await supabase.auth.getUser();
            const ownerId = u.user?.id;
            if (!ownerId) throw new Error("Sessão expirada. Faça login novamente.");
            const { data: comp, error: ce } = await supabase
              .from("companies")
              .insert({
                legal_name: lead.empresa,
                trade_name: lead.empresa,
                owner_id: ownerId,
                phone: lead.whatsapp || lead.telefone || "",
                email: lead.email,
                cidade: lead.cidade,
                estado: lead.estado,
                latitude: lead.latitude,
                longitude: lead.longitude,
                status: "approved",
              } as never)
              .select()
              .single();
            if (ce) throw ce;
            companyId = comp.id;

            const parsedAddress = parseLeadAddress(lead.observacoes, lead.cidade, lead.estado);
            if (parsedAddress) {
              const { error: addressError } = await supabase.from("addresses").insert({
                ...parsedAddress,
                company_id: companyId,
                kind: "both",
                country: "BR",
                is_default: true,
              });
              if (addressError) throw addressError;
            }
          }
          const { error } = await supabase
            .from("leads")
            .update({ status: "CLIENTE", company_id: companyId })
            .eq("id", lead.id);
          if (error) throw error;
          return companyId!;
        },
        `Converter: ${lead.empresa}`,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });
}

export function useCrmStats() {
  return useQuery({
    queryKey: ["crm", "stats"],
    queryFn: async () => {
      const { data: leads } = await supabase.from("leads").select("status,created_at");
      const { data: tasks } = await supabase.from("lead_tasks").select("status,data");
      const arr = leads ?? [];
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const novos = arr.filter((l) => l.status === "NOVO_LEAD").length;
      const negociando = arr.filter((l) => l.status === "NEGOCIACAO").length;
      const clientes = arr.filter((l) => l.status === "CLIENTE").length;
      const conversoesMes = arr.filter((l) => l.status === "CLIENTE" && new Date(l.created_at) >= monthStart).length;
      const total = arr.length || 1;
      const taxa = Math.round((clientes / total) * 100);
      const pendentes = (tasks ?? []).filter((t) => t.status === "PENDENTE").length;
      return { novos, negociando, clientes, conversoesMes, taxa, pendentes };
    },
  });
}
