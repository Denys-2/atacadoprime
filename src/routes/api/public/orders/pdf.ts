import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import type { Database } from "@/integrations/supabase/types";
import { buildOrderPdf } from "@/lib/order-pdf";

function sign(orderId: string, secret: string) {
  return createHmac("sha256", secret).update(orderId).digest("hex");
}

export function signedOrderPdfPath(orderId: string, secret: string) {
  return `/api/public/orders/pdf?orderId=${encodeURIComponent(orderId)}&sig=${sign(orderId, secret)}`;
}

export const Route = createFileRoute("/api/public/orders/pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orderId = url.searchParams.get("orderId") || "";
        const sig = url.searchParams.get("sig") || "";
        const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
        if (!orderId || !sig || !secret) {
          return new Response("Bad request", { status: 400 });
        }
        try {
          const expected = sign(orderId, secret);
          const a = Buffer.from(sig, "hex");
          const b = Buffer.from(expected, "hex");
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Forbidden", { status: 403 });
          }
        } catch {
          return new Response("Forbidden", { status: 403 });
        }

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: order, error: orderErr } = await supabase
          .from("orders").select("*").eq("id", orderId).maybeSingle();
        if (orderErr || !order) return new Response("Not found", { status: 404 });

        const { data: items } = await supabase
          .from("order_items")
          .select("quantidade, tipo_compra, preco_final, subtotal, product:products(nome, sku)")
          .eq("order_id", orderId);

        const { data: company } = order.company_id
          ? await supabase.from("companies").select("legal_name, trade_name, tax_id, phone, email").eq("id", order.company_id).maybeSingle()
          : { data: null };

        const { data: address } = order.address_id
          ? await supabase.from("addresses").select("street, number, district, city, state, zip").eq("id", order.address_id).maybeSingle()
          : { data: null };

        const { data: payment } = await supabase
          .from("payments").select("tipo, status, payment_link").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();

        const doc = buildOrderPdf({
          id: order.id,
          created_at: order.created_at,
          subtotal: Number(order.subtotal || 0),
          frete: Number(order.frete || 0),
          desconto: Number(order.desconto || 0),
          total: Number(order.total || 0),
          observacao: order.observacao,
          status: order.status,
          company: company ?? undefined,
          address: address ?? undefined,
          items: (items ?? []).map((it: any) => ({
            nome: it.product?.nome ?? "Produto",
            sku: it.product?.sku ?? null,
            tipo_compra: it.tipo_compra ?? "UNIDADE",
            quantidade: Number(it.quantidade || 0),
            preco_final: Number(it.preco_final || 0),
            subtotal: Number(it.subtotal || 0),
          })),
          payment: payment ?? undefined,
          brandName: "Prime Automotive",
          brandTagline: "Pedido / Nota de venda",
        });

        const bytes = doc.output("arraybuffer") as ArrayBuffer;

        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="pedido-${order.id.slice(0, 8)}.pdf"`,
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
