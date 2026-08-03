
DROP FUNCTION IF EXISTS public.finance_kpis(DATE, DATE);

CREATE OR REPLACE FUNCTION public.finance_kpis(_from DATE, _to DATE)
 RETURNS TABLE(
   a_receber NUMERIC,
   a_receber_vencidas NUMERIC,
   a_pagar_total NUMERIC,
   a_pagar_total_vencidas NUMERIC,
   contas_pagar NUMERIC,
   contas_pagar_vencidas NUMERIC,
   custo_pecas_periodo NUMERIC,
   despesas_viagem_periodo NUMERIC
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE((SELECT SUM(valor) FROM public.financial_transactions
              WHERE tipo='RECEITA' AND status IN ('PENDENTE','PARCIAL','ATRASADO')), 0),
    COALESCE((SELECT SUM(valor) FROM public.financial_transactions
              WHERE tipo='RECEITA' AND status='ATRASADO'), 0),
    COALESCE((SELECT SUM(valor) FROM public.financial_transactions
              WHERE tipo='DESPESA' AND status IN ('PENDENTE','PARCIAL','ATRASADO')), 0),
    COALESCE((SELECT SUM(valor) FROM public.financial_transactions
              WHERE tipo='DESPESA' AND status='ATRASADO'), 0),
    COALESCE((SELECT SUM(valor) FROM public.financial_transactions
              WHERE tipo='DESPESA' AND status IN ('PENDENTE','PARCIAL','ATRASADO')
                AND descricao !~* 'custo.*pe[çc]a'), 0),
    COALESCE((SELECT SUM(valor) FROM public.financial_transactions
              WHERE tipo='DESPESA' AND status='ATRASADO'
                AND descricao !~* 'custo.*pe[çc]a'), 0),
    COALESCE((SELECT SUM(oi.quantidade * COALESCE(oi.custo_unitario,0))
                FROM public.orders o
                JOIN public.order_items oi ON oi.order_id = o.id
               WHERE o.status <> 'CANCELADO'
                 AND o.created_at::date BETWEEN _from AND _to), 0),
    COALESCE((SELECT SUM(valor) FROM public.trip_expenses
              WHERE data BETWEEN _from AND _to), 0)
$function$;

REVOKE ALL ON FUNCTION public.finance_kpis(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_kpis(DATE, DATE) TO authenticated, service_role;
