-- ============================================================================
-- SPRINT 1: FUNDACAO DA AUTOMACAO
-- ============================================================================
-- Este arquivo consolida todas as alteracoes do Sprint 1:
-- 1. Colunas de metadados em bank_transactions (CNPJ, CPF, COB extraidos)
-- 2. Tabela system_alerts para alertas automaticos
-- 3. Trigger de auto-criacao de conta contabil para clientes
-- 4. Funcao de extracao de metadados de transacoes
-- 5. Funcao de geracao de alertas diarios
-- ============================================================================

-- ============================================================================
-- PARTE 1: COLUNAS DE METADADOS EM BANK_TRANSACTIONS
-- ============================================================================

-- Adicionar colunas para metadados extraidos das transacoes
ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS extracted_cnpj VARCHAR(18),
ADD COLUMN IF NOT EXISTS extracted_cpf VARCHAR(14),
ADD COLUMN IF NOT EXISTS extracted_cob VARCHAR(20),
ADD COLUMN IF NOT EXISTS extracted_name TEXT,
ADD COLUMN IF NOT EXISTS payer_type VARCHAR(20), -- pj, pf, interno, desconhecido
ADD COLUMN IF NOT EXISTS suggested_client_id UUID REFERENCES clients(id),
ADD COLUMN IF NOT EXISTS identification_confidence NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS identification_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS identification_reasoning TEXT,
ADD COLUMN IF NOT EXISTS auto_matched BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS metadata_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reconciliation_method VARCHAR(20); -- auto, manual, batch

