CREATE TABLE public.installment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelas INT NOT NULL UNIQUE CHECK (parcelas BETWEEN 1 AND 12),
  multiplicador NUMERIC(6,4) NOT NULL DEFAULT 1.0000,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.installment_plans TO anon, authenticated;
GRANT ALL ON public.installment_plans TO authenticated;
GRANT ALL ON public.installment_plans TO service_role;
ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read installment plans" ON public.installment_plans FOR SELECT USING (true);
CREATE POLICY "Admins manage installment plans" ON public.installment_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_installment_plans_updated_at BEFORE UPDATE ON public.installment_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.installment_plans (parcelas, multiplicador) VALUES
  (1, 1.0000),(2, 1.0300),(3, 1.0500),(4, 1.0700),(5, 1.0900),(6, 1.1100)
ON CONFLICT (parcelas) DO NOTHING;