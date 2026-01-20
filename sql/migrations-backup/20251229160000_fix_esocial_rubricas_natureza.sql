-- =====================================================
-- CORREÇÃO: Natureza das Rubricas eSocial + Contas Contábeis
-- 1. Corrige natureza (PROVENTO/DESCONTO)
-- 2. Vincula contas contábeis para lançamentos automáticos
-- =====================================================

-- PASSO 1: Corrigir natureza e tipo_rubrica

-- Rubricas de PROVENTO (códigos 1xxx)
UPDATE esocial_rubricas SET
  natureza = 'PROVENTO',
  tipo_rubrica = 'PROVENTO'
WHERE codigo LIKE '1%';

-- Rubricas de DESCONTO (códigos 2xxx)
UPDATE esocial_rubricas SET
  natureza = 'DESCONTO',
  tipo_rubrica = 'DESCONTO'
WHERE codigo LIKE '2%';

-- Rubricas de RESCISÃO são PROVENTO (códigos 3xxx)
UPDATE esocial_rubricas SET
  natureza = 'PROVENTO',
  tipo_rubrica = 'PROVENTO'
WHERE codigo LIKE '3%';

-- Rubricas de DESCONTO RESCISÃO (códigos 4xxx)
UPDATE esocial_rubricas SET
  natureza = 'DESCONTO',
  tipo_rubrica = 'DESCONTO'
WHERE codigo LIKE '4%';

-- Rubricas "por fora" são PROVENTO (códigos 9xxx, exceto 9201/9203)
UPDATE esocial_rubricas SET
  natureza = 'PROVENTO',
  tipo_rubrica = 'PROVENTO'
WHERE codigo LIKE '9%' AND codigo NOT IN ('9201', '9203');

-- INSS e IRRF descontados
UPDATE esocial_rubricas SET
  natureza = 'DESCONTO',
  tipo_rubrica = 'DESCONTO'
WHERE codigo IN ('9201', '9203', '2000', '2001');

-- PASSO 2: Criar rubricas de INSS/IRRF se não existirem
INSERT INTO esocial_rubricas (codigo, descricao, natureza, tipo_rubrica, is_oficial, is_active, incide_inss, incide_irrf, incide_fgts)
SELECT '9201', 'INSS Descontado', 'DESCONTO', 'DESCONTO', true, true, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM esocial_rubricas WHERE codigo = '9201');

INSERT INTO esocial_rubricas (codigo, descricao, natureza, tipo_rubrica, is_oficial, is_active, incide_inss, incide_irrf, incide_fgts)
SELECT '9203', 'IRRF Descontado', 'DESCONTO', 'DESCONTO', true, true, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM esocial_rubricas WHERE codigo = '9203');

-- PASSO 3: Criar contas contábeis padrão se não existirem
-- Estrutura: code, name, account_type, nature, level, is_synthetic, is_active

-- Despesas com Salários (4.1.1.xx)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.01', 'Despesas com Salários e Ordenados', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.01');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.02', 'INSS Patronal', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.02');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.03', 'FGTS', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.03');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.04', 'Vale Transporte', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.04');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.05', 'Vale Refeição/Alimentação', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.05');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.06', 'Plano de Saúde', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.06');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.07', 'Adicional de Insalubridade', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.07');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.08', 'Adicional de Periculosidade', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.08');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.09', 'Horas Extras', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.09');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.10', 'Adicional Noturno', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.10');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.11', 'Férias e 1/3 Constitucional', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.11');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.12', '13º Salário', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.12');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.13', 'Comissões', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.13');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '4.1.1.14', 'Gratificações', 'Expense', 'Devedora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.14');

