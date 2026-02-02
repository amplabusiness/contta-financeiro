-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | Maestro Governança Mensal
-- Migration: 20260202_GOVERNANCA_FECHAMENTO_FEV2025
-- Data: 02/02/2026
-- Autor: Dr. Cícero (Sistema Contta)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- COMPONENTES:
-- 1. Tabela classification_rules (criar se não existir)
-- 2. RPC get_month_status() - status do mês
-- 3. RPC validate_transitory_zero() - validação transitórias
-- 4. RPC classify_month_from_rules() - classificação em lote
-- 5. RPC close_month_guarded() - fechamento guardado
-- ═══════════════════════════════════════════════════════════════════════════════

-- 0) Extensão pgcrypto (para gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) TABELA: classification_rules (matriz de classificação aprovada)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  rule_name TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('contains', 'ilike', 'regex', 'exact')),
  match_value TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit', 'any')),
  debit_account_id UUID REFERENCES chart_of_accounts(id),
  credit_account_id UUID REFERENCES chart_of_accounts(id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,  -- regras ambíguas que exigem Dr. Cícero
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_classification_rules_tenant 
ON public.classification_rules(tenant_id, is_active, priority);

COMMENT ON TABLE public.classification_rules IS 'Matriz de regras de classificação automática - aprovada pelo Dr. Cícero';
COMMENT ON COLUMN public.classification_rules.requires_approval IS 'Se TRUE, transação vai para fila de aprovação ao invés de classificar automaticamente';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) RPC: get_month_status()
-- Retorna estatísticas completas do mês
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_month_status(
  p_tenant UUID, 
  p_start DATE, 
  p_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_tx INT;
  v_pending_tx INT;
  v_reconciled_tx INT;
  v_classified_tx INT;
  v_class_entries INT;
  v_trans_debit NUMERIC;
  v_trans_credit NUMERIC;
  v_trans_debit_id UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';  -- 1.1.9.01
  v_trans_credit_id UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1'; -- 2.1.9.01
BEGIN
  -- Total de transações bancárias no período
  SELECT COUNT(*) INTO v_total_tx
  FROM bank_transactions
  WHERE tenant_id = p_tenant
    AND transaction_date BETWEEN p_start AND p_end;

  -- Transações pendentes (sem journal_entry_id = não importada)
  SELECT COUNT(*) INTO v_pending_tx
  FROM bank_transactions
  WHERE tenant_id = p_tenant
    AND transaction_date BETWEEN p_start AND p_end
    AND journal_entry_id IS NULL;

  -- Transações reconciliadas (têm journal_entry_id de importação)
  SELECT COUNT(*) INTO v_reconciled_tx
  FROM bank_transactions
  WHERE tenant_id = p_tenant
    AND transaction_date BETWEEN p_start AND p_end
    AND journal_entry_id IS NOT NULL;

  -- Transações com classificação (têm entry de classification vinculado)
  SELECT COUNT(DISTINCT bt.id) INTO v_classified_tx
  FROM bank_transactions bt
  JOIN accounting_entries ae ON ae.reference_id = bt.id
  WHERE bt.tenant_id = p_tenant
    AND bt.transaction_date BETWEEN p_start AND p_end
    AND ae.source_type = 'classification';

  -- Entradas de classificação criadas no período
  SELECT COUNT(*) INTO v_class_entries
  FROM accounting_entries
  WHERE tenant_id = p_tenant
    AND entry_date BETWEEN p_start AND p_end
    AND source_type = 'classification';

  -- Saldo da transitória DÉBITOS (1.1.9.01) - ATIVO, natureza devedora
  SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) INTO v_trans_debit
  FROM accounting_entry_lines l
  JOIN accounting_entries e ON e.id = l.entry_id
  WHERE e.tenant_id = p_tenant
    AND e.entry_date BETWEEN p_start AND p_end
    AND l.account_id = v_trans_debit_id;

  -- Saldo da transitória CRÉDITOS (2.1.9.01) - PASSIVO, natureza credora
  SELECT COALESCE(SUM(l.credit) - SUM(l.debit), 0) INTO v_trans_credit
  FROM accounting_entry_lines l
  JOIN accounting_entries e ON e.id = l.entry_id
  WHERE e.tenant_id = p_tenant
    AND e.entry_date BETWEEN p_start AND p_end
    AND l.account_id = v_trans_credit_id;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', p_start, 'end', p_end),
    'total_transactions', v_total_tx,
    'pending_transactions', v_pending_tx,
    'reconciled_transactions', v_reconciled_tx,
    'classified_transactions', v_classified_tx,
    'classification_entries', v_class_entries,
    'transitory_debits_balance', v_trans_debit,
    'transitory_credits_balance', v_trans_credit,
    'transitories_zero', (ABS(v_trans_debit) < 0.01 AND ABS(v_trans_credit) < 0.01)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_month_status(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_month_status(UUID, DATE, DATE) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3) RPC: validate_transitory_zero()
