CREATE OR REPLACE FUNCTION public.audit_log_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'SUCESSO', now()
  );
  RETURN COALESCE(NEW, OLD);
END; $function$;