
-- C1: Trigger de estorno completo ao cancelar pedido pago/em separação/enviado
CREATE OR REPLACE FUNCTION public.order_cancel_reverse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it RECORD;
  custo_pedido NUMERIC := 0;
  desp RECORD;
  dia_label TEXT;
  desc_dia TEXT;
BEGIN
  -- Só age quando o status ESTÁ mudando PARA CANCELADO
  IF NOT (TG_OP = 'UPDATE' AND NEW.status = 'CANCELADO' AND OLD.status IS DISTINCT FROM 'CANCELADO') THEN
    RETURN NEW;
  END IF;

  -- Não permitir cancelar pedido já entregue
  IF OLD.status = 'ENTREGUE' THEN
    RAISE EXCEPTION 'Pedido já ENTREGUE não pode ser cancelado. Estorno manual necessário.';
  END IF;

  -- Se o pedido nunca chegou a PAGO, não há o que estornar financeiramente
  IF OLD.status NOT IN ('PAGO','EM_SEPARACAO','ENVIADO') THEN
    RETURN NEW;
  END IF;

  -- 1) Estornar RECEITA(s) financeira(s) desse pedido
  UPDATE public.financial_transactions
     SET status = 'ESTORNADO',
         updated_at = now(),
         descricao = COALESCE(descricao,'') || ' [Estorno cancelamento em ' || to_char(now(),'DD/MM/YYYY HH24:MI') || ']'
   WHERE order_id = NEW.id
     AND tipo = 'RECEITA'
     AND status <> 'ESTORNADO';

  -- 2) Calcular custo das peças desse pedido
  SELECT COALESCE(SUM(oi.quantidade * COALESCE(p.preco_custo,0)),0)
    INTO custo_pedido
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
   WHERE oi.order_id = NEW.id;

  -- 2a) Se pedido AVULSO (sem trip_id) e houve custo consolidado no dia, subtrair
  IF NEW.trip_id IS NULL AND custo_pedido > 0 THEN
    dia_label := to_char(COALESCE(OLD.created_at::date, CURRENT_DATE), 'DD/MM/YYYY');
    desc_dia  := 'Custos das peças vendidas ' || dia_label;

    SELECT id, valor INTO desp
      FROM public.financial_transactions
     WHERE tipo = 'DESPESA'
       AND order_id IS NULL
       AND descricao = desc_dia
     LIMIT 1;

    IF FOUND THEN
      IF desp.valor - custo_pedido <= 0 THEN
        DELETE FROM public.financial_transactions WHERE id = desp.id;
      ELSE
        UPDATE public.financial_transactions
           SET valor = valor - custo_pedido, updated_at = now()
         WHERE id = desp.id;
      END IF;
    END IF;
  END IF;

  -- 3) Devolver estoque item a item
  FOR it IN
    SELECT product_id, quantidade FROM public.order_items WHERE order_id = NEW.id
  LOOP
    IF NEW.trip_id IS NOT NULL THEN
      -- Devolve à viagem: reduz qtd_vendida
      UPDATE public.trip_items
         SET qtd_vendida = GREATEST(qtd_vendida - it.quantidade, 0),
             updated_at = now()
       WHERE trip_id = NEW.trip_id
         AND product_id = it.product_id;
    ELSE
      -- Devolve ao estoque geral
      UPDATE public.products
         SET estoque = COALESCE(estoque,0) + it.quantidade
       WHERE id = it.product_id;

      INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, reference_id, user_id)
      VALUES (it.product_id, 'ENTRADA', it.quantidade,
              'Estorno de cancelamento — pedido ' || substring(NEW.id::text,1,8),
              NEW.id, auth.uid());
    END IF;
  END LOOP;

  -- 4) Recalcular a viagem, se aplicável
  IF NEW.trip_id IS NOT NULL THEN
    PERFORM public.trip_recalculate_items(NEW.trip_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_cancel_reverse ON public.orders;
CREATE TRIGGER trg_order_cancel_reverse
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.order_cancel_reverse();

REVOKE ALL ON FUNCTION public.order_cancel_reverse() FROM PUBLIC, anon;