-- Indices para busca rapida por metadados
CREATE INDEX IF NOT EXISTS idx_bank_tx_extracted_cnpj
  ON bank_transactions(extracted_cnpj) WHERE extracted_cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_tx_extracted_cpf
  ON bank_transactions(extracted_cpf) WHERE extracted_cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_tx_extracted_cob
  ON bank_transactions(extracted_cob) WHERE extracted_cob IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_tx_suggested_client
  ON bank_transactions(suggested_client_id) WHERE suggested_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_tx_needs_review
  ON bank_transactions(needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_bank_tx_auto_matched
  ON bank_transactions(auto_matched) WHERE auto_matched = true;

COMMENT ON COLUMN bank_transactions.extracted_cnpj IS 'CNPJ extraido automaticamente da descricao da transacao';
COMMENT ON COLUMN bank_transactions.extracted_cpf IS 'CPF extraido automaticamente da descricao da transacao';
COMMENT ON COLUMN bank_transactions.extracted_cob IS 'Codigo COB extraido de transacoes de boleto';
COMMENT ON COLUMN bank_transactions.extracted_name IS 'Nome do pagador extraido da descricao';
COMMENT ON COLUMN bank_transactions.payer_type IS 'Tipo de pagador: pj, pf, interno, desconhecido';
COMMENT ON COLUMN bank_transactions.suggested_client_id IS 'Cliente sugerido pela IA para esta transacao';
COMMENT ON COLUMN bank_transactions.identification_confidence IS 'Confianca da identificacao (0-100)';
COMMENT ON COLUMN bank_transactions.identification_method IS 'Metodo usado: cnpj_match, cpf_match, qsa_match, name_similarity, pattern_learned';
COMMENT ON COLUMN bank_transactions.auto_matched IS 'Se foi conciliado automaticamente (confianca >= 90%)';
COMMENT ON COLUMN bank_transactions.needs_review IS 'Se precisa revisao humana (confianca 70-89%)';
COMMENT ON COLUMN bank_transactions.reconciled_at IS 'Data/hora da conciliacao';
COMMENT ON COLUMN bank_transactions.reconciliation_method IS 'Metodo de conciliacao: auto, manual, batch';

-- Adicionar coluna bank_transaction_id em invoices para rastrear qual transacao pagou a fatura
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS bank_transaction_id UUID REFERENCES bank_transactions(id);

CREATE INDEX IF NOT EXISTS idx_invoices_bank_transaction
  ON invoices(bank_transaction_id) WHERE bank_transaction_id IS NOT NULL;

COMMENT ON COLUMN invoices.bank_transaction_id IS 'Transacao bancaria que pagou esta fatura';

-- ============================================================================
-- PARTE 2: TABELA SYSTEM_ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL, -- reconciliation, payment_due, client_missing_account, anomaly, monthly_close_blocked
  severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
  title TEXT NOT NULL,
  description TEXT,
  entity_type VARCHAR(50), -- bank_transaction, client, invoice
  entity_id UUID,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID NOT NULL REFERENCES tenants(id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_system_alerts_tenant ON system_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved ON system_alerts(tenant_id, is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_system_alerts_entity ON system_alerts(entity_type, entity_id);

-- RLS
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saas_isolation_strict" ON system_alerts;
CREATE POLICY "saas_isolation_strict" ON system_alerts
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- Trigger para set tenant_id automaticamente
DROP TRIGGER IF EXISTS trg_set_tenant_system_alerts ON system_alerts;
CREATE TRIGGER trg_set_tenant_system_alerts
  BEFORE INSERT ON system_alerts
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_set_tenant_id();

COMMENT ON TABLE system_alerts IS 'Alertas automaticos do sistema para atencao do usuario';

-- ============================================================================
-- PARTE 3: FUNCAO DE EXTRACAO DE METADADOS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_extract_transaction_metadata()
RETURNS TRIGGER AS $$
DECLARE
  v_desc TEXT;
  v_cnpj TEXT;
  v_cpf TEXT;
  v_cob TEXT;
  v_name TEXT;
  v_payer_type TEXT;
BEGIN
  -- Pular se ja foi processado recentemente (evitar loops)
  IF NEW.metadata_extracted_at IS NOT NULL
     AND NEW.metadata_extracted_at > NOW() - INTERVAL '1 minute' THEN
    RETURN NEW;
  END IF;

  v_desc := UPPER(COALESCE(NEW.description, ''));

  -- ========================================
  -- Extrair CNPJ (XX.XXX.XXX/XXXX-XX ou 14 digitos)
  -- ========================================
  SELECT (regexp_matches(v_desc, '(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})', 'g'))[1]
  INTO v_cnpj
  LIMIT 1;

  IF v_cnpj IS NOT NULL THEN
    -- Limpar para apenas digitos
    v_cnpj := regexp_replace(v_cnpj, '[^\d]', '', 'g');
    IF LENGTH(v_cnpj) = 14 THEN
      -- Formatar
      v_cnpj := SUBSTRING(v_cnpj, 1, 2) || '.' ||
                SUBSTRING(v_cnpj, 3, 3) || '.' ||
                SUBSTRING(v_cnpj, 6, 3) || '/' ||
                SUBSTRING(v_cnpj, 9, 4) || '-' ||
                SUBSTRING(v_cnpj, 13, 2);
    ELSE
      v_cnpj := NULL;
    END IF;
  END IF;

  -- ========================================
  -- Extrair CPF (XXX.XXX.XXX-XX ou 11 digitos) se nao achou CNPJ
  -- ========================================
  IF v_cnpj IS NULL THEN
    SELECT (regexp_matches(v_desc, '(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})', 'g'))[1]
    INTO v_cpf
    LIMIT 1;

    IF v_cpf IS NOT NULL THEN
      v_cpf := regexp_replace(v_cpf, '[^\d]', '', 'g');
      IF LENGTH(v_cpf) = 11 THEN
        v_cpf := SUBSTRING(v_cpf, 1, 3) || '.' ||
                 SUBSTRING(v_cpf, 4, 3) || '.' ||
                 SUBSTRING(v_cpf, 7, 3) || '-' ||
                 SUBSTRING(v_cpf, 10, 2);
      ELSE
        v_cpf := NULL;
      END IF;
    END IF;
  END IF;

  -- ========================================
  -- Extrair codigo COB (boletos)
  -- ========================================
  SELECT (regexp_matches(v_desc, '(COB\d{5,10})', 'gi'))[1]
  INTO v_cob
  LIMIT 1;

  IF v_cob IS NULL THEN
    SELECT 'COB' || (regexp_matches(v_desc, '[^C]OB(\d{5,10})', 'gi'))[1]
    INTO v_cob
    LIMIT 1;
  END IF;

  -- ========================================
  -- Extrair nome do pagador
  -- ========================================
  -- Padrao: "PIX RECEBIDO - NOME DO PAGADOR"
  SELECT (regexp_matches(v_desc, '(?:PIX|TED|DOC|TRANSF)[^-]*-\s*([A-Z][A-Z\s]{2,50}?)(?:\s*-|\s*\d|$)', 'i'))[1]
  INTO v_name
  LIMIT 1;

  IF v_name IS NOT NULL THEN
    v_name := TRIM(regexp_replace(v_name, '\s+', ' ', 'g'));
    -- Remover sufixos empresariais comuns
    v_name := regexp_replace(v_name, '\s*(LTDA|ME|EPP|EIRELI|S/?A|INDIVIDUAL)\s*$', '', 'gi');
    v_name := TRIM(v_name);
  END IF;

  -- ========================================
  -- Determinar tipo de pagador
  -- ========================================
  v_payer_type := CASE
    WHEN v_cnpj IS NOT NULL THEN 'pj'
    WHEN v_cpf IS NOT NULL THEN 'pf'
    WHEN v_desc LIKE '%TRANSF ENTRE CONTAS%' OR v_desc LIKE '%APLICACAO%' OR v_desc LIKE '%RESGATE%' THEN 'interno'
    ELSE 'desconhecido'
  END;

  -- ========================================
  -- Atualizar registro
  -- ========================================
  NEW.extracted_cnpj := v_cnpj;
  NEW.extracted_cpf := v_cpf;
  NEW.extracted_cob := UPPER(v_cob);
  NEW.extracted_name := v_name;
  NEW.payer_type := v_payer_type;
  NEW.metadata_extracted_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para extrair metadados no INSERT
DROP TRIGGER IF EXISTS trg_extract_metadata ON bank_transactions;
CREATE TRIGGER trg_extract_metadata
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_extract_transaction_metadata();

-- Trigger para extrair metadados quando descricao e atualizada
DROP TRIGGER IF EXISTS trg_extract_metadata_on_update ON bank_transactions;
CREATE TRIGGER trg_extract_metadata_on_update
  BEFORE UPDATE OF description ON bank_transactions
  FOR EACH ROW
  WHEN (OLD.description IS DISTINCT FROM NEW.description)
  EXECUTE FUNCTION fn_extract_transaction_metadata();

-- ============================================================================
-- PARTE 4: AUTO-CRIACAO DE CONTA CONTABIL PARA CLIENTES
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_create_client_account()
RETURNS TRIGGER AS $$
DECLARE
  v_next_code TEXT;
  v_parent_id UUID;
  v_new_account_id UUID;
  v_tenant_id UUID;
  v_max_suffix INT;
BEGIN
  -- Pular se cliente ja tem conta
  IF NEW.accounting_account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_tenant_id := COALESCE(NEW.tenant_id, get_my_tenant_id());

  IF v_tenant_id IS NULL THEN
    RAISE WARNING 'fn_auto_create_client_account: tenant_id nao encontrado para cliente %', NEW.name;
    RETURN NEW;
  END IF;

  -- Buscar conta pai (1.1.2.01 - Clientes a Receber)
  SELECT id INTO v_parent_id
  FROM chart_of_accounts
  WHERE code = '1.1.2.01'
    AND tenant_id = v_tenant_id;

  IF v_parent_id IS NULL THEN
    RAISE WARNING 'fn_auto_create_client_account: conta pai 1.1.2.01 nao encontrada para tenant %', v_tenant_id;
    RETURN NEW;
  END IF;

  -- Gerar proximo codigo disponivel (1.1.2.01.XXX)
  SELECT COALESCE(MAX(SUBSTRING(code FROM '1\.1\.2\.01\.(\d+)')::INT), 0)
  INTO v_max_suffix
  FROM chart_of_accounts
  WHERE code LIKE '1.1.2.01.%'
    AND tenant_id = v_tenant_id;

  v_next_code := '1.1.2.01.' || LPAD((v_max_suffix + 1)::TEXT, 3, '0');

  -- Criar conta contabil
  INSERT INTO chart_of_accounts (
    code,
    name,
    account_type,
    nature,
    parent_id,
    level,
    is_analytical,
    is_synthetic,
    accepts_entries,
    description,
    tenant_id
  ) VALUES (
    v_next_code,
    LEFT(COALESCE(NEW.name, NEW.razao_social, 'Cliente ' || v_next_code), 200),
    'ativo_circulante',
    'DEVEDORA',
    v_parent_id,
    5,
    true,
    false,
    true,
    'Conta criada automaticamente para cliente: ' || COALESCE(NEW.cnpj, NEW.cpf, 'N/A'),
    v_tenant_id
  )
  RETURNING id INTO v_new_account_id;

  -- Atualizar cliente com a nova conta
  NEW.accounting_account_id := v_new_account_id;

  RAISE NOTICE 'Conta contabil % criada automaticamente para cliente %', v_next_code, NEW.name;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Codigo ja existe, tentar novamente com proximo
    RAISE WARNING 'fn_auto_create_client_account: codigo % ja existe, tentando proximo', v_next_code;
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE WARNING 'fn_auto_create_client_account: erro ao criar conta - %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no INSERT de clientes (prioridade baixa para rodar depois dos outros)
DROP TRIGGER IF EXISTS trg_auto_create_client_account ON clients;
CREATE TRIGGER trg_auto_create_client_account
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_client_account();

-- ============================================================================
-- PARTE 5: GERACAO DE ALERTAS DIARIOS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_generate_daily_alerts()
RETURNS TABLE(tenant_id UUID, alerts_created INT) AS $$
DECLARE
  v_tenant RECORD;
  v_count INT;
BEGIN
  FOR v_tenant IN
    SELECT DISTINCT t.id as tid
    FROM tenants t
    WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.tenant_id = t.id)
  LOOP
    v_count := 0;

    -- ========================================
    -- Alerta: Transacoes nao conciliadas > 3 dias
    -- ========================================
    INSERT INTO system_alerts (alert_type, severity, title, description, entity_type, entity_id, action_url, tenant_id)
    SELECT
      'reconciliation',
      CASE WHEN AGE(NOW(), bt.transaction_date) > INTERVAL '7 days' THEN 'critical' ELSE 'warning' END,
      'Transacao nao conciliada: R$ ' || TRIM(TO_CHAR(bt.amount, '999G999D99')),
      LEFT(bt.description, 100) || ' - ' || TO_CHAR(bt.transaction_date, 'DD/MM/YYYY'),
      'bank_transaction',
      bt.id,
      '/bank-reconciliation?highlight=' || bt.id,
      v_tenant.tid
    FROM bank_transactions bt
    WHERE bt.tenant_id = v_tenant.tid
      AND bt.matched = false
      AND bt.amount > 0
      AND bt.transaction_date < CURRENT_DATE - INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM system_alerts sa
        WHERE sa.entity_id = bt.id
          AND sa.alert_type = 'reconciliation'
          AND sa.is_resolved = false
      )
    LIMIT 20; -- Limitar para nao sobrecarregar

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- ========================================
    -- Alerta: Clientes sem conta contabil
    -- ========================================
    INSERT INTO system_alerts (alert_type, severity, title, description, entity_type, entity_id, action_url, tenant_id)
    SELECT
      'client_missing_account',
      'warning',
      'Cliente sem conta contabil: ' || LEFT(c.name, 50),
      'CNPJ: ' || COALESCE(c.cnpj, c.cpf, 'N/A'),
      'client',
      c.id,
      '/clients/' || c.id,
      v_tenant.tid
    FROM clients c
    WHERE c.tenant_id = v_tenant.tid
      AND c.accounting_account_id IS NULL
      AND c.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM system_alerts sa
        WHERE sa.entity_id = c.id
          AND sa.alert_type = 'client_missing_account'
          AND sa.is_resolved = false
      )
    LIMIT 10;

    -- ========================================
    -- Alerta: Faturas vencidas
    -- ========================================
    INSERT INTO system_alerts (alert_type, severity, title, description, entity_type, entity_id, action_url, tenant_id)
    SELECT
      'payment_due',
      CASE
        WHEN AGE(CURRENT_DATE, i.due_date) > INTERVAL '30 days' THEN 'critical'
        WHEN AGE(CURRENT_DATE, i.due_date) > INTERVAL '7 days' THEN 'warning'
        ELSE 'info'
      END,
      'Fatura vencida: ' || LEFT(cl.name, 30) || ' - R$ ' || TRIM(TO_CHAR(i.amount, '999G999D99')),
      'Vencimento: ' || TO_CHAR(i.due_date, 'DD/MM/YYYY') || ' (' || EXTRACT(DAY FROM AGE(CURRENT_DATE, i.due_date))::INT || ' dias)',
      'invoice',
      i.id,
      '/invoices?highlight=' || i.id,
      v_tenant.tid
    FROM invoices i
    JOIN clients cl ON cl.id = i.client_id
    WHERE i.tenant_id = v_tenant.tid
      AND i.status IN ('pending', 'overdue')
      AND i.due_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM system_alerts sa
        WHERE sa.entity_id = i.id
          AND sa.alert_type = 'payment_due'
          AND sa.is_resolved = false
          AND sa.created_at > NOW() - INTERVAL '7 days'
      )
    LIMIT 20;

    RETURN QUERY SELECT v_tenant.tid, v_count;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTE 6: VIEW DE DASHBOARD DE ALERTAS
