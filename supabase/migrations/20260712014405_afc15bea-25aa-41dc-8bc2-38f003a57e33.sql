
CREATE UNIQUE INDEX IF NOT EXISTS payments_order_id_unique
  ON public.payments (order_id);

COMMENT ON INDEX public.payments_order_id_unique IS
  'Impede múltiplos pagamentos por pedido. Split payment (PIX+CARTAO) exige remover esta constraint e adaptar order_sync_financials para gerar uma financial_transactions por linha de payments.';
