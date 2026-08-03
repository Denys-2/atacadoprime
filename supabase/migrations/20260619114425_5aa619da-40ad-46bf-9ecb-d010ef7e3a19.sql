UPDATE public.companies SET phone = regexp_replace(phone, '\D', '', 'g') WHERE phone IS NOT NULL;
UPDATE public.companies SET phone = '00000000000' WHERE phone IS NULL OR length(phone) < 10;
ALTER TABLE public.companies ALTER COLUMN phone SET NOT NULL;