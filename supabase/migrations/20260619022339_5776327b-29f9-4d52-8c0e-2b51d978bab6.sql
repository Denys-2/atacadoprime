
-- Helper: identifica equipe de vendas (admin/vendedor/gerente)
CREATE OR REPLACE FUNCTION public.is_sales_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin'::app_role, 'vendedor'::app_role, 'gerente'::app_role)
  )
$$;

-- companies: vendedor/gerente podem listar todos os clientes
CREATE POLICY "companies_sales_select"
  ON public.companies FOR SELECT
  TO authenticated
  USING (public.is_sales_staff(auth.uid()));

-- addresses: vendedor/gerente podem ler/criar/editar endereços de qualquer cliente
CREATE POLICY "addresses_sales_all"
  ON public.addresses FOR ALL
  TO authenticated
  USING (public.is_sales_staff(auth.uid()))
  WITH CHECK (public.is_sales_staff(auth.uid()));

-- orders: vendedor/gerente podem criar/ler/atualizar pedidos de qualquer cliente
CREATE POLICY "orders_sales_insert"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (public.is_sales_staff(auth.uid()));

CREATE POLICY "orders_sales_select"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_sales_staff(auth.uid()));

CREATE POLICY "orders_sales_update"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_sales_staff(auth.uid()))
  WITH CHECK (public.is_sales_staff(auth.uid()));

-- order_items: segue pedido para equipe de vendas
CREATE POLICY "order_items_sales_all"
  ON public.order_items FOR ALL
  TO authenticated
  USING (public.is_sales_staff(auth.uid()))
  WITH CHECK (public.is_sales_staff(auth.uid()));

-- payments: segue pedido para equipe de vendas
CREATE POLICY "payments_sales_all"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_sales_staff(auth.uid()))
  WITH CHECK (public.is_sales_staff(auth.uid()));