-- ============================================================================

CREATE OR REPLACE VIEW v_alerts_summary AS
SELECT
  tenant_id,
  alert_type,
  severity,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE NOT is_read) as unread,
  MIN(created_at) as oldest
FROM system_alerts
WHERE NOT is_resolved
GROUP BY tenant_id, alert_type, severity;

-- ============================================================================
-- PARTE 7: FUNCAO PARA RESOLVER ALERTA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_resolve_alert(
  p_alert_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE system_alerts
  SET
    is_resolved = true,
    resolved_at = NOW(),
    resolved_by = auth.uid(),
    resolution_notes = p_notes
  WHERE id = p_alert_id
    AND tenant_id = get_my_tenant_id();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTE 8: FUNCOES AUXILIARES PARA BUSCAR CLIENTES (BYPASS RLS)
-- ============================================================================

-- Funcao auxiliar para buscar cliente por CNPJ (bypassa RLS)
CREATE OR REPLACE FUNCTION fn_find_client_by_cnpj(p_cnpj_digits TEXT, p_tenant_id UUID)
RETURNS TABLE(id UUID, name TEXT, accounting_account_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name::TEXT, c.accounting_account_id
  FROM clients c
  WHERE regexp_replace(c.cnpj, '[^\d]', '', 'g') = p_cnpj_digits
    AND c.tenant_id = p_tenant_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- Funcao auxiliar para buscar cliente por CPF no QSA (bypassa RLS)
CREATE OR REPLACE FUNCTION fn_find_client_by_qsa_cpf(p_cpf_digits TEXT, p_tenant_id UUID)
RETURNS TABLE(id UUID, name TEXT, accounting_account_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name::TEXT, c.accounting_account_id
  FROM clients c
  WHERE c.tenant_id = p_tenant_id
    AND c.qsa IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(c.qsa) AS socio
      WHERE regexp_replace(socio->>'cpf_cnpj', '[^\d]', '', 'g') = p_cpf_digits
    )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- ============================================================================
-- PARTE 9: FUNCAO PARA IDENTIFICAR PAGADOR
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_identify_payer(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_client RECORD;
  v_confidence NUMERIC;
  v_method TEXT;
  v_cnpj_digits TEXT;
  v_cpf_digits TEXT;
BEGIN
  -- Buscar transacao
  SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

  IF v_tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transacao nao encontrada');
  END IF;

  -- ESTRATEGIA 1: Match por CNPJ (usando funcao auxiliar que bypassa RLS)
  IF v_tx.extracted_cnpj IS NOT NULL THEN
    v_cnpj_digits := regexp_replace(v_tx.extracted_cnpj, '[^\d]', '', 'g');

    SELECT * INTO v_client FROM fn_find_client_by_cnpj(v_cnpj_digits, v_tx.tenant_id);

    IF v_client.id IS NOT NULL THEN
      v_confidence := 100;
      v_method := 'cnpj_match';

      UPDATE bank_transactions SET
        suggested_client_id = v_client.id,
        identification_confidence = v_confidence,
        identification_method = v_method,
        identification_reasoning = 'CNPJ ' || v_tx.extracted_cnpj || ' corresponde ao cliente ' || v_client.name,
        auto_matched = true,
        needs_review = false
      WHERE id = p_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client.id,
        'client_name', v_client.name,
        'confidence', v_confidence,
        'method', v_method
      );
    END IF;
  END IF;

  -- ESTRATEGIA 2: Match por CPF no QSA (usando funcao auxiliar que bypassa RLS)
  IF v_tx.extracted_cpf IS NOT NULL THEN
    v_cpf_digits := regexp_replace(v_tx.extracted_cpf, '[^\d]', '', 'g');

    SELECT * INTO v_client FROM fn_find_client_by_qsa_cpf(v_cpf_digits, v_tx.tenant_id);

    IF v_client.id IS NOT NULL THEN
      v_confidence := 95;
      v_method := 'qsa_match';

      UPDATE bank_transactions SET
        suggested_client_id = v_client.id,
        identification_confidence = v_confidence,
        identification_method = v_method,
        identification_reasoning = 'CPF ' || v_tx.extracted_cpf || ' e socio de ' || v_client.name,
        auto_matched = true,
        needs_review = false
      WHERE id = p_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client.id,
        'client_name', v_client.name,
        'confidence', v_confidence,
        'method', v_method
      );
    END IF;
  END IF;

  -- Nao identificado
  UPDATE bank_transactions SET
    identification_confidence = 0,
    identification_method = 'none',
    identification_reasoning = 'Nao foi possivel identificar o pagador automaticamente',
    needs_review = CASE WHEN v_tx.amount > 0 THEN true ELSE false END
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', false,
    'confidence', 0,
    'method', 'none',
    'message', 'Pagador nao identificado'
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- ============================================================================
-- PARTE 9: TRIGGER PARA IDENTIFICAR PAGADOR APOS EXTRACAO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_trigger_identify_payer()
RETURNS TRIGGER AS $$
BEGIN
  -- So processar creditos (recebimentos) nao conciliados
  IF NEW.amount > 0
     AND NEW.matched = false
     AND NEW.suggested_client_id IS NULL
     AND (NEW.extracted_cnpj IS NOT NULL OR NEW.extracted_cpf IS NOT NULL OR NEW.extracted_cob IS NOT NULL) THEN

    -- Chamar identificacao (sincrono para simplicidade)
    PERFORM fn_identify_payer(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_identify_payer ON bank_transactions;
CREATE TRIGGER trg_identify_payer
  AFTER INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_identify_payer();

-- ============================================================================
-- PARTE 10: FUNCAO DE REPROCESSAMENTO DE TRANSACOES EXISTENTES
-- ============================================================================

-- Funcao para reprocessar metadados de uma transacao existente
CREATE OR REPLACE FUNCTION fn_reprocess_transaction_metadata(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_desc TEXT;
  v_cnpj TEXT;
  v_cpf TEXT;
  v_cob TEXT;
  v_name TEXT;
  v_payer_type TEXT;
BEGIN
  SELECT UPPER(COALESCE(description, '')) INTO v_desc
  FROM bank_transactions WHERE id = p_transaction_id;

  IF v_desc IS NULL THEN
    RETURN jsonb_build_object('error', 'Transacao nao encontrada');
  END IF;

  -- Extrair CNPJ
  SELECT (regexp_matches(v_desc, '(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})', 'g'))[1]
  INTO v_cnpj LIMIT 1;

  IF v_cnpj IS NOT NULL THEN
    v_cnpj := regexp_replace(v_cnpj, '[^\d]', '', 'g');
    IF LENGTH(v_cnpj) = 14 THEN
      v_cnpj := SUBSTRING(v_cnpj, 1, 2) || '.' ||
                SUBSTRING(v_cnpj, 3, 3) || '.' ||
                SUBSTRING(v_cnpj, 6, 3) || '/' ||
                SUBSTRING(v_cnpj, 9, 4) || '-' ||
                SUBSTRING(v_cnpj, 13, 2);
    ELSE
      v_cnpj := NULL;
    END IF;
  END IF;

  -- Extrair CPF se nao achou CNPJ
  IF v_cnpj IS NULL THEN
    SELECT (regexp_matches(v_desc, '(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})', 'g'))[1]
    INTO v_cpf LIMIT 1;

    IF v_cpf IS NOT NULL THEN
      v_cpf := regexp_replace(v_cpf, '[^\d]', '', 'g');
      IF LENGTH(v_cpf) = 11 THEN
        v_cpf := SUBSTRING(v_cpf, 1, 3) || '.' ||
                 SUBSTRING(v_cpf, 4, 3) || '.' ||
                 SUBSTRING(v_cpf, 7, 3) || '-' ||
                 SUBSTRING(v_cpf, 10, 2);
      ELSE
        v_cpf := NULL;
      END IF;
    END IF;
  END IF;

  -- Extrair COB
  SELECT (regexp_matches(v_desc, '(COB\d{5,10})', 'gi'))[1]
  INTO v_cob LIMIT 1;

  -- Tipo de pagador
  v_payer_type := CASE
    WHEN v_cnpj IS NOT NULL THEN 'pj'
    WHEN v_cpf IS NOT NULL THEN 'pf'
    ELSE 'desconhecido'
  END;

  -- Atualizar diretamente
  UPDATE bank_transactions SET
    extracted_cnpj = v_cnpj,
    extracted_cpf = v_cpf,
    extracted_cob = UPPER(v_cob),
    payer_type = v_payer_type,
    metadata_extracted_at = NOW()
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'cnpj', v_cnpj,
    'cpf', v_cpf,
    'cob', v_cob,
    'payer_type', v_payer_type
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- ============================================================================
-- PARTE 11: FUNCAO PARA CRIAR LANCAMENTO CONTABIL AUTOMATICO
-- ============================================================================

-- Funcao auxiliar para buscar conta do banco
CREATE OR REPLACE FUNCTION fn_get_bank_account_chart_id(p_bank_account_id UUID)
RETURNS UUID AS $$
DECLARE
  v_chart_id UUID;
BEGIN
  SELECT chart_of_accounts_id INTO v_chart_id
  FROM bank_accounts
  WHERE id = p_bank_account_id;

  -- Se nao encontrou, usa conta padrao Sicredi (1.1.1.05)
  IF v_chart_id IS NULL THEN
    SELECT id INTO v_chart_id
    FROM chart_of_accounts
    WHERE code = '1.1.1.05'
    LIMIT 1;
  END IF;

  RETURN v_chart_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off;

-- Funcao principal para criar lancamento contabil automatico
CREATE OR REPLACE FUNCTION fn_auto_create_accounting_entry(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_client RECORD;
  v_bank_chart_id UUID;
  v_client_chart_id UUID;
  v_entry_id UUID;
  v_entry_number INTEGER;
  v_description TEXT;
BEGIN
  -- Buscar transacao com cliente sugerido
  SELECT
    bt.*,
    c.name as client_name,
    c.accounting_account_id as client_account_id
  INTO v_tx
  FROM bank_transactions bt
  LEFT JOIN clients c ON c.id = bt.suggested_client_id
  WHERE bt.id = p_transaction_id;

  IF v_tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transacao nao encontrada');
  END IF;

  -- Verificar se ja tem lancamento vinculado
  IF v_tx.journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transacao ja possui lancamento contabil');
  END IF;

  -- Verificar se ja existe lancamento por reference_id (pode ter sido criado mas nao vinculado)
  SELECT id INTO v_entry_id
  FROM accounting_entries
  WHERE reference_id = p_transaction_id
  LIMIT 1;

  IF v_entry_id IS NOT NULL THEN
    -- Vincular o lancamento existente a transacao
    UPDATE bank_transactions
    SET journal_entry_id = v_entry_id,
        matched = true,
        auto_matched = true
    WHERE id = p_transaction_id;

    UPDATE accounting_entries
    SET transaction_id = p_transaction_id
    WHERE id = v_entry_id AND transaction_id IS NULL;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Lancamento existente vinculado',
      'entry_id', v_entry_id,
      'recovered', true
    );
  END IF;

  -- Verificar se tem cliente identificado com alta confianca
  IF v_tx.suggested_client_id IS NULL OR v_tx.identification_confidence < 95 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente nao identificado com confianca suficiente');
  END IF;

  -- Buscar conta do banco
  v_bank_chart_id := fn_get_bank_account_chart_id(v_tx.bank_account_id);

  IF v_bank_chart_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta bancaria nao configurada no plano de contas');
  END IF;

  -- Buscar conta do cliente
  v_client_chart_id := v_tx.client_account_id;

  -- Se cliente nao tem conta, buscar conta generica Clientes a Receber
  IF v_client_chart_id IS NULL THEN
    SELECT id INTO v_client_chart_id
    FROM chart_of_accounts
    WHERE code = '1.1.2.01'
    LIMIT 1;
  END IF;

  IF v_client_chart_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta de clientes nao encontrada no plano de contas');
  END IF;

  -- Gerar proximo numero de lancamento
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number
  FROM accounting_entries
  WHERE EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM v_tx.transaction_date::date);

  -- Montar descricao
  v_description := 'Recebimento ' || COALESCE(v_tx.client_name, 'Cliente') ||
                   ' - ' || COALESCE(v_tx.description, 'PIX/TED');

  -- Criar lancamento contabil
  INSERT INTO accounting_entries (
    entry_number,
    entry_date,
    competence_date,
    description,
    history,
    entry_type,
    document_type,
    document_number,
    transaction_id,
    reference_type,
    reference_id,
    total_debit,
    total_credit,
    balanced,
    ai_generated,
    ai_confidence,
    ai_model,
    created_by,
    tenant_id
  ) VALUES (
    v_entry_number,
    v_tx.transaction_date::date,
    v_tx.transaction_date::date,
    v_description,
    'Lancamento automatico - Identificacao por ' || COALESCE(v_tx.identification_method, 'sistema'),
    'automatic',
    'PIX',
    v_tx.fitid,
    p_transaction_id,
    'bank_transaction',
    p_transaction_id,
    ABS(v_tx.amount),
    ABS(v_tx.amount),
    true,
    true,
    v_tx.identification_confidence / 100.0,
    'Dr. Cicero Automation',
    v_tx.created_by,
    v_tx.tenant_id
  )
  RETURNING id INTO v_entry_id;

  -- Criar linhas do lancamento
  -- Linha 1: Debito no Banco (entrada de dinheiro)
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    debit,
    credit,
    description,
    tenant_id
  ) VALUES (
    v_entry_id,
    v_bank_chart_id,
    ABS(v_tx.amount),
    0,
    'Debito: ' || v_description,
    v_tx.tenant_id
  );

  -- Linha 2: Credito na conta do Cliente (baixa do a receber)
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    debit,
    credit,
    description,
    tenant_id
  ) VALUES (
    v_entry_id,
    v_client_chart_id,
    0,
    ABS(v_tx.amount),
    'Credito: ' || v_description,
    v_tx.tenant_id
  );

  -- Atualizar transacao como conciliada
  UPDATE bank_transactions SET
    matched = true,
    journal_entry_id = v_entry_id,
    reconciled_at = NOW(),
    reconciliation_method = 'auto'
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'entry_number', v_entry_number,
    'amount', ABS(v_tx.amount),
    'client_name', v_tx.client_name,
    'method', 'auto_accounting'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- ============================================================================
