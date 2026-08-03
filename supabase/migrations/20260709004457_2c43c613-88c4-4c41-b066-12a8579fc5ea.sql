
CREATE TABLE public.trip_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('COMBUSTIVEL','PEDAGIO','ALIMENTACAO','HOSPEDAGEM','MANUTENCAO','OUTROS')),
  descricao TEXT,
  valor NUMERIC NOT NULL CHECK (valor >= 0),
  forma_pagamento TEXT CHECK (forma_pagamento IN ('DINHEIRO','PIX','CARTAO','OUTRO')),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_expenses_trip ON public.trip_expenses(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_expenses TO authenticated;
GRANT ALL ON public.trip_expenses TO service_role;

ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedor vê despesas de suas viagens"
  ON public.trip_expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.vendedor_id = auth.uid())
    OR public.is_sales_staff(auth.uid())
  );

CREATE POLICY "Vendedor lança despesas em suas viagens"
  ON public.trip_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.vendedor_id = auth.uid() OR public.is_sales_staff(auth.uid())))
  );

CREATE POLICY "Vendedor edita despesas de suas viagens"
  ON public.trip_expenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.vendedor_id = auth.uid() OR public.is_sales_staff(auth.uid())))
  );

CREATE POLICY "Vendedor apaga despesas de suas viagens"
  ON public.trip_expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.vendedor_id = auth.uid() OR public.is_sales_staff(auth.uid())))
  );

CREATE TRIGGER trg_trip_expenses_updated_at
  BEFORE UPDATE ON public.trip_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
