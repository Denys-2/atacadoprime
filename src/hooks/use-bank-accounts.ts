import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BankAccount = {
  id: string;
  nome: string;
  banco: string | null;
  tipo: "CORRENTE" | "POUPANCA" | "DINHEIRO" | "CARTAO" | "OUTRO";
  cor: string;
  saldo_inicial: number;
  ativo: boolean;
  incluir_saldo_total: boolean;
  observacao: string | null;
  created_at: string;
};

export type AccountBalance = BankAccount & {
  saldo: number;
  entradas: number;
  saidas: number;
};

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank-accounts-balances"],
    queryFn: async (): Promise<AccountBalance[]> => {
      const [{ data: accounts }, { data: txs }, { data: entries }, { data: trips }, { data: transfers }] = await Promise.all([
        supabase.from("bank_accounts").select("*").eq("ativo", true).order("nome"),
        supabase.from("financial_transactions").select("account_id, tipo, valor, status").eq("status", "PAGO"),
        supabase.from("financial_entries").select("account_id, tipo, valor"),
        supabase.from("trip_expenses").select("account_id, valor"),
        supabase.from("bank_transfers" as never).select("from_account_id, to_account_id, valor"),
      ]);

      return (accounts ?? []).map((a) => {
        const acc = a as BankAccount;
        let entradas = Number(acc.saldo_inicial || 0);
        let saidas = 0;

        for (const t of (txs ?? []) as Array<{ account_id: string | null; tipo: string; valor: number }>) {
          if (t.account_id !== acc.id) continue;
          if (t.tipo === "RECEITA") entradas += Number(t.valor);
          else if (t.tipo === "DESPESA") saidas += Number(t.valor);
        }
        for (const e of (entries ?? []) as Array<{ account_id: string | null; tipo: string; valor: number }>) {
          if (e.account_id !== acc.id) continue;
          if (e.tipo === "RECEITA") entradas += Number(e.valor);
          else saidas += Number(e.valor);
        }
        for (const te of (trips ?? []) as Array<{ account_id: string | null; valor: number }>) {
          if (te.account_id === acc.id) saidas += Number(te.valor);
        }
        for (const tr of (transfers ?? []) as Array<{ from_account_id: string; to_account_id: string; valor: number }>) {
          if (tr.from_account_id === acc.id) saidas += Number(tr.valor);
          if (tr.to_account_id === acc.id) entradas += Number(tr.valor);
        }

        return { ...acc, entradas, saidas, saldo: entradas - saidas };
      });
    },
  });
}

export type BankTransferInput = {
  from_account_id: string;
  to_account_id: string;
  valor: number;
  data?: string;
  observacao?: string | null;
};

export function useCreateBankTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BankTransferInput) => {
      if (input.from_account_id === input.to_account_id) throw new Error("Conta origem e destino devem ser diferentes");
      if (!input.valor || input.valor <= 0) throw new Error("Informe um valor válido");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("bank_transfers" as never).insert({
        from_account_id: input.from_account_id,
        to_account_id: input.to_account_id,
        valor: input.valor,
        data: input.data ?? new Date().toISOString().slice(0, 10),
        observacao: input.observacao ?? null,
        created_by: user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
      qc.invalidateQueries({ queryKey: ["bank-transfers"] });
    },
  });
}

export function useBankTransfers() {
  return useQuery({
    queryKey: ["bank-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transfers" as never)
        .select("id, valor, data, observacao, from_account_id, to_account_id, created_at")
        .order("data", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; valor: number; data: string; observacao: string | null; from_account_id: string; to_account_id: string; created_at: string }>;
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BankAccount> & { nome: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("bank_accounts").insert({
        nome: input.nome,
        banco: input.banco ?? null,
        tipo: input.tipo ?? "CORRENTE",
        cor: input.cor ?? "#6366f1",
        saldo_inicial: Number(input.saldo_inicial ?? 0),
        observacao: input.observacao ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] }),
  });
}

export function useDeleteBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] }),
  });
}
