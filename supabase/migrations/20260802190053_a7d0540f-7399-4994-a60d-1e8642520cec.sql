ALTER TABLE public.fechamentos
ADD COLUMN IF NOT EXISTS despesa_viagem_periodo numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS despesa_empresa_periodo numeric DEFAULT 0;