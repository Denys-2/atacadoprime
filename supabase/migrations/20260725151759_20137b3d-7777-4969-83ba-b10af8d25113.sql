
CREATE OR REPLACE FUNCTION public.generate_ean13(_prefix text DEFAULT '789'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base TEXT;
  d INT;
  s INT := 0;
  i INT;
  chk INT;
BEGIN
  base := _prefix || lpad((floor(random() * 1000000000)::bigint)::text, 9, '0');
  base := left(base, 12);
  FOR i IN 1..12 LOOP
    d := substring(base FROM i FOR 1)::int;
    IF i % 2 = 1 THEN s := s + d; ELSE s := s + d * 3; END IF;
  END LOOP;
  chk := (10 - (s % 10)) % 10;
  RETURN base || chk::text;
END $function$;

CREATE OR REPLACE FUNCTION public.products_set_ean13()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE novo TEXT;
BEGIN
  IF NEW.ean13 IS NULL OR NEW.ean13 = '' THEN
    LOOP
      novo := public.generate_ean13('789');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE ean13 = novo);
    END LOOP;
    NEW.ean13 := novo;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.products_set_sku()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prefix TEXT;
  start_n INT;
  pad INT;
  next_n INT;
  candidate TEXT;
BEGIN
  IF NEW.sku IS NOT NULL AND NEW.sku <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'carcaca'::product_tipo THEN
    prefix := 'CP-'; start_n := 10;  pad := 3;
  ELSIF NEW.tipo = 'controle'::product_tipo THEN
    prefix := 'CT-'; start_n := 100; pad := 3;
  ELSIF NEW.tipo = 'chave'::product_tipo THEN
    prefix := 'CH-'; start_n := 200; pad := 3;
  ELSE
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(substring(sku FROM char_length(prefix) + 1), '\D', '', 'g'), '')::int
  ), start_n - 1) + 1
  INTO next_n
  FROM public.products
  WHERE sku LIKE prefix || '%';

  IF next_n < start_n THEN next_n := start_n; END IF;

  LOOP
    candidate := prefix || lpad(next_n::text, pad, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE sku = candidate);
    next_n := next_n + 1;
  END LOOP;

  NEW.sku := candidate;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_ean13(text) TO authenticated, service_role;
