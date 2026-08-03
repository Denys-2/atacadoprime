
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.visit_resultado AS ENUM ('COMPROU','NEGOCIACAO','SEM_INTERESSE','RETORNAR','AUSENTE','OUTRO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.visit_task_status AS ENUM ('ABERTA','CONCLUIDA','CANCELADA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.visit_photo_tipo AS ENUM ('FACHADA','ESTOQUE','PRODUTO','DOCUMENTO','OUTRO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.route_status AS ENUM ('PLANEJADA','EM_ANDAMENTO','CONCLUIDA','CANCELADA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.shared_cart_status AS ENUM ('PENDENTE','ABERTO','CONVERTIDO','EXPIRADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- VISITS
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_at TIMESTAMPTZ DEFAULT now(),
  checkout_at TIMESTAMPTZ,
  duracao_min INT,
  checkin_lat NUMERIC(10,6),
  checkin_lng NUMERIC(10,6),
  checkout_lat NUMERIC(10,6),
  checkout_lng NUMERIC(10,6),
  resultado public.visit_resultado,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage visits" ON public.visits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ON public.visits(user_id);
CREATE INDEX ON public.visits(company_id);
CREATE INDEX ON public.visits(lead_id);
CREATE INDEX ON public.visits(checkin_at DESC);

-- VISIT PHOTOS
CREATE TABLE public.visit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  tipo public.visit_photo_tipo NOT NULL DEFAULT 'OUTRO',
  legenda TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_photos TO authenticated;
GRANT ALL ON public.visit_photos TO service_role;
ALTER TABLE public.visit_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage visit photos" ON public.visit_photos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.visit_photos(visit_id);

-- ROUTE PLANS
CREATE TABLE public.route_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  cidade TEXT,
  estado TEXT,
  status public.route_status NOT NULL DEFAULT 'PLANEJADA',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_plans TO authenticated;
GRANT ALL ON public.route_plans TO service_role;
ALTER TABLE public.route_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage routes" ON public.route_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_routes_updated BEFORE UPDATE ON public.route_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ON public.route_plans(user_id, data DESC);

-- ROUTE ITEMS
CREATE TABLE public.route_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.route_plans(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ordem INT NOT NULL DEFAULT 0,
  visitado BOOLEAN NOT NULL DEFAULT false,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_items TO authenticated;
GRANT ALL ON public.route_items TO service_role;
ALTER TABLE public.route_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage route items" ON public.route_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.route_items(route_id, ordem);

-- VISIT TASKS
CREATE TABLE public.visit_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT,
  status public.visit_task_status NOT NULL DEFAULT 'ABERTA',
  due_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_tasks TO authenticated;
GRANT ALL ON public.visit_tasks TO service_role;
ALTER TABLE public.visit_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage visit tasks" ON public.visit_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_vtasks_updated BEFORE UPDATE ON public.visit_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ON public.visit_tasks(visit_id);

-- SHARED CARTS
CREATE TABLE public.shared_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  status public.shared_cart_status NOT NULL DEFAULT 'PENDENTE',
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_carts TO authenticated;
GRANT SELECT ON public.shared_carts TO anon;
GRANT ALL ON public.shared_carts TO service_role;
ALTER TABLE public.shared_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shared carts" ON public.shared_carts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Public can read shared cart by token" ON public.shared_carts FOR SELECT TO anon
  USING (true);
CREATE TRIGGER trg_scarts_updated BEFORE UPDATE ON public.shared_carts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ON public.shared_carts(token);
