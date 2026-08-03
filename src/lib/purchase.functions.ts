import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deleteSchema = z.object({ purchaseOrderId: z.string().uuid() });

export const deletePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("purchase_order_items")
      .select("id, product_id, quantidade")
      .eq("purchase_order_id", data.purchaseOrderId);
    if (itemsError) throw itemsError;

    // Reverte a entrada no estoque para cada item (saída com quantidade negativa).
    for (const item of items ?? []) {
      if (!item.product_id) continue;
      const { error: stockError } = await supabaseAdmin.rpc("stock_apply_delta", {
        _product_id: item.product_id,
        _delta: Number(item.quantidade) * -1,
        _tipo: "SAIDA",
        _motivo: `Estorno exclusão compra ${data.purchaseOrderId.slice(0, 8)}`,
        _ref: data.purchaseOrderId,
        _allow_negative: true,
      });
      if (stockError) throw stockError;
    }

    // Remove o lançamento financeiro vinculado à compra.
    const { error: finError } = await supabaseAdmin
      .from("financial_transactions")
      .delete()
      .eq("purchase_order_id", data.purchaseOrderId);
    if (finError) throw finError;

    // Remove os itens da compra.
    const { error: deleteItemsError } = await supabaseAdmin
      .from("purchase_order_items")
      .delete()
      .eq("purchase_order_id", data.purchaseOrderId);
    if (deleteItemsError) throw deleteItemsError;

    // Remove a compra.
    const { error: deletePoError } = await supabaseAdmin
      .from("purchase_orders")
      .delete()
      .eq("id", data.purchaseOrderId);
    if (deletePoError) throw deletePoError;

    return { ok: true };
  });
