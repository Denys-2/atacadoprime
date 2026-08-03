
-- Enums
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('NOVO_LEAD','CONTATO_FEITO','NEGOCIACAO','AGUARDANDO_RETORNO','CLIENTE','PERDIDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_segmento AS ENUM ('CHAVEIRO','AUTO_ELETRICA','CENTRO_AUTOMOTIVO','LOJA_DE_SOM','AUTO_PECAS','INSTALADOR_DE_ALARMES','OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_activity_tipo AS ENUM ('LIGACAO','WHATSAPP','VISITA','PROPOSTA','RETORNO','OBSERVACAO','PEDIDO','CADASTRO','MUDANCA_ETAPA','OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_task_status AS ENUM ('PENDENTE','CONCLUIDA','CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  contato TEXT NOT NULL,
  whatsapp TEXT,
  telefone TEXT,
  email TEXT,
  cidade TEXT,
  estado TEXT,
  segmento public.lead_segmento NOT NULL DEFAULT 'OUTRO',
  status public.lead_status NOT NULL DEFAULT 'NOVO_LEAD',
  score INT NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  observacoes TEXT,
  ultimo_contato TIMESTAMPTZ,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage leads" ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_responsavel ON public.leads(responsavel_id);

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- lead_activities
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo public.lead_activity_tipo NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead_activities" ON public.lead_activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id);

-- lead_tasks
CREATE TABLE public.lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data DATE,
  hora TIME,
  status public.lead_task_status NOT NULL DEFAULT 'PENDENTE',
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tasks TO authenticated;
GRANT ALL ON public.lead_tasks TO service_role;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead_tasks" ON public.lead_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_lead_tasks_lead ON public.lead_tasks(lead_id);
CREATE INDEX idx_lead_tasks_data ON public.lead_tasks(data);

CREATE TRIGGER trg_lead_tasks_updated BEFORE UPDATE ON public.lead_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- lead_notes
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_notes TO authenticated;
GRANT ALL ON public.lead_notes TO service_role;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead_notes" ON public.lead_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_lead_notes_lead ON public.lead_notes(lead_id);

-- lead_stage_history
CREATE TABLE public.lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  etapa_anterior public.lead_status,
  nova_etapa public.lead_status NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_stage_history TO authenticated;
GRANT ALL ON public.lead_stage_history TO service_role;
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead_stage_history" ON public.lead_stage_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_lead_stage_history_lead ON public.lead_stage_history(lead_id);

-- Trigger: log de mudanças de etapa + atividade automática
CREATE OR REPLACE FUNCTION public.log_lead_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_stage_history(lead_id, etapa_anterior, nova_etapa, user_id)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
    INSERT INTO public.lead_activities(lead_id, tipo, descricao, created_by)
    VALUES (NEW.id, 'CADASTRO', 'Lead cadastrado', auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_stage_history(lead_id, etapa_anterior, nova_etapa, user_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
    INSERT INTO public.lead_activities(lead_id, tipo, descricao, created_by)
    VALUES (NEW.id, 'MUDANCA_ETAPA', 'Etapa: ' || OLD.status || ' -> ' || NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_log_lead_stage
  AFTER INSERT OR UPDATE OF status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage();
