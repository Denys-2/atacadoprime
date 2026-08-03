-- Acesso autenticado completo a product-images e visit-photos
CREATE POLICY "Auth read images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('product-images','visit-photos'));

CREATE POLICY "Auth insert images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('product-images','visit-photos'));

CREATE POLICY "Auth update images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('product-images','visit-photos'));

CREATE POLICY "Auth delete images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('product-images','visit-photos'));