-- Migração para corrigir os tipos de conta no plano de contas
-- O problema é que todas as contas estão com account_type incorreto

-- Atualizar contas do grupo 1.x (ATIVO)
UPDATE chart_of_accounts
SET account_type = 'ATIVO', nature = 'DEVEDORA'
WHERE code LIKE '1%' AND (account_type IS NULL OR account_type != 'ATIVO');

-- Atualizar contas do grupo 2.x (PASSIVO)
UPDATE chart_of_accounts
SET account_type = 'PASSIVO', nature = 'CREDORA'
WHERE code LIKE '2%' AND (account_type IS NULL OR account_type != 'PASSIVO');

-- Atualizar contas do grupo 3.x (RECEITA)
UPDATE chart_of_accounts
SET account_type = 'RECEITA', nature = 'CREDORA'
WHERE code LIKE '3%' AND (account_type IS NULL OR account_type != 'RECEITA');

-- Atualizar contas do grupo 4.x (DESPESA)
UPDATE chart_of_accounts
SET account_type = 'DESPESA', nature = 'DEVEDORA'
WHERE code LIKE '4%' AND (account_type IS NULL OR account_type != 'DESPESA');

-- Atualizar nível das contas baseado no código
UPDATE chart_of_accounts
SET level = array_length(string_to_array(code, '.'), 1)
WHERE level IS NULL OR level = 0;

-- Atualizar is_analytical para contas de nível 4+
UPDATE chart_of_accounts
SET is_analytical = (level >= 4)
WHERE is_analytical IS NULL;