-- Valida se transitórias estão zeradas (pré-requisito para fechamento)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_transitory_zero(
  p_tenant UUID, 
  p_start DATE, 
  p_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status JSONB;
  v_deb NUMERIC;
  v_cred NUMERIC;
BEGIN
  v_status := public.get_month_status(p_tenant, p_start, p_end);
  v_deb := (v_status->>'transitory_debits_balance')::NUMERIC;
  v_cred := (v_status->>'transitory_credits_balance')::NUMERIC;

  IF ABS(v_deb) > 0.01 OR ABS(v_cred) > 0.01 THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'reason', 'TRANSITORIA_NAO_ZERADA',
      'transitory_debits_balance', v_deb,
      'transitory_credits_balance', v_cred,
      'message', 'Existem transações não classificadas. Complete a classificação antes de fechar.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'transitory_debits_balance', 0,
    'transitory_credits_balance', 0,
    'message', 'Transitórias zeradas. Período pode ser fechado.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_transitory_zero(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_transitory_zero(UUID, DATE, DATE) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4) RPC: classify_month_from_rules()
-- Classifica transações em lote aplicando a matriz de regras
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.classify_month_from_rules(
  p_tenant UUID,
  p_start DATE,
  p_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  rule RECORD;
  v_created INT := 0;
  v_skipped INT := 0;
  v_approval_queue INT := 0;
  v_entry_id UUID;
  v_desc TEXT;
  v_amt NUMERIC;
  v_dir TEXT;
  v_matched BOOLEAN;
  v_needs_approval BOOLEAN;
  v_trans_debit_id UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
  v_trans_credit_id UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1';
BEGIN
  -- Iterar transações que:
  -- 1. Têm journal_entry_id (importação OFX feita)
  -- 2. NÃO têm entry de classificação ainda
  FOR r IN
    SELECT 
      bt.id, 
      bt.transaction_date, 
      bt.amount, 
      COALESCE(bt.description, '') AS description,
      bt.fitid
    FROM bank_transactions bt
    WHERE bt.tenant_id = p_tenant
      AND bt.transaction_date BETWEEN p_start AND p_end
      AND bt.journal_entry_id IS NOT NULL  -- importado
      AND NOT EXISTS (
        -- Não tem classificação ainda
        SELECT 1
        FROM accounting_entries e
        WHERE e.tenant_id = p_tenant
          AND e.source_type = 'classification'
          AND e.reference_type = 'bank_transaction'
          AND e.reference_id = bt.id
      )
  LOOP
    v_desc := UPPER(r.description);
    v_amt := r.amount;
    v_dir := CASE 
      WHEN v_amt > 0 THEN 'credit' 
      WHEN v_amt < 0 THEN 'debit' 
      ELSE 'any' 
    END;
    v_matched := FALSE;
    v_needs_approval := FALSE;

    -- Procurar regra aplicável (por prioridade)
    FOR rule IN
      SELECT *
      FROM public.classification_rules
      WHERE tenant_id = p_tenant
        AND is_active = TRUE
        AND (direction = 'any' OR direction = v_dir)
      ORDER BY priority ASC
    LOOP
      -- Verificar match
      IF rule.match_type = 'contains' AND POSITION(UPPER(rule.match_value) IN v_desc) > 0 THEN
        v_matched := TRUE;
      ELSIF rule.match_type = 'ilike' AND v_desc ILIKE rule.match_value THEN
        v_matched := TRUE;
      ELSIF rule.match_type = 'regex' AND v_desc ~* rule.match_value THEN
        v_matched := TRUE;
      ELSIF rule.match_type = 'exact' AND v_desc = UPPER(rule.match_value) THEN
        v_matched := TRUE;
      END IF;

      IF v_matched THEN
        v_needs_approval := COALESCE(rule.requires_approval, FALSE);

        -- Se requer aprovação, não classificar automaticamente
        IF v_needs_approval THEN
          v_approval_queue := v_approval_queue + 1;
          EXIT;
        END IF;

        -- Criar entry de classificação
        v_entry_id := gen_random_uuid();

        INSERT INTO accounting_entries (
          id, tenant_id, entry_date, competence_date,
          description, internal_code, source_type,
          entry_type, reference_type, reference_id,
          created_at
        ) VALUES (
          v_entry_id, 
          p_tenant, 
          r.transaction_date, 
          r.transaction_date,
          'Classificação: ' || rule.rule_name || ' | ' || LEFT(r.description, 100),
          'CLASS_' || TO_CHAR(r.transaction_date, 'YYYYMMDD') || '_' || SUBSTR(r.id::TEXT, 1, 8),
          'classification',
          'NORMAL',
          'bank_transaction',
          r.id,
          NOW()
        );

        -- Criar linhas contábeis
        IF v_amt > 0 THEN
          -- ENTRADA: D Transitória Créditos / C Conta Destino (receita/cliente)
          INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
          VALUES
            (gen_random_uuid(), p_tenant, v_entry_id, v_trans_credit_id, ABS(v_amt), 0, 
             'Baixa transitória créditos'),
            (gen_random_uuid(), p_tenant, v_entry_id, rule.credit_account_id, 0, ABS(v_amt), 
             'Destino: ' || rule.rule_name);
        ELSE
          -- SAÍDA: D Conta Destino (despesa/fornecedor) / C Transitória Débitos
          INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
          VALUES
            (gen_random_uuid(), p_tenant, v_entry_id, rule.debit_account_id, ABS(v_amt), 0, 
             'Destino: ' || rule.rule_name),
            (gen_random_uuid(), p_tenant, v_entry_id, v_trans_debit_id, 0, ABS(v_amt), 
             'Baixa transitória débitos');
        END IF;

        v_created := v_created + 1;
        EXIT; -- Achou regra, não procurar mais
      END IF;
    END LOOP;

    -- Se não encontrou nenhuma regra
    IF NOT v_matched THEN
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'created_classifications', v_created,
    'skipped_no_rule', v_skipped,
    'sent_to_approval', v_approval_queue,
    'message', CASE 
      WHEN v_skipped > 0 THEN 'Existem ' || v_skipped || ' transações sem regra aplicável.'
      WHEN v_approval_queue > 0 THEN 'Existem ' || v_approval_queue || ' transações aguardando aprovação do Dr. Cícero.'
      ELSE 'Todas as transações foram classificadas.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.classify_month_from_rules(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classify_month_from_rules(UUID, DATE, DATE) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5) RPC: close_month_guarded()
-- Fecha mês SOMENTE se transitórias estiverem zeradas
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.close_month_guarded(
  p_tenant UUID,
  p_year INT,
  p_month INT,
  p_user_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_valid JSONB;
  v_closing_id UUID;
  v_status JSONB;
BEGIN
  -- Calcular datas do período
  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Validar transitórias
  v_valid := public.validate_transitory_zero(p_tenant, v_start, v_end);
  
  IF (v_valid->>'ok')::BOOLEAN = FALSE THEN
    RETURN jsonb_build_object(
      'ok', FALSE, 
      'blocked_by', 'TRANSITORIA_NAO_ZERADA',
      'details', v_valid,
      'message', 'Não é possível fechar o mês com transações pendentes de classificação.'
    );
  END IF;

  -- Obter status final
  v_status := public.get_month_status(p_tenant, v_start, v_end);

  -- Inserir/atualizar fechamento
  INSERT INTO monthly_closings (
    tenant_id,
    reference_month,
    status,
    total_transactions,
    reconciled_transactions,
    pending_transactions,
    transit_debit_balance,
    transit_credit_balance,
    closed_by,
    closed_at,
    notes
  ) VALUES (
    p_tenant,
    v_start,
    'closed',
    COALESCE((v_status->>'total_transactions')::INT, 0),
    COALESCE((v_status->>'reconciled_transactions')::INT, 0),
    COALESCE((v_status->>'pending_transactions')::INT, 0),
    COALESCE((v_status->>'transitory_debits_balance')::NUMERIC, 0),
    COALESCE((v_status->>'transitory_credits_balance')::NUMERIC, 0),
    COALESCE(p_user_id::TEXT, 'dr-cicero'),
    NOW(),
    p_notes
  )
  ON CONFLICT (tenant_id, reference_month)
  DO UPDATE SET
    status = 'closed',
    total_transactions = EXCLUDED.total_transactions,
    reconciled_transactions = EXCLUDED.reconciled_transactions,
    pending_transactions = EXCLUDED.pending_transactions,
    transit_debit_balance = EXCLUDED.transit_debit_balance,
    transit_credit_balance = EXCLUDED.transit_credit_balance,
    closed_by = EXCLUDED.closed_by,
    closed_at = NOW(),
    notes = CASE 
      WHEN monthly_closings.notes IS NULL THEN EXCLUDED.notes
      WHEN EXCLUDED.notes IS NULL THEN monthly_closings.notes
      ELSE monthly_closings.notes || E'\n' || EXCLUDED.notes
    END,
    updated_at = NOW()
  RETURNING id INTO v_closing_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'closing_id', v_closing_id,
    'reference_month', v_start,
    'status', v_status,
    'message', 'Mês ' || p_month || '/' || p_year || ' fechado com sucesso.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_month_guarded(UUID, INT, INT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_month_guarded(UUID, INT, INT, UUID, TEXT) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6) RPC: list_unclassified_transactions()
-- Lista transações que não têm regra aplicável (para análise manual)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.list_unclassified_transactions(
  p_tenant UUID,
  p_start DATE,
  p_end DATE,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  transaction_date DATE,
  amount NUMERIC,
  description TEXT,
  fitid TEXT,
  direction TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id,
    bt.transaction_date,
    bt.amount,
    bt.description,
    bt.fitid,
    CASE WHEN bt.amount > 0 THEN 'credit' ELSE 'debit' END AS direction
  FROM bank_transactions bt
  WHERE bt.tenant_id = p_tenant
    AND bt.transaction_date BETWEEN p_start AND p_end
    AND bt.journal_entry_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM accounting_entries e
      WHERE e.tenant_id = p_tenant
        AND e.source_type = 'classification'
        AND e.reference_type = 'bank_transaction'
        AND e.reference_id = bt.id
    )
  ORDER BY bt.transaction_date, bt.amount
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_unclassified_transactions(UUID, DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_unclassified_transactions(UUID, DATE, DATE, INT) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Migration 20260202_GOVERNANCA_FECHAMENTO_FEV2025 aplicada!';
  RAISE NOTICE '';
  RAISE NOTICE 'RPCs disponíveis:';
  RAISE NOTICE '  - get_month_status(tenant, start, end)';
  RAISE NOTICE '  - validate_transitory_zero(tenant, start, end)';
  RAISE NOTICE '  - classify_month_from_rules(tenant, start, end)';
  RAISE NOTICE '  - close_month_guarded(tenant, year, month, user, notes)';
  RAISE NOTICE '  - list_unclassified_transactions(tenant, start, end, limit)';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximo passo: Inserir regras em classification_rules';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
END $$;

SELECT 'Migration aplicada com sucesso!' AS resultado;
