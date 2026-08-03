ALTER TABLE public.whatsapp_campaigns
ADD COLUMN IF NOT EXISTS send_limit integer;

COMMENT ON COLUMN public.whatsapp_campaigns.send_limit IS 'Número máximo de destinatários a enviar nesta campanha (null = sem limite)';