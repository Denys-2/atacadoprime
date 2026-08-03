-- Enums
CREATE TYPE campaign_status AS ENUM ('RASCUNHO','AGENDADA','EM_EXECUCAO','FINALIZADA','CANCELADA');
CREATE TYPE campaign_model AS ENUM ('VISITA','REPOSICAO','REATIVACAO','LANCAMENTO','PROMOCAO','POS_VENDA');
CREATE TYPE campaign_contact_stage AS ENUM ('ENVIADA','VISUALIZADA','RESPONDEU','INTERESSADO','PRE_PEDIDO','VISITA_AGENDADA','PEDIDO');
CREATE TYPE campaign_response_class AS ENUM ('INTERESSADO','NAO_INTERESSADO','SOLICITOU_RETORNO','ORCAMENTO','VISITA','PEDIDO','SEM_RESPOSTA');

-- 1) commercial_campaigns
CREATE TABLE public.commercial_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  modelo campaign_model NOT NULL DEFAULT 'VISITA',
  cidade TEXT,
  estado TEXT,
  raio_km INTEGER DEFAULT 50,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_inicio DATE,
  data_fim DATE,
  objetivo TEXT,
  observacoes TEXT,
  status campaign_status NOT NULL DEFAULT 'RASCUNHO',
  meta_valor NUMERIC(12,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_campaigns TO authenticated;
GRANT ALL ON public.commercial_campaigns TO service_role;
ALTER TABLE public.commercial_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage campaigns" ON public.commercial_campaigns FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_commercial_campaigns_updated BEFORE UPDATE ON public.commercial_campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) campaign_contacts
CREATE TABLE public.campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.commercial_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_name TEXT,
  phone TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  stage campaign_contact_stage NOT NULL DEFAULT 'ENVIADA',
  classification campaign_response_class,
  last_message_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (lead_id IS NOT NULL OR company_id IS NOT NULL)
);
CREATE INDEX idx_camp_contacts_campaign ON public.campaign_contacts(campaign_id);
CREATE INDEX idx_camp_contacts_phone ON public.campaign_contacts(phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_contacts TO authenticated;
GRANT ALL ON public.campaign_contacts TO service_role;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage camp contacts" ON public.campaign_contacts FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_camp_contacts_updated BEFORE UPDATE ON public.campaign_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) campaign_messages (agendamento por dia relativo)
CREATE TABLE public.campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.commercial_campaigns(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  dia_relativo INTEGER NOT NULL DEFAULT 0, -- -7, -3, -1, 0
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  enviados INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_camp_messages_campaign ON public.campaign_messages(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_messages TO authenticated;
GRANT ALL ON public.campaign_messages TO service_role;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage camp messages" ON public.campaign_messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_camp_messages_updated BEFORE UPDATE ON public.campaign_messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) campaign_responses
CREATE TABLE public.campaign_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.commercial_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.campaign_contacts(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.campaign_messages(id) ON DELETE SET NULL,
  classification campaign_response_class NOT NULL DEFAULT 'SEM_RESPOSTA',
  resposta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_camp_responses_campaign ON public.campaign_responses(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_responses TO authenticated;
GRANT ALL ON public.campaign_responses TO service_role;
ALTER TABLE public.campaign_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage camp responses" ON public.campaign_responses FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5) campaign_history
CREATE TABLE public.campaign_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.commercial_campaigns(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  descricao TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_camp_history_campaign ON public.campaign_history(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_history TO authenticated;
GRANT ALL ON public.campaign_history TO service_role;
ALTER TABLE public.campaign_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage camp history" ON public.campaign_history FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));