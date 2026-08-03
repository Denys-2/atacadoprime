
-- Normaliza dados existentes
UPDATE public.leads SET cidade = UPPER(TRIM(cidade)) WHERE cidade IS NOT NULL AND cidade <> UPPER(TRIM(cidade));
UPDATE public.companies SET cidade = UPPER(TRIM(cidade)) WHERE cidade IS NOT NULL AND cidade <> UPPER(TRIM(cidade));

-- Função de normalização
CREATE OR REPLACE FUNCTION public.normalize_cidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cidade IS NOT NULL THEN
    NEW.cidade := UPPER(TRIM(NEW.cidade));
    IF NEW.cidade = '' THEN NEW.cidade := NULL; END IF;
  END IF;
  IF TG_TABLE_NAME IN ('leads','companies') AND NEW.estado IS NOT NULL THEN
    NEW.estado := UPPER(TRIM(NEW.estado));
    IF NEW.estado = '' THEN NEW.estado := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_cidade_leads ON public.leads;
CREATE TRIGGER trg_normalize_cidade_leads
BEFORE INSERT OR UPDATE OF cidade, estado ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_cidade();

DROP TRIGGER IF EXISTS trg_normalize_cidade_companies ON public.companies;
CREATE TRIGGER trg_normalize_cidade_companies
BEFORE INSERT OR UPDATE OF cidade, estado ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.normalize_cidade();
