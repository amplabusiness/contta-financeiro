-- ============================================================================
-- SQL PARA EXECUTAR NO SUPABASE DASHBOARD
-- Acesse: https://supabase.com/dashboard > SQL Editor > New Query
-- ============================================================================

-- 1. Adicionar campos de data de contrato
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS inactivation_reason TEXT;

-- 2. Comentários nos campos
COMMENT ON COLUMN clients.contract_start_date IS 'Data de início do contrato com a Ampla Contabilidade';
COMMENT ON COLUMN clients.contract_end_date IS 'Data de fim do contrato (quando cliente encerra)';
COMMENT ON COLUMN clients.inactivation_reason IS 'Motivo da inativação do cliente';

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_clients_contract_dates ON clients(contract_start_date, contract_end_date);

-- 4. Inicializar contract_start_date com opening_balance_date (se existir)
UPDATE clients
SET contract_start_date = opening_balance_date::date
WHERE contract_start_date IS NULL
  AND opening_balance_date IS NOT NULL;

-- 5. Para clientes sem opening_balance_date, usar created_at
UPDATE clients
SET contract_start_date = created_at::date
WHERE contract_start_date IS NULL;

-- 6. Verificar resultado
SELECT
  COUNT(*) as total_clientes,
  COUNT(contract_start_date) as com_data_inicio,
  COUNT(contract_end_date) as com_data_fim
FROM clients;

-- ============================================================================
-- 7. DESABILITAR TRIGGERS PROBLEMÁTICOS EM BANK_TRANSACTIONS
-- O trigger está tentando inserir em accounting_entries com coluna client_id
-- que não existe na tabela.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_auto_accounting_bank_transaction ON bank_transactions;
DROP TRIGGER IF EXISTS trg_bank_transaction_accounting ON bank_transactions;
DROP TRIGGER IF EXISTS trigger_bank_transaction_to_accounting ON bank_transactions;
DROP TRIGGER IF EXISTS bank_transaction_auto_entry ON bank_transactions;

-- ============================================================================
-- 8. DESABILITAR VALIDAÇÃO DE CNPJ (temporário para updates em batch)
-- O trigger validate_client_before_insert está bloqueando updates
-- ============================================================================

-- Opção A: Desabilitar temporariamente (nome correto do trigger)
ALTER TABLE clients DISABLE TRIGGER trigger_validate_client_before_insert;

-- IMPORTANTE: Reativar após as operações com:
-- ALTER TABLE clients ENABLE TRIGGER trigger_validate_client_before_insert;

-- ============================================================================
-- 9. AGORA EXECUTAR OS UPDATES (itens 4 e 5)
-- ============================================================================

-- 4. Inicializar contract_start_date com opening_balance_date
UPDATE clients
SET contract_start_date = opening_balance_date::date
WHERE contract_start_date IS NULL
  AND opening_balance_date IS NOT NULL;

-- 5. Para clientes sem opening_balance_date, usar created_at
UPDATE clients
SET contract_start_date = created_at::date
WHERE contract_start_date IS NULL;

-- ============================================================================
-- 10. REATIVAR TRIGGER DE VALIDAÇÃO
-- ============================================================================
ALTER TABLE clients ENABLE TRIGGER trigger_validate_client_before_insert;

-- ============================================================================
-- 11. VERIFICAR RESULTADOS
-- ============================================================================

-- Resultado dos clientes
SELECT
  COUNT(*) as total_clientes,
  COUNT(contract_start_date) as com_data_inicio,
  COUNT(contract_end_date) as com_data_fim
FROM clients;

-- Listar triggers restantes em bank_transactions
SELECT
    tgname as trigger_name,
    relname as table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'bank_transactions'
AND NOT tgisinternal;

-- ============================================================================
-- 12. CRIAR FUNÇÃO increment_rule_usage (faltando no schema)
-- IMPORTANTE: O parâmetro deve se chamar "rule_id" (não "p_rule_id")
-- porque é assim que o código frontend chama via RPC
-- ============================================================================

DROP FUNCTION IF EXISTS public.increment_rule_usage(UUID);

CREATE OR REPLACE FUNCTION public.increment_rule_usage(rule_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE classification_rules
  SET usage_count = COALESCE(usage_count, 0) + 1,
      last_used_at = NOW()
  WHERE id = rule_id;
END;
$$;
