-- ============================================================================
-- TRIGGER DEFINITIVA: Sincronização de Estado de Reconciliação
-- ============================================================================
-- EXECUTAR NO SUPABASE SQL EDITOR
-- Data: 01/02/2026
-- Autor: Dr. Cícero - Contador Responsável
-- ============================================================================
-- 🎯 REGRA: Se existe journal_entry_id → reconciled automaticamente
-- ============================================================================

-- 1. Função de proteção (versão definitiva)
CREATE OR REPLACE FUNCTION enforce_reconciliation_state()
RETURNS trigger AS $$
BEGIN
  IF NEW.journal_entry_id IS NOT NULL THEN
    NEW.status := 'reconciled';
    NEW.is_reconciled := true;
    NEW.reconciled_at := COALESCE(NEW.reconciled_at, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Remover trigger antiga (se existir)
DROP TRIGGER IF EXISTS trg_enforce_reconciliation_state ON bank_transactions;
DROP TRIGGER IF EXISTS trg_enforce_reconciliation ON bank_transactions;

-- 3. Criar trigger definitiva
CREATE TRIGGER trg_enforce_reconciliation_state
BEFORE INSERT OR UPDATE ON bank_transactions
FOR EACH ROW
EXECUTE FUNCTION enforce_reconciliation_state();

-- 4. Documentação
COMMENT ON FUNCTION enforce_reconciliation_state() IS 
'DR. CÍCERO - Regra Soberana: journal_entry_id != NULL → status = reconciled (automático)';

-- ============================================================================
-- CORREÇÃO RETROATIVA (executar uma vez)
-- ============================================================================

-- 5. Desabilitar triggers para correção em massa
ALTER TABLE bank_transactions DISABLE TRIGGER USER;

-- 6. Corrigir registros inconsistentes
UPDATE bank_transactions
SET 
  status = 'reconciled',
  is_reconciled = true,
  reconciled_at = COALESCE(reconciled_at, NOW())
WHERE journal_entry_id IS NOT NULL
  AND (status != 'reconciled' OR is_reconciled = false);

-- 7. Reabilitar triggers
ALTER TABLE bank_transactions ENABLE TRIGGER USER;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================
SELECT 
  COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL AND status = 'reconciled') as reconciliadas_ok,
  COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL AND status != 'reconciled') as inconsistentes,
  COUNT(*) FILTER (WHERE journal_entry_id IS NULL) as pendentes
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';

-- ✅ Resultado esperado: inconsistentes = 0
