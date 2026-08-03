CREATE OR REPLACE FUNCTION public.stock_apply_delta(_product_id uuid, _delta numeric, _tipo text, _motivo text, _ref uuid DEFAULT NULL::uuid, _allow_negative boolean DEFAULT false)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  novo NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_sales_staff(auth.uid())
     AND NOT public.has_role(auth.uid(), 'operador'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para movimentar estoque';
  END IF;

  IF _delta = 0 THEN
    SELECT COALESCE(estoque,0) INTO novo FROM public.products WHERE id = _product_id;
    RETURN novo;
  END IF;

  UPDATE public.products
     SET estoque = COALESCE(estoque,0) + _delta,
         updated_at = now()
   WHERE id = _product_id
  RETURNING estoque INTO novo;

  IF novo IS NULL THEN
    RAISE EXCEPTION 'Produto % não encontrado', _product_id;
  END IF;

  IF novo < 0 AND NOT _allow_negative THEN
    UPDATE public.products SET estoque = COALESCE(estoque,0) - _delta WHERE id = _product_id;
    RAISE EXCEPTION 'Estoque insuficiente para o produto (saldo ficaria %). Operação cancelada.', novo;
  END IF;

  INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
  VALUES (_product_id, _tipo, ABS(_delta), _motivo, _ref, auth.uid());

  RETURN novo;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.stock_apply_delta(uuid, numeric, text, text, uuid, boolean) TO authenticated;