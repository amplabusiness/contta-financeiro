-- ============================================================================
-- IMPORTAR TRANSAÇÕES DEZEMBRO 2025 E JANEIRO 2026
-- Execute no Supabase Dashboard: SQL Editor
-- ============================================================================

-- Primeiro, desabilitar triggers que tentam criar lançamentos contábeis automaticamente
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'bank_transactions'::regclass 
        AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE bank_transactions DISABLE TRIGGER %I', r.tgname);
        RAISE NOTICE 'Trigger desabilitado: %', r.tgname;
    END LOOP;
END $$;

-- Obter ID da conta bancária Sicredi
DO $$
DECLARE
    v_bank_account_id UUID;
BEGIN
    SELECT id INTO v_bank_account_id FROM bank_accounts WHERE name = 'Sicredi' OR bank_name = 'Sicredi' LIMIT 1;
    IF v_bank_account_id IS NULL THEN
        RAISE EXCEPTION 'Conta Sicredi não encontrada!';
    END IF;
    RAISE NOTICE 'Bank Account ID: %', v_bank_account_id;
END $$;

-- ========== DEZEMBRO 2025 ==========
-- Cole aqui as transações de dezembro que você precisa importar
-- Exemplo de estrutura:

INSERT INTO bank_transactions (bank_account_id, transaction_date, transaction_type, amount, description, document_number, fitid)
SELECT 
    (SELECT id FROM bank_accounts WHERE name = 'Sicredi' OR bank_name = 'Sicredi' LIMIT 1),
    transaction_date,
    transaction_type,
    amount,
    description,
    document_number,
    fitid
FROM (VALUES
    -- DEZEMBRO 2025 (cole as transações aqui do arquivo extrato (2) dez.ofx)
    ('2025-12-01'::date, 'credit', 5989.11, 'LIQ.COBRANCA SIMPLES-COB000003', '20234852817', '20234852817')
    -- ... adicionar mais linhas
) AS t(transaction_date, transaction_type, amount, description, document_number, fitid)
WHERE NOT EXISTS (
    SELECT 1 FROM bank_transactions WHERE fitid = t.fitid
);

-- Reabilitar triggers
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'bank_transactions'::regclass 
        AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE bank_transactions ENABLE TRIGGER %I', r.tgname);
        RAISE NOTICE 'Trigger reabilitado: %', r.tgname;
    END LOOP;
END $$;

-- Verificar resultado
SELECT 
    date_trunc('month', transaction_date) AS mes,
    COUNT(*) AS total,
    SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) AS entradas,
    SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) AS saidas
FROM bank_transactions
GROUP BY date_trunc('month', transaction_date)
ORDER BY mes;
