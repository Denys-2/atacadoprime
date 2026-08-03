
-- 1) Coluna congelada
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC NOT NULL DEFAULT 0;

-- 2) Backfill do histórico com custo atual (single shot)
UPDATE public.order_items oi
   SET custo_unitario = COALESCE(p.preco_custo, 0)
  FROM public.products p
 WHERE p.id = oi.product_id
   AND oi.custo_unitario = 0;

-- 3) order_create_atomic congela o custo
CREATE OR REPLACE FUNCTION public.order_create_atomic(_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id UUID := (_payload->>'company_id')::UUID;
  v_address_id UUID := NULLIF(_payload->>'address_id','')::UUID;
  v_origem     TEXT := _payload->>'origem';
  v_frete      NUMERIC := COALESCE((_payload->>'frete')::NUMERIC, 0);
  v_desconto   NUMERIC := COALESCE((_payload->>'desconto')::NUMERIC, 0);
  v_acrescimo  NUMERIC := COALESCE((_payload->>'acrescimo')::NUMERIC, 0);
  v_observacao TEXT := _payload->>'observacao';
  v_pagamento  TEXT := _payload->>'pagamento';
  v_trip_id    UUID := NULLIF(_payload->>'trip_id','')::UUID;
  v_created_by UUID := auth.uid();

  v_order_id   UUID;
  v_subtotal   NUMERIC := 0;
  v_total      NUMERIC := 0;

  it JSONB;
  v_product_id UUID;
  v_tipo_compra TEXT;
  v_qtd NUMERIC;
  v_preco_unit NUMERIC;
  v_preco_pac NUMERIC;
  v_preco_final NUMERIC;
  v_item_subtotal NUMERIC;
  v_custo_unit NUMERIC;
BEGIN
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'company_id obrigatório'; END IF;
  IF v_origem IS NULL THEN RAISE EXCEPTION 'origem obrigatório'; END IF;
  IF v_pagamento IS NULL THEN RAISE EXCEPTION 'pagamento obrigatório'; END IF;
  IF jsonb_array_length(_payload->'items') = 0 THEN
    RAISE EXCEPTION 'Pedido precisa de pelo menos 1 item';
  END IF;

  INSERT INTO public.orders(
    company_id, address_id, origem, status,
    subtotal, frete, desconto, total,
    observacao, created_by, trip_id
  ) VALUES (
    v_company_id, v_address_id, v_origem::order_origem, 'AGUARDANDO_PAGAMENTO'::order_status,
    0, v_frete, v_desconto, 0,
    v_observacao, v_created_by, v_trip_id
  ) RETURNING id INTO v_order_id;

  FOR it IN SELECT * FROM jsonb_array_elements(_payload->'items')
  LOOP
    v_product_id := (it->>'product_id')::UUID;
    v_tipo_compra := COALESCE(it->>'tipo_compra','UNIDADE');
    v_qtd := (it->>'quantidade')::NUMERIC;
    v_preco_unit := (it->>'preco_unitario')::NUMERIC;
    v_preco_pac := NULLIF(it->>'preco_pacote','')::NUMERIC;

    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para item %', v_product_id;
    END IF;

    v_preco_final := CASE
      WHEN v_tipo_compra = 'PACOTE' AND v_preco_pac IS NOT NULL THEN v_preco_pac
      ELSE v_preco_unit
    END;
    v_item_subtotal := v_preco_final * v_qtd;

    -- Congela o custo atual da peça
    SELECT COALESCE(preco_custo, 0) INTO v_custo_unit
      FROM public.products WHERE id = v_product_id;

    INSERT INTO public.order_items(
      order_id, product_id, tipo_compra, quantidade,
      preco_unitario, preco_final, subtotal, custo_unitario
    ) VALUES (
      v_order_id, v_product_id, v_tipo_compra, v_qtd,
      v_preco_unit, v_preco_final, v_item_subtotal, v_custo_unit
    );

    v_subtotal := v_subtotal + v_item_subtotal;

    IF v_trip_id IS NULL THEN
      PERFORM public.stock_apply_delta(
        v_product_id, -v_qtd, 'SAIDA',
        'Venda pedido ' || substring(v_order_id::text,1,8),
        v_order_id, TRUE
      );
    END IF;
  END LOOP;

  v_total := v_subtotal + v_frete - v_desconto + v_acrescimo;

  UPDATE public.orders SET subtotal = v_subtotal, total = v_total WHERE id = v_order_id;

  INSERT INTO public.payments(order_id, tipo, valor, status)
  VALUES (v_order_id, v_pagamento::payment_tipo, v_total, 'PENDENTE'::payment_status);

  IF v_trip_id IS NOT NULL THEN
    PERFORM public.trip_recalculate_items(v_trip_id);
  END IF;

  RETURN v_order_id;
END;
$function$;

-- 4) order_sync_financials passa a somar custo congelado
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

  SELECT id INTO ja_receita
    FROM public.financial_transactions
   WHERE order_id = NEW.id AND tipo = 'RECEITA'
   LIMIT 1;

  IF ja_receita IS NULL THEN
    INSERT INTO public.financial_transactions(
      order_id, company_id, tipo, status, valor,
      pagamento, descricao, forma_pagamento, parcelas, account_id
    ) VALUES (
      NEW.id, NEW.company_id, 'RECEITA', status_fin, COALESCE(NEW.total,0),
      pagamento_fin,
      COALESCE(observ_txt, 'Venda #'||substring(NEW.id::text,1,8)),
      forma_txt, parcelas_num,
      CASE WHEN is_cartao THEN NULL ELSE acc_id END
    );
  ELSE
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

  IF NEW.trip_id IS NULL AND NEW.custo_lancado_em IS NULL THEN
    SELECT COALESCE(SUM(oi.quantidade * COALESCE(oi.custo_unitario, 0)),0) INTO custo_total
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id;

    IF custo_total > 0 THEN
      dia_venda := CURRENT_DATE;
      dia_label := to_char(dia_venda, 'DD/MM/YYYY');
      desc_dia  := 'Custos das peças vendidas '||dia_label;

      SELECT id INTO ja_despesa_dia
        FROM public.financial_transactions
       WHERE tipo='DESPESA' AND order_id IS NULL AND descricao = desc_dia
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

