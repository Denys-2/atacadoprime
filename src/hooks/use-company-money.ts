import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { orderCodeHash } from "@/lib/order-code";

export type CompanyMoneyRow = {
  id: string;
  order_id: string | null;
  valor: number;
  status: string;
  vencimento: string | null;
  pagamento: string | null;
  descricao: string | null;
  parcela_num: number | null;
  parcelas_total: number | null;
  cliente: string;
  codigo: string;
  acerto_em: string | null;
};

type RawRow = {
  id: string;
  order_id: string | null;
  valor: number | null;
  status: string;
  vencimento: string | null;
  pagamento: string | null;
  descricao: string | null;
  parcela_num: number | null;
  parcelas_total: number | null;
  orders: {
    id: string;
    fechamento_id: string | null;
    companies: { trade_name: string | null; legal_name: string | null } | null;
  } | null;
};

const dayOf = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");

/**
 * Dinheiro que pertence à EMPRESA por já ter sido provisionado num acerto:
 * - `aTransferir`: parcelas de vendas já acertadas que CAÍRAM em caixa depois do acerto.
 * - `jaReservado`: parcelas de vendas já acertadas que ainda estão a vencer.
 */
export function useCompanyMoney() {
  return useQuery({
    queryKey: ["company-money"],
    queryFn: async () => {
      const [fechRes, txRes] = await Promise.all([
        supabase
          .from("fechamentos" as never)
          .select("id,created_at,periodo_to")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("financial_transactions")
          .select(
            "id,order_id,valor,status,vencimento,pagamento,descricao,parcela_num,parcelas_total,orders!inner(id,fechamento_id,companies(trade_name,legal_name))",
          )
          .eq("tipo", "RECEITA")
          .not("orders.fechamento_id", "is", null)
          .limit(2000),
      ]);
      if (fechRes.error) throw fechRes.error;
      if (txRes.error) throw txRes.error;

      const acertoPorId = new Map<string, string>();
      for (const f of (fechRes.data ?? []) as unknown as { id: string; created_at: string }[]) {
        acertoPorId.set(f.id, dayOf(f.created_at));
      }

      const aTransferir: CompanyMoneyRow[] = [];
      const jaReservado: CompanyMoneyRow[] = [];

      for (const raw of (txRes.data ?? []) as unknown as RawRow[]) {
        const ord = raw.orders;
        if (!ord?.fechamento_id) continue;
        const acertoEm = acertoPorId.get(ord.fechamento_id) ?? null;
        const cliente = ord.companies?.trade_name || ord.companies?.legal_name || "Cliente";
        const row: CompanyMoneyRow = {
          id: raw.id,
          order_id: raw.order_id,
          valor: Number(raw.valor || 0),
          status: raw.status,
          vencimento: raw.vencimento,
          pagamento: raw.pagamento,
          descricao: raw.descricao,
          parcela_num: raw.parcela_num,
          parcelas_total: raw.parcelas_total,
          cliente,
          codigo: orderCodeHash(ord.id, cliente),
          acerto_em: acertoEm,
        };

        if (row.status === "ESTORNADO" || row.status === "CANCELADO") continue;

        if (row.status === "PAGO") {
          // só é "a transferir" se o dinheiro entrou DEPOIS do acerto da venda
          if (acertoEm && dayOf(row.pagamento) > acertoEm) aTransferir.push(row);
        } else {
          jaReservado.push(row);
        }
      }

      const byDate = (a: CompanyMoneyRow, b: CompanyMoneyRow) =>
        String(a.vencimento ?? "").localeCompare(String(b.vencimento ?? ""));
      aTransferir.sort(byDate);
      jaReservado.sort(byDate);

      const sum = (arr: CompanyMoneyRow[]) => arr.reduce((s, r) => s + r.valor, 0);

      return {
        rowsTransferir: aTransferir,
        rowsReservado: jaReservado,
        totalTransferir: sum(aTransferir),
        totalReservado: sum(jaReservado),
      };
    },
  });
}
