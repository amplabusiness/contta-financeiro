-- =====================================================
-- DELETAR HEADER ÓRFÃO DO LANÇAMENTO DE AJUSTE
-- As linhas foram deletadas na migration anterior, mas o header ficou
-- =====================================================

BEGIN;

-- Configurar sessão para bypassar RLS e triggers
SET session_replication_role = replica;

-- Deletar o header órfão
DELETE FROM accounting_entries 
WHERE id = '93ace5df-d999-41ce-bd44-df71004afa93';

-- Restaurar sessão
SET session_replication_role = DEFAULT;

-- Verificar
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM accounting_entries
  WHERE id = '93ace5df-d999-41ce-bd44-df71004afa93';
  
  IF v_count > 0 THEN
    RAISE WARNING 'Header ainda existe';
  ELSE
    RAISE NOTICE '✓ Header deletado com sucesso!';
  END IF;
END $$;

-- Verificar saldo do banco
DO $$
DECLARE
  v_saldo DECIMAL;
BEGIN
  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
  INTO v_saldo
  FROM accounting_entry_lines
  WHERE account_id = '10d5892d-a843-4034-8d62-9fec95b8fd56'
    AND tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';
  
  RAISE NOTICE 'Saldo Banco Sicredi: R$ %', v_saldo;
  RAISE NOTICE 'Esperado: R$ 18553.54';
END $$;

COMMIT;
