
CREATE TYPE public.order_origem AS ENUM ('PORTAL','VISITA','WHATSAPP');
CREATE TYPE public.order_status AS ENUM (
  'PENDENTE','AGUARDANDO_PAGAMENTO','PAGO','EM_SEPARACAO','ENVIADO','ENTREGUE','CANCELADO'
);
CREATE TYPE public.compra_tipo AS ENUM ('UNITARIO','PACOTE');
CREATE TYPE public.payment_tipo AS ENUM ('PIX','CARTAO');
CREATE TYPE public.payment_status AS ENUM ('PENDENTE','APROVADO','RECUSADO','CANCELADO','ESTORNADO');

-- ===== ORDERS =====
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  origem public.order_origem NOT NULL DEFAULT 'PORTAL',
  status public.order_status NOT NULL DEFAULT 'PENDENTE',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  frete NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_company ON public.orders(company_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders self read" ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = orders.company_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "orders self insert" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = orders.company_id AND c.owner_id = auth.uid() AND c.status = 'approved')
  );
CREATE POLICY "orders admin update" ON public.orders FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = orders.company_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "orders admin delete" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== ORDER ITEMS =====
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  tipo_compra public.compra_tipo NOT NULL DEFAULT 'UNITARIO',
  quantidade INT NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(12,2) NOT NULL,
  preco_final NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items follow order" ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (public.has_role(auth.uid(), 'admin')
           OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = o.company_id AND c.owner_id = auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (public.has_role(auth.uid(), 'admin')
           OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = o.company_id AND c.owner_id = auth.uid()))
  ));

-- ===== PAYMENTS =====
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'mercado_pago',
  tipo public.payment_tipo NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'PENDENTE',
  transaction_id TEXT,
  qr_code TEXT,
  qr_code_base64 TEXT,
  valor NUMERIC(12,2) NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON public.payments(order_id);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments follow order" ON public.payments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id
      AND (public.has_role(auth.uid(), 'admin')
           OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = o.company_id AND c.owner_id = auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id
      AND (public.has_role(auth.uid(), 'admin')
           OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = o.company_id AND c.owner_id = auth.uid()))
  ));
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== ORDER HISTORY =====
CREATE TABLE public.order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  observacao TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_history_order ON public.order_history(order_id);
GRANT SELECT, INSERT ON public.order_history TO authenticated;
GRANT ALL ON public.order_history TO service_role;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_history follow order" ON public.order_history FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_history.order_id
      AND (public.has_role(auth.uid(), 'admin')
           OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = o.company_id AND c.owner_id = auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_history.order_id
      AND (public.has_role(auth.uid(), 'admin')
           OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = o.company_id AND c.owner_id = auth.uid()))
  ));

-- auto-create history on order create / status change
CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_history(order_id, status, observacao, user_id)
    VALUES (NEW.id, NEW.status, 'Pedido criado', NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_history(order_id, status, observacao, user_id)
    VALUES (NEW.id, NEW.status, 'Status atualizado', auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_orders_history AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

-- ===== SAVED ORDERS (favorite carts) =====
CREATE TABLE public.saved_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_orders_company ON public.saved_orders(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_orders TO authenticated;
GRANT ALL ON public.saved_orders TO service_role;
ALTER TABLE public.saved_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_orders self" ON public.saved_orders FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = saved_orders.company_id AND c.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = saved_orders.company_id AND c.owner_id = auth.uid())
  );

CREATE TABLE public.saved_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_order_id UUID NOT NULL REFERENCES public.saved_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tipo_compra public.compra_tipo NOT NULL DEFAULT 'UNITARIO',
  quantidade INT NOT NULL CHECK (quantidade > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_order_items ON public.saved_order_items(saved_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_order_items TO authenticated;
GRANT ALL ON public.saved_order_items TO service_role;
ALTER TABLE public.saved_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_order_items follow parent" ON public.saved_order_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.saved_orders s
    JOIN public.companies c ON c.id = s.company_id
    WHERE s.id = saved_order_items.saved_order_id
      AND (public.has_role(auth.uid(), 'admin') OR c.owner_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.saved_orders s
    JOIN public.companies c ON c.id = s.company_id
    WHERE s.id = saved_order_items.saved_order_id
      AND (public.has_role(auth.uid(), 'admin') OR c.owner_id = auth.uid())
  ));
