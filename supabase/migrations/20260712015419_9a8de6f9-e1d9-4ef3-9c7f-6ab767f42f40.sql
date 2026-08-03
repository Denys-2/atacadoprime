ALTER VIEW public.products_below_min SET (security_invoker = true);
ALTER VIEW public.sales_targets_progress SET (security_invoker = true);
ALTER VIEW public.lead_funnel_metrics SET (security_invoker = true);

REVOKE ALL ON FUNCTION public.audit_log_change() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_products_price() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inventory_apply_adjustments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_apply_adjustments(uuid) TO authenticated;