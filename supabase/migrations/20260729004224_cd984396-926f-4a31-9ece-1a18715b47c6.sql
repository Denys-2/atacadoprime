CREATE OR REPLACE FUNCTION public.norm_cidade_txt(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT UPPER(TRIM(TRANSLATE(COALESCE(v,''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')))
$$;

CREATE OR REPLACE FUNCTION public.orders_auto_link_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cidade text;
  v_estado text;
  v_trip uuid;
BEGIN
  IF NEW.trip_id IS NOT NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.norm_cidade_txt(cidade), public.norm_cidade_txt(estado)
    INTO v_cidade, v_estado
    FROM public.companies WHERE id = NEW.company_id;

  IF v_cidade IS NULL OR v_cidade = '' THEN
    RETURN NEW;
  END IF;

  SELECT t.id INTO v_trip
    FROM public.trips t
   WHERE t.status = 'open'
     AND (
       (public.norm_cidade_txt(t.cidade) = v_cidade AND (v_estado IS NULL OR v_estado = '' OR public.norm_cidade_txt(t.estado) = v_estado))
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(COALESCE(t.destinos, '[]'::jsonb)) d
         WHERE public.norm_cidade_txt(d->>'cidade') = v_cidade
           AND (v_estado IS NULL OR v_estado = '' OR public.norm_cidade_txt(d->>'estado') = v_estado)
       )
     )
   ORDER BY t.created_at DESC
   LIMIT 1;

  IF v_trip IS NOT NULL THEN
    NEW.trip_id := v_trip;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: pedidos sem viagem que pertencem a uma viagem aberta pela cidade do cliente
UPDATE public.orders o
SET trip_id = t.id
FROM public.trips t, public.companies c
WHERE o.trip_id IS NULL
  AND o.company_id = c.id
  AND t.status = 'open'
  AND o.created_at >= t.created_at
  AND public.norm_cidade_txt(c.cidade) <> ''
  AND (
    public.norm_cidade_txt(t.cidade) = public.norm_cidade_txt(c.cidade)
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(t.destinos, '[]'::jsonb)) d
      WHERE public.norm_cidade_txt(d->>'cidade') = public.norm_cidade_txt(c.cidade)
    )
  );