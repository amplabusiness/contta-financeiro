-- ==========================================
-- VERIFICAÇÃO DA MIGRAÇÃO
-- ==========================================

-- 1. Ver todas as tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Ver a view criada
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'VIEW'
ORDER BY table_name;

-- 3. Ver a conta SICREDI
SELECT * FROM bank_accounts WHERE bank_code = '748';

-- 4. Verificar estrutura da tabela client_opening_balance
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'client_opening_balance'
ORDER BY ordinal_position;

-- 5. Contar registros em cada tabela
SELECT 
  'clients' as tabela, COUNT(*) as total FROM clients
UNION ALL
SELECT 'bank_accounts', COUNT(*) FROM bank_accounts
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'bank_transactions', COUNT(*) FROM bank_transactions
UNION ALL
SELECT 'client_opening_balance', COUNT(*) FROM client_opening_balance;
