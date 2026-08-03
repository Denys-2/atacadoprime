
-- Índice único: no máximo 1 RECEITA por pedido
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_order_receita_uniq
  ON public.financial_transactions(order_id)
  WHERE tipo = 'RECEITA' AND order_id IS NOT NULL;

-- Reescreve o trigger para ser a única fonte de verdade da RECEITA
CREATE OR REPLACE FUNCTION public.order_sync_financials()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  custo_total NUMERIC := 0;
  ja_receita UUID;
  ja_despesa_dia UUID;
  pay RECORD;
  pay_tipo TEXT;
  parcelas_num INT := 1;
  conta_txt TEXT;
  observ_txt TEXT;
  acc_id UUID;
  is_cartao BOOLEAN;
  status_fin TEXT;
  pagamento_fin DATE;
  forma_txt TEXT;
  dia_venda DATE;
  dia_label TEXT;
  desc_dia TEXT;
BEGIN
  IF NOT (
    (TG_OP='INSERT' AND NEW.status='PAGO') OR
    (TG_OP='UPDATE' AND NEW.status='PAGO' AND NEW.status IS DISTINCT FROM OLD.status)
  ) THEN RETURN NEW; END IF;

  -- Lê o pagamento mais recente com metadados (parcelas, conta, observação)
  SELECT tipo::text,
         COALESCE((payload->>'parcelas')::int, 1) AS parcelas,
         payload->>'conta' AS conta,
         payload->>'observacao' AS observ,
         account_id
    INTO pay
    FROM public.payments
   WHERE order_id = NEW.id
   ORDER BY created_at DESC
   LIMIT 1;

  pay_tipo := pay.tipo;
  parcelas_num := COALESCE(pay.parcelas, 1);
  conta_txt := pay.conta;
  observ_txt := pay.observ;
  acc_id := pay.account_id;

  -- Se o pagamento não trouxe account_id, usa a conta padrão da forma
  IF acc_id IS NULL THEN
    IF pay_tipo = 'CARTAO' THEN
      SELECT id INTO acc_id FROM public.bank_accounts WHERE default_cartao AND ativo LIMIT 1;
    ELSIF pay_tipo = 'PIX' THEN
      SELECT id INTO acc_id FROM public.bank_accounts WHERE default_pix AND ativo LIMIT 1;
    ELSIF pay_tipo = 'DINHEIRO' THEN
      SELECT id INTO acc_id FROM public.bank_accounts WHERE default_dinheiro AND ativo LIMIT 1;
    END IF;
  END IF;

  is_cartao := pay_tipo = 'CARTAO';
  status_fin := CASE WHEN is_cartao THEN 'PENDENTE' ELSE 'PAGO' END;
  pagamento_fin := CASE WHEN is_cartao THEN NULL ELSE CURRENT_DATE END;
  forma_txt := CASE
    WHEN is_cartao AND conta_txt IS NOT NULL THEN conta_txt || ' · ' || parcelas_num || 'x'
    WHEN conta_txt IS NOT NULL THEN conta_txt
    ELSE pay_tipo
  END;

  -- RECEITA (uma por pedido, idempotente)
  SELECT id INTO ja_receita
    FROM public.financial_transactions
   WHERE order_id = NEW.id AND tipo = 'RECEITA'
   LIMIT 1;

  IF ja_receita IS NULL THEN
    INSERT INTO public.financial_transactions(
      order_id, company_id, tipo, status, valor,
      pagamento, descricao, forma_pagamento, parcelas,
      account_id
    ) VALUES (
      NEW.id, NEW.company_id, 'RECEITA', status_fin, COALESCE(NEW.total,0),
      pagamento_fin,
      COALESCE(observ_txt, 'Venda #'||substring(NEW.id::text,1,8)),
      forma_txt, parcelas_num,
      CASE WHEN is_cartao THEN NULL ELSE acc_id END
    );
  ELSE
    -- Apenas complementa se estiver vazio; não sobrescreve escolhas do operador
    UPDATE public.financial_transactions
       SET status = status_fin,
           valor = COALESCE(NEW.total, valor),
           pagamento = COALESCE(pagamento, pagamento_fin),
           forma_pagamento = COALESCE(forma_pagamento, forma_txt),
           parcelas = COALESCE(parcelas, parcelas_num),
           account_id = COALESCE(account_id, CASE WHEN is_cartao THEN NULL ELSE acc_id END),
           updated_at = now()
     WHERE id = ja_receita;
  END IF;

  -- DESPESA custo peças — consolidada por DIA (só vendas avulsas), idempotente
  IF NEW.trip_id IS NULL AND NEW.custo_lancado_em IS NULL THEN
    SELECT COALESCE(SUM(oi.quantidade*COALESCE(p.preco_custo,0)),0) INTO custo_total
      FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
     WHERE oi.order_id=NEW.id;

    IF custo_total > 0 THEN
      dia_venda := CURRENT_DATE;
      dia_label := to_char(dia_venda, 'DD/MM/YYYY');
      desc_dia  := 'Custos das peças vendidas '||dia_label;

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

    NEW.custo_lancado_em := now();
  END IF;

  RETURN NEW;
END; $function$;
