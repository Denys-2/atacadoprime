ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS fechamento_id UUID REFERENCES public.fechamentos(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_financial_entries_fechamento ON public.financial_entries(fechamento_id);

CREATE OR REPLACE FUNCTION public.fechamento_sync_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  desc_txt TEXT;
BEGIN
  desc_txt := 'Fechamento ' || to_char(NEW.periodo_from, 'DD/MM/YYYY') || ' a ' || to_char(NEW.periodo_to, 'DD/MM/YYYY');

  IF TG_OP = 'INSERT' THEN
    -- A parcela "empresa (custo + reserva)" NAO gera lancamento: o dinheiro das vendas
    -- ja foi creditado na conta pela baixa dos recebimentos. Lancar de novo duplicaria o saldo.

    -- A retirada pessoal e uma transferencia real: sai da conta da empresa, entra na pessoal.
    IF NEW.valor_retirada IS NOT NULL AND NEW.valor_retirada > 0
       AND NEW.account_id IS NOT NULL AND NEW.account_id_pessoal IS NOT NULL THEN
      INSERT INTO public.financial_entries (account_id, tipo, valor, data, descricao, fechamento_id)
      VALUES (NEW.account_id, 'DESPESA', NEW.valor_retirada, NEW.periodo_to, desc_txt || ' — Retirada pessoal (saida da empresa)', NEW.id);

      INSERT INTO public.financial_entries (account_id, tipo, valor, data, descricao, fechamento_id)
      VALUES (NEW.account_id_pessoal, 'RECEITA', NEW.valor_retirada, NEW.periodo_to, desc_txt || ' — Retirada pessoal (entrada)', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Corrige os lancamentos ja gravados do acerto de julho
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN SELECT * FROM public.fechamentos LOOP
    DELETE FROM public.financial_entries
     WHERE descricao LIKE 'Fechamento ' || to_char(f.periodo_from,'DD/MM/YYYY') || ' a ' || to_char(f.periodo_to,'DD/MM/YYYY') || '%'
       AND fechamento_id IS NULL;

    IF f.valor_retirada > 0 AND f.account_id IS NOT NULL AND f.account_id_pessoal IS NOT NULL THEN
      INSERT INTO public.financial_entries (account_id, tipo, valor, data, descricao, fechamento_id)
      VALUES (f.account_id, 'DESPESA', f.valor_retirada, f.periodo_to,
              'Fechamento ' || to_char(f.periodo_from,'DD/MM/YYYY') || ' a ' || to_char(f.periodo_to,'DD/MM/YYYY') || ' — Retirada pessoal (saida da empresa)', f.id),
             (f.account_id_pessoal, 'RECEITA', f.valor_retirada, f.periodo_to,
              'Fechamento ' || to_char(f.periodo_from,'DD/MM/YYYY') || ' a ' || to_char(f.periodo_to,'DD/MM/YYYY') || ' — Retirada pessoal (entrada)', f.id);
    END IF;
  END LOOP;
END $$;