-- Passivo - Obrigações Trabalhistas (2.1.2.xx)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '2.1.2.01', 'Salários e Ordenados a Pagar', 'Liability', 'Credora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.01');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '2.1.2.02', 'INSS a Recolher', 'Liability', 'Credora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.02');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '2.1.2.03', 'IRRF a Recolher', 'Liability', 'Credora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.03');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '2.1.2.04', 'FGTS a Recolher', 'Liability', 'Credora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.04');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '2.1.2.05', 'Contribuição Sindical a Recolher', 'Liability', 'Credora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.05');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '2.1.2.06', 'Pensão Alimentícia a Pagar', 'Liability', 'Credora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.06');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '2.1.2.07', 'Provisão de Férias', 'Liability', 'Credora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.07');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active)
SELECT '2.1.2.08', 'Provisão de 13º Salário', 'Liability', 'Credora', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.08');

-- PASSO 4: Vincular rubricas às contas contábeis
-- account_debit_id = conta de DÉBITO (despesa para proventos, passivo para descontos do funcionário)
-- account_credit_id = conta de CRÉDITO (passivo para proventos, ativo para pagamento)

-- Salários (1000-1002) - D: Despesa com Salários / C: Salários a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo IN ('1000', '1001', '1002', '3000');

-- Comissões (1003) - D: Comissões / C: Salários a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.13'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1003';

-- Insalubridade (1010) - D: Adicional Insalubridade / C: Salários a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.07'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1010';

-- Periculosidade (1011) - D: Adicional Periculosidade / C: Salários a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.08'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1011';

-- Adicional Noturno (1012) - D: Adicional Noturno / C: Salários a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.10'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1012';

-- Horas Extras (1020, 1021) - D: Horas Extras / C: Salários a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.09'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo IN ('1020', '1021');

-- DSR (1030) - D: Despesa com Salários / C: Salários a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1030';

-- Gratificações (1040, 1041) - D: Gratificações / C: Salários a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.14'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1040';

-- 13º Salário (1041) - D: 13º Salário / C: Provisão 13º
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.12'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.08')
WHERE codigo = '1041';

-- Férias (1050, 1051) - D: Férias / C: Provisão Férias
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.11'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.07')
WHERE codigo IN ('1050', '1051', '1060');

-- Vale Transporte empresa (1080) - D: VT / C: Caixa/Banco
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.04'),
  account_credit_id = NULL -- Será definido no momento do pagamento
WHERE codigo = '1080';

-- Vale Alimentação/Refeição (1090) - D: VA/VR / C: Caixa/Banco
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.05'),
  account_credit_id = NULL
WHERE codigo = '1090';

-- DESCONTOS DO FUNCIONÁRIO (não são despesa da empresa)
-- INSS Descontado (2000, 9201) - D: Salários a Pagar / C: INSS a Recolher
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.02')
WHERE codigo IN ('2000', '9201');

-- IRRF Descontado (2001, 9203) - D: Salários a Pagar / C: IRRF a Recolher
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.03')
WHERE codigo IN ('2001', '9203');

-- Desconto VT 6% (2010) - D: Salários a Pagar / C: VT a Pagar (reduz despesa)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.04') -- Reduz despesa
WHERE codigo = '2010';

-- Desconto VA (2011) - D: Salários a Pagar / C: VA a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.05')
WHERE codigo = '2011';

-- Contribuição/Mensalidade Sindical (2020, 2021) - D: Salários a Pagar / C: Contrib Sindical a Recolher
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.05')
WHERE codigo IN ('2020', '2021');

-- Faltas/Atrasos (2030, 2031) - D: Salários a Pagar / C: Despesa com Salários (reduz)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')
WHERE codigo IN ('2030', '2031');

-- Pensão Alimentícia (2060) - D: Salários a Pagar / C: Pensão a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.06')
WHERE codigo IN ('2060', '4040');

-- Plano de Saúde desc (2070) - D: Salários a Pagar / C: Plano Saúde (reduz despesa)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.06')
WHERE codigo = '2070';

-- Adiantamento (2040, 4020) - D: Salários a Pagar / C: Adiantamento a Empregados (Ativo)
-- Nota: Adiantamento reduz o que o funcionário tem a receber

COMMENT ON TABLE esocial_rubricas IS 'Rubricas eSocial com contas contábeis vinculadas para lançamentos automáticos';
