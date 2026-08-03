
-- Helper: manager = admin OR gerente
CREATE OR REPLACE FUNCTION public.is_manager(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin'::app_role, 'gerente'::app_role)
  )
$$;

REVOKE ALL ON FUNCTION public.is_manager(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager(UUID) TO authenticated, service_role;

-- Reescrita das policies de trip_expenses
DROP POLICY IF EXISTS "Vendedor vê despesas de suas viagens" ON public.trip_expenses;
DROP POLICY IF EXISTS "Vendedor lança despesas em suas viagens" ON public.trip_expenses;
DROP POLICY IF EXISTS "Vendedor edita despesas de suas viagens" ON public.trip_expenses;
DROP POLICY IF EXISTS "Vendedor apaga despesas de suas viagens" ON public.trip_expenses;

CREATE POLICY "Ver despesas das próprias viagens (ou manager)"
ON public.trip_expenses FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_expenses.trip_id AND t.vendedor_id = auth.uid())
  OR public.is_manager(auth.uid())
);

CREATE POLICY "Inserir despesas nas próprias viagens (ou manager)"
ON public.trip_expenses FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_expenses.trip_id AND t.vendedor_id = auth.uid())
    OR public.is_manager(auth.uid())
  )
);

CREATE POLICY "Editar despesas das próprias viagens (ou manager)"
ON public.trip_expenses FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_expenses.trip_id AND t.vendedor_id = auth.uid())
  OR public.is_manager(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_expenses.trip_id AND t.vendedor_id = auth.uid())
  OR public.is_manager(auth.uid())
);

CREATE POLICY "Apagar despesas das próprias viagens (ou manager)"
ON public.trip_expenses FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_expenses.trip_id AND t.vendedor_id = auth.uid())
  OR public.is_manager(auth.uid())
);
