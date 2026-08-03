ALTER TABLE public.financial_transactions ADD COLUMN purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.financial_transactions.purchase_order_id IS 'Vínculo com a compra de material que gerou esta transação financeira';