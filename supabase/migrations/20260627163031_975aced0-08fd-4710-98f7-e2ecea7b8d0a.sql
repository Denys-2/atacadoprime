
-- =========================
-- TABELAS
-- =========================
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  vendedor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  observacao TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trips_vendedor_idx ON public.trips(vendedor_id);
CREATE INDEX trips_status_idx ON public.trips(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff vê viagens próprias ou todas se admin/gerente"
  ON public.trips FOR SELECT TO authenticated
  USING (
    public.is_sales_staff(auth.uid()) AND (
      vendedor_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gerente')
    )
  );
CREATE POLICY "Staff cria viagem própria"
  ON public.trips FOR INSERT TO authenticated
  WITH CHECK (public.is_sales_staff(auth.uid()) AND vendedor_id = auth.uid());
CREATE POLICY "Dono ou admin atualiza viagem"
  ON public.trips FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "Dono ou admin deleta viagem"
  ON public.trips FOR DELETE TO authenticated
  USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.trip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qtd_carregada NUMERIC NOT NULL DEFAULT 0 CHECK (qtd_carregada >= 0),
  qtd_vendida NUMERIC NOT NULL DEFAULT 0 CHECK (qtd_vendida >= 0),
  qtd_devolvida NUMERIC NOT NULL DEFAULT 0 CHECK (qtd_devolvida >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, product_id)
);
CREATE INDEX trip_items_trip_idx ON public.trip_items(trip_id);
CREATE INDEX trip_items_product_idx ON public.trip_items(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_items TO authenticated;
GRANT ALL ON public.trip_items TO service_role;
ALTER TABLE public.trip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver itens das viagens visíveis"
  ON public.trip_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
    t.vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente')
  )));
CREATE POLICY "Gerir itens das viagens próprias/admin"
  ON public.trip_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
    t.vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente')
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (
    t.vendedor_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente')
  )));

-- =========================
-- TRIGGERS updated_at
-- =========================
CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trip_items_set_updated_at
  BEFORE UPDATE ON public.trip_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- FUNÇÃO: carregar viagem (debita estoque principal)
-- payload: [{ product_id, quantidade }]
-- =========================
CREATE OR REPLACE FUNCTION public.trip_load_items(_trip_id UUID, _items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  pid UUID;
  qtd NUMERIC;
  trip_status TEXT;
BEGIN
  SELECT status INTO trip_status FROM public.trips WHERE id = _trip_id;
  IF trip_status IS NULL THEN RAISE EXCEPTION 'Viagem não encontrada'; END IF;
  IF trip_status <> 'open' THEN RAISE EXCEPTION 'Viagem encerrada'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    pid := (item->>'product_id')::UUID;
    qtd := (item->>'quantidade')::NUMERIC;
    IF qtd <= 0 THEN CONTINUE; END IF;

    -- debita estoque principal
    UPDATE public.products SET estoque = COALESCE(estoque,0) - qtd WHERE id = pid;

    -- upsert no trip_items
    INSERT INTO public.trip_items(trip_id, product_id, qtd_carregada)
      VALUES (_trip_id, pid, qtd)
      ON CONFLICT (trip_id, product_id) DO UPDATE
      SET qtd_carregada = public.trip_items.qtd_carregada + EXCLUDED.qtd_carregada;

    -- log de movimento
    INSERT INTO public.stock_movements(product_id, tipo, quantidade, observacao, user_id)
      VALUES (pid, 'SAIDA', qtd, 'Carga em viagem ' || _trip_id::text, auth.uid());
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.trip_load_items(UUID, JSONB) TO authenticated;

-- =========================
-- FUNÇÃO: encerrar viagem (devolve saldo ao estoque)
-- =========================
CREATE OR REPLACE FUNCTION public.trip_close(_trip_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  saldo NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = _trip_id AND status = 'open') THEN
    RAISE EXCEPTION 'Viagem não está aberta';
  END IF;

  FOR rec IN SELECT * FROM public.trip_items WHERE trip_id = _trip_id LOOP
    saldo := rec.qtd_carregada - rec.qtd_vendida - rec.qtd_devolvida;
    IF saldo > 0 THEN
      UPDATE public.products SET estoque = COALESCE(estoque,0) + saldo WHERE id = rec.product_id;
      UPDATE public.trip_items SET qtd_devolvida = qtd_devolvida + saldo WHERE id = rec.id;
      INSERT INTO public.stock_movements(product_id, tipo, quantidade, observacao, user_id)
        VALUES (rec.product_id, 'ENTRADA', saldo, 'Retorno de viagem ' || _trip_id::text, auth.uid());
    END IF;
  END LOOP;

  UPDATE public.trips SET status = 'closed', closed_at = now() WHERE id = _trip_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.trip_close(UUID) TO authenticated;

-- =========================
-- FUNÇÃO: registrar venda em viagem (baixa saldo do carro)
-- =========================
CREATE OR REPLACE FUNCTION public.trip_record_sale(_trip_id UUID, _product_id UUID, _quantidade NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trip_items
    SET qtd_vendida = qtd_vendida + _quantidade
  WHERE trip_id = _trip_id AND product_id = _product_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.trip_record_sale(UUID, UUID, NUMERIC) TO authenticated;
