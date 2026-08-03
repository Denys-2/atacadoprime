
CREATE OR REPLACE FUNCTION public.stock_deduct_open_trips()
RETURNS TABLE(product_id uuid, deduzido numeric, insuficientes boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  saldo NUMERIC;
  atual NUMERIC;
BEGIN
  FOR rec IN
    SELECT ti.product_id AS pid,
           SUM(ti.qtd_carregada - ti.qtd_vendida - ti.qtd_devolvida) AS saldo_viagem
      FROM public.trip_items ti
      JOIN public.trips t ON t.id = ti.trip_id
     WHERE t.status = 'open'
     GROUP BY ti.product_id
    HAVING SUM(ti.qtd_carregada - ti.qtd_vendida - ti.qtd_devolvida) > 0
  LOOP
    SELECT COALESCE(estoque,0) INTO atual FROM public.products WHERE id = rec.pid;
    saldo := rec.saldo_viagem;

    IF atual < saldo THEN
      product_id := rec.pid; deduzido := 0; insuficientes := true; RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE public.products SET estoque = atual - saldo WHERE id = rec.pid;

    INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, user_id)
    VALUES (rec.pid, 'AJUSTE', saldo, 'Separação: estoque já carregado em viagem aberta', auth.uid());

    product_id := rec.pid; deduzido := saldo; insuficientes := false; RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.stock_deduct_open_trips() FROM public;
GRANT EXECUTE ON FUNCTION public.stock_deduct_open_trips() TO authenticated;
