
-- 1) Reverter a última execução duplicada (adicionar de volta o que foi deduzido em 20:01)
WITH dup AS (
  SELECT product_id, SUM(quantidade) AS qtd
  FROM public.stock_movements
  WHERE motivo = 'Separação: estoque já carregado em viagem aberta'
    AND created_at >= '2026-07-07 20:00:00+00'
  GROUP BY product_id
)
UPDATE public.products p
SET estoque = COALESCE(p.estoque,0) + d.qtd
FROM dup d
WHERE p.id = d.product_id;

-- Registra estorno
INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, user_id)
SELECT product_id, 'ENTRADA', SUM(quantidade), 'Estorno: dedução em viagens duplicada', NULL
FROM public.stock_movements
WHERE motivo = 'Separação: estoque já carregado em viagem aberta'
  AND created_at >= '2026-07-07 20:00:00+00'
GROUP BY product_id;

-- 2) Proteger a função contra dedução duplicada:
-- só deduz o que ainda NÃO foi deduzido antes (subtrai ajustes anteriores de mesma origem).
CREATE OR REPLACE FUNCTION public.stock_deduct_open_trips()
 RETURNS TABLE(product_id uuid, deduzido numeric, insuficientes boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  saldo NUMERIC;
  atual NUMERIC;
  ja_deduzido NUMERIC;
  a_deduzir NUMERIC;
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

    -- Quanto já foi deduzido por esta rotina para este produto
    SELECT COALESCE(SUM(
      CASE WHEN tipo = 'AJUSTE' THEN quantidade
           WHEN tipo = 'ENTRADA' AND motivo ILIKE 'Estorno%' THEN -quantidade
           ELSE 0 END
    ), 0)
      INTO ja_deduzido
      FROM public.stock_movements
     WHERE product_id = rec.pid
       AND (motivo = 'Separação: estoque já carregado em viagem aberta'
            OR motivo ILIKE 'Estorno: dedução em viagens duplicada');

    a_deduzir := saldo - ja_deduzido;
    IF a_deduzir <= 0 THEN
      product_id := rec.pid; deduzido := 0; insuficientes := false; RETURN NEXT;
      CONTINUE;
    END IF;

    IF atual < a_deduzir THEN
      product_id := rec.pid; deduzido := 0; insuficientes := true; RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE public.products SET estoque = atual - a_deduzir WHERE id = rec.pid;

    INSERT INTO public.stock_movements(product_id, tipo, quantidade, motivo, user_id)
    VALUES (rec.pid, 'AJUSTE', a_deduzir, 'Separação: estoque já carregado em viagem aberta', auth.uid());

    product_id := rec.pid; deduzido := a_deduzir; insuficientes := false; RETURN NEXT;
  END LOOP;
END $function$;
