-- =====================================================
-- CORREÇÃO: Função gerar_lancamento_contabil_folha
-- A tabela accounting_entries não tem coluna "status"
-- Remover essa coluna do INSERT
-- =====================================================

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

  -- Criar lançamento contábil (CORREÇÃO: removido campo "status" que não existe)
  INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    reference_type,
    reference_id,
    entry_type,
    total_debit,
    total_credit
  ) VALUES (
    CURRENT_DATE,
    v_payroll.competencia,
    'Folha: ' || v_employee.name || ' - ' || NEW.descricao,
    'payroll',
    NEW.id,
    'payroll',
    NEW.valor,
    NEW.valor
  ) RETURNING id INTO v_entry_id;

  -- Criar linhas do lançamento (débito e crédito)
  INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
  VALUES
    (v_entry_id, v_rubrica.account_debit_id, NEW.valor, 0, NEW.descricao),
    (v_entry_id, v_rubrica.account_credit_id, 0, NEW.valor, NEW.descricao);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION gerar_lancamento_contabil_folha IS 'Gera lançamento contábil automático para eventos da folha de pagamento';