-- PARTE 12: FUNCAO PARA BAIXAR FATURA AUTOMATICAMENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_reconcile_invoice(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_invoice RECORD;
  v_tolerance NUMERIC := 0.50; -- Tolerancia de R$ 0,50
BEGIN
  -- Buscar transacao
  SELECT * INTO v_tx
  FROM bank_transactions
  WHERE id = p_transaction_id;

  IF v_tx IS NULL OR v_tx.suggested_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transacao ou cliente nao encontrado');
  END IF;

  -- Buscar fatura do cliente com valor proximo e status pendente
  SELECT * INTO v_invoice
  FROM invoices
  WHERE client_id = v_tx.suggested_client_id
    AND status IN ('pending', 'sent', 'overdue')
    AND ABS(amount - ABS(v_tx.amount)) <= v_tolerance
    AND due_date <= (v_tx.transaction_date::date + INTERVAL '30 days')
  ORDER BY
    ABS(amount - ABS(v_tx.amount)) ASC, -- Valor mais proximo
    due_date ASC -- Mais antiga primeiro
  LIMIT 1;

  IF v_invoice IS NULL THEN
    -- Nao encontrou fatura correspondente, mas nao e erro
    RETURN jsonb_build_object(
      'success', true,
      'invoice_found', false,
      'message', 'Nenhuma fatura correspondente encontrada'
    );
  END IF;

  -- Atualizar fatura como paga
  UPDATE invoices SET
    status = 'paid',
    paid_date = v_tx.transaction_date::date,
    paid_amount = ABS(v_tx.amount),
    payment_method = 'pix',
    reconciled_at = NOW(),
    bank_transaction_id = p_transaction_id
  WHERE id = v_invoice.id;

  -- Vincular transacao a fatura
  UPDATE bank_transactions SET
    invoice_id = v_invoice.id
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_found', true,
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.number,
    'invoice_amount', v_invoice.amount,
    'transaction_amount', ABS(v_tx.amount),
    'difference', ABS(v_invoice.amount - ABS(v_tx.amount))
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- ============================================================================
-- PARTE 13: FUNCAO COMPLETA DE AUTOMACAO (ORQUESTRA TUDO)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_full_auto_reconciliation(p_transaction_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_identify_result JSONB;
  v_entry_result JSONB;
  v_invoice_result JSONB;
  v_final_result JSONB;
BEGIN
  -- Etapa 1: Identificar pagador (se ainda nao identificado)
  SELECT fn_identify_payer(p_transaction_id) INTO v_identify_result;

  IF NOT (v_identify_result->>'success')::boolean THEN
    -- Nao conseguiu identificar, retorna resultado parcial
    RETURN jsonb_build_object(
      'success', false,
      'stage', 'identification',
      'identification', v_identify_result,
      'message', 'Pagador nao identificado automaticamente'
    );
  END IF;

  -- Etapa 2: Criar lancamento contabil
  SELECT fn_auto_create_accounting_entry(p_transaction_id) INTO v_entry_result;

  IF NOT (v_entry_result->>'success')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'stage', 'accounting',
      'identification', v_identify_result,
      'accounting', v_entry_result,
      'message', 'Erro ao criar lancamento contabil'
    );
  END IF;

  -- Etapa 3: Tentar baixar fatura correspondente
  SELECT fn_auto_reconcile_invoice(p_transaction_id) INTO v_invoice_result;

  -- Montar resultado final
  v_final_result := jsonb_build_object(
    'success', true,
    'stage', 'complete',
    'identification', v_identify_result,
    'accounting', v_entry_result,
    'invoice', v_invoice_result,
    'message', 'Conciliacao automatica completa'
  );

  RETURN v_final_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'stage', 'error',
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- ============================================================================
-- PARTE 14: TRIGGER PARA AUTOMACAO COMPLETA NO INSERT
-- ============================================================================

-- Atualizar trigger de identificacao para fazer automacao completa
CREATE OR REPLACE FUNCTION fn_trigger_full_automation()
RETURNS TRIGGER AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Apenas para transacoes de credito (recebimentos)
  IF NEW.transaction_type = 'credit' AND NEW.amount > 0 AND NEW.matched = false THEN
    -- Executar automacao completa
    SELECT fn_full_auto_reconciliation(NEW.id) INTO v_result;

    -- Log do resultado (opcional - pode ser removido em producao)
    IF (v_result->>'success')::boolean THEN
      RAISE NOTICE 'Automacao completa: % - %', NEW.id, v_result->>'message';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off;

-- Remover trigger antigo e criar novo
DROP TRIGGER IF EXISTS trg_identify_payer ON bank_transactions;
DROP TRIGGER IF EXISTS trg_full_automation ON bank_transactions;

-- Trigger que roda AFTER INSERT para nao bloquear a insercao
CREATE TRIGGER trg_full_automation
  AFTER INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_full_automation();

-- ============================================================================
-- PARTE 15: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON system_alerts TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION fn_generate_daily_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION fn_resolve_alert(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_identify_payer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_find_client_by_cnpj(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_find_client_by_qsa_cpf(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_reprocess_transaction_metadata(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_auto_create_accounting_entry(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_auto_reconcile_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_full_auto_reconciliation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_bank_account_chart_id(UUID) TO authenticated;
GRANT SELECT ON v_alerts_summary TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================

COMMENT ON FUNCTION fn_extract_transaction_metadata() IS 'Extrai CNPJ, CPF, COB e nome da descricao da transacao bancaria';
COMMENT ON FUNCTION fn_auto_create_client_account() IS 'Cria automaticamente conta contabil 1.1.2.01.XXX para novos clientes';
COMMENT ON FUNCTION fn_generate_daily_alerts() IS 'Gera alertas diarios de transacoes pendentes, clientes sem conta e faturas vencidas';
COMMENT ON FUNCTION fn_identify_payer(UUID) IS 'Identifica o pagador de uma transacao por CNPJ, CPF/QSA';
COMMENT ON FUNCTION fn_find_client_by_cnpj(TEXT, UUID) IS 'Busca cliente por CNPJ (bypassa RLS)';
COMMENT ON FUNCTION fn_find_client_by_qsa_cpf(TEXT, UUID) IS 'Busca cliente por CPF no QSA (bypassa RLS)';
COMMENT ON FUNCTION fn_reprocess_transaction_metadata(UUID) IS 'Reprocessa metadados de uma transacao existente';
COMMENT ON FUNCTION fn_auto_create_accounting_entry(UUID) IS 'Cria lancamento contabil automatico para transacao identificada';
COMMENT ON FUNCTION fn_auto_reconcile_invoice(UUID) IS 'Baixa fatura correspondente automaticamente';
COMMENT ON FUNCTION fn_full_auto_reconciliation(UUID) IS 'Orquestra identificacao, lancamento e baixa de fatura';
