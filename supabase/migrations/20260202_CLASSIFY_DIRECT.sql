-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | CLASSIFICAÇÃO DIRETA (SEM TRANSITÓRIA)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- Consistente com Janeiro/2025: lançamento direto Banco ↔ Conta Destino
-- Sem passar por contas transitórias
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. RPC: classify_direct_with_ai
-- ═══════════════════════════════════════════════════════════════════════════════
-- Classifica uma transação criando lançamento DIRETO (Banco ↔ Conta)

CREATE OR REPLACE FUNCTION classify_direct_with_ai(
  p_tenant UUID,
  p_transaction_id UUID,
  p_created_by TEXT DEFAULT 'dr-cicero'
)
RETURNS JSONB AS $$
DECLARE
  v_suggestion JSONB;
  v_tx RECORD;
  v_entry_id UUID;
  v_decision_id UUID;
  v_bank_account_id UUID := '10d5892d-a843-4034-8d62-9fec95b8fd56';  -- Banco Sicredi 1.1.1.05
  v_account_id UUID;
  v_abs_amount NUMERIC;
  v_internal_code TEXT;
BEGIN
  -- Verificar se já tem classificação
  IF EXISTS (
    SELECT 1 FROM accounting_entries ae
    WHERE ae.reference_id = p_transaction_id
      AND ae.source_type = 'classification'
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Transação já classificada'
    );
  END IF;

  -- Obter sugestão via RAG
  v_suggestion := get_ai_classification_suggestion(p_tenant, p_transaction_id);
  
  IF NOT (v_suggestion->>'ok')::boolean THEN
    RETURN v_suggestion;
  END IF;
  
  -- Se não tem sugestão com confiança suficiente, retornar para revisão
  IF NOT (v_suggestion->>'has_suggestion')::boolean OR 
     (v_suggestion->>'confidence')::numeric < 70 THEN
    
    -- Registrar decisão pendente
    INSERT INTO classification_decisions (
      tenant_id, transaction_id, decision_type, reasoning, was_approved
    ) VALUES (
      p_tenant, p_transaction_id, 'suggested', 
      v_suggestion->>'reasoning', false
    );
    
    RETURN jsonb_build_object(
      'ok', true,
      'classified', false,
      'reason', 'Confiança insuficiente para classificação automática',
      'confidence', v_suggestion->>'confidence',
      'suggestion', v_suggestion->'suggestion'
    );
  END IF;
  
  -- Buscar transação
  SELECT * INTO v_tx
  FROM bank_transactions
  WHERE id = p_transaction_id AND tenant_id = p_tenant;
  
  v_account_id := (v_suggestion->'suggestion'->>'account_id')::UUID;
  v_abs_amount := ABS(v_tx.amount);
  
  -- Gerar internal_code único
  v_internal_code := 'AI_' || to_char(NOW(), 'YYYYMMDDHH24MISSMS') || '_' || 
                     COALESCE(LEFT(v_tx.fitid, 8), LEFT(p_transaction_id::text, 8));
  
  -- Criar lançamento de classificação DIRETO
  v_entry_id := gen_random_uuid();
  
  INSERT INTO accounting_entries (
    id, tenant_id, entry_date, competence_date,
    description, internal_code, source_type,
    entry_type, reference_type, reference_id,
    created_by
  ) VALUES (
    v_entry_id, p_tenant, v_tx.transaction_date, v_tx.transaction_date,
    format('AI: %s → %s', LEFT(v_tx.description, 40), v_suggestion->'suggestion'->>'account_code'),
    v_internal_code,
    'classification',
    'CLASSIFICACAO', 'bank_transaction', p_transaction_id,
    p_created_by
  );
  
  -- Linhas do lançamento DIRETO (sem transitória)
  IF v_tx.amount > 0 THEN
    -- ENTRADA (recebimento): D-Banco / C-Receita
    INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (gen_random_uuid(), p_tenant, v_entry_id, v_bank_account_id, v_abs_amount, 0, 'Entrada banco'),
      (gen_random_uuid(), p_tenant, v_entry_id, v_account_id, 0, v_abs_amount, 'Classificado via AI');
  ELSE
    -- SAÍDA (pagamento): D-Despesa / C-Banco
    INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (gen_random_uuid(), p_tenant, v_entry_id, v_account_id, v_abs_amount, 0, 'Classificado via AI'),
      (gen_random_uuid(), p_tenant, v_entry_id, v_bank_account_id, 0, v_abs_amount, 'Saída banco');
  END IF;
  
  -- Registrar decisão
  INSERT INTO classification_decisions (
    tenant_id, transaction_id, decision_type,
    suggested_account_id, final_account_id,
    similar_knowledge_ids, reasoning,
    was_approved, approved_by, approved_at
  ) VALUES (
    p_tenant, p_transaction_id, 'auto',
    v_account_id, v_account_id,
    ARRAY[(v_suggestion->'suggestion'->>'knowledge_id')::UUID],
    v_suggestion->>'reasoning',
    true, 'auto-ai', NOW()
  ) RETURNING id INTO v_decision_id;
  
  -- Feedback: aprender com esta classificação
  PERFORM learn_from_classification(p_tenant, p_transaction_id, v_entry_id, v_account_id, 'auto-ai');
  
  RETURN jsonb_build_object(
    'ok', true,
    'classified', true,
    'entry_id', v_entry_id,
    'decision_id', v_decision_id,
    'account', v_suggestion->'suggestion'->>'account_code',
    'confidence', v_suggestion->>'confidence',
    'reasoning', v_suggestion->>'reasoning'
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RPC: classify_month_direct_with_ai
-- ═══════════════════════════════════════════════════════════════════════════════
-- Classifica todas as transações de um mês usando classificação DIRETA

CREATE OR REPLACE FUNCTION classify_month_direct_with_ai(
  p_tenant UUID,
  p_start DATE,
  p_end DATE
)
RETURNS JSONB AS $$
DECLARE
  v_classified INT := 0;
  v_pending INT := 0;
  v_skipped INT := 0;
  v_errors INT := 0;
  v_result JSONB;
  r RECORD;
BEGIN
  -- Processar cada transação não classificada do período
  FOR r IN
    SELECT bt.id, bt.description, bt.amount
    FROM bank_transactions bt
    WHERE bt.tenant_id = p_tenant
      AND bt.transaction_date BETWEEN p_start AND p_end
      -- Não já classificado
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.reference_id = bt.id
          AND ae.source_type = 'classification'
      )
    ORDER BY bt.transaction_date
  LOOP
    BEGIN
      v_result := classify_direct_with_ai(p_tenant, r.id, 'batch-ai');
      
      IF v_result->>'ok' = 'false' THEN
        IF v_result->>'error' = 'Transação já classificada' THEN
          v_skipped := v_skipped + 1;
        ELSE
          v_errors := v_errors + 1;
        END IF;
      ELSIF (v_result->>'classified')::boolean THEN
        v_classified := v_classified + 1;
      ELSE
        v_pending := v_pending + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Erro ao classificar %: %', r.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'ok', true,
    'classified', v_classified,
    'pending_review', v_pending,
    'skipped', v_skipped,
    'errors', v_errors,
    'total_processed', v_classified + v_pending + v_skipped + v_errors,
    'message', format('AI classificou %s transações, %s para revisão, %s puladas, %s erros', 
                      v_classified, v_pending, v_skipped, v_errors)
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RPC: get_pending_classifications
-- ═══════════════════════════════════════════════════════════════════════════════
-- Lista transações pendentes de classificação para revisão manual

