
-- C5: Ajuste atômico de estoque + registro de movimento
CREATE OR REPLACE FUNCTION public.stock_apply_delta(
  _product_id UUID,
  _delta NUMERIC,           -- positivo = ENTRADA / negativo = SAIDA
  _tipo TEXT,               -- 'ENTRADA' | 'SAIDA' | 'AJUSTE'
  _motivo TEXT,
  _ref UUID DEFAULT NULL,
  _allow_negative BOOLEAN DEFAULT FALSE
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo NUMERIC;
BEGIN
  IF _delta = 0 THEN
    SELECT COALESCE(estoque,0) INTO novo FROM public.products WHERE id = _product_id;
    RETURN novo;
  END IF;

  -- UPDATE atômico (lock de linha implícito). RETURNING evita SELECT prévio.
  UPDATE public.products
     SET estoque = COALESCE(estoque,0) + _delta,
         updated_at = now()
   WHERE id = _product_id
  RETURNING estoque INTO novo;

  IF novo IS NULL THEN
    RAISE EXCEPTION 'Produto % não encontrado', _product_id;
  END IF;

  IF novo < 0 AND NOT _allow_negative THEN
    -- reverter e abortar
    UPDATE public.products SET estoque = COALESCE(estoque,0) - _delta WHERE id = _product_id;
    RAISE EXCEPTION 'Estoque insuficiente para o produto (saldo ficaria %). Operação cancelada.', novo;
  END IF;

  INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
  VALUES (_product_id, _tipo, ABS(_delta), _motivo, _ref, auth.uid());

  RETURN novo;
END;
$$;

REVOKE ALL ON FUNCTION public.stock_apply_delta(UUID,NUMERIC,TEXT,TEXT,UUID,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_apply_delta(UUID,NUMERIC,TEXT,TEXT,UUID,BOOLEAN) TO authenticated, service_role;
