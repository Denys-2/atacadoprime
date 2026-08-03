CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job antigo se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('abandoned-carts-notify');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- A cada 1 hora, chama o endpoint que envia WhatsApp para carrinhos abandonados
SELECT cron.schedule(
  'abandoned-carts-notify',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--f6fdd83d-738f-496c-8445-a3838d9aa7cf.lovable.app/api/public/hooks/abandoned-carts-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aGRkeWJ6cGpybndmbHRraXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTgxOTYsImV4cCI6MjA5NzMzNDE5Nn0.sk2txLJSs2F6lWUm7-kbtaL4PTwSu__6WUtQsPGWlv8'
    ),
    body := '{"source":"pg_cron"}'::jsonb
  ) AS request_id;
  $$
);