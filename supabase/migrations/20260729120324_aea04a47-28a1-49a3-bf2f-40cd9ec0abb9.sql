ALTER TABLE public.fechamentos
  ADD COLUMN IF NOT EXISTS valor_empresa_pendente numeric NOT NULL DEFAULT 0;