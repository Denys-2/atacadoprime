DROP POLICY IF EXISTS "trip-receipts: authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "trip-receipts: authenticated insert" ON storage.objects;

CREATE POLICY "trip-receipts: owner read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'trip-receipts' AND owner = auth.uid());

CREATE POLICY "trip-receipts: owner insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trip-receipts' AND owner = auth.uid());