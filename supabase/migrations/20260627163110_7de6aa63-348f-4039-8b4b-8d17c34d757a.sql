
CREATE OR REPLACE FUNCTION public.trip_load_items(_trip_id UUID, _items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  pid UUID;
  qtd NUMERIC;
  trip_status TEXT;
BEGIN
  SELECT status INTO trip_status FROM public.trips WHERE id = _trip_id;
  IF trip_status IS NULL THEN RAISE EXCEPTION 'Viagem não encontrada'; END IF;
  IF trip_status <> 'open' THEN RAISE EXCEPTION 'Viagem encerrada'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := (item->>'product_id')::UUID;
    qtd := (item->>'quantidade')::NUMERIC;
    IF qtd <= 0 THEN CONTINUE; END IF;

    UPDATE public.products SET estoque = COALESCE(estoque,0) - qtd WHERE id = pid;

    INSERT INTO public.trip_items(trip_id, product_id, qtd_carregada)
      VALUES (_trip_id, pid, qtd)
      ON CONFLICT (trip_id, product_id) DO UPDATE
      SET qtd_carregada = public.trip_items.qtd_carregada + EXCLUDED.qtd_carregada;

    INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
      VALUES (pid, 'SAIDA', qtd, 'Carga em viagem', _trip_id, auth.uid());
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trip_close(_trip_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  saldo NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = _trip_id AND status = 'open') THEN
    RAISE EXCEPTION 'Viagem não está aberta';
  END IF;

  FOR rec IN SELECT * FROM public.trip_items WHERE trip_id = _trip_id LOOP
    saldo := rec.qtd_carregada - rec.qtd_vendida - rec.qtd_devolvida;
    IF saldo > 0 THEN
      UPDATE public.products SET estoque = COALESCE(estoque,0) + saldo WHERE id = rec.product_id;
      UPDATE public.trip_items SET qtd_devolvida = qtd_devolvida + saldo WHERE id = rec.id;
      INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
        VALUES (rec.product_id, 'ENTRADA', saldo, 'Retorno de viagem', _trip_id, auth.uid());
    END IF;
  END LOOP;

  UPDATE public.trips SET status = 'closed', closed_at = now() WHERE id = _trip_id;
END;
$$;
