
-- Função genérica: uppercase + trim, mantendo NULL
CREATE OR REPLACE FUNCTION public._upper_trim(v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    WHEN NULLIF(TRIM(v),'') IS NULL THEN NULL
    ELSE UPPER(TRIM(v))
  END
$$;

-- LEADS
CREATE OR REPLACE FUNCTION public.uppercase_leads() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.empresa := public._upper_trim(NEW.empresa);
  NEW.contato := public._upper_trim(NEW.contato);
  NEW.cidade  := public._upper_trim(NEW.cidade);
  NEW.estado  := public._upper_trim(NEW.estado);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_normalize_cidade_leads ON public.leads;
DROP TRIGGER IF EXISTS trg_uppercase_leads ON public.leads;
CREATE TRIGGER trg_uppercase_leads BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.uppercase_leads();

-- COMPANIES
CREATE OR REPLACE FUNCTION public.uppercase_companies() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.legal_name := public._upper_trim(NEW.legal_name);
  NEW.trade_name := public._upper_trim(NEW.trade_name);
  NEW.cidade     := public._upper_trim(NEW.cidade);
  NEW.estado     := public._upper_trim(NEW.estado);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_normalize_cidade_companies ON public.companies;
DROP TRIGGER IF EXISTS trg_uppercase_companies ON public.companies;
CREATE TRIGGER trg_uppercase_companies BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.uppercase_companies();

-- SUPPLIERS
CREATE OR REPLACE FUNCTION public.uppercase_suppliers() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.razao_social  := public._upper_trim(NEW.razao_social);
  NEW.nome_fantasia := public._upper_trim(NEW.nome_fantasia);
  NEW.contato       := public._upper_trim(NEW.contato);
  NEW.cidade        := public._upper_trim(NEW.cidade);
  NEW.estado        := public._upper_trim(NEW.estado);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_uppercase_suppliers ON public.suppliers;
CREATE TRIGGER trg_uppercase_suppliers BEFORE INSERT OR UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.uppercase_suppliers();

-- ADDRESSES
CREATE OR REPLACE FUNCTION public.uppercase_addresses() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.label      := public._upper_trim(NEW.label);
  NEW.street     := public._upper_trim(NEW.street);
  NEW.number     := public._upper_trim(NEW.number);
  NEW.complement := public._upper_trim(NEW.complement);
  NEW.district   := public._upper_trim(NEW.district);
  NEW.city       := public._upper_trim(NEW.city);
  NEW.state      := public._upper_trim(NEW.state);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_uppercase_addresses ON public.addresses;
CREATE TRIGGER trg_uppercase_addresses BEFORE INSERT OR UPDATE ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.uppercase_addresses();

-- PRODUCTS (apenas identificação, não descrições longas)
CREATE OR REPLACE FUNCTION public.uppercase_products() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.nome                 := public._upper_trim(NEW.nome);
  NEW.modelo               := public._upper_trim(NEW.modelo);
  NEW.codigo_fabricante    := public._upper_trim(NEW.codigo_fabricante);
  NEW.localizacao          := public._upper_trim(NEW.localizacao);
  NEW.corredor             := public._upper_trim(NEW.corredor);
  NEW.prateleira           := public._upper_trim(NEW.prateleira);
  NEW.coluna               := public._upper_trim(NEW.coluna);
  NEW.posicao              := public._upper_trim(NEW.posicao);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_uppercase_products ON public.products;
CREATE TRIGGER trg_uppercase_products BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.uppercase_products();

-- BRANDS
CREATE OR REPLACE FUNCTION public.uppercase_brands() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.nome := public._upper_trim(NEW.nome);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_uppercase_brands ON public.brands;
CREATE TRIGGER trg_uppercase_brands BEFORE INSERT OR UPDATE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.uppercase_brands();

-- CATEGORIES
CREATE OR REPLACE FUNCTION public.uppercase_categories() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.nome := public._upper_trim(NEW.nome);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_uppercase_categories ON public.categories;
CREATE TRIGGER trg_uppercase_categories BEFORE INSERT OR UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.uppercase_categories();

-- Backfill dados existentes
UPDATE public.leads SET empresa=public._upper_trim(empresa), contato=public._upper_trim(contato), cidade=public._upper_trim(cidade), estado=public._upper_trim(estado);
UPDATE public.companies SET legal_name=public._upper_trim(legal_name), trade_name=public._upper_trim(trade_name), cidade=public._upper_trim(cidade), estado=public._upper_trim(estado);
UPDATE public.suppliers SET razao_social=public._upper_trim(razao_social), nome_fantasia=public._upper_trim(nome_fantasia), contato=public._upper_trim(contato), cidade=public._upper_trim(cidade), estado=public._upper_trim(estado);
UPDATE public.addresses SET label=public._upper_trim(label), street=public._upper_trim(street), number=public._upper_trim(number), complement=public._upper_trim(complement), district=public._upper_trim(district), city=public._upper_trim(city), state=public._upper_trim(state);
UPDATE public.products SET nome=public._upper_trim(nome), modelo=public._upper_trim(modelo), codigo_fabricante=public._upper_trim(codigo_fabricante), localizacao=public._upper_trim(localizacao), corredor=public._upper_trim(corredor), prateleira=public._upper_trim(prateleira), coluna=public._upper_trim(coluna), posicao=public._upper_trim(posicao);
UPDATE public.brands SET nome=public._upper_trim(nome);
UPDATE public.categories SET nome=public._upper_trim(nome);
