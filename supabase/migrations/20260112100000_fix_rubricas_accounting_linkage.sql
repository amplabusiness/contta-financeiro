-- ============================================================================
-- CORRIGIR VINCULAÇÃO DAS RUBRICAS eSocial AO PLANO DE CONTAS
-- ============================================================================
-- Data: 2026-01-12
-- Descrição: Corrige as contas de débito para cada rubrica da folha de pagamento
-- ============================================================================

-- PROVENTOS (Débito = Despesa, Crédito = Salários a Pagar)

-- 1000 - Salário Base -> 4.1.1.01.01 Salário Base - CLT
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1000';

-- 1001 - Salário Hora -> 4.1.1.01.01 Salário Base - CLT
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1001';

-- 1002 - Salário Tarefa/Produção -> 4.1.1.01.01 Salário Base - CLT
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1002';

-- 1003 - Comissão -> 4.1.1.01.07 Comissões
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.07'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1003';

-- 1010 - Adicional de Insalubridade -> 4.1.1.01.05 Adicional Insalubridade
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.05'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1010';

-- 1011 - Adicional de Periculosidade -> 4.1.1.01.06 Adicional Periculosidade
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.06'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1011';

-- 1012 - Adicional Noturno -> 4.1.1.01.04 Adicional Noturno
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.04'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1012';

-- 1020 - Hora Extra 50% -> 4.1.1.01.02 Horas Extras
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.02'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1020';

-- 1021 - Hora Extra 100% -> 4.1.1.01.02 Horas Extras
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.02'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1021';

-- 1030 - DSR -> 4.1.1.01.03 DSR - Descanso Semanal
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.03'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1030';

-- 1040 - Gratificação de Função -> 4.1.1.01.08 Gratificações
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.08'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1040';

-- 1041 - Gratificação Natalina (13º) -> 4.1.1.01.08 Gratificações (ou criar conta específica)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.08'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.05') -- 13º a Pagar
WHERE codigo = '1041';

-- 1050 - Férias Gozadas -> 4.1.1.07 Férias
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.07'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.04') -- Férias a Pagar
WHERE codigo = '1050';

-- 1051 - 1/3 Constitucional de Férias -> 4.1.1.07 Férias
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.07'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.04')
WHERE codigo = '1051';

-- 1060 - Abono Pecuniário de Férias -> 4.1.1.07 Férias
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.07'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.04')
WHERE codigo = '1060';

-- 1080 - Vale Transporte (parte empresa) -> 4.1.1.09 Vale Transporte
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.09'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1080';

-- 1090 - Vale Alimentação/Refeição -> 4.1.1.10 Vale Refeição/Alimentação
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.10'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '1090';

-- ============================================================================
-- DESCONTOS (Débito = Reduz Salários a Pagar, Crédito = Obrigação a Recolher)
-- ============================================================================

-- 2000 - INSS
-- D: 2.1.2.01 Salários a Pagar (reduz o que devo ao funcionário)
-- C: 2.1.2.03 INSS a Recolher (aumento obrigação com a Previdência)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.03')
WHERE codigo = '2000';

-- 2001 - IRRF
-- D: 2.1.2.01 Salários a Pagar
-- C: 2.1.3.02 IRRF a Recolher
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.3.02')
WHERE codigo = '2001';

-- 2010 - Desc. Vale Transporte (6%)
-- D: 2.1.2.01 Salários a Pagar
-- C: 4.1.1.09 Vale Transporte (reduz a despesa, pois funcionário paga parte)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.09')
WHERE codigo = '2010';

-- 2011 - Desc. Vale Alimentação
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.10')
WHERE codigo = '2011';

-- 2040 - Adiantamento Salarial
-- D: 2.1.2.01 Salários a Pagar (reduz o que devo)
-- C: 1.1.4.01 Adiantamento a Funcionários (baixa do adiantamento)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '1.1.4.01')
WHERE codigo = '2040';

-- 2050 - Empréstimo Consignado
-- D: 2.1.2.01 Salários a Pagar
-- C: 2.1.2.12 Consignado a Pagar
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.12')
WHERE codigo = '2050';

-- 2060 - Pensão Alimentícia
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.06')
WHERE codigo = '2060';

-- 2070 - Plano de Saúde
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.11') -- reduz despesa
WHERE codigo = '2070';

-- ============================================================================
-- RESCISÃO
-- ============================================================================

-- 3000 - Saldo de Salário -> 4.1.1.05 Rescisões Trabalhistas
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.05'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '3000';

