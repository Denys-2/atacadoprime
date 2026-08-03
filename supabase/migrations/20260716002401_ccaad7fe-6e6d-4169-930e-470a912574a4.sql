
CREATE TABLE public.post_sale_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone TEXT,
  message TEXT,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED','SKIPPED','CANCELED')),
  sent_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_sale_status_send_at ON public.post_sale_messages(status, send_at);
CREATE INDEX idx_post_sale_order ON public.post_sale_messages(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_sale_messages TO authenticated;
GRANT ALL ON public.post_sale_messages TO service_role;

ALTER TABLE public.post_sale_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales staff can view post_sale_messages"
  ON public.post_sale_messages FOR SELECT TO authenticated
  USING (public.is_sales_staff(auth.uid()));

CREATE POLICY "Sales staff can manage post_sale_messages"
  ON public.post_sale_messages FOR ALL TO authenticated
  USING (public.is_sales_staff(auth.uid()))
  WITH CHECK (public.is_sales_staff(auth.uid()));

CREATE TRIGGER trg_post_sale_messages_updated
  BEFORE UPDATE ON public.post_sale_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função que enfileira mensagem de pós-venda quando pedido vira PAGO
CREATE OR REPLACE FUNCTION public.enqueue_post_sale_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_lead_id UUID;
BEGIN
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'PAGO') OR
    (TG_OP = 'UPDATE' AND NEW.status = 'PAGO' AND NEW.status IS DISTINCT FROM OLD.status)
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Busca telefone e lead vinculado
  SELECT l.id, COALESCE(l.whatsapp, c.phone)
    INTO v_lead_id, v_phone
    FROM public.companies c
    LEFT JOIN public.leads l ON l.company_id = c.id
   WHERE c.id = NEW.company_id
   LIMIT 1;

  IF v_phone IS NULL OR length(regexp_replace(v_phone, '\D', '', 'g')) < 8 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.post_sale_messages(order_id, company_id, lead_id, phone, send_at, status)
  VALUES (NEW.id, NEW.company_id, v_lead_id, v_phone, now() + INTERVAL '3 days', 'PENDING')
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_enqueue_post_sale
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_post_sale_message();
