-- =====================================================
-- LIMPAR TRANSAÇÕES DE JANEIRO/2025 PARA REIMPORTAÇÃO
-- Permite reimportar o extrato completo (183 transações)
-- =====================================================

-- Primeiro, verificar quantas transações existem
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM bank_transactions;
  RAISE NOTICE 'Transações encontradas antes da limpeza: %', v_count;
END $$;

-- Remover todas as transações bancárias (para reimportar corretamente)
DELETE FROM bank_transactions;

-- Limpar histórico de importações também
DELETE FROM bank_imports;

-- Verificar resultado
DO $$
DECLARE
  v_txn_count INT;
  v_import_count INT;
BEGIN
  SELECT COUNT(*) INTO v_txn_count FROM bank_transactions;
  SELECT COUNT(*) INTO v_import_count FROM bank_imports;

  RAISE NOTICE 'Limpeza concluída!';
  RAISE NOTICE 'Transações restantes: %', v_txn_count;
  RAISE NOTICE 'Importações restantes: %', v_import_count;
  RAISE NOTICE 'Agora você pode reimportar o extrato de Janeiro/2025 com todas as 183 transações.';
END $$;
