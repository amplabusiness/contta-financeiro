-- ==========================================
-- CRIAR USUÁRIO ADMIN
-- ==========================================

-- OPÇÃO 1: Via SQL (NÃO RECOMENDADO - use o dashboard)
-- Este é apenas para referência, use o dashboard do Supabase

-- INSTRUÇÕES PARA CRIAR USUÁRIO:
-- 1. Acesse: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/auth/users
-- 2. Clique em "Add user" (ou "Convidar usuário")
-- 3. Escolha "Create new user"
-- 4. Preencha:
--    - Email: seu_email@exemplo.com
--    - Password: sua_senha_forte
--    - Auto Confirm User: MARQUE esta opção
-- 5. Clique em "Create user"

-- Depois tente fazer login na aplicação com esse email e senha

-- ==========================================
-- VERIFICAR CONFIGURAÇÃO DE EMAIL
-- ==========================================

-- Se quiser verificar as configurações de autenticação:
SELECT * FROM auth.users LIMIT 5;
