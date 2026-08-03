
-- Novo gatilho: consolida despesa por DIA (vendas avulsas) e limpa antigas por pedido
CREATE OR REPLACE FUNCTION public.order_sync_financials()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  custo_total NUMERIC := 0;
  ja_receita UUID;
  ja_despesa_dia UUID;
  pay_tipo TEXT; acc_id UUID;
  dia_venda DATE;
  dia_label TEXT;
  desc_dia TEXT;
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

  -- RECEITA (uma por pedido)
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

  -- DESPESA custo peças — consolidada por DIA (só vendas avulsas)
  IF NEW.trip_id IS NULL THEN
    SELECT COALESCE(SUM(oi.quantidade*COALESCE(p.preco_custo,0)),0) INTO custo_total
      FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
     WHERE oi.order_id=NEW.id;

    IF custo_total>0 THEN
      dia_venda := CURRENT_DATE;
      dia_label := to_char(dia_venda, 'DD/MM/YYYY');
      desc_dia  := 'Custos das peças vendidas '||dia_label;

      -- Procura despesa consolidada existente para o dia (não-viagem, pendente)
      SELECT id INTO ja_despesa_dia
        FROM public.financial_transactions
       WHERE tipo='DESPESA'
         AND order_id IS NULL
         AND descricao = desc_dia
       LIMIT 1;

      IF ja_despesa_dia IS NULL THEN
        INSERT INTO public.financial_transactions(order_id, company_id, tipo, status, valor, vencimento, descricao)
        VALUES (NULL, NULL, 'DESPESA', 'PENDENTE', custo_total,
                dia_venda + INTERVAL '30 days', desc_dia);
      ELSE
        UPDATE public.financial_transactions
           SET valor = valor + custo_total, updated_at = now()
         WHERE id = ja_despesa_dia;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

-- Consolida despesas antigas "Custo peças — Venda #xxxx" agrupando por dia da receita
DO $$
DECLARE
  r RECORD;
  novo_id UUID;
  desc_dia TEXT;
BEGIN
  FOR r IN
    SELECT date(COALESCE(rc.pagamento, ft.created_at::date)) as dia,
           SUM(ft.valor) as total
      FROM public.financial_transactions ft
      LEFT JOIN public.financial_transactions rc
        ON rc.order_id = ft.order_id AND rc.tipo='RECEITA'
     WHERE ft.tipo='DESPESA'
       AND ft.order_id IS NOT NULL
       AND ft.status='PENDENTE'
       AND ft.descricao ILIKE 'Custo peças — Venda%'
     GROUP BY 1
  LOOP
    desc_dia := 'Custos das peças vendidas '||to_char(r.dia, 'DD/MM/YYYY');
    INSERT INTO public.financial_transactions(order_id, company_id, tipo, status, valor, vencimento, descricao)
    VALUES (NULL, NULL, 'DESPESA', 'PENDENTE', r.total, r.dia + INTERVAL '30 days', desc_dia)
    RETURNING id INTO novo_id;
  END LOOP;

  -- Remove as antigas por pedido
  DELETE FROM public.financial_transactions
   WHERE tipo='DESPESA'
     AND order_id IS NOT NULL
     AND status='PENDENTE'
     AND descricao ILIKE 'Custo peças — Venda%';
END $$;
