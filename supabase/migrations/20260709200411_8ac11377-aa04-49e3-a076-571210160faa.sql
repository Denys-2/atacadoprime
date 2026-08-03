
-- Link financial entries back to trip expenses for automatic sync
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS trip_expense_id uuid REFERENCES public.trip_expenses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS financial_entries_trip_expense_id_idx
  ON public.financial_entries(trip_expense_id);

-- Ensure a "Viagem" category exists (used as fallback)
INSERT INTO public.financial_categories(nome, tipo)
SELECT 'Viagem', 'DESPESA'
WHERE NOT EXISTS (SELECT 1 FROM public.financial_categories WHERE nome = 'Viagem' AND tipo = 'DESPESA');

CREATE OR REPLACE FUNCTION public.trip_expense_to_financial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cidade text;
  v_estado text;
  v_nome text;
  v_local text;
  v_desc text;
  v_cat_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT cidade, estado, nome INTO v_cidade, v_estado, v_nome FROM public.trips WHERE id = NEW.trip_id;

    IF v_cidade IS NOT NULL AND v_cidade <> '' THEN
      v_local := v_cidade || COALESCE(' - ' || NULLIF(v_estado, ''), '');
    ELSE
      v_local := COALESCE(v_nome, 'Viagem');
    END IF;

    v_desc := 'Viagem ' || v_local
              || ' · ' || NEW.categoria
              || COALESCE(' · ' || NULLIF(NEW.descricao, ''), '');

    SELECT id INTO v_cat_id FROM public.financial_categories
     WHERE tipo = 'DESPESA' AND nome = 'Viagem' LIMIT 1;

    INSERT INTO public.financial_entries(descricao, valor, tipo, data, categoria_id, trip_expense_id)
    VALUES (v_desc, NEW.valor, 'DESPESA', NEW.data, v_cat_id, NEW.id);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.financial_entries
       SET valor = NEW.valor,
           data = NEW.data
     WHERE trip_expense_id = NEW.id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_trip_expense_to_financial_ins ON public.trip_expenses;
CREATE TRIGGER trg_trip_expense_to_financial_ins
AFTER INSERT ON public.trip_expenses
FOR EACH ROW EXECUTE FUNCTION public.trip_expense_to_financial();

DROP TRIGGER IF EXISTS trg_trip_expense_to_financial_upd ON public.trip_expenses;
CREATE TRIGGER trg_trip_expense_to_financial_upd
AFTER UPDATE ON public.trip_expenses
FOR EACH ROW EXECUTE FUNCTION public.trip_expense_to_financial();

-- Backfill existing trip expenses that don't have a corresponding financial entry
INSERT INTO public.financial_entries(descricao, valor, tipo, data, categoria_id, trip_expense_id)
SELECT
  'Viagem ' ||
    CASE WHEN t.cidade IS NOT NULL AND t.cidade <> ''
         THEN t.cidade || COALESCE(' - ' || NULLIF(t.estado, ''), '')
         ELSE COALESCE(t.nome, 'Viagem') END
    || ' · ' || te.categoria
    || COALESCE(' · ' || NULLIF(te.descricao, ''), ''),
  te.valor, 'DESPESA', te.data,
  (SELECT id FROM public.financial_categories WHERE tipo='DESPESA' AND nome='Viagem' LIMIT 1),
  te.id
FROM public.trip_expenses te
JOIN public.trips t ON t.id = te.trip_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_entries fe WHERE fe.trip_expense_id = te.id
);
