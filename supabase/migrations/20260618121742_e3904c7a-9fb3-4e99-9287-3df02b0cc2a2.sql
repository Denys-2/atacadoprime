
CREATE TABLE public.route_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  distancia_real NUMERIC,
  tempo_real INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_route_execution_route ON public.route_execution(route_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_execution TO authenticated;
GRANT ALL ON public.route_execution TO service_role;
ALTER TABLE public.route_execution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage route execution" ON public.route_execution FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.route_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  visitas INTEGER NOT NULL DEFAULT 0,
  pedidos INTEGER NOT NULL DEFAULT 0,
  valor_vendido NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_route_metrics_route ON public.route_metrics(route_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_metrics TO authenticated;
GRANT ALL ON public.route_metrics TO service_role;
ALTER TABLE public.route_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage route metrics" ON public.route_metrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
