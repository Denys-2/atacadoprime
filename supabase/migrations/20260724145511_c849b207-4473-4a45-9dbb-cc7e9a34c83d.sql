
ALTER TABLE public.fechamentos
  ADD COLUMN IF NOT EXISTS despesas_periodo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lucro_liquido numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_retirada numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_id_pessoal uuid REFERENCES public.bank_accounts(id);

CREATE OR REPLACE FUNCTION public.fechamento_sync_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  desc_txt TEXT;
  desc_pessoal TEXT;
BEGIN
  desc_txt := 'Fechamento ' || to_char(NEW.periodo_from, 'DD/MM/YYYY') || ' a ' || to_char(NEW.periodo_to, 'DD/MM/YYYY');
  desc_pessoal := 'Retirada pessoal — fechamento ' || to_char(NEW.periodo_from, 'DD/MM/YYYY') || ' a ' || to_char(NEW.periodo_to, 'DD/MM/YYYY');

  IF TG_OP = 'INSERT' THEN
    IF NEW.valor_transferido > 0 AND NEW.account_id IS NOT NULL THEN
      INSERT INTO public.financial_entries (account_id, tipo, valor, data, descricao)
      VALUES (NEW.account_id, 'RECEITA', NEW.valor_transferido, NEW.periodo_to, desc_txt);
    END IF;

    IF NEW.valor_retirada > 0 AND NEW.account_id_pessoal IS NOT NULL THEN
      INSERT INTO public.financial_entries (account_id, tipo, valor, data, descricao)
      VALUES (NEW.account_id_pessoal, 'RECEITA', NEW.valor_retirada, NEW.periodo_to, desc_pessoal);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
