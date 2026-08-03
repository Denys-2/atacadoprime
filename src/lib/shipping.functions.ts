import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const CartItemSchema = z.object({
  product_id: z.string(),
  quantidade: z.number().int().positive(),
  preco_unitario: z.number(),
});

const InputSchema = z.object({
  cepDestino: z.string().min(8),
  items: z.array(CartItemSchema).min(1),
});

// CEP de origem (loja). Ajuste se mudar de endereço.
const FROM_CEP = "38400454";

// Serviços: Correios PAC=1, SEDEX=2, Jadlog .Package=3
const SERVICES = "1,2,3";

export type ShippingOption = {
  id: number;
  name: string;
  company: string;
  price: number;
  delivery_days: number;
  error?: string;
};

export const calculateShipping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ShippingOption[]> => {

    const token = process.env.MELHOR_ENVIO_TOKEN;
    if (!token) throw new Error("MELHOR_ENVIO_TOKEN não configurado.");

    const cep = data.cepDestino.replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("CEP inválido.");

    // Dimensões padrão por item (cm/kg). Ajuste se tiver dados no produto.
    const products = data.items.map((i) => ({
      id: i.product_id,
      width: 16,
      height: 11,
      length: 11,
      weight: 0.3,
      insurance_value: Number(i.preco_unitario) || 0,
      quantity: i.quantidade,
    }));

    const res = await fetch(
      "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "AtacadoPrime (suporte@atacadoprime.com.br)",
        },
        body: JSON.stringify({
          from: { postal_code: FROM_CEP },
          to: { postal_code: cep },
          products,
          services: SERVICES,
          options: { receipt: false, own_hand: false, insurance_value: 0 },
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error("Melhor Envio error:", res.status, txt);
      throw new Error(`Falha ao calcular frete (${res.status}).`);
    }

    const json = (await res.json()) as Array<{
      id: number;
      name: string;
      price: string | number | null;
      delivery_time: number | null;
      company?: { name: string };
      error?: string;
    }>;

    return json.map((s) => ({
      id: s.id,
      name: s.name,
      company: s.company?.name ?? "",
      price: Number(s.price ?? 0),
      delivery_days: Number(s.delivery_time ?? 0),
      error: s.error,
    }));
  });
