
CREATE OR REPLACE FUNCTION public.crm_sync_lead_for_company(_company_id uuid, _created_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
  v_company RECORD;
  v_next_pos INT;
BEGIN
  IF _company_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_lead_id FROM public.leads WHERE company_id = _company_id LIMIT 1;

  IF v_lead_id IS NULL THEN
    SELECT c.legal_name, c.trade_name, c.phone, c.email, c.cidade, c.estado,
           c.latitude, c.longitude, c.owner_id
      INTO v_company
      FROM public.companies c WHERE c.id = _company_id;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_pos
      FROM public.leads WHERE status = 'PEDIDO'::lead_status;

    INSERT INTO public.leads(
      empresa, contato, whatsapp, email, cidade, estado,
      latitude, longitude, segmento, status, company_id,
      created_by, responsavel_id, position, observacoes
    ) VALUES (
      COALESCE(v_company.trade_name, v_company.legal_name, 'Cliente'),
      COALESCE(v_company.trade_name, v_company.legal_name, 'Cliente'),
      v_company.phone, v_company.email, v_company.cidade, v_company.estado,
      v_company.latitude, v_company.longitude,
      'OUTRO'::lead_segmento, 'PEDIDO'::lead_status, _company_id,
      COALESCE(_created_by, v_company.owner_id),
      COALESCE(_created_by, v_company.owner_id),
      v_next_pos,
      'Criado automaticamente a partir de pedido pago'
    );
  ELSE
    UPDATE public.leads
       SET status = 'PEDIDO'::lead_status,
           ultimo_contato = now(),
           updated_at = now()
     WHERE id = v_lead_id
       AND status <> 'PEDIDO'::lead_status;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_lead_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'PAGO') OR
    (TG_OP = 'UPDATE' AND NEW.status = 'PAGO' AND NEW.status IS DISTINCT FROM OLD.status)
  ) THEN
    RETURN NEW;
  END IF;
  PERFORM public.crm_sync_lead_for_company(NEW.company_id, NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_sync_lead_from_order ON public.orders;
CREATE TRIGGER trg_crm_sync_lead_from_order
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.crm_sync_lead_from_order();

-- Backfill: para cada empresa com pedido "pago em diante", sincroniza o lead
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (company_id) company_id, created_by
      FROM public.orders
     WHERE status IN ('PAGO','EM_SEPARACAO','ENVIADO','ENTREGUE')
       AND company_id IS NOT NULL
     ORDER BY company_id, created_at DESC
  LOOP
    PERFORM public.crm_sync_lead_for_company(r.company_id, r.created_by);
  END LOOP;
END $$;
