import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signedOrderPdfPath } from "@/routes/api/public/orders/pdf";

const schema = z.object({ orderId: z.string().uuid() });

export const getOrderShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, total, companies(trade_name, legal_name, phone)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado");

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error("Servidor sem chave para assinar o PDF");

    const path = signedOrderPdfPath(order.id, secret);
    const company = order.companies as { trade_name: string | null; legal_name: string | null; phone: string | null } | null;
    return {
      path,
      phone: company?.phone ?? null,
      name: company?.trade_name ?? company?.legal_name ?? null,
      total: Number(order.total ?? 0),
    };
  });
