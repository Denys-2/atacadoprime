
-- C2: flag idempotente para o lançamento de custo
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS custo_lancado_em TIMESTAMPTZ;

-- Marcar retroativamente os pedidos já pagos e cujo custo já foi contabilizado
-- (evita re-lançamento na próxima transição de status)
UPDATE public.orders
   SET custo_lancado_em = COALESCE(updated_at, created_at, now())
 WHERE custo_lancado_em IS NULL
   AND status IN ('PAGO','EM_SEPARACAO','ENVIADO','ENTREGUE');

-- Recria trigger de sync financeiro com guarda idempotente
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

  -- RECEITA (uma por pedido, idempotente por order_id)
  SELECT id INTO ja_receita
    FROM public.financial_transactions
   WHERE order_id=NEW.id AND tipo='RECEITA'
   LIMIT 1;

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
  -- IDEMPOTENTE: só lança se orders.custo_lancado_em IS NULL
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

    -- Marca como lançado (mesmo se custo_total=0, para não reavaliar)
    NEW.custo_lancado_em := now();
  END IF;

  RETURN NEW;
END; $function$;

-- Recria trigger de cancelamento para também limpar a flag
CREATE OR REPLACE FUNCTION public.order_cancel_reverse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
  custo_pedido NUMERIC := 0;
  desp RECORD;
  dia_label TEXT;
  desc_dia TEXT;
BEGIN
  IF NOT (TG_OP = 'UPDATE' AND NEW.status = 'CANCELADO' AND OLD.status IS DISTINCT FROM 'CANCELADO') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'ENTREGUE' THEN
    RAISE EXCEPTION 'Pedido já ENTREGUE não pode ser cancelado. Estorno manual necessário.';
  END IF;

  IF OLD.status NOT IN ('PAGO','EM_SEPARACAO','ENVIADO') THEN
    RETURN NEW;
  END IF;

  UPDATE public.financial_transactions
     SET status = 'ESTORNADO',
         updated_at = now(),
         descricao = COALESCE(descricao,'') || ' [Estorno cancelamento em ' || to_char(now(),'DD/MM/YYYY HH24:MI') || ']'
   WHERE order_id = NEW.id
     AND tipo = 'RECEITA'
     AND status <> 'ESTORNADO';

  SELECT COALESCE(SUM(oi.quantidade * COALESCE(p.preco_custo,0)),0)
    INTO custo_pedido
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
   WHERE oi.order_id = NEW.id;

  IF NEW.trip_id IS NULL AND custo_pedido > 0 AND OLD.custo_lancado_em IS NOT NULL THEN
    dia_label := to_char(COALESCE(OLD.custo_lancado_em::date, OLD.created_at::date, CURRENT_DATE), 'DD/MM/YYYY');
    desc_dia  := 'Custos das peças vendidas ' || dia_label;

    SELECT id, valor INTO desp
      FROM public.financial_transactions
     WHERE tipo = 'DESPESA'
       AND order_id IS NULL
       AND descricao = desc_dia
     LIMIT 1;

    IF FOUND THEN
      IF desp.valor - custo_pedido <= 0 THEN
        DELETE FROM public.financial_transactions WHERE id = desp.id;
      ELSE
        UPDATE public.financial_transactions
           SET valor = valor - custo_pedido, updated_at = now()
         WHERE id = desp.id;
      END IF;
    END IF;
  END IF;

  -- Limpar flag para permitir relançamento correto se pedido for repago
  NEW.custo_lancado_em := NULL;

  FOR it IN
    SELECT product_id, quantidade FROM public.order_items WHERE order_id = NEW.id
  LOOP
    IF NEW.trip_id IS NOT NULL THEN
      UPDATE public.trip_items
         SET qtd_vendida = GREATEST(qtd_vendida - it.quantidade, 0),
             updated_at = now()
       WHERE trip_id = NEW.trip_id
         AND product_id = it.product_id;
    ELSE
      UPDATE public.products
         SET estoque = COALESCE(estoque,0) + it.quantidade
       WHERE id = it.product_id;

      INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
      VALUES (it.product_id, 'ENTRADA', it.quantidade,
              'Estorno de cancelamento — pedido ' || substring(NEW.id::text,1,8),
              NEW.id, auth.uid());
    END IF;
  END LOOP;

  IF NEW.trip_id IS NOT NULL THEN
    PERFORM public.trip_recalculate_items(NEW.trip_id);
  END IF;

  RETURN NEW;
END;
$$;