-- 5) order_cancel_reverse usa custo congelado
CREATE OR REPLACE FUNCTION public.order_cancel_reverse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT COALESCE(SUM(oi.quantidade * COALESCE(oi.custo_unitario, 0)),0)
    INTO custo_pedido
    FROM public.order_items oi
   WHERE oi.order_id = NEW.id;

  IF NEW.trip_id IS NULL AND custo_pedido > 0 AND OLD.custo_lancado_em IS NOT NULL THEN
    dia_label := to_char(COALESCE(OLD.custo_lancado_em::date, OLD.created_at::date, CURRENT_DATE), 'DD/MM/YYYY');
    desc_dia  := 'Custos das peças vendidas ' || dia_label;

    SELECT id, valor INTO desp
      FROM public.financial_transactions
     WHERE tipo = 'DESPESA' AND order_id IS NULL AND descricao = desc_dia
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
$function$;

-- 6) trip_close e trip_close_v2 usam custo congelado
CREATE OR REPLACE FUNCTION public.trip_close(_trip_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  saldo NUMERIC;
  custo_total NUMERIC := 0;
  local_txt TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = _trip_id AND status = 'open') THEN
    RAISE EXCEPTION 'Viagem não está aberta';
  END IF;

  PERFORM public.trip_recalculate_items(_trip_id);

  FOR rec IN SELECT * FROM public.trip_items WHERE trip_id = _trip_id LOOP
    saldo := rec.qtd_carregada - rec.qtd_vendida - rec.qtd_devolvida;
    IF saldo > 0 THEN
      UPDATE public.products SET estoque = COALESCE(estoque,0) + saldo WHERE id = rec.product_id;
      UPDATE public.trip_items SET qtd_devolvida = qtd_devolvida + saldo WHERE id = rec.id;
      INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
        VALUES (rec.product_id, 'ENTRADA', saldo, 'Retorno de viagem', _trip_id, auth.uid());
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(oi.quantidade * COALESCE(oi.custo_unitario, 0)), 0)
    INTO custo_total
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.trip_id = _trip_id
     AND o.status <> 'CANCELADO';

  IF custo_total > 0 THEN
    SELECT CASE WHEN cidade IS NOT NULL THEN cidade || COALESCE('-' || estado, '') ELSE COALESCE(nome, 'Viagem') END
      INTO local_txt FROM public.trips WHERE id = _trip_id;

    INSERT INTO public.financial_transactions(tipo, valor, status, descricao, vencimento)
    VALUES ('DESPESA', custo_total, 'PENDENTE',
            'Custo peças vendidas — ' || local_txt,
            CURRENT_DATE + INTERVAL '30 days');
  END IF;

  UPDATE public.trips SET status = 'closed', closed_at = now() WHERE id = _trip_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trip_close_v2(_trip_id uuid, _return_stock boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  saldo NUMERIC;
  custo_total NUMERIC := 0;
  local_txt TEXT;
  trip_row RECORD;
  new_trip_id UUID := NULL;
BEGIN
  SELECT * INTO trip_row FROM public.trips WHERE id = _trip_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não está aberta';
  END IF;

  PERFORM public.trip_recalculate_items(_trip_id);

  IF _return_stock THEN
    FOR rec IN SELECT * FROM public.trip_items WHERE trip_id = _trip_id LOOP
      saldo := rec.qtd_carregada - rec.qtd_vendida - rec.qtd_devolvida;
      IF saldo > 0 THEN
        UPDATE public.products SET estoque = COALESCE(estoque,0) + saldo WHERE id = rec.product_id;
        UPDATE public.trip_items SET qtd_devolvida = qtd_devolvida + saldo WHERE id = rec.id;
        INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
          VALUES (rec.product_id, 'ENTRADA', saldo, 'Retorno de viagem', _trip_id, auth.uid());
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.trips(nome, cidade, estado, status, vendedor_id, created_by, notas)
    VALUES (
      'Sobras de ' || COALESCE(trip_row.nome, 'viagem'),
      trip_row.cidade, trip_row.estado, 'open',
      COALESCE(trip_row.vendedor_id, auth.uid()),
      auth.uid(),
      'Gerada automaticamente ao encerrar viagem ' || COALESCE(trip_row.nome, _trip_id::text)
    )
    RETURNING id INTO new_trip_id;

    FOR rec IN SELECT * FROM public.trip_items WHERE trip_id = _trip_id LOOP
      saldo := rec.qtd_carregada - rec.qtd_vendida - rec.qtd_devolvida;
      IF saldo > 0 THEN
        INSERT INTO public.trip_items(trip_id, product_id, qtd_carregada)
          VALUES (new_trip_id, rec.product_id, saldo)
          ON CONFLICT (trip_id, product_id) DO UPDATE
            SET qtd_carregada = public.trip_items.qtd_carregada + EXCLUDED.qtd_carregada;
        UPDATE public.trip_items SET qtd_devolvida = qtd_devolvida + saldo WHERE id = rec.id;
        INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
          VALUES (rec.product_id, 'TRANSFERENCIA', saldo, 'Transferência de saldo para nova viagem', new_trip_id, auth.uid());
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(SUM(oi.quantidade * COALESCE(oi.custo_unitario, 0)), 0)
    INTO custo_total
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.trip_id = _trip_id
     AND o.status <> 'CANCELADO';

  IF custo_total > 0 THEN
    SELECT CASE WHEN cidade IS NOT NULL THEN cidade || COALESCE('-' || estado, '') ELSE COALESCE(nome, 'Viagem') END
      INTO local_txt FROM public.trips WHERE id = _trip_id;

    INSERT INTO public.financial_transactions(tipo, valor, status, descricao, vencimento)
    VALUES ('DESPESA', custo_total, 'PENDENTE',
            'Custo peças vendidas — ' || local_txt,
            CURRENT_DATE + INTERVAL '30 days');
  END IF;

  UPDATE public.trips SET status = 'closed', closed_at = now() WHERE id = _trip_id;
  RETURN new_trip_id;
END;
$function$;
