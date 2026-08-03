
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
    INSERT INTO public.financial_entries (account_id, tipo, valor, data, descricao)
    VALUES (NEW.account_id, 'RECEITA', NEW.valor_transferido, NEW.periodo_to, desc_txt);
  END IF;

  RETURN NEW;
END;
$$;
