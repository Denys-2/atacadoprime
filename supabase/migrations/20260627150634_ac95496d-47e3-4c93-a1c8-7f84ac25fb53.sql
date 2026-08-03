
-- push_subscriptions: dispositivos inscritos
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX push_subs_user_idx ON public.push_subscriptions(user_id) WHERE revoked_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs select" ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_sales_staff(auth.uid()));
CREATE POLICY "own subs insert" ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own subs update" ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own subs delete" ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- push_campaigns
CREATE TYPE push_campaign_status AS ENUM ('DRAFT','SENDING','DONE','FAILED');
CREATE TABLE public.push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  imagem_url text,
  link_url text,
  segmento text NOT NULL DEFAULT 'all',
  segmento_valor text,
  status push_campaign_status NOT NULL DEFAULT 'DRAFT',
  scheduled_at timestamptz,
  sent_at timestamptz,
  total int NOT NULL DEFAULT 0,
  enviados int NOT NULL DEFAULT 0,
  falhas int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_campaigns TO authenticated;
GRANT ALL ON public.push_campaigns TO service_role;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff push campaigns" ON public.push_campaigns FOR ALL TO authenticated
  USING (public.is_sales_staff(auth.uid())) WITH CHECK (public.is_sales_staff(auth.uid()));

-- push_deliveries
CREATE TABLE public.push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  user_id uuid,
  status text NOT NULL,
  error text,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_del_campaign_idx ON public.push_deliveries(campaign_id);
GRANT SELECT, INSERT, UPDATE ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff push deliveries select" ON public.push_deliveries FOR SELECT TO authenticated
  USING (public.is_sales_staff(auth.uid()));
CREATE POLICY "staff push deliveries write" ON public.push_deliveries FOR INSERT TO authenticated
  WITH CHECK (public.is_sales_staff(auth.uid()));
-- click webhook is anon: allow anon update of clicked_at only
GRANT UPDATE (clicked_at) ON public.push_deliveries TO anon;
CREATE POLICY "anon mark click" ON public.push_deliveries FOR UPDATE TO anon
  USING (true) WITH CHECK (true);
