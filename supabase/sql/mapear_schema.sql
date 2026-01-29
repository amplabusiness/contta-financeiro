-- =============================================================================
-- MAPEAR SCHEMA DAS TABELAS
-- Dr. Cícero - 29/01/2026
-- =============================================================================

-- 1. COLUNAS DA accounting_entry_lines
SELECT 'accounting_entry_lines' as tabela, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'accounting_entry_lines'
ORDER BY ordinal_position;

-- 2. COLUNAS DA accounting_entries
SELECT 'accounting_entries' as tabela, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'accounting_entries'
ORDER BY ordinal_position;

-- 3. COLUNAS DA bank_transactions (para referência)
SELECT 'bank_transactions' as tabela, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bank_transactions'
ORDER BY ordinal_position;
