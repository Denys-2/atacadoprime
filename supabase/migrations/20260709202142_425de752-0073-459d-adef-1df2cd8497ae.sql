
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  banco TEXT,
  tipo TEXT NOT NULL DEFAULT 'CORRENTE' CHECK (tipo IN ('CORRENTE','POUPANCA','DINHEIRO','CARTAO','OUTRO')),
  cor TEXT NOT NULL DEFAULT '#6366f1',
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales staff can view bank accounts" ON public.bank_accounts
  FOR SELECT TO authenticated USING (public.is_sales_staff(auth.uid()));
CREATE POLICY "sales staff can insert bank accounts" ON public.bank_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_sales_staff(auth.uid()));
CREATE POLICY "sales staff can update bank accounts" ON public.bank_accounts
  FOR UPDATE TO authenticated USING (public.is_sales_staff(auth.uid())) WITH CHECK (public.is_sales_staff(auth.uid()));
CREATE POLICY "sales staff can delete bank accounts" ON public.bank_accounts
  FOR DELETE TO authenticated USING (public.is_sales_staff(auth.uid()));

CREATE TRIGGER trg_bank_accounts_updated
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS financial_transactions_account_id_idx ON public.financial_transactions(account_id);

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS financial_entries_account_id_idx ON public.financial_entries(account_id);

ALTER TABLE public.trip_expenses
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS trip_expenses_account_id_idx ON public.trip_expenses(account_id);

-- Backfill paid orders that don't yet have a financial_transaction
INSERT INTO public.financial_transactions (
  company_id, order_id, tipo, forma_pagamento, valor, status, pagamento, descricao
)
SELECT
  o.company_id,
  o.id,
  'RECEITA',
  COALESCE(p.tipo, 'DINHEIRO'),
  o.total,
  'PAGO',
  o.created_at::date,
  'Venda #' || substring(o.id::text, 1, 8)
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT tipo FROM public.payments WHERE order_id = o.id AND status = 'APROVADO' LIMIT 1
) p ON true
WHERE o.status IN ('PAGO','EM_SEPARACAO','ENVIADO','ENTREGUE')
  AND NOT EXISTS (SELECT 1 FROM public.financial_transactions ft WHERE ft.order_id = o.id);

CREATE OR REPLACE FUNCTION public.bank_account_balance(_account_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT saldo_inicial FROM public.bank_accounts WHERE id = _account_id), 0)
    + COALESCE((SELECT SUM(valor) FROM public.financial_transactions WHERE account_id = _account_id AND status = 'PAGO' AND tipo = 'RECEITA'), 0)
    - COALESCE((SELECT SUM(valor) FROM public.financial_transactions WHERE account_id = _account_id AND status = 'PAGO' AND tipo = 'DESPESA'), 0)
    + COALESCE((SELECT SUM(valor) FROM public.financial_entries WHERE account_id = _account_id AND tipo = 'RECEITA'), 0)
    - COALESCE((SELECT SUM(valor) FROM public.financial_entries WHERE account_id = _account_id AND tipo = 'DESPESA'), 0)
    - COALESCE((SELECT SUM(valor) FROM public.trip_expenses WHERE account_id = _account_id), 0)
$$;
