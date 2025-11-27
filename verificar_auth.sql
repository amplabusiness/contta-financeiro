-- ==========================================
-- VERIFICAR CONFIGURAÇÃO DE AUTENTICAÇÃO
-- ==========================================

-- 1. Verificar se schema auth existe
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'auth';

-- 2. Verificar tabelas do auth
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 3. Verificar se há usuários cadastrados
SELECT id, email, created_at, confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar configuração de signup
SELECT * FROM pg_settings 
WHERE name LIKE '%jwt%' OR name LIKE '%auth%'
LIMIT 20;
