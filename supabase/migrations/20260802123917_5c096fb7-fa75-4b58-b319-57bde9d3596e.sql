CREATE OR REPLACE FUNCTION public.products_set_sku()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prefix TEXT;
  start_n INT;
  pad INT := 3;
  next_n INT;
  candidate TEXT;
BEGIN
  IF NEW.sku IS NOT NULL AND NEW.sku <> '' THEN
    RETURN NEW;
  END IF;

  CASE COALESCE(NEW.tipo::text, 'outro')
    WHEN 'carcaca'     THEN prefix := 'CP-'; start_n := 10;
    WHEN 'controle'    THEN prefix := 'CT-'; start_n := 100;
    WHEN 'chave'       THEN prefix := 'CH-'; start_n := 200;
    WHEN 'alarme'      THEN prefix := 'AL-'; start_n := 300;
    WHEN 'modulo'      THEN prefix := 'MD-'; start_n := 400;
    WHEN 'transponder' THEN prefix := 'TR-'; start_n := 500;
    WHEN 'lamina'      THEN prefix := 'LM-'; start_n := 600;
    WHEN 'bateria'     THEN prefix := 'BT-'; start_n := 700;
    WHEN 'acessorio'   THEN prefix := 'AC-'; start_n := 800;
    ELSE                    prefix := 'PR-'; start_n := 900;
  END CASE;

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(substring(sku FROM char_length(prefix) + 1), '\D', '', 'g'), '')::int
  ), start_n - 1) + 1
  INTO next_n
  FROM public.products
  WHERE sku LIKE prefix || '%';

  IF next_n IS NULL OR next_n < start_n THEN next_n := start_n; END IF;

  LOOP
    candidate := prefix || lpad(next_n::text, pad, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE sku = candidate);
    next_n := next_n + 1;
  END LOOP;

  NEW.sku := candidate;
  RETURN NEW;
END;
$function$;