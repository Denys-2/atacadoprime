-- ============ #2 AUDIT LOGGING ============
CREATE OR REPLACE FUNCTION public.audit_log_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _old JSONB; _new JSONB; _action TEXT;
BEGIN
  IF TG_OP='INSERT' THEN _action:='INSERT'; _new:=to_jsonb(NEW);
  ELSIF TG_OP='UPDATE' THEN
    _action:='UPDATE'; _old:=to_jsonb(OLD); _new:=to_jsonb(NEW);
    IF _old = _new THEN RETURN NEW; END IF;
  ELSIF TG_OP='DELETE' THEN _action:='DELETE'; _old:=to_jsonb(OLD);
  END IF;
  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, old_data, new_data, created_at)
  VALUES (auth.uid(), _action, TG_TABLE_NAME,
          COALESCE((_new->>'id')::uuid, (_old->>'id')::uuid), _old, _new, now());
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS audit_financial_transactions ON public.financial_transactions;
CREATE TRIGGER audit_financial_transactions AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

DROP TRIGGER IF EXISTS audit_trip_expenses ON public.trip_expenses;
CREATE TRIGGER audit_trip_expenses AFTER INSERT OR UPDATE OR DELETE ON public.trip_expenses
FOR EACH ROW EXECUTE FUNCTION public.audit_log_change();

CREATE OR REPLACE FUNCTION public.audit_products_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP='UPDATE' AND (
    COALESCE(OLD.preco_custo,0) IS DISTINCT FROM COALESCE(NEW.preco_custo,0)
    OR COALESCE(OLD.preco_unitario,0) IS DISTINCT FROM COALESCE(NEW.preco_unitario,0)
    OR COALESCE(OLD.preco_pacote,0) IS DISTINCT FROM COALESCE(NEW.preco_pacote,0)
  ) THEN
    INSERT INTO public.audit_logs(user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'PRICE_CHANGE', 'products', NEW.id,
      jsonb_build_object('preco_custo', OLD.preco_custo, 'preco_unitario', OLD.preco_unitario, 'preco_pacote', OLD.preco_pacote),
      jsonb_build_object('preco_custo', NEW.preco_custo, 'preco_unitario', NEW.preco_unitario, 'preco_pacote', NEW.preco_pacote));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS audit_products_price_trg ON public.products;
CREATE TRIGGER audit_products_price_trg AFTER UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.audit_products_price();

-- ============ #10 STOCK MIN ALERT ============
CREATE OR REPLACE VIEW public.products_below_min AS
SELECT id, sku, nome, estoque, estoque_minimo,
       (COALESCE(estoque_minimo,0) - COALESCE(estoque,0)) AS falta,
       marca_id, categoria_id, status
FROM public.products
WHERE COALESCE(status, true) = true
  AND COALESCE(estoque_minimo,0) > 0
  AND COALESCE(estoque,0) < COALESCE(estoque_minimo,0);
GRANT SELECT ON public.products_below_min TO authenticated;

-- ============ #12 SALES TARGETS + FUNNEL ============
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_ref DATE NOT NULL,
  meta_valor NUMERIC NOT NULL DEFAULT 0,
  meta_qtd_pedidos INT DEFAULT 0,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendedor_id, mes_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_targets TO authenticated;
GRANT ALL ON public.sales_targets TO service_role;
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendedor vê própria meta" ON public.sales_targets FOR SELECT TO authenticated
USING (vendedor_id = auth.uid() OR public.is_manager(auth.uid()));
CREATE POLICY "Gerente gerencia metas" ON public.sales_targets FOR ALL TO authenticated
USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE TRIGGER sales_targets_updated_at BEFORE UPDATE ON public.sales_targets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE VIEW public.sales_targets_progress AS
SELECT st.id, st.vendedor_id, st.mes_ref, st.meta_valor, st.meta_qtd_pedidos,
  COALESCE(SUM(o.total),0) AS vendido_valor,
  COUNT(o.id) AS vendido_qtd,
  CASE WHEN st.meta_valor>0 THEN (COALESCE(SUM(o.total),0)/st.meta_valor)*100 ELSE 0 END AS pct_atingido
FROM public.sales_targets st
LEFT JOIN public.orders o ON o.created_by = st.vendedor_id
  AND o.status <> 'CANCELADO'
  AND date_trunc('month', o.created_at) = st.mes_ref
GROUP BY st.id;
GRANT SELECT ON public.sales_targets_progress TO authenticated;

CREATE OR REPLACE VIEW public.lead_funnel_metrics AS
SELECT status AS etapa, COUNT(*) AS quantidade,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '30 days') AS ultimos_30_dias
FROM public.leads GROUP BY status;
GRANT SELECT ON public.lead_funnel_metrics TO authenticated;

