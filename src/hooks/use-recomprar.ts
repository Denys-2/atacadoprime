import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/use-cart";

type ProductImage = { image_url: string; ordem: number };

export function useRecomprar() {
  const addToCart = useCart((s) => s.add);

  return useCallback(
    async (orderId: string) => {
      const { data } = await supabase
        .from("order_items")
        .select(
          "*, products(nome, sku, preco_unitario, quantidade_pacote, preco_pacote, product_images(image_url, ordem))",
        )
        .eq("order_id", orderId);

      (data ?? []).forEach((it) => {
        const p = it.products;
        if (!p) return;
        const img = ((p.product_images ?? []) as ProductImage[])
          .slice()
          .sort((a, b) => a.ordem - b.ordem)[0];
        addToCart({
          product_id: it.product_id,
          nome: p.nome,
          sku: p.sku,
          image_url: img?.image_url ?? null,
          tipo_compra: it.tipo_compra,
          quantidade: it.quantidade,
          preco_unitario: Number(p.preco_unitario),
          quantidade_pacote: p.quantidade_pacote,
          preco_pacote: p.preco_pacote ? Number(p.preco_pacote) : null,
        });
      });
    },
    [addToCart],
  );
}
