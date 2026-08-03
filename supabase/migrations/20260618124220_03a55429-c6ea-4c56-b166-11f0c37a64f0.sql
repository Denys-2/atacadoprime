
-- customer_notifications
CREATE TABLE public.customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('PEDIDOS','FINANCEIRO','PROMOCOES','CAMPANHAS','SISTEMA')),
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notifications TO authenticated;
GRANT ALL ON public.customer_notifications TO service_role;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.customer_notifications FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_cust_notif_user ON public.customer_notifications(user_id, created_at DESC);

-- customer_favorites
CREATE TABLE public.customer_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_favorites TO authenticated;
GRANT ALL ON public.customer_favorites TO service_role;
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites" ON public.customer_favorites FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- customer_documents
CREATE TABLE public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('COMPROVANTE','NOTA_FISCAL','PIX','MANUAL','CATALOGO','OUTRO')),
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_documents TO authenticated;
GRANT ALL ON public.customer_documents TO service_role;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs" ON public.customer_documents FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- customer_support
CREATE TABLE public.customer_support (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'PORTAL' CHECK (canal IN ('PORTAL','WHATSAPP','EMAIL')),
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','EM_ATENDIMENTO','RESOLVIDO','CANCELADO')),
  prioridade TEXT NOT NULL DEFAULT 'NORMAL' CHECK (prioridade IN ('BAIXA','NORMAL','ALTA','URGENTE')),
  resposta TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_support TO authenticated;
GRANT ALL ON public.customer_support TO service_role;
ALTER TABLE public.customer_support ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own support read" ON public.customer_support FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own support insert" ON public.customer_support FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin support update" ON public.customer_support FOR UPDATE
  USING (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);
CREATE TRIGGER trg_customer_support_updated BEFORE UPDATE ON public.customer_support
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- customer_rewards
CREATE TABLE public.customer_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pontos INTEGER NOT NULL DEFAULT 0,
  cashback_disponivel NUMERIC(12,2) NOT NULL DEFAULT 0,
  cashback_acumulado NUMERIC(12,2) NOT NULL DEFAULT 0,
  nivel TEXT NOT NULL DEFAULT 'BRONZE' CHECK (nivel IN ('BRONZE','PRATA','OURO','DIAMANTE')),
  beneficios JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_rewards TO authenticated;
GRANT ALL ON public.customer_rewards TO service_role;
ALTER TABLE public.customer_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rewards" ON public.customer_rewards FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_customer_rewards_updated BEFORE UPDATE ON public.customer_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
