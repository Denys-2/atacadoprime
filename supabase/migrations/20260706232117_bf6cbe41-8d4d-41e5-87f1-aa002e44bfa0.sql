
CREATE OR REPLACE FUNCTION public.products_set_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;
