
-- product-images: revoke broad authenticated write/update/delete
DROP POLICY IF EXISTS "Auth insert images" ON storage.objects;
DROP POLICY IF EXISTS "Auth update images" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete images" ON storage.objects;

-- visit-photos: revoke broad authenticated CRUD
DROP POLICY IF EXISTS "Auth read images" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert visit images" ON storage.objects;
DROP POLICY IF EXISTS "Auth update visit images" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete visit images" ON storage.objects;

-- Recreate scoped policies for visit-photos (staff only)
CREATE POLICY "visit-photos staff read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'visit-photos' AND public.is_sales_staff(auth.uid()));

CREATE POLICY "visit-photos staff insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'visit-photos' AND public.is_sales_staff(auth.uid()));

CREATE POLICY "visit-photos staff update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'visit-photos' AND public.is_sales_staff(auth.uid()))
WITH CHECK (bucket_id = 'visit-photos' AND public.is_sales_staff(auth.uid()));

CREATE POLICY "visit-photos staff delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'visit-photos' AND public.is_sales_staff(auth.uid()));

-- wa_campaign_images: restrict to admins
DROP POLICY IF EXISTS "wa_campaign_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "wa_campaign_images_update" ON storage.objects;
DROP POLICY IF EXISTS "wa_campaign_images_delete" ON storage.objects;
DROP POLICY IF EXISTS "wa_campaign_images_read" ON storage.objects;

CREATE POLICY "wa_campaign_images admin read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'wa-campaign-images' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "wa_campaign_images admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wa-campaign-images' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "wa_campaign_images admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'wa-campaign-images' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'wa-campaign-images' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "wa_campaign_images admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'wa-campaign-images' AND public.has_role(auth.uid(),'admin'));
