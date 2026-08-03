
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories read all" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brands TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands read all" ON public.brands FOR SELECT USING (true);
CREATE POLICY "brands admin write" ON public.brands FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.product_tipo AS ENUM
  ('controle','carcaca','alarme','modulo','transponder','lamina','bateria','acessorio');

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  codigo_fabricante TEXT,
  categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  marca_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  modelo TEXT,
  descricao_curta TEXT,
  descricao_completa TEXT,
  frequencia TEXT,
  quantidade_botoes INT,
  tipo public.product_tipo,
  observacoes_tecnicas TEXT,
  estoque INT NOT NULL DEFAULT 0,
  estoque_minimo INT NOT NULL DEFAULT 0,
  localizacao TEXT,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_pacote INT NOT NULL DEFAULT 1,
  preco_pacote NUMERIC(12,2),
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_categoria ON public.products(categoria_id);
CREATE INDEX idx_products_marca ON public.products(marca_id);
CREATE INDEX idx_products_tipo ON public.products(tipo);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_search ON public.products
  USING gin (to_tsvector('portuguese',
    coalesce(nome,'')||' '||coalesce(sku,'')||' '||coalesce(codigo_fabricante,'')
    ||' '||coalesce(modelo,'')||' '||coalesce(frequencia,'')));
CREATE INDEX idx_products_nome_trgm ON public.products USING gin (nome gin_trgm_ops);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products read all" ON public.products FOR SELECT USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.image_tipo AS ENUM
  ('principal','secundaria','traseira','placa','botoes','tecnica');

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  tipo_imagem public.image_tipo NOT NULL DEFAULT 'principal',
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_images_product ON public.product_images(product_id);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_images read all" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "product_images admin write" ON public.product_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.compatibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compat_product ON public.compatibilities(product_id);
CREATE INDEX idx_compat_desc_trgm ON public.compatibilities USING gin (descricao gin_trgm_ops);
GRANT SELECT ON public.compatibilities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.compatibilities TO authenticated;
GRANT ALL ON public.compatibilities TO service_role;
ALTER TABLE public.compatibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compat read all" ON public.compatibilities FOR SELECT USING (true);
CREATE POLICY "compat admin write" ON public.compatibilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites self" ON public.favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.categories (nome, slug) VALUES
  ('Chaves Canivete','chaves-canivete'),
  ('Controles de Alarme','controles-de-alarme'),
  ('Carcaças','carcacas'),
  ('Alarmes','alarmes'),
  ('Módulos','modulos'),
  ('Baterias','baterias'),
  ('Transponders','transponders'),
  ('Lâminas','laminas'),
  ('Acessórios','acessorios');

INSERT INTO public.brands (nome) VALUES
  ('Positron'),('FKS'),('Olimpus'),('PX'),('Taramps');
