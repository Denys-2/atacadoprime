
-- 1) Novas taxas Ton (Débito 1,22 / Crédito 1x 3,02 / 2-6x 5,38 / 7-12x 6,11)
UPDATE public.payment_fees
   SET debito = 1.22,
       credito_avista = 3.02,
       credito_2_6 = 5.38,
       credito_7_12 = 6.11,
       updated_at = now()
 WHERE ativo;

-- 2) Antecipação zerada (D+1 vira padrão para todas as vendas)
INSERT INTO public.system_settings (categoria, chave, valor)
VALUES ('financeiro', 'antecipacao_taxa_percentual', to_jsonb(0::numeric))
ON CONFLICT (categoria, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();

-- 3) Banco Ton
INSERT INTO public.bank_accounts (nome, banco, tipo, ativo, default_cartao, default_pix, default_dinheiro, saldo_inicial)
VALUES ('TON', 'TON (Stone)', 'CORRENTE', true, true, false, false, 0)
ON CONFLICT DO NOTHING;

-- 3.1) Ton passa a ser o default de cartão
UPDATE public.bank_accounts SET default_cartao = false WHERE default_cartao = true AND nome <> 'TON';
UPDATE public.bank_accounts SET default_cartao = true WHERE nome = 'TON';

-- 4) Trigger: todas as vendas de cartão em D+1 (crédito e débito), sem taxa de antecipação
CREATE OR REPLACE FUNCTION public.order_sync_financials()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pay RECORD;
  pay_tipo TEXT;
  modalidade TEXT;
  bandeira TEXT;
  parcelas_num INT := 1;
  conta_txt TEXT;
  observ_txt TEXT;
  acc_id UUID;
  fee_rec RECORD;
  taxa_bandeira NUMERIC := 0;
  taxa_total_pct NUMERIC := 0;
  bruto_total NUMERIC := 0;
  liquido_total NUMERIC := 0;
  taxa_valor_total NUMERIC := 0;
  parcela_bruto NUMERIC := 0;
  parcela_liquido NUMERIC := 0;
  i INT;
  venc DATE;
  desc_base TEXT;
  desc_dia TEXT;
  ja_despesa_dia UUID;
  custo_total NUMERIC := 0;
  is_credito BOOLEAN;
  is_cartao BOOLEAN;
  status_fin TEXT;
  pagamento_fin DATE;
  forma_txt TEXT;
  allowed_formas TEXT[] := ARRAY['PIX','CARTAO','BOLETO','DINHEIRO','TRANSFERENCIA','OUTRO'];
