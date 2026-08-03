
CREATE POLICY "wa_campaign_images_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'wa-campaign-images');
CREATE POLICY "wa_campaign_images_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'wa-campaign-images');
CREATE POLICY "wa_campaign_images_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'wa-campaign-images');
CREATE POLICY "wa_campaign_images_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'wa-campaign-images');
