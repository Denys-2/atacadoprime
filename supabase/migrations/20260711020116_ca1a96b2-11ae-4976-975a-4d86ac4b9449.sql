CREATE OR REPLACE FUNCTION public.trip_recalculate_items(_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sold RECORD;
BEGIN
  FOR sold IN
    SELECT
      oi.product_id,
      COALESCE(SUM(oi.quantidade), 0)::numeric AS quantidade_vendida
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.trip_id = _trip_id
      AND o.status <> 'CANCELADO'
    GROUP BY oi.product_id
  LOOP
    INSERT INTO public.trip_items(
      trip_id,
      product_id,
      qtd_carregada,
      qtd_vendida,
      qtd_devolvida
    )
    VALUES (
      _trip_id,
      sold.product_id,
      sold.quantidade_vendida,
      sold.quantidade_vendida,
      0
    )
    ON CONFLICT (trip_id, product_id) DO UPDATE
      SET qtd_vendida = sold.quantidade_vendida,
          qtd_carregada = GREATEST(public.trip_items.qtd_carregada, sold.quantidade_vendida),
          updated_at = now();
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.trip_recalculate_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_recalculate_items(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trip_apply_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trip uuid;
BEGIN
  SELECT trip_id INTO v_trip FROM public.orders WHERE id = _order_id;
  IF v_trip IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.trip_recalculate_items(v_trip);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.trip_apply_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_apply_order(uuid) TO service_role;

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

  SELECT COALESCE(SUM(oi.quantidade * COALESCE(p.preco_custo, 0)), 0)
    INTO custo_total
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
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
      trip_row.cidade,
      trip_row.estado,
      'open',
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

  SELECT COALESCE(SUM(oi.quantidade * COALESCE(p.preco_custo, 0)), 0)
    INTO custo_total
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
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

DO $function$
DECLARE
  trip_row RECORD;
BEGIN
  FOR trip_row IN SELECT id FROM public.trips LOOP
    PERFORM public.trip_recalculate_items(trip_row.id);
  END LOOP;
END;
$function$;