-- ============ #16 LGPD ============
CREATE TABLE IF NOT EXISTS public.lgpd_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  requester_email TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('EXPORT','DELETE','ACCESS')),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','NEGADO')),
  observacao TEXT,
  processado_por UUID REFERENCES auth.users(id),
  processado_em TIMESTAMPTZ,
  export_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lgpd_requests TO authenticated;
GRANT ALL ON public.lgpd_requests TO service_role;
ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gerente gerencia LGPD" ON public.lgpd_requests FOR ALL TO authenticated
USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE TRIGGER lgpd_requests_updated_at BEFORE UPDATE ON public.lgpd_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ #9 CYCLIC INVENTORY ============
ALTER TABLE public.inventory_counts
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'CICLICO' CHECK (tipo IN ('CICLICO','GERAL','ESPOT')),
  ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.inventory_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qtd_sistema NUMERIC NOT NULL DEFAULT 0,
  qtd_contada NUMERIC,
  divergencia NUMERIC GENERATED ALWAYS AS (COALESCE(qtd_contada,0) - qtd_sistema) STORED,
  observacao TEXT,
  ajustado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (count_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_count_items TO authenticated;
GRANT ALL ON public.inventory_count_items TO service_role;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gerencia contagem" ON public.inventory_count_items FOR ALL TO authenticated
USING (public.is_sales_staff(auth.uid())) WITH CHECK (public.is_sales_staff(auth.uid()));
CREATE TRIGGER inventory_count_items_updated_at BEFORE UPDATE ON public.inventory_count_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.inventory_apply_adjustments(_count_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE it RECORD; n INT := 0;
BEGIN
  IF NOT public.is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Somente gerente pode aprovar ajuste';
  END IF;
  FOR it IN
    SELECT * FROM public.inventory_count_items
    WHERE count_id = _count_id AND ajustado = false AND qtd_contada IS NOT NULL AND divergencia <> 0
  LOOP
    PERFORM public.stock_apply_delta(
      it.product_id, it.divergencia,
      CASE WHEN it.divergencia>0 THEN 'ENTRADA' ELSE 'SAIDA' END,
      'Ajuste inventário ' || substring(_count_id::text,1,8),
      _count_id, TRUE
    );
    UPDATE public.inventory_count_items SET ajustado = true WHERE id = it.id;
    n := n + 1;
  END LOOP;
  UPDATE public.inventory_counts SET aprovado_por = auth.uid(), aprovado_em = now() WHERE id = _count_id;
  RETURN n;
END; $$;

-- ============ #4 BANK RECONCILIATION ============
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('CREDITO','DEBITO')),
  documento TEXT,
  fitid TEXT,
  conciliado BOOLEAN NOT NULL DEFAULT false,
  transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, fitid)
);
CREATE INDEX IF NOT EXISTS idx_bank_statements_account_data ON public.bank_statements(account_id, data);
CREATE INDEX IF NOT EXISTS idx_bank_statements_pendentes ON public.bank_statements(conciliado) WHERE conciliado = false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statements TO authenticated;
GRANT ALL ON public.bank_statements TO service_role;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gerente gerencia extratos" ON public.bank_statements FOR ALL TO authenticated
USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));
CREATE TRIGGER bank_statements_updated_at BEFORE UPDATE ON public.bank_statements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ #11 ABANDONED CARTS ============
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  cart_token TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  recovery_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_notify ON public.abandoned_carts(last_activity)
  WHERE notified_at IS NULL AND recovered_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abandoned_carts TO authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff gerencia carrinhos" ON public.abandoned_carts FOR ALL TO authenticated
USING (public.is_sales_staff(auth.uid())) WITH CHECK (public.is_sales_staff(auth.uid()));
CREATE TRIGGER abandoned_carts_updated_at BEFORE UPDATE ON public.abandoned_carts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ #14 ERROR LOG CENTRAL ============
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  origem TEXT NOT NULL CHECK (origem IN ('FRONTEND','BACKEND','EDGE','SERVER_FN')),
  nivel TEXT NOT NULL DEFAULT 'ERROR' CHECK (nivel IN ('DEBUG','INFO','WARN','ERROR','FATAL')),
  mensagem TEXT NOT NULL,
  stack TEXT,
  contexto JSONB,
  url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_nivel ON public.error_logs(nivel, created_at DESC);
GRANT SELECT, INSERT ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticado insere próprio erro" ON public.error_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Gerente lê erros" ON public.error_logs FOR SELECT TO authenticated
USING (public.is_manager(auth.uid()));