
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_account_id_idx ON public.payments(account_id);
