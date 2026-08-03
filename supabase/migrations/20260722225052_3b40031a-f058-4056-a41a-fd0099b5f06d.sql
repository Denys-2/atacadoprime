
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
  IF NEW.trip_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT UPPER(TRIM(cidade)), UPPER(TRIM(estado))
    INTO v_cidade, v_estado
    FROM public.companies WHERE id = NEW.company_id;

  IF v_cidade IS NULL OR v_cidade = '' THEN
    RETURN NEW;
  END IF;

  SELECT t.id INTO v_trip
    FROM public.trips t
   WHERE t.status = 'open'
     AND (
       (UPPER(TRIM(t.cidade)) = v_cidade AND (v_estado IS NULL OR UPPER(TRIM(t.estado)) = v_estado))
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(COALESCE(t.destinos, '[]'::jsonb)) d
         WHERE UPPER(TRIM(d->>'cidade')) = v_cidade
           AND (v_estado IS NULL OR UPPER(TRIM(d->>'estado')) = v_estado)
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

DROP TRIGGER IF EXISTS trg_orders_auto_link_trip ON public.orders;
CREATE TRIGGER trg_orders_auto_link_trip
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_auto_link_trip();
