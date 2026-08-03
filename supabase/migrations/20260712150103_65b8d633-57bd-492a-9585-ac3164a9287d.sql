DROP POLICY IF EXISTS "subs can refresh browser subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "staff can refresh browser subscriptions" ON public.push_subscriptions;

CREATE POLICY "subs can refresh browser subscription"
ON public.push_subscriptions
FOR UPDATE
TO anon, authenticated
USING (
  user_id IS NULL
  OR auth.uid() = user_id
)
WITH CHECK (
  user_id IS NULL
  OR auth.uid() = user_id
);

CREATE POLICY "staff can refresh browser subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (public.is_sales_staff(auth.uid()))
WITH CHECK (public.is_sales_staff(auth.uid()));