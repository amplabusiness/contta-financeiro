-- ============================================================================
-- CORREÇÃO: Adicionar trigger de tenant_id para bank_transactions
--
-- Este trigger estava faltando, fazendo com que transações importadas via OFX
-- não tivessem tenant_id, o que impedia a automação de identificação de pagadores.
-- ============================================================================

-- Criar trigger para auto-preencher tenant_id em bank_transactions
DROP TRIGGER IF EXISTS trg_set_tenant_bank_transactions ON bank_transactions;

CREATE TRIGGER trg_set_tenant_bank_transactions
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_set_tenant_id();

-- Atualizar transações existentes que não têm tenant_id
-- Usar o primeiro (único) tenant disponível no ambiente local
UPDATE bank_transactions
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE tenant_id IS NULL;

-- Verificar resultado
DO $$
DECLARE
  v_count INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM bank_transactions WHERE tenant_id IS NULL;
  SELECT COUNT(*) INTO v_total FROM bank_transactions;

  IF v_count > 0 THEN
    RAISE WARNING 'Ainda existem % transações sem tenant_id de % total', v_count, v_total;
  ELSE
    RAISE NOTICE 'Todas as % transações agora possuem tenant_id', v_total;
  END IF;
END $$;

COMMENT ON TRIGGER trg_set_tenant_bank_transactions ON bank_transactions IS
  'Auto-preenche tenant_id baseado no usuário autenticado (via fn_auto_set_tenant_id)';
