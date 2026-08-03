import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyCompany } from "@/hooks/use-auth";
import type { CartItem } from "@/hooks/use-cart";

export type CreateOrderInput = {
  company_id: string;
  address_id: string | null;
  origem: "PORTAL" | "VISITA" | "WHATSAPP";
  items: CartItem[];
  frete: number;
  desconto: number;
  acrescimo?: number;
  observacao?: string;
  pagamento: "PIX" | "CARTAO";
  trip_id?: string | null;
};


export function useCreateOrder() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const payload = {
        company_id: input.company_id,
        address_id: input.address_id,
        origem: input.origem,
        frete: input.frete,
        desconto: input.desconto,
        acrescimo: input.acrescimo ?? 0,
        observacao: input.observacao ?? null,
        pagamento: input.pagamento,
        trip_id: input.trip_id ?? null,
        items: input.items.map((i) => ({
          product_id: i.product_id,
          tipo_compra: i.tipo_compra,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          preco_pacote: i.preco_pacote ?? null,
        })),
      };
      const { data: orderId, error } = await supabase.rpc(
        "order_create_atomic" as never,
        { _payload: payload } as never,
      );
      if (error) throw error;

      // Move lead vinculado a esse cliente para a coluna "Pedido" do CRM.
      // Só altera leads do vendedor atual — nunca de outros vendedores da mesma empresa.
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase
          .from("leads")
          .update({ status: "PEDIDO" })
          .eq("company_id", input.company_id)
          .neq("status", "PEDIDO")
          .or(`responsavel_id.eq.${currentUser.id},created_by.eq.${currentUser.id}`);
      }


      return orderId as unknown as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-admin"] });
      qc.invalidateQueries({ queryKey: ["order-stats"] });
      qc.invalidateQueries({ queryKey: ["crm"] });
    },
  });
}

