
-- ================================================================
-- B2: Unificar trip_close v1 e v2 (v1 delega para v2)
-- ================================================================
CREATE OR REPLACE FUNCTION public.trip_close(_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.trip_close_v2(_trip_id, true);
END;
$function$;

-- ================================================================
-- B3a: Corrigir policies USING(true) / WITH CHECK(true) permissivas
-- ================================================================

-- bank_transfers: restringir a admin/gerente (era ALL com true/true)
DROP POLICY IF EXISTS "Authenticated can manage bank transfers" ON public.bank_transfers;
CREATE POLICY "Managers can manage bank transfers"
  ON public.bank_transfers
  FOR ALL
  TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

-- push_subscriptions: restringir UPDATE (qual=true era brecha para reassociar linhas)
DROP POLICY IF EXISTS "public subs update" ON public.push_subscriptions;
CREATE POLICY "subs update own or anonymous"
  ON public.push_subscriptions
  FOR UPDATE
  USING (
    ((auth.uid() IS NULL) AND (user_id IS NULL))
    OR ((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (user_id IS NULL)))
  )
  WITH CHECK (
    ((auth.uid() IS NULL) AND (user_id IS NULL))
    OR ((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (user_id IS NULL)))
  );

-- push_deliveries: apertar WITH CHECK (só permite marcar clicked_at, não zerar de volta)
DROP POLICY IF EXISTS "anon mark click once" ON public.push_deliveries;
CREATE POLICY "anon mark click once"
  ON public.push_deliveries
  FOR UPDATE
  USING (clicked_at IS NULL)
  WITH CHECK (clicked_at IS NOT NULL);

-- ================================================================
-- B3b: Revogar EXECUTE em SECURITY DEFINER internos (triggers/helpers)
-- Só funções chamadas via .rpc() do client mantêm EXECUTE.
-- ================================================================

-- Triggers (só o owner do trigger executa, cliente nunca precisa chamar)
REVOKE EXECUTE ON FUNCTION public.order_cancel_reverse() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_sync_financials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_lead_stage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wa_touch_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.workflow_log_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.products_set_ean13() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.products_set_sku() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Helpers internos (só chamados por outras funções do banco)
REVOKE EXECUTE ON FUNCTION public.trip_recalculate_items(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trip_apply_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trip_record_sale(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stock_apply_delta(uuid, numeric, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_ean13(text) FROM PUBLIC, anon, authenticated;

-- RPCs públicas/autenticadas continuam callable:
-- has_role, is_manager, is_sales_staff, order_create_atomic,
-- trip_close, trip_close_v2, trip_load_items, stock_deduct_open_trips,
-- finance_kpis, bank_account_balance, get_shared_cart
GRANT EXECUTE ON FUNCTION public.order_create_atomic(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_close(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_close_v2(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_load_items(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_deduct_open_trips() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_kpis(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bank_account_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_cart(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sales_staff(uuid) TO authenticated;
