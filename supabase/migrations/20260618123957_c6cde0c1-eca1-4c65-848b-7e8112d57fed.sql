REVOKE EXECUTE ON FUNCTION public.workflow_log_after_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.workflow_log_after_insert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.workflow_log_after_insert() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_log_after_insert() TO service_role;