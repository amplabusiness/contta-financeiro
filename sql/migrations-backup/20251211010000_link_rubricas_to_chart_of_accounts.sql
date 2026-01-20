-- ============================================================================
-- VINCULAR RUBRICAS eSocial AO PLANO DE CONTAS
-- ============================================================================
-- Quando lançar um evento na folha, já gera lançamento contábil automaticamente
-- ============================================================================

-- 1. Adicionar coluna de conta contábil nas rubricas
ALTER TABLE esocial_rubricas ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id);
ALTER TABLE esocial_rubricas ADD COLUMN IF NOT EXISTS account_debit_id UUID REFERENCES chart_of_accounts(id);
ALTER TABLE esocial_rubricas ADD COLUMN IF NOT EXISTS account_credit_id UUID REFERENCES chart_of_accounts(id);

-- 2. Criar contas contábeis para folha de pagamento (se não existirem)

-- GRUPO 4.1.1 - DESPESAS COM PESSOAL (já existe, mas vamos garantir as sub-contas)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  -- Salários e Ordenados por tipo
  ('4.1.1.01.01', 'Salário Base - CLT', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')),
  ('4.1.1.01.02', 'Horas Extras', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')),
  ('4.1.1.01.03', 'DSR - Descanso Semanal', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')),
  ('4.1.1.01.04', 'Adicional Noturno', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')),
  ('4.1.1.01.05', 'Adicional Insalubridade', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')),
  ('4.1.1.01.06', 'Adicional Periculosidade', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')),
  ('4.1.1.01.07', 'Comissões', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')),
  ('4.1.1.01.08', 'Gratificações', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01')),

  -- Encargos Sociais detalhados
  ('4.1.1.02.01', 'INSS Patronal', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.02')),
  ('4.1.1.02.02', 'FGTS', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.02')),
  ('4.1.1.02.03', 'RAT/SAT', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.02')),
  ('4.1.1.02.04', 'Terceiros (Sistema S)', 'DESPESA', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.02')),

  -- Férias e 13º
  ('4.1.1.07', 'Férias', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
  ('4.1.1.08', '13º Salário', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),

  -- Benefícios
  ('4.1.1.09', 'Vale Transporte', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
  ('4.1.1.10', 'Vale Refeição/Alimentação', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
  ('4.1.1.11', 'Plano de Saúde (empresa)', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
  ('4.1.1.12', 'Seguro de Vida', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'))
ON CONFLICT (code) DO NOTHING;

-- CONTAS DE PASSIVO (obrigações a pagar)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
VALUES
  -- Criar grupo se não existir
  ('2.1', 'Passivo Circulante', 'PASSIVO', 'CREDORA', 2, false, true),
  ('2.1.1', 'Obrigações Trabalhistas', 'PASSIVO', 'CREDORA', 3, false, true),
  ('2.1.1.01', 'Salários a Pagar', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.02', 'INSS a Recolher', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.03', 'FGTS a Recolher', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.04', 'IRRF a Recolher', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.05', 'Contribuição Sindical a Recolher', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.06', 'Pensão Alimentícia a Pagar', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.07', 'Provisão de Férias', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.08', 'Provisão de 13º Salário', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.09', 'Vale Transporte a Pagar', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.10', 'Vale Refeição a Pagar', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.11', 'Plano de Saúde a Pagar', 'PASSIVO', 'CREDORA', 4, true, true),
  ('2.1.1.12', 'Empréstimo Consignado a Pagar', 'PASSIVO', 'CREDORA', 4, true, true)
ON CONFLICT (code) DO NOTHING;

-- Atualizar parent_id das contas de passivo
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1')
WHERE code = '2.1.1' AND parent_id IS NULL;

UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1')
WHERE code LIKE '2.1.1.%' AND LENGTH(code) = 8 AND parent_id IS NULL;

-- 3. VINCULAR RUBRICAS ÀS CONTAS CONTÁBEIS

-- PROVENTOS (Débito = Despesa, Crédito = Salários a Pagar)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01')
WHERE codigo = '1000'; -- Salário Base

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.02'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01')
WHERE codigo IN ('1020', '1021'); -- Horas Extras

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.03'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01')
WHERE codigo = '1030'; -- DSR

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.04'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01')
WHERE codigo = '1012'; -- Adicional Noturno

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.05'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01')
WHERE codigo = '1010'; -- Insalubridade

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.06'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01')
WHERE codigo = '1011'; -- Periculosidade

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.07'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01')
WHERE codigo = '1003'; -- Comissão

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.01.08'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01')
WHERE codigo IN ('1040', '1041'); -- Gratificações

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.07'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.07')
WHERE codigo IN ('1050', '1051', '1060'); -- Férias

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.09'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.09')
WHERE codigo = '1080'; -- Vale Transporte

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.10'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.10')
WHERE codigo = '1090'; -- Vale Alimentação

-- DESCONTOS (Débito = Passivo reduz Salários a Pagar, Crédito = Obrigação)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.02')
WHERE codigo = '2000'; -- INSS

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.04')
WHERE codigo = '2001'; -- IRRF

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.09')
WHERE codigo = '2010'; -- Desc. Vale Transporte

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.10')
WHERE codigo = '2011'; -- Desc. Vale Alimentação

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.05')
WHERE codigo IN ('2020', '2021'); -- Contribuição Sindical

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.11')
WHERE codigo = '2070'; -- Plano de Saúde

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.06')
WHERE codigo = '2060'; -- Pensão Alimentícia

UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.01'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '2.1.1.12')
WHERE codigo = '2050'; -- Empréstimo Consignado

-- PAGAMENTOS POR FORA -> Adiantamento a Sócios (não é despesa de pessoal)
UPDATE esocial_rubricas SET
  account_debit_id = (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04'),
  account_credit_id = (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.01')
WHERE codigo LIKE '90%'; -- Todos por fora

-- 4. CRIAR FUNÇÃO PARA GERAR LANÇAMENTO CONTÁBIL DA FOLHA

CREATE OR REPLACE FUNCTION gerar_lancamento_contabil_folha()
RETURNS TRIGGER AS $$
DECLARE
  v_rubrica RECORD;
  v_entry_id UUID;
  v_payroll RECORD;
  v_employee RECORD;
BEGIN
  -- Buscar dados da rubrica
  SELECT * INTO v_rubrica FROM esocial_rubricas WHERE codigo = NEW.rubrica_codigo;

  -- Se rubrica não tem vinculação contábil, ignorar
  IF v_rubrica.account_debit_id IS NULL OR v_rubrica.account_credit_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar dados da folha e funcionário
  SELECT * INTO v_payroll FROM payroll WHERE id = NEW.payroll_id;
  SELECT * INTO v_employee FROM employees WHERE id = v_payroll.employee_id;

  -- Criar lançamento contábil
  INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    reference_type,
    reference_id,
    status
  ) VALUES (
    CURRENT_DATE,
    v_payroll.competencia,
    'Folha: ' || v_employee.name || ' - ' || NEW.descricao,
    'payroll',
    NEW.id,
    'approved'
  ) RETURNING id INTO v_entry_id;

  -- Criar linhas do lançamento (débito e crédito)
  INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
  VALUES
    (v_entry_id, v_rubrica.account_debit_id, NEW.valor, 0, NEW.descricao),
    (v_entry_id, v_rubrica.account_credit_id, 0, NEW.valor, NEW.descricao);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. CRIAR TRIGGER PARA GERAR LANÇAMENTOS AUTOMÁTICOS
DROP TRIGGER IF EXISTS tr_payroll_event_accounting ON payroll_events;
CREATE TRIGGER tr_payroll_event_accounting
  AFTER INSERT ON payroll_events
  FOR EACH ROW
  EXECUTE FUNCTION gerar_lancamento_contabil_folha();

-- 6. MOSTRAR VINCULAÇÃO ATUAL
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== RUBRICAS VINCULADAS AO PLANO DE CONTAS ===';
  RAISE NOTICE '';

  FOR v_rec IN
    SELECT
      r.codigo,
      r.descricao,
      r.natureza,
      d.code as conta_debito,
      d.name as nome_debito,
      c.code as conta_credito,
      c.name as nome_credito
    FROM esocial_rubricas r
    LEFT JOIN chart_of_accounts d ON d.id = r.account_debit_id
    LEFT JOIN chart_of_accounts c ON c.id = r.account_credit_id
    WHERE r.account_debit_id IS NOT NULL
    ORDER BY r.codigo
  LOOP
    RAISE NOTICE '% - %', v_rec.codigo, v_rec.descricao;
    RAISE NOTICE '   D: % - %', v_rec.conta_debito, v_rec.nome_debito;
    RAISE NOTICE '   C: % - %', v_rec.conta_credito, v_rec.nome_credito;
    RAISE NOTICE '';
  END LOOP;
END $$;
