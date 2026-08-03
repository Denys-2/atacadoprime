
ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS batch_size INT,
  ADD COLUMN IF NOT EXISTS batch_pause_minutes INT,
  ADD COLUMN IF NOT EXISTS message_interval_seconds INT,
  ADD COLUMN IF NOT EXISTS last_batch_at TIMESTAMPTZ;
