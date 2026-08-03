-- 1) Devolver saldo das viagens ABERTAS ao estoque da loja
DO $$
DECLARE rec RECORD; saldo NUMERIC;
BEGIN
  FOR rec IN
    SELECT ti.* FROM public.trip_items ti
    JOIN public.trips t ON t.id = ti.trip_id
    WHERE t.status = 'open'
  LOOP
    saldo := COALESCE(rec.qtd_carregada,0) - COALESCE(rec.qtd_vendida,0) - COALESCE(rec.qtd_devolvida,0);
    IF saldo > 0 THEN
      UPDATE public.products SET estoque = COALESCE(estoque,0) + saldo, updated_at = now() WHERE id = rec.product_id;
      UPDATE public.trip_items SET qtd_devolvida = COALESCE(qtd_devolvida,0) + saldo, updated_at = now() WHERE id = rec.id;
      INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id)
      VALUES (rec.product_id, 'ENTRADA', saldo, 'Unificação de estoque: retorno de viagem', rec.trip_id);
    END IF;
  END LOOP;
END $$;

-- 2) Vendas sempre dão baixa no estoque da loja
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

    SELECT COALESCE(preco_custo, 0) INTO v_custo_unit
      FROM public.products WHERE id = v_product_id;

    INSERT INTO public.order_items(
      order_id, product_id, tipo_compra, quantidade,
      preco_unitario, preco_final, subtotal, custo_unitario
    ) VALUES (
      v_order_id, v_product_id, v_tipo_compra::compra_tipo, v_qtd,
      v_preco_unit, v_preco_final, v_item_subtotal, v_custo_unit
    );

    v_subtotal := v_subtotal + v_item_subtotal;

    -- Estoque único: sempre dá baixa na loja
    PERFORM public.stock_apply_delta(
      v_product_id, -v_qtd, 'SAIDA',
      'Venda pedido ' || substring(v_order_id::text,1,8),
      v_order_id, TRUE
    );
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

-- 3) Cancelamento devolve sempre ao estoque da loja
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

  IF custo_pedido > 0 AND OLD.custo_lancado_em IS NOT NULL THEN
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
    UPDATE public.products
       SET estoque = COALESCE(estoque,0) + it.quantidade
     WHERE id = it.product_id;

    INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
    VALUES (it.product_id, 'ENTRADA', it.quantidade,
            'Estorno de cancelamento — pedido ' || substring(NEW.id::text,1,8),
            NEW.id, auth.uid());
  END LOOP;

  IF NEW.trip_id IS NOT NULL THEN
    PERFORM public.trip_recalculate_items(NEW.trip_id);
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Encerrar viagem não movimenta mais estoque
CREATE OR REPLACE FUNCTION public.trip_close_v2(_trip_id uuid, _return_stock boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  custo_total NUMERIC := 0;
  local_txt TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = _trip_id AND status = 'open') THEN
    RAISE EXCEPTION 'Viagem não está aberta';
  END IF;

  PERFORM public.trip_recalculate_items(_trip_id);

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
  RETURN NULL;
END;
$function$;

-- 5) Carga de viagem desativada
CREATE OR REPLACE FUNCTION public.trip_load_items(_trip_id uuid, _items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Estoque unificado: não é mais necessário carregar peças na viagem. As vendas dão baixa direto no estoque da loja.';
END;
$function$;

-- 6) Rotina de dedução de viagens abertas vira inofensiva
CREATE OR REPLACE FUNCTION public.stock_deduct_open_trips()
 RETURNS TABLE(product_id uuid, deduzido numeric, insuficientes boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN;
END;
$function$;