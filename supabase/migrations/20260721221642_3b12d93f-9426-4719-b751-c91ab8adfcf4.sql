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