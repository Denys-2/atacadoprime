import { createFileRoute } from "@tanstack/react-router";

// Webhook público da Z-API para mensagens recebidas e status de entrega.
// Configurar na Z-API: https://{stable-url}/api/public/whatsapp/webhook?t=<ZAPI_WEBHOOK_TOKEN>
// Autenticação obrigatória via token — configure ZAPI_WEBHOOK_TOKEN nos secrets.
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ZAPI_WEBHOOK_TOKEN ?? "";
        if (!expected) {
          // Bloqueia por padrão quando o token não está configurado — evita webhook aberto.
          return new Response("Webhook token not configured", { status: 503 });
        }
        const url = new URL(request.url);
        const provided = url.searchParams.get("t") ?? request.headers.get("x-webhook-token") ?? "";
        if (provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        // Z-API envia diversos tipos. Tratamos os mais comuns: ReceivedCallback, MessageStatusCallback
        const type: string = payload?.type ?? "";

        // Status de entrega de mensagem que enviamos
        if (type === "MessageStatusCallback" || payload?.status) {
          const externalId: string | undefined = payload?.ids?.[0] ?? payload?.messageId ?? payload?.id;
          const newStatus = mapZapiStatus(payload?.status);
          if (externalId && newStatus) {
            await supabaseAdmin
              .from("whatsapp_messages")
              .update({ status: newStatus })
              .eq("external_id", externalId);
          }
          return new Response("ok");
        }

        // Mensagem recebida
        const phoneRaw: string | undefined = payload?.phone ?? payload?.from;
        if (!phoneRaw || payload?.fromMe) return new Response("ignored");
        const phone = String(phoneRaw).replace(/\D/g, "");

        // localizar/criar conversa
        let convId: string | undefined;
        const { data: existing } = await supabaseAdmin
          .from("whatsapp_conversations")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();

        if (existing) {
          convId = existing.id;
        } else {
          // tenta vincular lead pelo whatsapp
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("id")
            .ilike("whatsapp", `%${phone.slice(-8)}%`)
            .limit(1)
            .maybeSingle();
          const { data: created, error } = await supabaseAdmin
            .from("whatsapp_conversations")
            .insert({
              phone,
              contact_name: payload?.senderName ?? payload?.chatName ?? null,
              lead_id: lead?.id ?? null,
            })
            .select("id")
            .single();
          if (error) return new Response(error.message, { status: 500 });
          convId = created.id;
        }

        const { type: msgType, content, fileUrl } = extractContent(payload);

        await supabaseAdmin.from("whatsapp_messages").insert({
          conversation_id: convId,
          direction: "IN",
          message_type: msgType,
          content,
          file_url: fileUrl,
          external_id: payload?.messageId ?? payload?.id ?? null,
          status: "RECEIVED",
          metadata: payload,
        });

        return new Response("ok");
      },
      GET: async () => new Response("Z-API webhook ready", { status: 200 }),
    },
  },
});

function mapZapiStatus(s: string | undefined):
  | "SENT" | "DELIVERED" | "READ" | "FAILED" | null {
  if (!s) return null;
  const v = String(s).toUpperCase();
  if (v.includes("READ")) return "READ";
  if (v.includes("DELIVER") || v === "RECEIVED") return "DELIVERED";
  if (v.includes("SENT")) return "SENT";
  if (v.includes("FAIL") || v.includes("ERROR")) return "FAILED";
  return null;
}

function extractContent(p: any): { type: any; content: string | null; fileUrl: string | null } {
  if (p?.text?.message) return { type: "TEXT", content: p.text.message, fileUrl: null };
  if (p?.image?.imageUrl) return { type: "IMAGE", content: p.image.caption ?? null, fileUrl: p.image.imageUrl };
  if (p?.audio?.audioUrl) return { type: "AUDIO", content: null, fileUrl: p.audio.audioUrl };
  if (p?.video?.videoUrl) return { type: "VIDEO", content: p.video.caption ?? null, fileUrl: p.video.videoUrl };
  if (p?.document?.documentUrl) return { type: "DOCUMENT", content: p.document.fileName ?? null, fileUrl: p.document.documentUrl };
  if (p?.location) return { type: "LOCATION", content: `${p.location.latitude},${p.location.longitude}`, fileUrl: null };
  if (p?.contact) return { type: "CONTACT", content: p.contact.displayName ?? null, fileUrl: null };
  return { type: "TEXT", content: p?.body ?? p?.message ?? null, fileUrl: null };
}
