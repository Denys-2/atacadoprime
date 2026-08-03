// Sincroniza vendas offline com o servidor.
// Regras:
// - Se sale.new_client, cria um cadastro em `companies` primeiro (owner = vendedor).
// - Se sale.lead_id sem company_id, cria uma company a partir dos dados do lead.
// - Depois cria order + order_items + payments (espelhando useCreateOrder).

import { supabase } from "@/integrations/supabase/client";
import {
  loadSalesQueue,
  updateOfflineSale,
  type OfflineSale,
} from "@/lib/offline-store";
import { cartSubtotal } from "@/hooks/use-cart";

let running = false;

async function ensureCompanyId(sale: OfflineSale, userId: string): Promise<string> {
  if (sale.company_id) return sale.company_id;

  // Se veio de um lead sem company vinculada → cria company a partir do lead
  if (sale.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("company_id,empresa,contato,telefone,cidade,estado")
      .eq("id", sale.lead_id)
      .maybeSingle();
    if (lead?.company_id) return lead.company_id;
    if (lead) {
      const { data: created, error } = await supabase
        .from("companies")
        .insert({
          owner_id: userId,
          legal_name: lead.empresa,
          trade_name: lead.contato ?? null,
          phone: lead.telefone ?? "não informado",
          cidade: lead.cidade ?? null,
          estado: lead.estado ?? null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("leads").update({ company_id: created.id }).eq("id", sale.lead_id);
      return created.id;
    }
  }

  // Cliente novo cadastrado offline
  if (sale.new_client) {
    const { data: created, error } = await supabase
      .from("companies")
      .insert({
        owner_id: userId,
        legal_name: sale.new_client.legal_name,
        phone: sale.new_client.phone || "não informado",
        cidade: sale.new_client.cidade ?? null,
        estado: sale.new_client.estado ?? null,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    return created.id;
  }

  throw new Error("Venda offline sem cliente vinculado");
}

async function submitOne(sale: OfflineSale, userId: string): Promise<string> {
  const company_id = await ensureCompanyId(sale, userId);

  const subtotal = cartSubtotal(sale.items);
  const total = subtotal + (sale.frete ?? 0) - (sale.desconto ?? 0) + (sale.acrescimo ?? 0);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      company_id,
      address_id: null,
      origem: sale.origem ?? "VISITA",
      status: "AGUARDANDO_PAGAMENTO",
      subtotal,
      frete: sale.frete ?? 0,
      desconto: sale.desconto ?? 0,
      total,
      observacao: sale.observacao ?? null,
      created_by: userId,
    } as any)
    .select("id")
    .single();
  if (error) throw error;

  const items = sale.items.map((i) => {
    const preco_final = i.tipo_compra === "PACOTE" && i.preco_pacote ? Number(i.preco_pacote) : Number(i.preco_unitario);
    const desc = i.desconto_pct ?? 0;
    const preco_com_desc = preco_final * (1 - desc / 100);
    return {
      order_id: order.id,
      product_id: i.product_id,
      tipo_compra: i.tipo_compra,
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
      preco_final: preco_com_desc,
      subtotal: preco_com_desc * i.quantidade,
    };
  });
  const { error: itErr } = await supabase.from("order_items").insert(items);
  if (itErr) throw itErr;

  const { error: payErr } = await supabase.from("payments").insert({
    order_id: order.id,
    tipo: sale.pagamento,
    valor: total,
    status: "PENDENTE",
  } as any);
  if (payErr) throw payErr;

  return order.id;
}

export async function syncOfflineSales(userId: string | null): Promise<{
  sent: number;
  failed: number;
}> {
  if (!userId) return { sent: 0, failed: 0 };
  if (running) return { sent: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0;
  let failed = 0;
  try {
    const queue = await loadSalesQueue();
    const pending = queue.filter((s) => s.status === "pending" || s.status === "error");
    for (const sale of pending) {
      await updateOfflineSale(sale.local_id, { status: "sending", error: null });
      try {
        const remote_order_id = await submitOne(sale, userId);
        await updateOfflineSale(sale.local_id, {
          status: "sent",
          remote_order_id,
          error: null,
        });
        sent++;
      } catch (e: any) {
        await updateOfflineSale(sale.local_id, {
          status: "error",
          error: e?.message ?? "Falha desconhecida",
        });
        failed++;
      }
    }
  } finally {
    running = false;
  }
  return { sent, failed };
}
