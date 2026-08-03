import { createFileRoute } from "@tanstack/react-router";

// Cron-invocado endpoint para notificar carrinhos abandonados via WhatsApp (Z-API).
// Autenticação: header `apikey` com a chave anon do Supabase (padrão dos cron jobs).
// Regras:
//  - carrinho com last_activity entre 1h e 48h atrás
//  - ainda não notificado (notified_at IS NULL)
//  - não recuperado (recovered_at IS NULL)
//  - empresa com telefone válido
export const Route = createFileRoute("/api/public/hooks/abandoned-carts-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET ?? "";
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!cronSecret || provided !== cronSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = Date.now();
        const oneHour = new Date(now - 60 * 60 * 1000).toISOString();
        const fortyEight = new Date(now - 48 * 60 * 60 * 1000).toISOString();

        const { data: carts, error } = await supabaseAdmin
          .from("abandoned_carts")
          .select("id, total, company_id, companies(nome_fantasia, razao_social, telefone)")
          .is("notified_at", null)
          .is("recovered_at", null)
          .lte("last_activity", oneHour)
          .gte("last_activity", fortyEight)
          .limit(50);

        if (error) return new Response(error.message, { status: 500 });

        let sent = 0;
        let skipped = 0;
        const errors: string[] = [];

        const instance = process.env.Z_API_INSTANCE_ID;
        const token = process.env.Z_API_TOKEN;
        const clientToken = process.env.Z_API_CLIENT_TOKEN;
        const zapiReady = !!(instance && token);

        for (const c of carts ?? []) {
          const rel = (c as unknown as { companies?: { nome_fantasia?: string | null; razao_social?: string | null; telefone?: string | null } | null }).companies;
          const phone = (rel?.telefone ?? "").replace(/\D/g, "");
          const nome = rel?.nome_fantasia || rel?.razao_social || "cliente";
          if (!phone || phone.length < 10) { skipped++; continue; }

          const total = Number(c.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const message = `Olá, ${nome}! 👋\n\nNotamos que você deixou itens no seu carrinho na Prime Automotive (${total}).\n\nPosso ajudar a finalizar seu pedido? Estamos com estoque e pronta entrega. 🚗🔑`;

          if (!zapiReady) {
            // Sem Z-API: apenas marca como "notificado" para não repetir
            await supabaseAdmin.from("abandoned_carts").update({ notified_at: new Date().toISOString() }).eq("id", c.id);
            skipped++;
            continue;
          }

          try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (clientToken) headers["Client-Token"] = clientToken;
            const res = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/send-text`, {
              method: "POST",
              headers,
              body: JSON.stringify({ phone, message }),
            });
            if (!res.ok) {
              errors.push(`cart ${c.id}: ${res.status}`);
              continue;
            }
            await supabaseAdmin.from("abandoned_carts").update({ notified_at: new Date().toISOString() }).eq("id", c.id);
            sent++;
          } catch (e) {
            errors.push(`cart ${c.id}: ${(e as Error).message}`);
          }
        }

        return new Response(
          JSON.stringify({ ok: true, scanned: carts?.length ?? 0, sent, skipped, errors }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
