
DROP POLICY IF EXISTS "Public can read shared cart by token" ON public.shared_carts;

CREATE OR REPLACE FUNCTION public.get_shared_cart(_token text)
RETURNS SETOF public.shared_carts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.shared_carts
  WHERE token = _token
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_shared_cart(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_cart(text) TO anon, authenticated;