BEGIN
  IF NOT (
    (TG_OP='INSERT' AND NEW.status='PAGO') OR
    (TG_OP='UPDATE' AND NEW.status='PAGO' AND NEW.status IS DISTINCT FROM OLD.status)
  ) THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE order_id = NEW.id AND tipo = 'RECEITA') THEN
    RETURN NEW;
  END IF;

  SELECT tipo::text,
         COALESCE((payload->>'parcelas')::int, 1) AS parcelas,
         payload->>'conta' AS conta,
         payload->>'observacao' AS observ,
         payload->>'modalidade' AS modalidade,
         COALESCE(payments.bandeira, payload->>'bandeira') AS bandeira,
         account_id
    INTO pay
    FROM public.payments
   WHERE order_id = NEW.id
   ORDER BY created_at DESC
   LIMIT 1;

  pay_tipo := pay.tipo;
  parcelas_num := GREATEST(COALESCE(pay.parcelas, 1), 1);
  conta_txt := pay.conta;
  observ_txt := pay.observ;
  acc_id := pay.account_id;
  bandeira := pay.bandeira;
  modalidade := UPPER(COALESCE(pay.modalidade,
    CASE WHEN pay_tipo = 'CARTAO' THEN 'CREDITO' ELSE pay_tipo END));

  is_cartao := (pay_tipo = 'CARTAO');
  is_credito := (is_cartao AND modalidade = 'CREDITO');

  -- Conta padrão: cartão sempre no default_cartao (Ton)
  IF acc_id IS NULL THEN
    IF is_cartao THEN
      SELECT id INTO acc_id FROM public.bank_accounts WHERE default_cartao AND ativo LIMIT 1;
    ELSIF pay_tipo = 'PIX' THEN
      SELECT id INTO acc_id FROM public.bank_accounts WHERE default_pix AND ativo LIMIT 1;
    ELSIF pay_tipo = 'DINHEIRO' THEN
      SELECT id INTO acc_id FROM public.bank_accounts WHERE default_dinheiro AND ativo LIMIT 1;
    END IF;
  END IF;

  forma_txt := CASE WHEN pay_tipo = ANY(allowed_formas) THEN pay_tipo ELSE 'OUTRO' END;
  desc_base := COALESCE(observ_txt, 'Venda #'||substring(NEW.id::text,1,8));
  bruto_total := COALESCE(NEW.total, 0);

  IF is_cartao THEN
    -- Busca taxa da bandeira
    IF bandeira IS NOT NULL THEN
      SELECT * INTO fee_rec FROM public.payment_fees
       WHERE ativo AND LOWER(payment_fees.bandeira) = LOWER(bandeira) LIMIT 1;
      IF FOUND THEN
        IF NOT is_credito THEN
          taxa_bandeira := COALESCE(fee_rec.debito, 0);
        ELSIF parcelas_num = 1 THEN
          taxa_bandeira := COALESCE(fee_rec.credito_avista, 0);
        ELSIF parcelas_num BETWEEN 2 AND 6 THEN
          taxa_bandeira := COALESCE(fee_rec.credito_2_6, 0);
        ELSE
          taxa_bandeira := COALESCE(fee_rec.credito_7_12, 0);
        END IF;
      END IF;
    END IF;

    taxa_total_pct := COALESCE(taxa_bandeira, 0);
    taxa_valor_total := ROUND(bruto_total * taxa_total_pct / 100.0, 2);
    liquido_total := bruto_total - taxa_valor_total;

    -- Débito: 1 parcela; Crédito: N parcelas — todas D+1
    IF NOT is_credito THEN parcelas_num := 1; END IF;

    parcela_bruto := ROUND(bruto_total / parcelas_num, 2);
    parcela_liquido := ROUND(liquido_total / parcelas_num, 2);

    FOR i IN 1..parcelas_num LOOP
      -- D+1 para TODAS as parcelas (débito e crédito)
      venc := CURRENT_DATE + INTERVAL '1 day';

      IF i = parcelas_num THEN
        parcela_bruto := bruto_total - ROUND(bruto_total / parcelas_num, 2) * (parcelas_num - 1);
        parcela_liquido := liquido_total - ROUND(liquido_total / parcelas_num, 2) * (parcelas_num - 1);
      END IF;

      INSERT INTO public.financial_transactions(
        order_id, company_id, tipo, status, valor, valor_bruto,
        vencimento, pagamento, descricao, forma_pagamento,
        parcelas, parcela_num, parcelas_total,
        bandeira, taxa_percentual, taxas, antecipado, account_id
      ) VALUES (
        NEW.id, NEW.company_id, 'RECEITA', 'PENDENTE',
        parcela_liquido, parcela_bruto,
        venc, NULL,
        desc_base || CASE WHEN is_credito THEN ' (' || i || '/' || parcelas_num || ' — ' || COALESCE(bandeira,'Cartão') || ' D+1)'
                          ELSE ' (Débito ' || COALESCE(bandeira,'') || ' D+1)' END,
        forma_txt, parcelas_num, i, parcelas_num,
        bandeira, taxa_total_pct,
        ROUND(parcela_bruto * taxa_total_pct / 100.0, 2),
        false, acc_id
      );
    END LOOP;

    IF taxa_valor_total > 0 THEN
      INSERT INTO public.financial_transactions(
        order_id, tipo, status, valor, vencimento, pagamento, descricao, forma_pagamento
      ) VALUES (
        NEW.id, 'DESPESA', 'PAGO', taxa_valor_total,
        CURRENT_DATE, CURRENT_DATE,
        'Taxa Ton — Venda #' || substring(NEW.id::text,1,8) ||
          ' (' || COALESCE(bandeira,'?') || ' ' ||
          CASE WHEN is_credito THEN parcelas_num || 'x' ELSE 'Débito' END || ')',
        'OUTRO'
      );
    END IF;

  ELSE
    -- PIX / Dinheiro: 1 linha, quitada hoje, sem taxa
    status_fin := 'PAGO';
    pagamento_fin := CURRENT_DATE;

    INSERT INTO public.financial_transactions(
      order_id, company_id, tipo, status, valor, valor_bruto,
      vencimento, pagamento, descricao, forma_pagamento,
      parcelas, parcela_num, parcelas_total, bandeira, taxa_percentual, taxas, antecipado, account_id
    ) VALUES (
      NEW.id, NEW.company_id, 'RECEITA', status_fin,
      bruto_total, bruto_total,
      CURRENT_DATE, pagamento_fin,
      desc_base || CASE
        WHEN pay_tipo = 'PIX' THEN ' (PIX)'
        WHEN pay_tipo = 'DINHEIRO' THEN ' (Dinheiro)'
        ELSE ''
      END,
      forma_txt, 1, 1, 1, bandeira, 0, 0, false, acc_id
    );
  END IF;

  -- Custo das peças
  IF NEW.trip_id IS NULL AND NEW.custo_lancado_em IS NULL THEN
    SELECT COALESCE(SUM(oi.quantidade * COALESCE(oi.custo_unitario, 0)),0) INTO custo_total
      FROM public.order_items oi
     WHERE oi.order_id = NEW.id;

    IF custo_total > 0 THEN
      desc_dia := 'Custos das peças vendidas ' || to_char(CURRENT_DATE, 'DD/MM/YYYY');

      SELECT id INTO ja_despesa_dia
        FROM public.financial_transactions
       WHERE tipo='DESPESA' AND order_id IS NULL AND descricao = desc_dia
       LIMIT 1;

      IF ja_despesa_dia IS NULL THEN
        INSERT INTO public.financial_transactions(order_id, company_id, tipo, status, valor, vencimento, descricao)
        VALUES (NULL, NULL, 'DESPESA', 'PENDENTE', custo_total,
                CURRENT_DATE + INTERVAL '30 days', desc_dia);
      ELSE
        UPDATE public.financial_transactions
           SET valor = valor + custo_total, updated_at = now()
         WHERE id = ja_despesa_dia;
      END IF;
    END IF;

    NEW.custo_lancado_em := now();
  END IF;

  RETURN NEW;
END;
$function$;
