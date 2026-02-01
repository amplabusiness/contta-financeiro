-- ============================================================================
-- RPC OFICIAL: reconcile_transaction()
-- ============================================================================
-- Fonte única, segura, auditável e à prova de erro humano/IA
-- Data: 01/02/2026
-- Autor: Dr. Cícero - Contador Responsável
-- ============================================================================

-- ============================================================================
-- PARTE 1: TABELA DE AUDITORIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS reconciliation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  journal_entry_id uuid,
  action text NOT NULL CHECK (action IN ('RECONCILE', 'UNRECONCILE', 'RECLASSIFY')),
  actor text NOT NULL DEFAULT 'system',
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON reconciliation_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_transaction ON reconciliation_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON reconciliation_audit_log(created_at DESC);

-- RLS
ALTER TABLE reconciliation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON reconciliation_audit_log
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Comentário
COMMENT ON TABLE reconciliation_audit_log IS 
'DR. CÍCERO - Registro imutável de todas as operações de reconciliação';

-- ============================================================================
-- PARTE 2: RPC reconcile_transaction()
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_transaction(
  p_transaction_id uuid,
  p_journal_entry_id uuid,
  p_actor text DEFAULT 'system'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_current_status text;
  v_current_entry_id uuid;
  v_previous_state jsonb;
BEGIN
  -- 1. Buscar tenant e status atual (com lock para evitar race condition)
  SELECT tenant_id, status, journal_entry_id
  INTO v_tenant_id, v_current_status, v_current_entry_id
  FROM bank_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada: %', p_transaction_id;
  END IF;

  -- 2. Validar: transação já reconciliada com MESMO entry?
  IF v_current_entry_id = p_journal_entry_id THEN
    RAISE EXCEPTION 'Transação já reconciliada com este lançamento';
  END IF;

  -- 3. Se já tem outro entry, é reclassificação (permitido)
  IF v_current_entry_id IS NOT NULL AND v_current_entry_id != p_journal_entry_id THEN
    -- Guardar estado anterior para auditoria
    v_previous_state := jsonb_build_object(
      'journal_entry_id', v_current_entry_id,
      'status', v_current_status
    );
  END IF;

  -- 4. Atualizar transação
  UPDATE bank_transactions
  SET
    journal_entry_id = p_journal_entry_id,
    status = 'reconciled',
    is_reconciled = true,
    reconciled_at = COALESCE(reconciled_at, now()),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 5. Registrar auditoria
  INSERT INTO reconciliation_audit_log (
    tenant_id,
    transaction_id,
    journal_entry_id,
    action,
    actor,
    previous_state,
    new_state,
    metadata,
    created_at
  ) VALUES (
    v_tenant_id,
    p_transaction_id,
    p_journal_entry_id,
    CASE WHEN v_previous_state IS NOT NULL THEN 'RECLASSIFY' ELSE 'RECONCILE' END,
    p_actor,
    v_previous_state,
    jsonb_build_object(
      'journal_entry_id', p_journal_entry_id,
      'status', 'reconciled'
    ),
    jsonb_build_object(
      'timestamp', now(),
      'source', 'rpc'
    ),
    now()
  );

  -- 6. Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'journal_entry_id', p_journal_entry_id,
    'action', CASE WHEN v_previous_state IS NOT NULL THEN 'RECLASSIFY' ELSE 'RECONCILE' END,
    'actor', p_actor
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'transaction_id', p_transaction_id
    );
END;
$$;

-- ============================================================================
-- PARTE 3: RPC unreconcile_transaction() (para desfazer)
-- ============================================================================

CREATE OR REPLACE FUNCTION unreconcile_transaction(
  p_transaction_id uuid,
  p_actor text DEFAULT 'system',
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_current_entry_id uuid;
  v_previous_state jsonb;
BEGIN
  -- 1. Buscar estado atual
  SELECT tenant_id, journal_entry_id
  INTO v_tenant_id, v_current_entry_id
  FROM bank_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada: %', p_transaction_id;
  END IF;

  IF v_current_entry_id IS NULL THEN
    RAISE EXCEPTION 'Transação não está reconciliada';
  END IF;

  -- 2. Guardar estado anterior
  v_previous_state := jsonb_build_object(
    'journal_entry_id', v_current_entry_id,
    'status', 'reconciled'
  );

  -- 3. Reverter transação
  UPDATE bank_transactions
  SET
    journal_entry_id = NULL,
    status = 'pending',
    is_reconciled = false,
    matched = false,
    reconciled_at = NULL,
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 4. Registrar auditoria
  INSERT INTO reconciliation_audit_log (
    tenant_id,
    transaction_id,
    journal_entry_id,
    action,
    actor,
    previous_state,
    new_state,
    metadata,
    created_at
  ) VALUES (
    v_tenant_id,
    p_transaction_id,
    v_current_entry_id,
    'UNRECONCILE',
    p_actor,
    v_previous_state,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object(
      'reason', p_reason,
      'timestamp', now()
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'previous_entry_id', v_current_entry_id,
    'action', 'UNRECONCILE'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- PARTE 4: PERMISSÕES
-- ============================================================================

GRANT EXECUTE ON FUNCTION reconcile_transaction(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION unreconcile_transaction(uuid, text, text) TO authenticated;

-- ============================================================================
-- PARTE 5: DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON FUNCTION reconcile_transaction IS 
'DR. CÍCERO - RPC oficial para reconciliar transações bancárias.
Uso: SELECT reconcile_transaction(transaction_id, journal_entry_id, actor)
Retorna: jsonb com success, transaction_id, action';

COMMENT ON FUNCTION unreconcile_transaction IS 
'DR. CÍCERO - RPC oficial para desfazer reconciliação.
Uso: SELECT unreconcile_transaction(transaction_id, actor, reason)
Retorna: jsonb com success, previous_entry_id';

-- ============================================================================
-- TESTE
-- ============================================================================
-- SELECT reconcile_transaction(
--   'uuid-da-transacao'::uuid,
--   'uuid-do-lancamento'::uuid,
--   'dr-cicero'
-- );
