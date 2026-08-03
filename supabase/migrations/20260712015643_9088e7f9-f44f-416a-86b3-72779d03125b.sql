CREATE OR REPLACE FUNCTION public.audit_log_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _old JSONB; _new JSONB; _action TEXT;
BEGIN
  IF TG_OP='INSERT' THEN _action:='INSERT'; _new:=to_jsonb(NEW);
  ELSIF TG_OP='UPDATE' THEN
    _action:='UPDATE'; _old:=to_jsonb(OLD); _new:=to_jsonb(NEW);
    IF _old = _new THEN RETURN NEW; END IF;
  ELSIF TG_OP='DELETE' THEN _action:='DELETE'; _old:=to_jsonb(OLD);
  END IF;
  INSERT INTO public.audit_logs(user_id, acao, entidade, entidade_id, payload, resultado, created_at)
  VALUES (
    auth.uid(), _action, TG_TABLE_NAME,
    COALESCE((_new->>'id'), (_old->>'id')),
    jsonb_build_object('old', _old, 'new', _new),
    'OK', now()
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE FUNCTION public.audit_products_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP='UPDATE' AND (
    COALESCE(OLD.preco_custo,0) IS DISTINCT FROM COALESCE(NEW.preco_custo,0)
    OR COALESCE(OLD.preco_unitario,0) IS DISTINCT FROM COALESCE(NEW.preco_unitario,0)
    OR COALESCE(OLD.preco_pacote,0) IS DISTINCT FROM COALESCE(NEW.preco_pacote,0)
  ) THEN
    INSERT INTO public.audit_logs(user_id, acao, entidade, entidade_id, payload, resultado)
    VALUES (auth.uid(), 'PRICE_CHANGE', 'products', NEW.id::text,
      jsonb_build_object(
        'old', jsonb_build_object('preco_custo', OLD.preco_custo, 'preco_unitario', OLD.preco_unitario, 'preco_pacote', OLD.preco_pacote),
        'new', jsonb_build_object('preco_custo', NEW.preco_custo, 'preco_unitario', NEW.preco_unitario, 'preco_pacote', NEW.preco_pacote)
      ),
      'OK');
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.audit_log_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_products_price() FROM PUBLIC, anon;