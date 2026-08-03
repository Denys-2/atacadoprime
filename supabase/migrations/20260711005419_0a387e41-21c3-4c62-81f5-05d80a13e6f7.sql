
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS default_pix boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_cartao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_dinheiro boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_default_pix_uq
  ON public.bank_accounts ((true)) WHERE default_pix;
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_default_cartao_uq
  ON public.bank_accounts ((true)) WHERE default_cartao;
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_default_dinheiro_uq
  ON public.bank_accounts ((true)) WHERE default_dinheiro;

UPDATE public.bank_accounts SET
  default_cartao = (nome = 'INTER PRIME'),
  default_pix = (nome = 'DENYS - C6BANK'),
  default_dinheiro = (nome = 'DENYS PESSOAL');

CREATE OR REPLACE FUNCTION public.order_sync_financials()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  custo_total NUMERIC := 0;
  ja_receita UUID; ja_despesa UUID;
  pay_tipo TEXT; acc_id UUID;
BEGIN
  IF NOT (
    (TG_OP='INSERT' AND NEW.status='PAGO') OR
    (TG_OP='UPDATE' AND NEW.status='PAGO' AND NEW.status IS DISTINCT FROM OLD.status)
  ) THEN RETURN NEW; END IF;

  SELECT tipo::text INTO pay_tipo FROM public.payments WHERE order_id=NEW.id ORDER BY created_at DESC LIMIT 1;

  IF pay_tipo='CARTAO' THEN
    SELECT id INTO acc_id FROM public.bank_accounts WHERE default_cartao AND ativo LIMIT 1;
  ELSIF pay_tipo='PIX' THEN
    SELECT id INTO acc_id FROM public.bank_accounts WHERE default_pix AND ativo LIMIT 1;
  ELSIF pay_tipo='DINHEIRO' THEN
    SELECT id INTO acc_id FROM public.bank_accounts WHERE default_dinheiro AND ativo LIMIT 1;
  END IF;

  SELECT id INTO ja_receita FROM public.financial_transactions WHERE order_id=NEW.id AND tipo='RECEITA' LIMIT 1;
  IF ja_receita IS NULL THEN
    INSERT INTO public.financial_transactions(order_id, company_id, tipo, status, valor, pagamento, descricao, forma_pagamento, account_id)
    VALUES (NEW.id, NEW.company_id, 'RECEITA', 'PAGO', COALESCE(NEW.total,0), CURRENT_DATE,
            'Venda #'||substring(NEW.id::text,1,8), pay_tipo, acc_id);
  ELSE
    UPDATE public.financial_transactions
       SET status='PAGO', valor=COALESCE(NEW.total,0),
           pagamento=COALESCE(pagamento,CURRENT_DATE),
           forma_pagamento=COALESCE(forma_pagamento,pay_tipo),
           account_id=COALESCE(account_id,acc_id),
           updated_at=now()
     WHERE id=ja_receita;
  END IF;

  IF NEW.trip_id IS NULL THEN
    SELECT COALESCE(SUM(oi.quantidade*COALESCE(p.preco_custo,0)),0) INTO custo_total
      FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
     WHERE oi.order_id=NEW.id;
    IF custo_total>0 THEN
      SELECT id INTO ja_despesa FROM public.financial_transactions WHERE order_id=NEW.id AND tipo='DESPESA' LIMIT 1;
      IF ja_despesa IS NULL THEN
        INSERT INTO public.financial_transactions(order_id, company_id, tipo, status, valor, vencimento, descricao)
        VALUES (NEW.id, NEW.company_id, 'DESPESA', 'PENDENTE', custo_total, CURRENT_DATE+INTERVAL '30 days',
                'Custo peças — Venda #'||substring(NEW.id::text,1,8));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

UPDATE public.financial_transactions ft
   SET account_id = ba.id,
       forma_pagamento = COALESCE(ft.forma_pagamento, p.tipo::text)
  FROM public.payments p
  JOIN public.bank_accounts ba
    ON (p.tipo::text='CARTAO'   AND ba.default_cartao)
    OR (p.tipo::text='PIX'      AND ba.default_pix)
    OR (p.tipo::text='DINHEIRO' AND ba.default_dinheiro)
 WHERE ft.account_id IS NULL AND ft.tipo='RECEITA' AND ft.order_id=p.order_id AND ba.ativo;
