
ALTER TABLE public.trip_expenses
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS receipt_path TEXT;

-- RLS on trip-receipts storage: users authenticated leem/inserem/deletam apenas suas próprias fotos
CREATE POLICY "trip-receipts: authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trip-receipts');

CREATE POLICY "trip-receipts: authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trip-receipts');

CREATE POLICY "trip-receipts: authenticated delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trip-receipts' AND owner = auth.uid());
