CREATE TABLE public.product_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  cidade TEXT,
  observacao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA','MEDIA','ALTA')),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','COMPRADO','DESCARTADO')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_requests_status ON public.product_requests(status);
CREATE INDEX idx_product_requests_product ON public.product_requests(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_requests TO authenticated;
GRANT ALL ON public.product_requests TO service_role;

ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe pode ver demandas" ON public.product_requests
  FOR SELECT TO authenticated USING (public.is_sales_staff(auth.uid()) OR public.has_role(auth.uid(),'operador'::app_role));

CREATE POLICY "Equipe pode criar demandas" ON public.product_requests
  FOR INSERT TO authenticated WITH CHECK (public.is_sales_staff(auth.uid()) OR public.has_role(auth.uid(),'operador'::app_role));

CREATE POLICY "Equipe pode atualizar demandas" ON public.product_requests
  FOR UPDATE TO authenticated USING (public.is_sales_staff(auth.uid()) OR public.has_role(auth.uid(),'operador'::app_role));

CREATE POLICY "Gerente pode apagar demandas" ON public.product_requests
  FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

CREATE TRIGGER trg_product_requests_updated_at
  BEFORE UPDATE ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();