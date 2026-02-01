-- ============================================================================
-- CORREÇÃO ARQUITETURAL: Sincronização de Estado de Reconciliação
-- ============================================================================
-- Data: 01/02/2026
-- Autor: Dr. Cícero (Sistema Multi-Agente)
-- 
-- PROBLEMA IDENTIFICADO:
-- O sistema tinha dois fluxos desacoplados:
-- 1. Fluxo Contábil: Criava lançamentos e zerava transitórias (OK)
-- 2. Fluxo Operacional: Não atualizava status para 'reconciled'
--
-- SOLUÇÃO:
-- Trigger que GARANTE consistência: se journal_entry_id existe, 
-- a transação DEVE estar reconciliada.
-- ============================================================================

-- 1. Criar função de proteção
CREATE OR REPLACE FUNCTION enforce_reconciliation_state()
RETURNS trigger AS $$
BEGIN
  -- Se a transação tem lançamento contábil vinculado, DEVE estar reconciliada
  IF NEW.journal_entry_id IS NOT NULL THEN
    NEW.status := 'reconciled';
    NEW.is_reconciled := true;
    NEW.matched := true;  -- Campo usado pela UI
    NEW.reconciled_at := COALESCE(NEW.reconciled_at, NOW());
  END IF;
  
  -- Se removeu o lançamento (raro, mas possível em estorno), volta para pending
  IF NEW.journal_entry_id IS NULL AND OLD.journal_entry_id IS NOT NULL THEN
    NEW.status := 'pending';
    NEW.is_reconciled := false;
    NEW.matched := false;
    NEW.reconciled_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Criar trigger (BEFORE para garantir que o estado é corrigido antes de salvar)
DROP TRIGGER IF EXISTS trg_enforce_reconciliation ON bank_transactions;

CREATE TRIGGER trg_enforce_reconciliation
BEFORE INSERT OR UPDATE ON bank_transactions
FOR EACH ROW
EXECUTE FUNCTION enforce_reconciliation_state();

-- 3. Comentário de documentação
COMMENT ON FUNCTION enforce_reconciliation_state() IS 
'DR. CÍCERO - Regra de Ouro: Se journal_entry_id existe, transação DEVE estar reconciliada.
Criado em 01/02/2026 para corrigir inconsistência entre estado contábil e operacional.';

COMMENT ON TRIGGER trg_enforce_reconciliation ON bank_transactions IS
'Garante sincronização automática: journal_entry_id != NULL → status = reconciled';

-- 4. Aplicar correção retroativa em todas as transações inconsistentes
-- (todas que têm lançamento mas não estão marcadas como reconciled)
UPDATE bank_transactions
SET 
  status = 'reconciled',
  is_reconciled = true,
  matched = true,
  reconciled_at = COALESCE(reconciled_at, NOW())
WHERE journal_entry_id IS NOT NULL
  AND (status != 'reconciled' OR is_reconciled = false OR matched = false);

-- 5. Log da correção
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM bank_transactions
  WHERE journal_entry_id IS NOT NULL AND status = 'reconciled';
  
  RAISE NOTICE 'Trigger enforce_reconciliation_state criado. % transações com lançamento estão agora reconciliadas.', v_count;
END $$;