CREATE OR REPLACE FUNCTION get_pending_classifications(
  p_tenant UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE (
  transaction_id UUID,
  transaction_date DATE,
  description TEXT,
  amount NUMERIC,
  suggestion_account_code TEXT,
  suggestion_account_name TEXT,
  confidence NUMERIC,
  reasoning TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id AS transaction_id,
    bt.transaction_date,
    bt.description,
    bt.amount,
    cd.suggested_account_id::text AS suggestion_account_code,
    coa.name AS suggestion_account_name,
    COALESCE((cd.similarity_scores)[1], 0) AS confidence,
    cd.reasoning
  FROM bank_transactions bt
  LEFT JOIN classification_decisions cd ON cd.transaction_id = bt.id 
    AND cd.was_approved = false
  LEFT JOIN chart_of_accounts coa ON coa.id = cd.suggested_account_id
  WHERE bt.tenant_id = p_tenant
    AND bt.transaction_date BETWEEN p_start AND p_end
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.reference_id = bt.id
        AND ae.source_type = 'classification'
    )
  ORDER BY bt.transaction_date, ABS(bt.amount) DESC;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. RPC: classify_manual
-- ═══════════════════════════════════════════════════════════════════════════════
-- Classificação manual de uma transação (para revisão humana)

CREATE OR REPLACE FUNCTION classify_manual(
  p_tenant UUID,
  p_transaction_id UUID,
  p_account_id UUID,
  p_created_by TEXT DEFAULT 'manual'
)
RETURNS JSONB AS $$
DECLARE
  v_tx RECORD;
  v_account RECORD;
  v_entry_id UUID;
  v_bank_account_id UUID := '10d5892d-a843-4034-8d62-9fec95b8fd56';
  v_abs_amount NUMERIC;
  v_internal_code TEXT;
BEGIN
  -- Verificar se já tem classificação
  IF EXISTS (
    SELECT 1 FROM accounting_entries ae
    WHERE ae.reference_id = p_transaction_id
      AND ae.source_type = 'classification'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transação já classificada');
  END IF;

  -- Buscar transação
  SELECT * INTO v_tx
  FROM bank_transactions
  WHERE id = p_transaction_id AND tenant_id = p_tenant;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transação não encontrada');
  END IF;
  
  -- Buscar conta
  SELECT * INTO v_account
  FROM chart_of_accounts
  WHERE id = p_account_id AND tenant_id = p_tenant;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Conta não encontrada');
  END IF;
  
  v_abs_amount := ABS(v_tx.amount);
  v_internal_code := 'MANUAL_' || to_char(NOW(), 'YYYYMMDDHH24MISSMS') || '_' || 
                     COALESCE(LEFT(v_tx.fitid, 8), LEFT(p_transaction_id::text, 8));
  
  -- Criar lançamento
  v_entry_id := gen_random_uuid();
  
  INSERT INTO accounting_entries (
    id, tenant_id, entry_date, competence_date,
    description, internal_code, source_type,
    entry_type, reference_type, reference_id,
    created_by
  ) VALUES (
    v_entry_id, p_tenant, v_tx.transaction_date, v_tx.transaction_date,
    format('Manual: %s → %s', LEFT(v_tx.description, 40), v_account.code),
    v_internal_code,
    'classification',
    'CLASSIFICACAO', 'bank_transaction', p_transaction_id,
    p_created_by
  );
  
  -- Linhas
  IF v_tx.amount > 0 THEN
    INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (gen_random_uuid(), p_tenant, v_entry_id, v_bank_account_id, v_abs_amount, 0, 'Entrada banco'),
      (gen_random_uuid(), p_tenant, v_entry_id, p_account_id, 0, v_abs_amount, 'Classificação manual');
  ELSE
    INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (gen_random_uuid(), p_tenant, v_entry_id, p_account_id, v_abs_amount, 0, 'Classificação manual'),
      (gen_random_uuid(), p_tenant, v_entry_id, v_bank_account_id, 0, v_abs_amount, 'Saída banco');
  END IF;
  
  -- Registrar decisão
  INSERT INTO classification_decisions (
    tenant_id, transaction_id, decision_type,
    final_account_id, reasoning,
    was_approved, approved_by, approved_at
  ) VALUES (
    p_tenant, p_transaction_id, 'manual',
    p_account_id, 'Classificação manual por ' || p_created_by,
    true, p_created_by, NOW()
  );
  
  -- Feedback: aprender com esta classificação
  PERFORM learn_from_classification(p_tenant, p_transaction_id, v_entry_id, p_account_id, p_created_by);
  
  RETURN jsonb_build_object(
    'ok', true,
    'entry_id', v_entry_id,
    'account', v_account.code || ' - ' || v_account.name
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION classify_direct_with_ai(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION classify_month_direct_with_ai(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_pending_classifications(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION classify_manual(UUID, UUID, UUID, TEXT) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'CLASSIFICAÇÃO DIRETA (SEM TRANSITÓRIA) - INSTALADA';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Novas funções:';
  RAISE NOTICE '  • classify_direct_with_ai(tenant, transaction_id)';
  RAISE NOTICE '  • classify_month_direct_with_ai(tenant, start, end)';
  RAISE NOTICE '  • get_pending_classifications(tenant, start, end)';
  RAISE NOTICE '  • classify_manual(tenant, transaction_id, account_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'FLUXO:';
  RAISE NOTICE '  ENTRADA: D-Banco Sicredi / C-Receita';
  RAISE NOTICE '  SAÍDA:   D-Despesa / C-Banco Sicredi';
  RAISE NOTICE '';
  RAISE NOTICE 'EXECUTAR:';
  RAISE NOTICE '  SELECT classify_month_direct_with_ai(tenant, ''2025-02-01'', ''2025-02-28'')';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
END $$;
