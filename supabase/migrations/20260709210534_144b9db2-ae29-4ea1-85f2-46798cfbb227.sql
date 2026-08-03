-- Ao encerrar viagem: gera conta a pagar com custo das peças vendidas naquela viagem
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

  -- Retorno de estoque
  FOR rec IN SELECT * FROM public.trip_items WHERE trip_id = _trip_id LOOP
    saldo := rec.qtd_carregada - rec.qtd_vendida - rec.qtd_devolvida;
    IF saldo > 0 THEN
      UPDATE public.products SET estoque = COALESCE(estoque,0) + saldo WHERE id = rec.product_id;
      UPDATE public.trip_items SET qtd_devolvida = qtd_devolvida + saldo WHERE id = rec.id;
      INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
        VALUES (rec.product_id, 'ENTRADA', saldo, 'Retorno de viagem', _trip_id, auth.uid());
    END IF;
  END LOOP;

  -- Custo das peças vendidas na viagem => conta a pagar
  SELECT COALESCE(SUM(ti.qtd_vendida * COALESCE(p.preco_custo, 0)), 0)
    INTO custo_total
    FROM public.trip_items ti
    JOIN public.products p ON p.id = ti.product_id
   WHERE ti.trip_id = _trip_id;

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