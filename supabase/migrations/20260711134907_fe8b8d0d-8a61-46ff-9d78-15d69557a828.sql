
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
  ja_saida_carga NUMERIC;
  ja_entrada_retorno NUMERIC;
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

    -- Ajustes anteriores desta própria rotina (líquido: AJUSTE - estornos)
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

    -- SAIDAs de carga em viagem (feitas pelo fluxo normal trip_load_items) em viagens AINDA ABERTAS
    SELECT COALESCE(SUM(sm.quantidade), 0) INTO ja_saida_carga
      FROM public.stock_movements sm
      JOIN public.trips t ON t.id = sm.reference_id
     WHERE sm.product_id = rec.pid
       AND sm.tipo = 'SAIDA'
       AND sm.motivo = 'Carga em viagem'
       AND t.status = 'open';

    -- Retornos já efetuados em viagens abertas (raro, mas por segurança)
    SELECT COALESCE(SUM(sm.quantidade), 0) INTO ja_entrada_retorno
      FROM public.stock_movements sm
      JOIN public.trips t ON t.id = sm.reference_id
     WHERE sm.product_id = rec.pid
       AND sm.tipo = 'ENTRADA'
       AND sm.motivo = 'Retorno de viagem'
       AND t.status = 'open';

    -- Faltando deduzir = saldo em viagens abertas − (já saído pela carga − retornos) − ajustes desta rotina
    a_deduzir := saldo - (ja_saida_carga - ja_entrada_retorno) - ja_deduzido;

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
