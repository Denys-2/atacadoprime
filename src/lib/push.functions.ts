import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const subSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(4),
  userAgent: z.string().optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
          last_seen_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "endpoint" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const saveAnonymousPushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    if (readError) throw readError;

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .update({
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
          last_seen_at: new Date().toISOString(),
          revoked_at: null,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return { ok: true };
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").insert({
      user_id: null,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAnonymousPushSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("endpoint", data.endpoint);
    if (error) throw error;
    return { ok: true };
  });

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
});

const campaignSchema = z.object({
  titulo: z.string().min(1).max(80),
  mensagem: z.string().min(1).max(300),
  imagem_url: z.string().url().optional().nullable(),
  link_url: z.string().optional().nullable(),
  segmento: z.enum(["all", "cidade", "estado"]).default("all"),
  segmento_valor: z.string().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
});

async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("is_sales_staff", { _uid: ctx.userId });
  if (!data) throw new Error("Forbidden");
}

export const createPushCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => campaignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: row, error } = await context.supabase
      .from("push_campaigns")
      .insert({
        titulo: data.titulo,
        mensagem: data.mensagem,
        imagem_url: data.imagem_url ?? null,
        link_url: data.link_url ?? null,
        segmento: data.segmento,
        segmento_valor: data.segmento_valor ?? null,
        scheduled_at: data.scheduled_at ?? null,
        status: "DRAFT",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const listPushCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("push_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const dispatchPushCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const webpush = (await import("web-push")).default;

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contato@example.com",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("push_campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();
    if (cErr || !campaign) throw new Error("Campanha não encontrada");

    // Seleciona inscrições conforme segmento
    let userIds: string[] | null = null;
    if (campaign.segmento === "cidade" && campaign.segmento_valor) {
      const { data: comps } = await supabaseAdmin
        .from("companies")
        .select("user_id")
        .ilike("cidade", campaign.segmento_valor);
      userIds = (comps ?? []).map((c: any) => c.user_id).filter(Boolean);
    } else if (campaign.segmento === "estado" && campaign.segmento_valor) {
      const { data: comps } = await supabaseAdmin
        .from("companies")
        .select("user_id")
        .ilike("estado", campaign.segmento_valor);
      userIds = (comps ?? []).map((c: any) => c.user_id).filter(Boolean);
    }

    let subQ = supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .is("revoked_at", null);
    if (userIds) {
      if (userIds.length === 0) {
        await supabaseAdmin
          .from("push_campaigns")
          .update({ status: "DONE", total: 0, enviados: 0, falhas: 0, sent_at: new Date().toISOString() })
          .eq("id", campaign.id);
        return { ok: 0, fail: 0, total: 0 };
      }
      subQ = subQ.in("user_id", userIds);
    }
    const { data: subs, error: sErr } = await subQ;
    if (sErr) throw sErr;

    await supabaseAdmin
      .from("push_campaigns")
      .update({ status: "SENDING", total: subs?.length ?? 0 })
      .eq("id", campaign.id);

    let ok = 0, fail = 0;
    for (const s of subs ?? []) {
      // Cria delivery primeiro para ter ID e linkar clique
      const { data: del } = await supabaseAdmin
        .from("push_deliveries")
        .insert({
          campaign_id: campaign.id,
          subscription_id: s.id,
          user_id: s.user_id,
          status: "PENDING",
        })
        .select("id")
        .single();
      const payload = JSON.stringify({
        title: campaign.titulo,
        body: campaign.mensagem,
        image: campaign.imagem_url,
        url: campaign.link_url || "/",
        deliveryId: del?.id,
      });
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        await supabaseAdmin.from("push_deliveries").update({ status: "SENT" }).eq("id", del!.id);
        ok++;
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", s.id);
        }
        await supabaseAdmin
          .from("push_deliveries")
          .update({ status: code === 410 ? "EXPIRED" : "FAILED", error: String(e?.body || e?.message || e) })
          .eq("id", del!.id);
        fail++;
      }
    }

    await supabaseAdmin
      .from("push_campaigns")
      .update({
        status: fail === (subs?.length ?? 0) && fail > 0 ? "FAILED" : "DONE",
        enviados: ok,
        falhas: fail,
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    return { ok, fail, total: subs?.length ?? 0 };
  });
