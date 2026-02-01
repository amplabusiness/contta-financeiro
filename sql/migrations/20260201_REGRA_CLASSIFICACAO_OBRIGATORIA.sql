-- ============================================================================
-- REGRA: Reconciliação requer classificação
-- ============================================================================
-- Data: 01/02/2026
-- Autor: Dr. Cícero - Contador Responsável
-- 
-- OBJETIVO: Garantir que nenhuma transação seja marcada como reconciled
--           se existir lançamento ofx_import sem lançamento classification
-- ============================================================================

-- 1. Inserir nova regra aprendida
INSERT INTO learned_rules (
  tenant_id,
  rule_id,
  rule_name,
  category,
  condition_description,
  condition_sql,
  expected_outcome,
  action_description,
  severity,
  source,
  first_occurrence,
  occurrence_count,
  is_active,
  approved_by,
  approved_at
) VALUES (
  'a53a4957-fe97-4856-b3ca-70045157b421',
  'RECONCILIACAO_REQUER_CLASSIFICACAO',
  'Reconciliação requer classificação contábil',
  'reconciliation',
  'Transação só pode ser marcada como reconciled se existir lançamento de classificação que zere a transitória',
  $SQL$
    -- Transações com lançamento OFX mas sem classificação
    SELECT bt.id, bt.transaction_date, bt.amount, bt.description
    FROM bank_transactions bt
    JOIN accounting_entries ae ON ae.id = bt.journal_entry_id
    WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
      AND ae.source_type IN ('ofx_import', 'ofx_transit', 'OFX_BANK')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries class
        WHERE class.tenant_id = bt.tenant_id
          AND class.source_type = 'classification'
          AND class.reference_id = bt.id
      )
  $SQL$,
  'Toda transação reconciliada deve ter lançamento de classificação',
  'Impedir reconciliação sem classificação. Criar lançamento de classificação antes.',
  'critical',
  'institutional',
  '2026-02-01',
  1,
  true,
  'dr-cicero',
  now()
)
ON CONFLICT (tenant_id, rule_id) DO UPDATE SET
  occurrence_count = learned_rules.occurrence_count + 1,
  last_occurrence = now(),
  updated_at = now();

-- 2. Função para verificar se transação pode ser reconciliada
CREATE OR REPLACE FUNCTION check_classification_exists(
  p_transaction_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_ofx boolean := false;
  v_has_class boolean := false;
BEGIN
  -- Verificar se tem lançamento OFX
  SELECT EXISTS (
    SELECT 1 FROM accounting_entries ae
    JOIN bank_transactions bt ON bt.journal_entry_id = ae.id
    WHERE bt.id = p_transaction_id
      AND bt.tenant_id = p_tenant_id
      AND ae.source_type IN ('ofx_import', 'ofx_transit', 'OFX_BANK', 'bank_transaction')
  ) INTO v_has_ofx;

  -- Se não tem OFX, pode reconciliar normalmente
  IF NOT v_has_ofx THEN
    RETURN true;
  END IF;

  -- Se tem OFX, verificar se tem classificação
  SELECT EXISTS (
    SELECT 1 FROM accounting_entries ae
    WHERE ae.tenant_id = p_tenant_id
      AND ae.source_type = 'classification'
      AND (ae.reference_id = p_transaction_id OR ae.source_id::text = p_transaction_id::text)
  ) INTO v_has_class;

  RETURN v_has_class;
END;
$$;

COMMENT ON FUNCTION check_classification_exists IS 
'DR. CÍCERO - Verifica se transação OFX tem classificação correspondente';

-- 3. Função para listar transações sem classificação
CREATE OR REPLACE FUNCTION get_unclassified_transactions(
  p_tenant_id uuid,
  p_start_date date DEFAULT '2025-01-01',
  p_end_date date DEFAULT '2025-01-31'
)
RETURNS TABLE (
  transaction_id uuid,
  transaction_date date,
  amount numeric,
  description text,
  entry_source_type text,
  has_classification boolean
)
LANGUAGE sql
AS $$
  SELECT 
    bt.id as transaction_id,
    bt.transaction_date,
    bt.amount,
    bt.description,
    ae.source_type as entry_source_type,
    EXISTS (
      SELECT 1 FROM accounting_entries class
      WHERE class.tenant_id = bt.tenant_id
        AND class.source_type = 'classification'
        AND (class.reference_id = bt.id OR class.source_id::text = bt.id::text)
    ) as has_classification
  FROM bank_transactions bt
  LEFT JOIN accounting_entries ae ON ae.id = bt.journal_entry_id
  WHERE bt.tenant_id = p_tenant_id
    AND bt.transaction_date BETWEEN p_start_date AND p_end_date
  ORDER BY bt.transaction_date, bt.amount;
$$;

GRANT EXECUTE ON FUNCTION get_unclassified_transactions(uuid, date, date) TO authenticated;

COMMENT ON FUNCTION get_unclassified_transactions IS 
'DR. CÍCERO - Lista transações do período com flag de classificação';

-- 4. Verificação: Quantas transações de Jan/2025 estão sem classificação?
SELECT 
  COUNT(*) FILTER (WHERE has_classification = false) as sem_classificacao,
  COUNT(*) FILTER (WHERE has_classification = true) as com_classificacao,
  COUNT(*) as total
FROM get_unclassified_transactions(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2025-01-01',
  '2025-01-31'
);
