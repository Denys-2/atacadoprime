CREATE POLICY companies_sales_insert ON public.companies
FOR INSERT TO authenticated
WITH CHECK (is_sales_staff(auth.uid()) AND auth.uid() = owner_id);