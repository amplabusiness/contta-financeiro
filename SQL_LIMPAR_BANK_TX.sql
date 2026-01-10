-- ============================================================================
-- CORRIGIR BANK_TRANSACTIONS: Remover 2024 e reimportar tudo
-- Execute no Supabase Dashboard: SQL Editor
-- ============================================================================

-- PASSO 1: Desabilitar triggers
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'bank_transactions'::regclass AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE bank_transactions DISABLE TRIGGER %I', r.tgname);
    END LOOP;
END $$;

-- PASSO 2: Deletar TODAS as transações de 2024 (não deveriam existir)
DELETE FROM bank_transactions WHERE transaction_date < '2025-01-01';

-- PASSO 3: Deletar transações com amount = 0 (dados corrompidos)
DELETE FROM bank_transactions WHERE amount = 0;

-- PASSO 4: Deletar TODAS as transações existentes para reimportar
-- (porque os dados antigos parecem estar com valores zerados)
DELETE FROM bank_transactions WHERE transaction_date >= '2025-01-01';

-- PASSO 5: Verificar que está vazio
SELECT COUNT(*) as total_restante FROM bank_transactions;
