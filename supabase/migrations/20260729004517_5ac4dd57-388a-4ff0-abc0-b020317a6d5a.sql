CREATE OR REPLACE FUNCTION public.normalize_cidade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cidade IS NOT NULL THEN
    NEW.cidade := public.norm_cidade_txt(NEW.cidade);
    IF NEW.cidade = '' THEN NEW.cidade := NULL; END IF;
  END IF;
  IF TG_TABLE_NAME IN ('leads','companies') AND NEW.estado IS NOT NULL THEN
    NEW.estado := public.norm_cidade_txt(NEW.estado);
    IF NEW.estado = '' THEN NEW.estado := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$function$;