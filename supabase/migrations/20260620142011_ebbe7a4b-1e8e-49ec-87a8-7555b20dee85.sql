
-- route_plans: dono do registro pode gerenciar; admin/sales_staff veem tudo
DROP POLICY IF EXISTS "Admins manage routes" ON public.route_plans;
CREATE POLICY "Sales staff manage routes" ON public.route_plans
  FOR ALL TO authenticated
  USING (public.is_sales_staff(auth.uid()) OR auth.uid() = user_id)
  WITH CHECK (public.is_sales_staff(auth.uid()) OR auth.uid() = user_id);

-- route_items: amarrado à rota do dono ou sales staff
DROP POLICY IF EXISTS "Admins manage route items" ON public.route_items;
CREATE POLICY "Sales staff manage route items" ON public.route_items
  FOR ALL TO authenticated
  USING (
    public.is_sales_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.route_plans rp WHERE rp.id = route_items.route_id AND rp.user_id = auth.uid())
  )
  WITH CHECK (
    public.is_sales_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.route_plans rp WHERE rp.id = route_items.route_id AND rp.user_id = auth.uid())
  );

-- visits
DROP POLICY IF EXISTS "Admins manage visits" ON public.visits;
CREATE POLICY "Sales staff manage visits" ON public.visits
  FOR ALL TO authenticated
  USING (public.is_sales_staff(auth.uid()) OR auth.uid() = user_id)
  WITH CHECK (public.is_sales_staff(auth.uid()) OR auth.uid() = user_id);

-- leads
DROP POLICY IF EXISTS "Admins manage leads" ON public.leads;
CREATE POLICY "Sales staff manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_sales_staff(auth.uid()))
  WITH CHECK (public.is_sales_staff(auth.uid()));
