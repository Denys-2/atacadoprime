
DROP POLICY IF EXISTS "anon subs insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "anon subs update by endpoint" ON public.push_subscriptions;

CREATE POLICY "public subs insert" ON public.push_subscriptions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL))
  );

CREATE POLICY "public subs update" ON public.push_subscriptions
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL))
  );

DROP POLICY IF EXISTS "own subs insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "own subs update" ON public.push_subscriptions;
