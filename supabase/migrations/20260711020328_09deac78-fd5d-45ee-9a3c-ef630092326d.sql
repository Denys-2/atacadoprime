REVOKE EXECUTE ON FUNCTION public.trip_recalculate_items(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trip_recalculate_items(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.trip_recalculate_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_recalculate_items(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.trip_apply_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trip_apply_order(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.trip_apply_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_apply_order(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.trip_close(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trip_close(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.trip_close(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_close(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.trip_close_v2(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trip_close_v2(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.trip_close_v2(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trip_close_v2(uuid, boolean) TO service_role;