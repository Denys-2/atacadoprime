-- EAN-13 para produtos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ean13 TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_ean13(_prefix TEXT DEFAULT '789')
RETURNS TEXT
LANGUAGE plpgsql
AS $$
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
END $$;

-- Preenche EAN13 para produtos sem código
DO $$
DECLARE r RECORD; novo TEXT;
BEGIN
  FOR r IN SELECT id FROM public.products WHERE ean13 IS NULL LOOP
    LOOP
      novo := public.generate_ean13('789');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.products WHERE ean13 = novo);
    END LOOP;
    UPDATE public.products SET ean13 = novo WHERE id = r.id;
  END LOOP;
END $$;

-- Trigger para gerar automaticamente em novos produtos
CREATE OR REPLACE FUNCTION public.products_set_ean13()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
END $$;

DROP TRIGGER IF EXISTS trg_products_set_ean13 ON public.products;
CREATE TRIGGER trg_products_set_ean13
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_set_ean13();