
CREATE TABLE public.personal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('RECEITA','DESPESA')),
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  vencimento DATE NOT NULL DEFAULT CURRENT_DATE,
  pagamento DATE,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','PAGO')),
  categoria TEXT,
  observacao TEXT,
  origem TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origem IN ('MANUAL','FECHAMENTO')),
  fechamento_id UUID REFERENCES public.fechamentos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX personal_entries_user_idx ON public.personal_entries(user_id);
CREATE INDEX personal_entries_status_idx ON public.personal_entries(user_id, status);
CREATE INDEX personal_entries_fechamento_idx ON public.personal_entries(fechamento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_entries TO authenticated;
GRANT ALL ON public.personal_entries TO service_role;

ALTER TABLE public.personal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_entries_owner_all"
  ON public.personal_entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER personal_entries_set_updated_at
  BEFORE UPDATE ON public.personal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Espelha retirada pessoal do fechamento como RECEITA PAGA no Particular do dono
CREATE OR REPLACE FUNCTION public.fechamento_mirror_personal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
BEGIN
  IF NEW.valor_retirada IS NULL OR NEW.valor_retirada <= 0 THEN
    RETURN NEW;
  END IF;

  v_user := COALESCE(NEW.created_by, auth.uid());
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.personal_entries(
    user_id, tipo, descricao, valor, vencimento, pagamento, status, categoria, origem, fechamento_id
  ) VALUES (
    v_user, 'RECEITA',
    'Retirada de fechamento ' || to_char(NEW.periodo_from,'DD/MM/YYYY') || ' a ' || to_char(NEW.periodo_to,'DD/MM/YYYY'),
    NEW.valor_retirada, NEW.periodo_to, NEW.periodo_to, 'PAGO',
    'Retirada', 'FECHAMENTO', NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fechamento_mirror_personal ON public.fechamentos;
CREATE TRIGGER trg_fechamento_mirror_personal
  AFTER INSERT ON public.fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.fechamento_mirror_personal();
