ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fechamento_id uuid REFERENCES public.fechamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_fechamento_id ON public.orders(fechamento_id);

-- Backfill: pedidos criados até a data em que cada acerto foi realizado,
-- dentro do período do acerto, ficam marcados como já acertados.
UPDATE public.orders o
SET fechamento_id = f.id
FROM public.fechamentos f
WHERE o.fechamento_id IS NULL
  AND o.status <> 'CANCELADO'
  AND o.created_at <= f.created_at
  AND (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= f.periodo_from
  AND (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= f.periodo_to;