
CREATE OR REPLACE FUNCTION public.trip_recalculate_items(_trip_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sold RECORD;
BEGIN
  -- Zera qtd_vendida de itens que não têm mais vendas (evita resíduo de cancelamentos antigos)
  UPDATE public.trip_items ti
     SET qtd_vendida = 0,
         updated_at = now()
   WHERE ti.trip_id = _trip_id
     AND ti.qtd_vendida > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.orders o
       JOIN public.order_items oi ON oi.order_id = o.id
       WHERE o.trip_id = _trip_id
         AND o.status <> 'CANCELADO'
         AND oi.product_id = ti.product_id
     );

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
    -- IMPORTANTE: NÃO inflar qtd_carregada. Vendas sem carga => saldo negativo,
    -- que é o sinal correto de sobrevenda.
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
      0,                        -- carregada = 0 quando peça não foi carregada
      sold.quantidade_vendida,
      0
    )
    ON CONFLICT (trip_id, product_id) DO UPDATE
      SET qtd_vendida = EXCLUDED.qtd_vendida,
          updated_at = now();
    -- qtd_carregada preservado como está (não é alterado)
  END LOOP;
END;
$function$;
