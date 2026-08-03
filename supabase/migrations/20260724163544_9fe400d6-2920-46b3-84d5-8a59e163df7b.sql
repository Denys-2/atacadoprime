
-- 1) Débito e PIX sem taxa (usuário não usa maquininha)
UPDATE public.payment_fees SET debito = 0, updated_at = now();

-- 2) Config global de antecipação (2,09%) + flag padrão desligada
INSERT INTO public.system_settings (categoria, chave, valor)
VALUES
  ('financeiro', 'antecipacao_taxa_percentual', '2.09'::jsonb),
  ('financeiro', 'antecipacao_padrao', 'false'::jsonb)
ON CONFLICT (categoria, chave) DO NOTHING;

-- 3) Payments: bandeira do cartão e sinalização de antecipação
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS bandeira text,
  ADD COLUMN IF NOT EXISTS antecipado boolean NOT NULL DEFAULT false;

-- 4) Financial transactions: identificar parcela e origem
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS parcela_num integer,
  ADD COLUMN IF NOT EXISTS parcelas_total integer,
  ADD COLUMN IF NOT EXISTS bandeira text,
  ADD COLUMN IF NOT EXISTS taxa_percentual numeric,
  ADD COLUMN IF NOT EXISTS valor_bruto numeric,
  ADD COLUMN IF NOT EXISTS antecipado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ft_order_parcela
  ON public.financial_transactions(order_id, parcela_num);
