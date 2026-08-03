
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS preco_nivel_1 numeric(10,2),
  ADD COLUMN IF NOT EXISTS preco_nivel_2 numeric(10,2),
  ADD COLUMN IF NOT EXISTS preco_nivel_3 numeric(10,2);

INSERT INTO public.system_settings (chave, valor, descricao, categoria)
SELECT 'pricing_tiers',
       jsonb_build_object('tier_2_min', 500, 'tier_3_min', 1000, 'enabled', true),
       'Faixas globais de pre�o por total do carrinho',
       'pricing'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE chave = 'pricing_tiers');

UPDATE public.products
SET preco_nivel_1 = 4.50, preco_nivel_2 = 4.30, preco_nivel_3 = 4.00, preco_unitario = 4.50
WHERE tipo = 'carcaca';

UPDATE public.products
SET preco_nivel_1 = 45.00, preco_nivel_2 = 43.00, preco_nivel_3 = 40.00, preco_unitario = 45.00
WHERE tipo = 'chave';

UPDATE public.products
SET preco_nivel_1 = 35.00, preco_nivel_2 = 33.00, preco_nivel_3 = 30.00, preco_unitario = 35.00
WHERE tipo = 'controle';

UPDATE public.products
SET preco_nivel_1 = COALESCE(preco_nivel_1, preco_unitario),
    preco_nivel_2 = COALESCE(preco_nivel_2, preco_unitario),
    preco_nivel_3 = COALESCE(preco_nivel_3, preco_unitario)
WHERE preco_nivel_1 IS NULL OR preco_nivel_2 IS NULL OR preco_nivel_3 IS NULL;

CREATE OR REPLACE FUNCTION public.pricing_tier_for_total(_total numeric)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _total >= 1000 THEN 3
    WHEN _total >= 500  THEN 2
    ELSE 1
  END;
$$;

GRANT EXECUTE ON FUNCTION public.pricing_tier_for_total(numeric) TO anon, authenticated, service_role;
