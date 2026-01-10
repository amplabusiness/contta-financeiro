-- ============================================================================
-- CORRIGIR BANK_TRANSACTIONS (SOMENTE TABELA bank_transactions)
-- NÃO AFETA: saldos de abertura, lançamentos contábeis, clientes a receber
-- Execute no Supabase Dashboard: SQL Editor
-- ============================================================================

-- PASSO 1: Desabilitar triggers (para não disparar criação de lançamentos)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'bank_transactions'::regclass AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE bank_transactions DISABLE TRIGGER %I', r.tgname);
    END LOOP;
END $$;

-- PASSO 2: Deletar SOMENTE transações BANCÁRIAS de 2024
-- ATENÇÃO: Isso NÃO afeta accounting_entries, accounting_entry_lines ou account_opening_balances
DELETE FROM bank_transactions WHERE transaction_date < '2025-01-01';

-- PASSO 3: Corrigir transações antigas que têm transaction_type NULL
-- Definir tipo baseado no sinal do amount
UPDATE bank_transactions
SET 
    transaction_type = CASE WHEN amount >= 0 THEN 'credit' ELSE 'debit' END,
    amount = ABS(amount)
WHERE transaction_type IS NULL;

-- PASSO 4: Reabilitar triggers
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'bank_transactions'::regclass AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE bank_transactions ENABLE TRIGGER %I', r.tgname);
    END LOOP;
END $$;

-- PASSO 5: Verificar resultado - SOMENTE bank_transactions
SELECT 
    to_char(transaction_date, 'YYYY-MM') AS mes,
    COUNT(*) AS total,
    SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) AS entradas,
    SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) AS saidas,
    SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END) AS saldo_mes
FROM bank_transactions
WHERE transaction_date >= '2025-01-01'
GROUP BY to_char(transaction_date, 'YYYY-MM')
ORDER BY mes;
