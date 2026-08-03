
-- financial_transactions
DROP POLICY IF EXISTS "admin manage fin tx" ON public.financial_transactions;
CREATE POLICY "manager manage fin tx"
  ON public.financial_transactions
  FOR ALL
  TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

-- financial_entries
DROP POLICY IF EXISTS "admin manage fin entries" ON public.financial_entries;
CREATE POLICY "manager manage fin entries"
  ON public.financial_entries
  FOR ALL
  TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

-- stock_movements: gerente lê e insere; admin pode tudo
DROP POLICY IF EXISTS "admin manage stock mov" ON public.stock_movements;
CREATE POLICY "manager manage stock mov"
  ON public.stock_movements
  FOR ALL
  TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));

-- Vendedores continuam podendo inserir stock_movements (ex.: separações, retornos)
CREATE POLICY "sales staff insert stock mov"
  ON public.stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_sales_staff(auth.uid()));

CREATE POLICY "sales staff read stock mov"
  ON public.stock_movements
  FOR SELECT
  TO authenticated
  USING (public.is_sales_staff(auth.uid()));
