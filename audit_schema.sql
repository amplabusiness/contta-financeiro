-- AUDITORIA DE ESTRUTURA DO BANCO DE DADOS
-- Listando todas as tabelas relevantes e suas colunas

-- 1. JOURNAL_ENTRIES
SELECT 'journal_entries' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'journal_entries'
ORDER BY ordinal_position;

-- 2. JOURNAL_ENTRY_LINES
SELECT 'journal_entry_lines' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'journal_entry_lines'
ORDER BY ordinal_position;

-- 3. BANK_TRANSACTIONS
SELECT 'bank_transactions' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bank_transactions'
ORDER BY ordinal_position;

-- 4. ACCOUNTING_ENTRIES (se existir)
SELECT 'accounting_entries' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'accounting_entries'
ORDER BY ordinal_position;

-- 5. CHART_OF_ACCOUNTS
SELECT 'chart_of_accounts' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'chart_of_accounts'
ORDER BY ordinal_position;

-- 6. Chaves estrangeiras relevantes
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name IN ('journal_entries', 'journal_entry_lines', 'bank_transactions', 'accounting_entries')
       OR ccu.table_name IN ('journal_entries', 'journal_entry_lines', 'accounting_entries'))
ORDER BY tc.table_name, tc.constraint_name;
