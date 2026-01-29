-- ============================================================================
-- MIGRAÇÃO: ETAPA 1 - LIMPEZA JANEIRO/2025
-- AUTORIZADO POR: Dr. Cícero - Contador Responsável
-- DATA: 29/01/2026
-- ============================================================================

-- ============================================================================
-- OPERAÇÃO 1.1: Remover is_reconciled de transações sem lançamento contábil
-- ============================================================================
-- 
-- JUSTIFICATIVA:
-- 158 transações estão marcadas como is_reconciled=true mas não possuem
-- journal_entry_id. Isso é uma inconsistência - só pode estar reconciliada
-- se tiver lançamento contábil.
--
-- REGRA: Transação reconciliada = Transação COM lançamento contábil
-- ============================================================================

-- Primeiro: Backup para auditoria
CREATE TABLE IF NOT EXISTS _backup_etapa1_jan2025 AS
SELECT 
    id,
    transaction_date,
    description,
    amount,
    journal_entry_id,
    is_reconciled,
    reconciled_at,
    NOW() as backup_created_at
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND transaction_date >= '2025-01-01'
  AND transaction_date <= '2025-01-31'
  AND is_reconciled = true
  AND journal_entry_id IS NULL;

-- Contagem antes da alteração
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM bank_transactions
    WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
      AND transaction_date >= '2025-01-01'
      AND transaction_date <= '2025-01-31'
      AND is_reconciled = true
      AND journal_entry_id IS NULL;
    
    RAISE NOTICE 'ETAPA 1.1 - Transações a serem desreconciliadas: %', v_count;
END $$;

-- EXECUÇÃO: Remover flag is_reconciled
UPDATE bank_transactions
SET 
    is_reconciled = false,
    reconciled_at = NULL,
    reconciliation_method = NULL
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND transaction_date >= '2025-01-01'
  AND transaction_date <= '2025-01-31'
  AND is_reconciled = true
  AND journal_entry_id IS NULL;

-- Verificação pós-execução
DO $$
DECLARE
    v_total INTEGER;
    v_reconciliadas INTEGER;
    v_sem_lancamento INTEGER;
BEGIN
    -- Total de transações
    SELECT COUNT(*) INTO v_total
    FROM bank_transactions
    WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
      AND transaction_date >= '2025-01-01'
      AND transaction_date <= '2025-01-31';
    
    -- Reconciliadas
    SELECT COUNT(*) INTO v_reconciliadas
    FROM bank_transactions
    WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
      AND transaction_date >= '2025-01-01'
      AND transaction_date <= '2025-01-31'
      AND is_reconciled = true;
    
    -- Sem lançamento
    SELECT COUNT(*) INTO v_sem_lancamento
    FROM bank_transactions
    WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
      AND transaction_date >= '2025-01-01'
      AND transaction_date <= '2025-01-31'
      AND journal_entry_id IS NULL;
    
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'ETAPA 1 - RESULTADO';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Total transações Janeiro/2025: %', v_total;
    RAISE NOTICE 'Reconciliadas (com lançamento): %', v_reconciliadas;
    RAISE NOTICE 'Pendentes (sem lançamento): %', v_sem_lancamento;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- FIM DA ETAPA 1
-- Assinado: Dr. Cícero - Contador Responsável - 29/01/2026
-- ============================================================================
