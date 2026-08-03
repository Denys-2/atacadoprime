GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.push_subscriptions TO anon;
GRANT ALL ON public.push_subscriptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_campaigns TO authenticated;
GRANT ALL ON public.push_campaigns TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_deliveries TO service_role;

DROP POLICY IF EXISTS "subs update own or anonymous" ON public.push_subscriptions;
CREATE POLICY "subs can refresh browser subscription"
ON public.push_subscriptions
FOR UPDATE
TO anon, authenticated
USING (
  user_id IS NULL
  OR auth.uid() = user_id
  OR public.is_sales_staff(auth.uid())
)
WITH CHECK (
  user_id IS NULL
  OR auth.uid() = user_id
  OR public.is_sales_staff(auth.uid())
);