export function useMyOrders() {
  const { user } = useAuth();
  const { data: company } = useMyCompany(user);
  return useQuery({
    queryKey: ["orders", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, companies(legal_name, trade_name), order_items(quantidade), payments(tipo, status, payment_link)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllOrdersAdmin() {
  return useQuery({
    queryKey: ["orders-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, companies(legal_name, trade_name, phone), order_items(quantidade), payments(tipo, status, payment_link)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, companies(legal_name, trade_name), addresses(*), order_items(*, products(nome, sku)), payments(*), order_history(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useOrderStats() {
  return useQuery({
    queryKey: ["order-stats"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const week = new Date(); week.setDate(week.getDate() - 7);
      const month = new Date(); month.setMonth(month.getMonth() - 1);
      const [t1, t7, t30, pend, pago] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", week.toISOString()),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", month.toISOString()),
        supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["PENDENTE","AGUARDANDO_PAGAMENTO"]),
        supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["PAGO","EM_SEPARACAO","ENVIADO","ENTREGUE"]),
      ]);
      const { data: monthRows } = await supabase
        .from("orders").select("total").gte("created_at", month.toISOString());
      const totals = (monthRows ?? []).map((r) => Number(r.total));
      const ticket = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
      return {
        hoje: t1.count ?? 0,
        semana: t7.count ?? 0,
        mes: t30.count ?? 0,
        pendentes: pend.count ?? 0,
        pagos: pago.count ?? 0,
        ticket,
      };
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "PENDENTE" | "AGUARDANDO_PAGAMENTO" | "PAGO" | "EM_SEPARACAO" | "ENVIADO" | "ENTREGUE" | "CANCELADO" }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
      if (status === "PAGO") {
        await supabase.from("payments").update({ status: "APROVADO" }).eq("order_id", id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-admin"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}
export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Remove dependências primeiro (caso não haja cascade)
      await supabase.from("payments").delete().eq("order_id", id);
      await supabase.from("order_items").delete().eq("order_id", id);
      await supabase.from("order_history").delete().eq("order_id", id);
      await supabase.from("financial_transactions").delete().eq("order_id", id);
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-admin"] });
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["fin-tx"] });
    },
  });
}


export type ConfirmPaymentInput = {
  order_id: string;
  company_id: string | null;
  total: number;
  tipo: "PIX" | "CARTAO" | "DINHEIRO" | "FATURADO";
  modalidade?: "CREDITO" | "DEBITO"; // só cartão
  bandeira?: string | null; // só cartão
  antecipado?: boolean; // só crédito
  conta: string; // ex: "Pix Denys - 34998651112"
  account_id?: string | null; // conta bancária real
  parcelas?: number; // apenas cartão
  prazos?: number[]; // apenas faturado — dias de vencimento (ex: [30,60,90])
  observacao?: string;
  /** Substitui um pagamento já confirmado: apaga os lançamentos antigos e recria. */
  replace?: boolean;
};


export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConfirmPaymentInput) => {
      // Salva metadados no pagamento; o trigger order_sync_financials
      // é a única fonte de verdade da linha em financial_transactions.
      const isCartao = input.tipo === "CARTAO";
      const modalidade = isCartao ? (input.modalidade ?? "CREDITO") : null;
      const bandeira = isCartao ? (input.bandeira ?? null) : null;
      const antecipado = isCartao && modalidade === "CREDITO" ? !!input.antecipado : false;

      if (input.replace) {
        // Limpa lançamentos financeiros do pedido e volta o status para que o
        // trigger recrie tudo conforme a nova forma de pagamento.
        const { error: dErr } = await supabase
          .from("financial_transactions")
          .delete()
          .eq("order_id", input.order_id);
        if (dErr) throw dErr;
        const { error: sErr } = await supabase
          .from("orders")
          .update({ status: "AGUARDANDO_PAGAMENTO" })
          .eq("id", input.order_id);
        if (sErr) throw sErr;
      }


      const { error: pErr } = await supabase.from("payments").update({
        status: input.tipo === "FATURADO" ? "PENDENTE" : "APROVADO",
        tipo: input.tipo as "PIX" | "CARTAO" | "DINHEIRO",
        valor: input.total,
        account_id: input.account_id ?? null,
        bandeira,
        antecipado,
        payload: {
          conta: input.conta,
          parcelas: input.parcelas ?? 1,
          prazos: input.tipo === "FATURADO" ? (input.prazos ?? [30]) : null,
          observacao: input.observacao ?? null,
          modalidade,
          bandeira,
          antecipado,
        },
      }).eq("order_id", input.order_id);
      if (pErr) throw pErr;


      const { error: oErr } = await supabase
        .from("orders")
        .update({ status: "PAGO" })
        .eq("id", input.order_id);
      if (oErr) throw oErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-admin"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
      qc.invalidateQueries({ queryKey: ["fin-tx"] });
    },
  });
}




export function useUpdatePaymentLink() {

  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ order_id, payment_link }: { order_id: string; payment_link: string }) => {
      const { error } = await supabase.from("payments").update({ payment_link }).eq("order_id", order_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export type EditOrderItemInput = {
  id: string;
  quantidade: number;
  preco_final: number;
};

export function useUpdateOrderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      order_id,
      items,
      frete,
      desconto,
    }: {
      order_id: string;
      items: EditOrderItemInput[];
      frete: number;
      desconto: number;
    }) => {
      // Update each item (subtotal = preco_final * quantidade)
      for (const it of items) {
        const subtotal = Number(it.preco_final) * Number(it.quantidade);
        const { error } = await supabase
          .from("order_items")
          .update({
            quantidade: it.quantidade,
            preco_final: it.preco_final,
            subtotal,
          })
          .eq("id", it.id);
        if (error) throw error;
      }
      const subtotal = items.reduce((s, i) => s + Number(i.preco_final) * Number(i.quantidade), 0);
      const total = subtotal + Number(frete) - Number(desconto);
      const { error: oErr } = await supabase
        .from("orders")
        .update({ subtotal, frete, desconto, total })
        .eq("id", order_id);
      if (oErr) throw oErr;
      await supabase.from("payments").update({ valor: total }).eq("order_id", order_id);
      return { order_id, total };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-admin"] });
    },
  });
}
