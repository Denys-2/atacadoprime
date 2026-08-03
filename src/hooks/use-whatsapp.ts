import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";

export type WaConversation = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
export type WaMessage = Database["public"]["Tables"]["whatsapp_messages"]["Row"];
export type WaTemplate = Database["public"]["Tables"]["whatsapp_templates"]["Row"];
export type WaCampaign = Database["public"]["Tables"]["whatsapp_campaigns"]["Row"];

export function useConversations(filter: "all" | "unread" | "leads" | "clients" = "all") {
  return useQuery({
    queryKey: ["wa", "conversations", filter],
    queryFn: async () => {
      let q = supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (filter === "unread") q = q.gt("unread_count", 0);
      if (filter === "leads") q = q.not("lead_id", "is", null);
      if (filter === "clients") q = q.not("company_id", "is", null);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["wa", "messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWaRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("wa-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["wa", "messages"] });
        qc.invalidateQueries({ queryKey: ["wa", "conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["wa", "conversations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}

export function useTemplates() {
  return useQuery({
    queryKey: ["wa", "templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { id?: string; nome: string; categoria: string; conteudo: string }) => {
      if (t.id) {
        const { error } = await supabase.from("whatsapp_templates").update({
          nome: t.nome, categoria: t.categoria, conteudo: t.conteudo,
        }).eq("id", t.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("whatsapp_templates").insert({
          nome: t.nome, categoria: t.categoria, conteudo: t.conteudo, created_by: u.user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa", "templates"] }),
  });
}

export function applyTemplate(content: string, vars: Record<string, string | null | undefined>) {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
}

export function useCampaigns() {
  return useQuery({
    queryKey: ["wa", "campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      mensagem: string;
      cidade?: string;
      estado?: string;
      segmento?: string;
      image_url?: string | null;
      scheduled_at?: string | null;
      send_limit?: number | null;
      batch_size?: number | null;
      batch_pause_minutes?: number | null;
      message_interval_seconds?: number | null;
      recipients: { phone: string; lead_id?: string | null }[];
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data: c, error } = await supabase
        .from("whatsapp_campaigns")
        .insert({
          nome: input.nome,
          mensagem: input.mensagem,
          cidade: input.cidade ?? null,
          estado: input.estado ?? null,
          segmento: input.segmento ?? null,
          image_url: input.image_url ?? null,
          scheduled_at: input.scheduled_at ?? null,
          send_limit: input.send_limit ?? null,
          batch_size: input.batch_size ?? null,
          batch_pause_minutes: input.batch_pause_minutes ?? null,
          message_interval_seconds: input.message_interval_seconds ?? null,
          status: input.scheduled_at ? "SCHEDULED" : "DRAFT",
          created_by: u.user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      if (input.recipients.length) {
        const { error: rErr } = await supabase.from("whatsapp_campaign_recipients").insert(
          input.recipients.map((r) => ({
            campaign_id: c.id, phone: r.phone, lead_id: r.lead_id ?? null,
          })),
        );
        if (rErr) throw rErr;
      }
      return c;
    },

    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa"] }),
  });
}

export function useWaStats() {
  return useQuery({
    queryKey: ["wa", "stats"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: hoje } = await supabase
        .from("whatsapp_messages").select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());
      const { count: semana } = await supabase
        .from("whatsapp_messages").select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString());
      const { count: campanhas } = await supabase
        .from("whatsapp_campaigns").select("*", { count: "exact", head: true })
        .in("status", ["SCHEDULED", "SENDING"]);
      return { hoje: hoje ?? 0, semana: semana ?? 0, campanhas: campanhas ?? 0 };
    },
  });
}
