
DROP TRIGGER IF EXISTS trg_trip_expense_to_financial_ins ON public.trip_expenses;
DROP TRIGGER IF EXISTS trg_trip_expense_to_financial_upd ON public.trip_expenses;
DROP FUNCTION IF EXISTS public.trip_expense_to_financial();

DELETE FROM public.financial_entries WHERE trip_expense_id IS NOT NULL;
