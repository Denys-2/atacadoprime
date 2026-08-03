
CREATE TABLE public.fechamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo_from DATE NOT NULL,
  periodo_to DATE NOT NULL,
  vendas_periodo NUMERIC NOT NULL DEFAULT 0,
  custo_pecas_periodo NUMERIC NOT NULL DEFAULT 0,
  pct_reserva NUMERIC NOT NULL DEFAULT 0,
  valor_reserva NUMERIC NOT NULL DEFAULT 0,
  valor_transferido NUMERIC NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fechamentos_periodo_check CHECK (periodo_to >= periodo_from)
);

CREATE INDEX idx_fechamentos_periodo ON public.fechamentos(periodo_from, periodo_to);
CREATE INDEX idx_fechamentos_account ON public.fechamentos(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fechamentos TO authenticated;
GRANT ALL ON public.fechamentos TO service_role;

ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales staff can view fechamentos" ON public.fechamentos
  FOR SELECT TO authenticated
  USING (public.is_sales_staff(auth.uid()));

CREATE POLICY "Sales staff can insert fechamentos" ON public.fechamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_sales_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Managers can update fechamentos" ON public.fechamentos
  FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete fechamentos" ON public.fechamentos
  FOR DELETE TO authenticated
  USING (public.is_manager(auth.uid()));

CREATE TRIGGER trg_fechamentos_updated_at
  BEFORE UPDATE ON public.fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: ao criar/atualizar fechamento, lançar como RECEITA na conta destino
CREATE OR REPLACE FUNCTION public.fechamento_sync_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  desc_txt TEXT;
BEGIN
  desc_txt := 'Fechamento ' || to_char(NEW.periodo_from, 'DD/MM/YYYY') || ' a ' || to_char(NEW.periodo_to, 'DD/MM/YYYY');

  IF TG_OP = 'INSERT' AND NEW.valor_transferido > 0 AND NEW.account_id IS NOT NULL THEN
    INSERT INTO public.financial_entries (account_id, tipo, valor, data, descricao, created_by)
    VALUES (NEW.account_id, 'RECEITA', NEW.valor_transferido, NEW.periodo_to, desc_txt, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fechamento_sync_financeiro
  AFTER INSERT ON public.fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.fechamento_sync_financeiro();
