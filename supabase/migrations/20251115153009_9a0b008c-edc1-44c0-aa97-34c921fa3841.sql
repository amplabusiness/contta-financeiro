
-- REORGANIZAÇÃO DO PLANO DE CONTAS CONFORME REGRAS CONTÁBEIS
-- 1.x = ATIVO | 2.x = PASSIVO | 3.x = RECEITA | 4.x = DESPESA

-- ========================================
-- PASSO 1: DELETAR ESTRUTURA ANTIGA INCORRETA DE DESPESAS EM 1.x
-- ========================================

-- Deletar lançamentos vinculados às contas antigas (para poder deletar as contas)
DELETE FROM accounting_entry_lines 
WHERE account_id IN (
  SELECT id FROM chart_of_accounts WHERE code LIKE '1%' AND type = 'despesa'
);

-- Deletar contas de despesas que estão incorretamente em 1.x
DELETE FROM chart_of_accounts WHERE code LIKE '1%' AND type = 'despesa';

-- ========================================
-- PASSO 2: CRIAR ESTRUTURA CORRETA - 1.x ATIVO
-- ========================================

-- 1 - ATIVO (Sintética Principal)
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by)
SELECT '1', 'ATIVO', 'ativo', true, true, created_by
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- 1.1 - Ativo Circulante
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '1.1', 'ATIVO CIRCULANTE', 'ativo', true, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '1')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- Atualizar Bancos e Clientes para ter parent correto
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '1.1')
WHERE code IN ('1.1.2', '1.1.3');

-- ========================================
-- PASSO 3: CRIAR ESTRUTURA CORRETA - 2.x PASSIVO
-- ========================================

-- 2 - PASSIVO (Sintética Principal)
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by)
SELECT '2', 'PASSIVO', 'passivo', true, true, created_by
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- 2.1 - Passivo Circulante
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '2.1', 'PASSIVO CIRCULANTE', 'passivo', true, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '2')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- 2.1.1 - Fornecedores a Pagar
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '2.1.1', 'Fornecedores a Pagar', 'passivo', false, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '2.1')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- ========================================
-- PASSO 4: CRIAR ESTRUTURA CORRETA - 3.x RECEITA
-- ========================================

-- 3 - RECEITA (já existe, mas vamos garantir que está correta)
UPDATE chart_of_accounts 
SET is_synthetic = true, parent_id = NULL
WHERE code = '3';

-- 3.1 - Receita de Serviços
UPDATE chart_of_accounts 
SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '3'),
    is_synthetic = true
WHERE code = '3.1';

-- ========================================
-- PASSO 5: REORGANIZAR 4.x DESPESAS CORRETAMENTE
-- ========================================

-- 4 - DESPESAS (Sintética Principal)
UPDATE chart_of_accounts 
SET is_synthetic = true, parent_id = NULL, name = 'DESPESAS'
WHERE code = '4';

-- 4.1 - Despesas Operacionais
UPDATE chart_of_accounts 
SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '4'),
    is_synthetic = true,
    name = 'Despesas Operacionais'
WHERE code = '4.1';

-- 4.1.1 - Despesas Administrativas (Sintética)
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '4.1.1', 'Despesas Administrativas', 'despesa', true, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '4.1')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- Subcontas de Despesas Administrativas
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id) VALUES
((SELECT '4.1.1.01'), 'Aluguel', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
((SELECT '4.1.1.02'), 'Água', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
((SELECT '4.1.1.03'), 'Luz', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
((SELECT '4.1.1.04'), 'Telefone/Internet', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
((SELECT '4.1.1.05'), 'Material de Escritório', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
((SELECT '4.1.1.06'), 'Material de Limpeza', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'))
ON CONFLICT DO NOTHING;

-- 4.1.2 - Despesas com Pessoal (Sintética)
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '4.1.2', 'Despesas com Pessoal', 'despesa', true, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '4.1')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- 4.1.2.01 - Salários (Sintética)
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '4.1.2.01', 'Salários', 'despesa', true, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- Subcontas de Salários por funcionário
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id) VALUES
((SELECT '4.1.2.01.001'), 'Salário - João Silva', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.01')),
((SELECT '4.1.2.01.002'), 'Salário - Maria Santos', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.01')),
((SELECT '4.1.2.01.003'), 'Salário - Carlos Oliveira', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.01'))
ON CONFLICT DO NOTHING;

-- 4.1.2.02 - Encargos Sociais
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id) VALUES
((SELECT '4.1.2.02'), 'Encargos Sociais', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
((SELECT '4.1.2.03'), 'Vale Transporte', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
((SELECT '4.1.2.04'), 'Vale Alimentação', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.2'))
ON CONFLICT DO NOTHING;

-- 4.1.3 - Despesas Tributárias (Sintética)
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '4.1.3', 'Despesas Tributárias', 'despesa', true, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '4.1')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- Subcontas de Despesas Tributárias
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id) VALUES
((SELECT '4.1.3.01'), 'Impostos Federais', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.3')),
((SELECT '4.1.3.02'), 'Impostos Estaduais', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.3')),
((SELECT '4.1.3.03'), 'Impostos Municipais', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.3'))
ON CONFLICT DO NOTHING;

-- 4.1.4 - Despesas Financeiras (Sintética)
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '4.1.4', 'Despesas Financeiras', 'despesa', true, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '4.1')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;

-- Subcontas de Despesas Financeiras
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id) VALUES
((SELECT '4.1.4.01'), 'Juros', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.4')),
((SELECT '4.1.4.02'), 'Tarifas Bancárias', 'despesa', false, true, (SELECT created_by FROM chart_of_accounts LIMIT 1),
  (SELECT id FROM chart_of_accounts WHERE code = '4.1.4'))
ON CONFLICT DO NOTHING;

-- 4.1.5 - Outras Despesas
INSERT INTO chart_of_accounts (code, name, type, is_synthetic, is_active, created_by, parent_id)
SELECT '4.1.5', 'Outras Despesas', 'despesa', false, true, created_by,
  (SELECT id FROM chart_of_accounts WHERE code = '4.1')
FROM chart_of_accounts LIMIT 1
ON CONFLICT DO NOTHING;
