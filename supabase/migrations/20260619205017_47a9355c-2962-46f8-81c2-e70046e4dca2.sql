CREATE TABLE public.hero_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  titulo TEXT,
  subtitulo TEXT,
  cta_label TEXT,
  cta_link TEXT,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hero_slides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hero_slides TO authenticated;
GRANT ALL ON public.hero_slides TO service_role;
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero slides ativos públicos" ON public.hero_slides FOR SELECT USING (ativo = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "hero slides admin manage" ON public.hero_slides FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER hero_slides_set_updated_at BEFORE UPDATE ON public.hero_slides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "hero-images public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'hero-images');
CREATE POLICY "hero-images admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "hero-images admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "hero-images admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hero-images' AND public.has_role(auth.uid(), 'admin'));