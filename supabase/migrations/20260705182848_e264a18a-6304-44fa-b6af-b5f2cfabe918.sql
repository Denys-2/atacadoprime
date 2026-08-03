
-- 1. Restringir política anônima de push_deliveries: só rows sem clique + só coluna clicked_at
DROP POLICY IF EXISTS "anon mark click" ON public.push_deliveries;

REVOKE UPDATE ON public.push_deliveries FROM anon;
GRANT UPDATE (clicked_at) ON public.push_deliveries TO anon;

CREATE POLICY "anon mark click once"
ON public.push_deliveries
FOR UPDATE
TO anon
USING (clicked_at IS NULL)
WITH CHECK (true);

-- 2. Revogar EXECUTE anônimo em funções SECURITY DEFINER não-trigger
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_sales_staff(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_sales_staff(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.trip_load_items(uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.trip_load_items(uuid, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.trip_close(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.trip_close(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.trip_record_sale(uuid, uuid, numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.trip_record_sale(uuid, uuid, numeric) TO authenticated, service_role;

-- Funções de trigger não são chamadas via API, revogar de todos os roles clientes
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_order_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_lead_stage() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.workflow_log_after_insert() FROM anon, authenticated, public;
