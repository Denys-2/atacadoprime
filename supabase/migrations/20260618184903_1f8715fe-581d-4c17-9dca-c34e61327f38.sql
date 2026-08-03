
CREATE TABLE public.payment_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bandeira TEXT NOT NULL UNIQUE,
  debito NUMERIC(5,2),
  credito_avista NUMERIC(5,2) NOT NULL DEFAULT 0,
  credito_2_6 NUMERIC(5,2) NOT NULL DEFAULT 0,
  credito_7_12 NUMERIC(5,2) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_fees TO authenticated;
GRANT ALL ON public.payment_fees TO service_role;
ALTER TABLE public.payment_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view fees" ON public.payment_fees FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage fees" ON public.payment_fees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payment_fees_updated BEFORE UPDATE ON public.payment_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value NUMERIC(8,4) NOT NULL DEFAULT 0,
  label TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view settings" ON public.payment_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage settings" ON public.payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payment_settings_updated BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.payment_fees (bandeira, debito, credito_avista, credito_2_6, credito_7_12, ordem) VALUES
  ('Visa', 1.04, 2.27, 2.50, 2.91, 1),
  ('Mastercard', 0.95, 2.16, 2.71, 2.89, 2),
  ('Elo', 1.55, 2.82, 2.97, 3.41, 3),
  ('American Express', NULL, 3.24, 3.84, 4.14, 4),
  ('Hipercard', NULL, 0.00, 0.00, 0.00, 5);

INSERT INTO public.payment_settings (key, value, label) VALUES
  ('antecipacao_mensal', 2.09, 'Taxa de antecipação de vendas (% a.m.)');
