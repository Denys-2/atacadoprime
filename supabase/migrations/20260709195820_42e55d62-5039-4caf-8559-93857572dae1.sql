
-- Vincular pedidos à viagem (opcional) e dar baixa no estoque do carro
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_trip_id ON public.orders(trip_id);

-- RPC: dá baixa (qtd_vendida) nos itens da viagem para um pedido específico
CREATE OR REPLACE FUNCTION public.trip_apply_order(_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip UUID;
BEGIN
  SELECT trip_id INTO v_trip FROM public.orders WHERE id = _order_id;
  IF v_trip IS NULL THEN RETURN; END IF;

  UPDATE public.trip_items ti
     SET qtd_vendida = qtd_vendida + oi.quantidade,
         updated_at  = now()
    FROM public.order_items oi
   WHERE oi.order_id = _order_id
     AND ti.trip_id   = v_trip
     AND ti.product_id = oi.product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trip_apply_order(UUID) TO authenticated;
