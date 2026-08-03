import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ZAPI_BASE = "https://api.z-api.io";
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MESSAGE_INTERVAL_SECONDS = 2;
const DEFAULT_BATCH_PAUSE_MINUTES = 0;

function zApiUrl(instanceId: string, token: string, path: string) {
  return `${ZAPI_BASE}/instances/${instanceId}/token/${token}${path}`;
}

function normalizePhone(p: string) {
  return p.replace(/\D/g, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const Route = createFileRoute("/api/public/hooks/process-campaigns")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET ?? "";
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!cronSecret || provided !== cronSecret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const instanceId = process.env.Z_API_INSTANCE_ID;
        const token = process.env.Z_API_TOKEN;
        if (!instanceId || !token) {
          return new Response(JSON.stringify({ error: "Z-API not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const now = new Date();
        const nowIso = now.toISOString();

        const { data: campaigns, error: cErr } = await supabase
          .from("whatsapp_campaigns")
          .select("*")
          .or("status.eq.SCHEDULED,status.eq.SENDING")
          .lte("scheduled_at", nowIso);

        if (cErr) {
          return new Response(JSON.stringify({ error: cErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: {
          campaignId: string;
          sent: number;
          failed: number;
          remaining: number;
          skipped?: string;
        }[] = [];

        for (const campaign of campaigns ?? []) {
          const c = campaign as any;
          const batchSize = Math.max(1, Number(c.batch_size) || DEFAULT_BATCH_SIZE);
          const pauseMinutes = Math.max(0, Number(c.batch_pause_minutes) || DEFAULT_BATCH_PAUSE_MINUTES);
          const intervalSeconds = Math.max(0, Number(c.message_interval_seconds) || DEFAULT_MESSAGE_INTERVAL_SECONDS);
          const sendLimit = c.send_limit ? Math.max(0, Number(c.send_limit)) : null;

          // Respeita pausa entre lotes
          if (pauseMinutes > 0 && c.last_batch_at) {
            const nextAllowed = new Date(new Date(c.last_batch_at).getTime() + pauseMinutes * 60_000);
            if (nextAllowed > now) {
              results.push({
                campaignId: c.id,
                sent: 0,
                failed: 0,
                remaining: -1,
                skipped: `pausa até ${nextAllowed.toISOString()}`,
              });
              continue;
            }
          }

          if (c.status === "SCHEDULED") {
            await supabase.from("whatsapp_campaigns").update({ status: "SENDING" }).eq("id", c.id);
          }

          // Verifica quantas já foram enviadas para respeitar send_limit
          let allowedThisRun = batchSize;
          if (sendLimit && sendLimit > 0) {
            const { count: sentCount } = await supabase
              .from("whatsapp_campaign_recipients")
              .select("*", { count: "exact", head: true })
              .eq("campaign_id", c.id)
              .eq("status", "SENT");
            const restante = sendLimit - (sentCount ?? 0);
            allowedThisRun = Math.max(0, Math.min(batchSize, restante));
            if (allowedThisRun === 0) {
              await supabase
                .from("whatsapp_campaigns")
                .update({ status: "DONE", sent_at: nowIso })
                .eq("id", c.id);
              results.push({ campaignId: c.id, sent: 0, failed: 0, remaining: 0, skipped: "send_limit atingido" });
              continue;
            }
          }

          const { data: recipients, error: rErr } = await supabase
            .from("whatsapp_campaign_recipients")
            .select("*")
            .eq("campaign_id", c.id)
            .eq("status", "PENDING")
            .limit(allowedThisRun);

          if (rErr) {
            results.push({ campaignId: c.id, sent: 0, failed: 0, remaining: 0 });
            continue;
          }

          const leadIds = (recipients ?? []).map((r) => r.lead_id).filter(Boolean) as string[];
          const { data: leads } = await supabase
            .from("leads")
            .select("id, contato, empresa")
            .in("id", leadIds);
          const leadById = new Map((leads ?? []).map((l) => [l.id, l]));

          let ok = 0;
          let fail = 0;
          const hasImage = !!c.image_url;
          const endpoint = hasImage ? "/send-image" : "/send-text";

          for (const r of recipients ?? []) {
            try {
              const phone = normalizePhone(r.phone);
              const lead = r.lead_id ? leadById.get(r.lead_id) : undefined;
              const personalizedMessage = c.mensagem
                .replace(/\{\{nome\}\}/gi, lead?.contato ?? "")
                .replace(/\{\{empresa\}\}/gi, lead?.empresa ?? "");
              const payload = hasImage
                ? { phone, image: c.image_url, caption: personalizedMessage }
                : { phone, message: personalizedMessage };
              const res = await fetch(zApiUrl(instanceId, token, endpoint), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
            if (intervalSeconds > 0) await sleep(intervalSeconds * 1000);
          }

          // Marca timestamp do lote
          await supabase
            .from("whatsapp_campaigns")
            .update({ last_batch_at: new Date().toISOString() })
            .eq("id", c.id);

          const { count: remaining } = await supabase
            .from("whatsapp_campaign_recipients")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", c.id)
            .eq("status", "PENDING");

          let finished = (remaining ?? 0) === 0;
          if (!finished && sendLimit && sendLimit > 0) {
            const { count: sentCount } = await supabase
              .from("whatsapp_campaign_recipients")
              .select("*", { count: "exact", head: true })
              .eq("campaign_id", c.id)
              .eq("status", "SENT");
            if ((sentCount ?? 0) >= sendLimit) finished = true;
          }

          if (finished) {
            await supabase
              .from("whatsapp_campaigns")
              .update({ status: "DONE", sent_at: new Date().toISOString() })
              .eq("id", c.id);
          }

          results.push({ campaignId: c.id, sent: ok, failed: fail, remaining: remaining ?? 0 });
        }

        return Response.json({ processed: campaigns?.length ?? 0, results });
      },
    },
  },
});