-- 3001 - Aviso Prévio Indenizado -> 4.1.1.05 Rescisões Trabalhistas
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.05'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '3001';

-- 3010, 3011, 3012 - Férias Rescisórias -> 4.1.1.07 Férias
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.07'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo IN ('3010', '3011', '3012');

-- 3020 - 13º Proporcional -> 4.1.1.01.08 Gratificações
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.08'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '3020';

-- 3030 - Multa 40% FGTS -> 4.1.1.05 Rescisões Trabalhistas
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.05'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '3030';

-- 3031 - Multa 20% FGTS (Acordo) -> 4.1.1.05 Rescisões Trabalhistas
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.05'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.2.01')
WHERE codigo = '3031';

-- ============================================================================
-- PAGAMENTOS "POR FORA" (9XXX) -> Adiantamento a Sócios
-- Estes pagamentos NÃO são despesa da empresa, são retirada dos sócios
-- ============================================================================

-- 9000 a 9010 - Pagamentos por fora
-- D: 1.1.3.04.99 Adiantamento Família (genérico)
-- C: 1.1.1.05 Banco Sicredi
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04.99'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05')
WHERE codigo LIKE '90%' AND codigo NOT LIKE '92%';

-- 9201, 9203 - Descontos fictícios (não geram lançamento)
UPDATE esocial_rubricas SET
  account_debit_id = NULL,
  account_credit_id = NULL
WHERE codigo IN ('9201', '9203');

-- ============================================================================
-- CRIAR CONTAS QUE FALTAM
-- ============================================================================

-- Criar conta 2.1.2.04 Férias a Pagar se não existir
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
SELECT '2.1.2.04', 'Férias a Pagar', 'PASSIVO', 'CREDORA', 4, true, true,
  (SELECT id FROM chart_of_accounts WHERE code = '2.1.2')
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.04');

-- Criar conta 2.1.2.05 13º Salário a Pagar se não existir
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
SELECT '2.1.2.05', '13º Salário a Pagar', 'PASSIVO', 'CREDORA', 4, true, true,
  (SELECT id FROM chart_of_accounts WHERE code = '2.1.2')
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.05');

-- Criar conta 2.1.2.06 Pensão Alimentícia a Pagar se não existir
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
SELECT '2.1.2.06', 'Pensão Alimentícia a Pagar', 'PASSIVO', 'CREDORA', 4, true, true,
  (SELECT id FROM chart_of_accounts WHERE code = '2.1.2')
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.06');

-- Criar conta 2.1.2.12 Consignado a Pagar se não existir
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
SELECT '2.1.2.12', 'Empréstimo Consignado a Pagar', 'PASSIVO', 'CREDORA', 4, true, true,
  (SELECT id FROM chart_of_accounts WHERE code = '2.1.2')
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.2.12');

-- Criar conta 1.1.4.01 Adiantamento a Funcionários se não existir
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
SELECT '1.1.4.01', 'Adiantamento a Funcionários', 'ATIVO', 'DEVEDORA', 4, true, true,
  (SELECT id FROM chart_of_accounts WHERE code = '1.1.4')
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.4.01');

-- Criar grupo 1.1.4 Outros Ativos Circulantes se não existir
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_synthetic, is_active, parent_id)
SELECT '1.1.4', 'Outros Créditos', 'ATIVO', 'DEVEDORA', 3, true, true,
  (SELECT id FROM chart_of_accounts WHERE code = '1.1')
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.4');

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== RUBRICAS ATUALIZADAS ===';
  RAISE NOTICE '';

  FOR v_rec IN
    SELECT
      r.codigo,
      r.descricao,
      d.code as conta_debito,
      d.name as nome_debito,
      c.code as conta_credito,
      c.name as nome_credito
    FROM esocial_rubricas r
    LEFT JOIN chart_of_accounts d ON d.id = r.account_debit_id
    LEFT JOIN chart_of_accounts c ON c.id = r.account_credit_id
    WHERE r.account_debit_id IS NOT NULL
    ORDER BY r.codigo
    LIMIT 20
  LOOP
    RAISE NOTICE '% - %', v_rec.codigo, v_rec.descricao;
    RAISE NOTICE '   D: % - %', v_rec.conta_debito, v_rec.nome_debito;
    RAISE NOTICE '   C: % - %', v_rec.conta_credito, v_rec.nome_credito;
    RAISE NOTICE '';
  END LOOP;
END $$;
