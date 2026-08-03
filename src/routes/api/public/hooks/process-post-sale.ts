import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { signedOrderPdfPath } from "../orders/pdf";

const ZAPI_BASE = "https://api.z-api.io";
const BATCH_SIZE = 20;
const DELAY_MS = 1500;

const DEFAULT_MESSAGE = `Olá {{nome}}, tudo bem?

Aqui é da *Prime Automotive* 🚗🔑

Passando para agradecer pela sua compra! Foi um prazer atender você{{empresa_sufixo}}.

Se precisar de qualquer coisa — dúvidas, novas peças ou sugestões — nossos canais estão à disposição:

🌐 Site: www.primeautomotive.app
📧 E-mail: contato@primeautomotive.app
💬 WhatsApp: este mesmo número

Conte com a gente sempre! 🙌`;

function zApiUrl(instanceId: string, token: string, path: string) {
  return `${ZAPI_BASE}/instances/${instanceId}/token/${token}${path}`;
}
function normalizePhone(p: string) {
  const digits = p.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function renderMessage(template: string, vars: { nome?: string | null; empresa?: string | null }) {
  const nome = vars.nome?.trim() || "tudo certo";
  const empresa = vars.empresa?.trim() || "";
  return template
    .replace(/\{\{\s*nome\s*\}\}/gi, nome)
    .replace(/\{\{\s*empresa\s*\}\}/gi, empresa)
    .replace(/\{\{\s*empresa_sufixo\s*\}\}/gi, empresa ? ` — ${empresa}` : "");
}

export const Route = createFileRoute("/api/public/hooks/process-post-sale")({
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
        const clientToken = process.env.Z_API_CLIENT_TOKEN;

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const now = new Date().toISOString();

        // Modelo padrão configurável via system_settings (categoria=whatsapp, chave=post_sale_template)
        let templateDefault = DEFAULT_MESSAGE;
        try {
          const { data: setting } = await supabase
            .from("system_settings")
            .select("valor")
            .eq("categoria", "whatsapp")
            .eq("chave", "post_sale_template")
            .maybeSingle();
          const v = setting?.valor as { template?: string } | null;
          if (v?.template && typeof v.template === "string" && v.template.trim()) {
            templateDefault = v.template;
          }
        } catch { /* fallback silencioso */ }

        const { data: pending, error } = await supabase
          .from("post_sale_messages")
          .select("*")
          .eq("status", "PENDING")
          .lte("send_at", now)
          .limit(BATCH_SIZE);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let ok = 0;
        let fail = 0;

        for (const row of pending ?? []) {
          try {
            const phone = normalizePhone(row.phone || "");
            if (!phone || phone.length < 8) throw new Error("Telefone inválido");

            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (clientToken) headers["Client-Token"] = clientToken;

            // 1) Nome do WhatsApp do destinatário (Z-API) — tenta múltiplos endpoints
            let nome: string | null = null;
            let empresa: string | null = null;
            const waDebug: any[] = [];
            const pickName = (o: any): string | null => {
              if (!o || typeof o !== "object") return null;
              return (
                o.name || o.short || o.notify || o.pushname ||
                o.contactName || o.senderName || o.chatName || null
              );
            };
            const isPhoneLike = (s: string) => /^\+?\d[\d\s\-()]{5,}$/.test(s.trim());
            for (const path of [`/chats/${phone}`, `/contacts/${phone}`, `/contact-metadata/${phone}`]) {
              try {
                const r = await fetch(zApiUrl(instanceId, token, path), { headers });
                const j: any = await r.json().catch(() => ({}));
                waDebug.push({ path, status: r.status, body: j });
                if (r.ok) {
                  const n = pickName(j) || pickName(j?.contact) || pickName(j?.chat);
                  if (n && typeof n === "string" && !isPhoneLike(n)) {
                    const first = n.trim().split(/\s+/)[0];
                    nome = first || n.trim();
                    break;
                  }
                }
              } catch (e) {
                waDebug.push({ path, error: String(e) });
              }
            }

            // 2) Fallback: lead / empresa
            if (!nome && row.lead_id) {
              const { data: l } = await supabase
                .from("leads").select("contato, empresa").eq("id", row.lead_id).maybeSingle();
              nome = l?.contato ?? null;
              empresa = l?.empresa ?? null;
            }
            if (!nome && row.company_id) {
              const { data: c } = await supabase
                .from("companies").select("trade_name, legal_name").eq("id", row.company_id).maybeSingle();
              nome = c?.trade_name ?? c?.legal_name ?? null;
              empresa = empresa ?? c?.trade_name ?? c?.legal_name ?? null;
            }

            const message = renderMessage(row.message || templateDefault, { nome, empresa });

            const res = await fetch(zApiUrl(instanceId, token, "/send-text"), {
              method: "POST",
              headers,
              body: JSON.stringify({ phone, message }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(`Z-API ${res.status}: ${JSON.stringify(body)}`);

            // Envia PDF do pedido em anexo (best-effort — não falha o envio se der erro)
            let pdfResult: unknown = null;
            try {
              const origin = new URL(request.url).origin;
              const pdfUrl = origin + signedOrderPdfPath(row.order_id, process.env.SUPABASE_SERVICE_ROLE_KEY!);
              const docRes = await fetch(zApiUrl(instanceId, token, "/send-document/pdf"), {
                method: "POST",
                headers,
                body: JSON.stringify({
                  phone,
                  document: pdfUrl,
                  fileName: `pedido-${row.order_id.slice(0, 8)}.pdf`,
                  caption: "Segue o comprovante da sua compra.",
                }),
              });
              pdfResult = await docRes.json().catch(() => ({}));
              if (!docRes.ok) pdfResult = { error: `Z-API ${docRes.status}`, body: pdfResult };
            } catch (docErr) {
              pdfResult = { error: String(docErr) };
            }

            await supabase.from("post_sale_messages")
              .update({
                status: "SENT",
                sent_at: new Date().toISOString(),
                metadata: { text: body, pdf: pdfResult, wa: waDebug, nome, empresa } as any,
                message,
              })
              .eq("id", row.id);
            ok++;
          } catch (e) {
            await supabase.from("post_sale_messages")
              .update({ status: "FAILED", error: String(e) })
              .eq("id", row.id);
            fail++;
          }
          await sleep(DELAY_MS);
        }

        return Response.json({ processed: pending?.length ?? 0, sent: ok, failed: fail });
      },
    },
  },
});
