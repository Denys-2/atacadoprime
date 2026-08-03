
DROP INDEX IF EXISTS public.financial_transactions_order_receita_uniq;
CREATE UNIQUE INDEX financial_transactions_order_receita_parcela_uniq
  ON public.financial_transactions (order_id, COALESCE(parcela_num, 1))
  WHERE tipo = 'RECEITA' AND order_id IS NOT NULL;
