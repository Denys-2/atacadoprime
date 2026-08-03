-- 1) Trigger function
CREATE OR REPLACE FUNCTION public.order_sync_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  custo_total NUMERIC := 0;
  ja_receita UUID;
  ja_despesa UUID;
BEGIN
  -- Só age quando o status vira PAGO (ou pedido é criado já PAGO)
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'PAGO') OR
    (TG_OP = 'UPDATE' AND NEW.status = 'PAGO' AND NEW.status IS DISTINCT FROM OLD.status)
  ) THEN
    RETURN NEW;
  END IF;

  -- RECEITA (venda): cria se ainda não existir
  SELECT id INTO ja_receita
    FROM public.financial_transactions
   WHERE order_id = NEW.id AND tipo = 'RECEITA'
   LIMIT 1;

  IF ja_receita IS NULL THEN
    INSERT INTO public.financial_transactions(
      order_id, company_id, tipo, status, valor, pagamento, descricao
    ) VALUES (
      NEW.id, NEW.company_id, 'RECEITA', 'PAGO', COALESCE(NEW.total, 0), CURRENT_DATE,
      'Venda #' || substring(NEW.id::text, 1, 8)
    );
  ELSE
    UPDATE public.financial_transactions
       SET status = 'PAGO',
           valor = COALESCE(NEW.total, 0),
           pagamento = COALESCE(pagamento, CURRENT_DATE),
           updated_at = now()
     WHERE id = ja_receita;
  END IF;

  -- DESPESA (custo das peças) — apenas se NÃO for pedido de viagem
  -- (viagens geram esse lançamento no trip_close)
  IF NEW.trip_id IS NULL THEN
    SELECT COALESCE(SUM(oi.quantidade * COALESCE(p.preco_custo, 0)), 0)
      INTO custo_total
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = NEW.id;

    IF custo_total > 0 THEN
      SELECT id INTO ja_despesa
        FROM public.financial_transactions
       WHERE order_id = NEW.id AND tipo = 'DESPESA'
       LIMIT 1;

      IF ja_despesa IS NULL THEN
        INSERT INTO public.financial_transactions(
          order_id, company_id, tipo, status, valor, vencimento, descricao
        ) VALUES (
          NEW.id, NEW.company_id, 'DESPESA', 'PENDENTE',
          custo_total, CURRENT_DATE + INTERVAL '30 days',
          'Custo peças — Venda #' || substring(NEW.id::text, 1, 8)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Trigger
DROP TRIGGER IF EXISTS trg_order_sync_financials ON public.orders;
CREATE TRIGGER trg_order_sync_financials
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.order_sync_financials();

-- 3) Back-fill: pedidos já em status pago/enviado/entregue sem lançamento
DO $$
DECLARE
  o RECORD;
  custo_total NUMERIC;
BEGIN
  FOR o IN
    SELECT id, company_id, total, trip_id
      FROM public.orders
     WHERE status IN ('PAGO', 'EM_SEPARACAO', 'ENVIADO', 'ENTREGUE')
  LOOP
    -- RECEITA
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions
       WHERE order_id = o.id AND tipo = 'RECEITA'
    ) THEN
      INSERT INTO public.financial_transactions(
        order_id, company_id, tipo, status, valor, pagamento, descricao
      ) VALUES (
        o.id, o.company_id, 'RECEITA', 'PAGO', COALESCE(o.total, 0), CURRENT_DATE,
        'Venda #' || substring(o.id::text, 1, 8) || ' (backfill)'
      );
    END IF;

    -- DESPESA custo das peças (só para pedidos não-viagem)
    IF o.trip_id IS NULL THEN
      SELECT COALESCE(SUM(oi.quantidade * COALESCE(p.preco_custo, 0)), 0)
        INTO custo_total
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
       WHERE oi.order_id = o.id;

      IF custo_total > 0 AND NOT EXISTS (
        SELECT 1 FROM public.financial_transactions
         WHERE order_id = o.id AND tipo = 'DESPESA'
      ) THEN
        INSERT INTO public.financial_transactions(
          order_id, company_id, tipo, status, valor, vencimento, descricao
        ) VALUES (
          o.id, o.company_id, 'DESPESA', 'PENDENTE',
          custo_total, CURRENT_DATE + INTERVAL '30 days',
          'Custo peças — Venda #' || substring(o.id::text, 1, 8) || ' (backfill)'
        );
      END IF;
    END IF;
  END LOOP;
END $$;