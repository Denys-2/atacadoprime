DROP POLICY IF EXISTS companies_owner_update ON public.companies;

CREATE POLICY companies_owner_update ON public.companies
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);