UPDATE public.financial_transactions ft
SET status = 'PENDENTE',
    pagamento = NULL,
    account_id = NULL
FROM public.payments p
WHERE ft.order_id = p.order_id
  AND p.tipo = 'CARTAO'
  AND ft.tipo = 'RECEITA'
  AND ft.status = 'PAGO';