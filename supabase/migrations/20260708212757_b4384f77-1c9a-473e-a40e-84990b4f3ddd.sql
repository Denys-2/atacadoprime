
ALTER TABLE public.push_subscriptions ALTER COLUMN user_id DROP NOT NULL;

GRANT INSERT, UPDATE ON public.push_subscriptions TO anon;

CREATE POLICY "anon subs insert" ON public.push_subscriptions
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "anon subs update by endpoint" ON public.push_subscriptions
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
