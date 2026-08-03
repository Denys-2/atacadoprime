CREATE OR REPLACE FUNCTION public.audit_products_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      'SUCESSO');
  END IF;
  RETURN NEW;
END; $function$;