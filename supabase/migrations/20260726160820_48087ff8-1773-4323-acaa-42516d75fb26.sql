DROP FUNCTION IF EXISTS public.get_shared_cart(text);

CREATE FUNCTION public.get_shared_cart(_token text)
RETURNS TABLE (
  items jsonb,
  subtotal numeric,
  observacoes text,
  status public.shared_cart_status,
  expires_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT sc.items, sc.subtotal, sc.observacoes, sc.status, sc.expires_at
  FROM public.shared_carts sc
  WHERE sc.token = _token
    AND (sc.expires_at IS NULL OR sc.expires_at > now())
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.get_shared_cart(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_cart(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.bank_account_balance(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.bank_account_balance(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.crm_sync_lead_for_company(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_sync_lead_for_company(uuid, uuid) TO authenticated, service_role;