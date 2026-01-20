-- Migration: Corrigir nome da conta 4.1.1.08
-- Problema: A conta 4.1.1.08 estava sendo usada como "Outras Despesas"
-- mas o nome no banco estava "13º Salário"

-- 1. Atualizar nome da conta 4.1.1.08 para "Outras Despesas Operacionais"
UPDATE chart_of_accounts
SET name = 'Outras Despesas Operacionais',
    description = 'Conta para despesas não classificadas - migrar para contas específicas'
WHERE code = '4.1.1.08';

-- 2. Garantir que a conta 4.1.2.99 existe como "Outras Despesas Administrativas"
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
SELECT '4.1.2.99', 'Outras Despesas Administrativas', 'DESPESA', 'DEVEDORA', 4, true, true,
       (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.2.99');

-- 3. Log para verificação
DO $$
DECLARE
    v_count_old INTEGER;
    v_count_new INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_old
    FROM accounting_entry_lines ael
    JOIN chart_of_accounts coa ON ael.account_id = coa.id
    WHERE coa.code = '4.1.1.08';

    RAISE NOTICE 'Lançamentos na conta 4.1.1.08: %', v_count_old;
END $$;
