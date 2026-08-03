CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'CUSTOM' CHECK (categoria IN ('CUSTOM','REATIVACAO','POS_VENDA','REPOSICAO','COBRANCA','FOLLOW_UP','PRE_VISITA')),
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','ATIVO','PAUSADO','ARQUIVADO')),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  execucoes_count INTEGER NOT NULL DEFAULT 0 CHECK (execucoes_count >= 0),
  falhas_count INTEGER NOT NULL DEFAULT 0 CHECK (falhas_count >= 0),
  conversoes_count INTEGER NOT NULL DEFAULT 0 CHECK (conversoes_count >= 0),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflows_admin_all" ON public.workflows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "workflows_owner_all" ON public.workflows FOR ALL TO authenticated
  USING (created_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (created_by = auth.uid());
CREATE INDEX idx_workflows_status ON public.workflows(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_created_by ON public.workflows(created_by) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_workflows_updated BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('NOVO_LEAD','NOVO_CLIENTE','NOVA_MENSAGEM','NOVO_PEDIDO','PEDIDO_PAGO','PEDIDO_CANCELADO','CLIENTE_SEM_COMPRA','VISITA_FINALIZADA','CAMPANHA_RESPONDIDA')),
  parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_triggers TO authenticated;
GRANT ALL ON public.workflow_triggers TO service_role;
ALTER TABLE public.workflow_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_triggers_admin_all" ON public.workflow_triggers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "workflow_triggers_owner_all" ON public.workflow_triggers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.created_by = auth.uid() AND w.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.created_by = auth.uid() AND w.deleted_at IS NULL));
CREATE INDEX idx_workflow_triggers_workflow ON public.workflow_triggers(workflow_id);
CREATE INDEX idx_workflow_triggers_tipo ON public.workflow_triggers(tipo) WHERE ativo = true;
CREATE TRIGGER trg_workflow_triggers_updated BEFORE UPDATE ON public.workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workflow_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  campo TEXT NOT NULL CHECK (campo IN ('CIDADE','ESTADO','VALOR','STATUS','PRODUTO','CATEGORIA','CLIENTE','SEGMENTO','DIAS_SEM_COMPRA')),
  operador TEXT NOT NULL CHECK (operador IN ('IGUAL','DIFERENTE','MAIOR_QUE','MENOR_QUE','CONTEM','ENTRE','EXISTE')),
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  ordem INTEGER NOT NULL DEFAULT 1 CHECK (ordem > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_conditions TO authenticated;
GRANT ALL ON public.workflow_conditions TO service_role;
ALTER TABLE public.workflow_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_conditions_admin_all" ON public.workflow_conditions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "workflow_conditions_owner_all" ON public.workflow_conditions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.created_by = auth.uid() AND w.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.created_by = auth.uid() AND w.deleted_at IS NULL));
CREATE INDEX idx_workflow_conditions_workflow ON public.workflow_conditions(workflow_id);
CREATE TRIGGER trg_workflow_conditions_updated BEFORE UPDATE ON public.workflow_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('CRIAR_TAREFA','ENVIAR_WHATSAPP','CRIAR_CAMPANHA','MOVER_CRM','CRIAR_PRE_PEDIDO','CRIAR_VISITA','ENVIAR_EMAIL','NOTIFICAR_USUARIO')),
  parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
  ordem INTEGER NOT NULL DEFAULT 1 CHECK (ordem > 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_actions TO authenticated;
GRANT ALL ON public.workflow_actions TO service_role;
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_actions_admin_all" ON public.workflow_actions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "workflow_actions_owner_all" ON public.workflow_actions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.created_by = auth.uid() AND w.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.created_by = auth.uid() AND w.deleted_at IS NULL));
CREATE INDEX idx_workflow_actions_workflow ON public.workflow_actions(workflow_id);
CREATE TRIGGER trg_workflow_actions_updated BEFORE UPDATE ON public.workflow_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_tipo TEXT NOT NULL,
  resultado TEXT NOT NULL DEFAULT 'SUCESSO' CHECK (resultado IN ('SUCESSO','ERRO','IGNORADO')),
  referencia_tipo TEXT,
  referencia_id TEXT,
  usuario_id UUID DEFAULT auth.uid(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  erro TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.workflow_logs TO authenticated;
GRANT ALL ON public.workflow_logs TO service_role;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_logs_admin_all" ON public.workflow_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "workflow_logs_owner_read" ON public.workflow_logs FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.created_by = auth.uid() AND w.deleted_at IS NULL));
CREATE POLICY "workflow_logs_insert_self" ON public.workflow_logs FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR usuario_id IS NULL OR EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_id AND w.created_by = auth.uid() AND w.deleted_at IS NULL));
CREATE INDEX idx_workflow_logs_workflow_executed ON public.workflow_logs(workflow_id, executed_at DESC);
CREATE INDEX idx_workflow_logs_resultado ON public.workflow_logs(resultado, executed_at DESC);

CREATE OR REPLACE FUNCTION public.workflow_log_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.workflows
  SET
    execucoes_count = execucoes_count + 1,
    falhas_count = falhas_count + CASE WHEN NEW.resultado = 'ERRO' THEN 1 ELSE 0 END,
    conversoes_count = conversoes_count + CASE WHEN COALESCE((NEW.payload->>'conversao')::boolean, false) THEN 1 ELSE 0 END,
    last_run_at = NEW.executed_at,
    updated_at = now()
  WHERE id = NEW.workflow_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_workflow_log_after_insert
  AFTER INSERT ON public.workflow_logs
  FOR EACH ROW EXECUTE FUNCTION public.workflow_log_after_insert();