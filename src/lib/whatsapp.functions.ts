import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ZAPI_BASE = "https://api.z-api.io";

function zApiUrl(path: string) {
  const id = process.env.Z_API_INSTANCE_ID;
  const token = process.env.Z_API_TOKEN;
  if (!id || !token) throw new Error("Z-API não configurada. Defina Z_API_INSTANCE_ID e Z_API_TOKEN.");
  return `${ZAPI_BASE}/instances/${id}/token/${token}${path}`;
}

function zApiHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const ct = process.env.Z_API_CLIENT_TOKEN;
  if (ct) headers["Client-Token"] = ct;
  return headers;
}

function normalizePhone(p: string) {
  const digits = p.replace(/\D/g, "");
  // Brasil: garante 55 no início
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}


const sendTextSchema = z.object({
  conversationId: z.string().uuid().optional(),
  phone: z.string().min(8),
  message: z.string().min(1),
  imageUrl: z.string().url().optional().nullable(),
});

export const sendWhatsAppText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendTextSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const phone = normalizePhone(data.phone);

    // Garante conversation
    let convId = data.conversationId;
    if (!convId) {
      const { data: existing } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (existing) convId = existing.id;
      else {
        const { data: created, error } = await supabase
          .from("whatsapp_conversations")
          .insert({ phone })
          .select("id")
          .single();
        if (error) throw error;
        convId = created.id;
      }
    }

    const hasImage = !!data.imageUrl;
    // Insere mensagem como PENDING
    const { data: msg, error: mErr } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: convId,
        direction: "OUT",
        message_type: hasImage ? "IMAGE" : "TEXT",
        content: data.message,
        status: "PENDING",
        sent_by: userId,
        file_url: hasImage ? data.imageUrl : null,
      })
      .select()
      .single();
    if (mErr) throw mErr;

    // Envia via Z-API
    try {
      const endpoint = hasImage ? "/send-image" : "/send-text";
      const payload = hasImage
        ? { phone, image: data.imageUrl, caption: data.message }
        : { phone, message: data.message };
      const res = await fetch(zApiUrl(endpoint), {
        method: "POST",
        headers: zApiHeaders(),
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        await supabase
          .from("whatsapp_messages")
          .update({ status: "FAILED", metadata: body })
          .eq("id", msg.id);
        throw new Error(`Z-API ${res.status}: ${JSON.stringify(body)}`);
      }
      await supabase
        .from("whatsapp_messages")
        .update({ status: "SENT", external_id: body?.messageId ?? body?.id ?? null, metadata: body })
        .eq("id", msg.id);
      return { ok: true, conversationId: convId, messageId: msg.id };
    } catch (e) {
      await supabase
        .from("whatsapp_messages")
        .update({ status: "FAILED", metadata: { error: String(e) } })
        .eq("id", msg.id);
      throw e;
    }
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });

const campaignSendSchema = z.object({ campaignId: z.string().uuid() });

export const dispatchCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => campaignSendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaign, error } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();
    if (error || !campaign) throw new Error("Campanha não encontrada");

    const { data: recipients, error: rErr } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("status", "PENDING");
    if (rErr) throw rErr;

    // Busca nomes dos leads para substituir placeholders
    const leadIds = (recipients ?? []).map((r) => r.lead_id).filter(Boolean) as string[];
    const { data: leads } = await supabase
      .from("leads")
      .select("id, contato, empresa")
      .in("id", leadIds);
    const leadById = new Map((leads ?? []).map((l) => [l.id, l]));

    await supabase.from("whatsapp_campaigns").update({ status: "SENDING" }).eq("id", campaign.id);

    let ok = 0, fail = 0;
    const hasImage = !!(campaign as any).image_url;
    const endpoint = hasImage ? "/send-image" : "/send-text";
    for (const r of recipients ?? []) {
      try {
        const phone = normalizePhone(r.phone);
        const lead = r.lead_id ? leadById.get(r.lead_id) : undefined;
        const personalizedMessage = campaign.mensagem
          .replace(/\{\{nome\}\}/gi, lead?.contato ?? "")
          .replace(/\{\{empresa\}\}/gi, lead?.empresa ?? "");
        const payload = hasImage
          ? { phone, image: (campaign as any).image_url, caption: personalizedMessage }
          : { phone, message: personalizedMessage };
        const res = await fetch(zApiUrl(endpoint), {
          method: "POST",
          headers: zApiHeaders(),
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(JSON.stringify(body));
        await supabase
          .from("whatsapp_campaign_recipients")
          .update({ status: "SENT", sent_at: new Date().toISOString() })
          .eq("id", r.id);
        ok++;
      } catch (e) {
        await supabase
          .from("whatsapp_campaign_recipients")
          .update({ status: "FAILED", error: String(e) })
          .eq("id", r.id);
        fail++;
      }
    }

    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "DONE", sent_at: new Date().toISOString() })
      .eq("id", campaign.id);

    return { ok, fail, total: (recipients ?? []).length };
  });
