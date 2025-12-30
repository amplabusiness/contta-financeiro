-- Limpeza de lançamentos de folha de pagamento para funcionários admitidos após a competência
-- Problema: Funcionários admitidos em datas futuras (ex: abril/2025) tiveram folha gerada em janeiro/2025

-- 1. Identificar e excluir registros de payroll para funcionários admitidos após a competência
-- Primeiro excluir eventos relacionados
DELETE FROM payroll_events
WHERE payroll_id IN (
  SELECT p.id
  FROM payroll p
  JOIN employees e ON p.employee_id = e.id
  WHERE e.hire_date IS NOT NULL
  AND e.hire_date > (p.competencia + INTERVAL '1 month' - INTERVAL '1 day')::date
);

-- Depois excluir as folhas inválidas
DELETE FROM payroll
WHERE id IN (
  SELECT p.id
  FROM payroll p
  JOIN employees e ON p.employee_id = e.id
  WHERE e.hire_date IS NOT NULL
  AND e.hire_date > (p.competencia + INTERVAL '1 month' - INTERVAL '1 day')::date
);

-- 2. Criar trigger para prevenir futuras inserções inválidas
CREATE OR REPLACE FUNCTION check_employee_hire_date_for_payroll()
RETURNS TRIGGER AS $$
DECLARE
  v_hire_date DATE;
  v_competencia_end DATE;
BEGIN
  -- Buscar data de admissão do funcionário
  SELECT hire_date INTO v_hire_date
  FROM employees
  WHERE id = NEW.employee_id;

  -- Calcular último dia da competência
  v_competencia_end := (NEW.competencia + INTERVAL '1 month' - INTERVAL '1 day')::date;

  -- Verificar se funcionário foi admitido até o final da competência
  IF v_hire_date IS NOT NULL AND v_hire_date > v_competencia_end THEN
    RAISE EXCEPTION 'Funcionário não pode ter folha gerada para competência anterior à data de admissão. Admissão: %, Competência: %',
      v_hire_date, NEW.competencia;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_check_hire_date_payroll ON payroll;

-- Criar trigger
CREATE TRIGGER trigger_check_hire_date_payroll
  BEFORE INSERT OR UPDATE ON payroll
  FOR EACH ROW
  EXECUTE FUNCTION check_employee_hire_date_for_payroll();

COMMENT ON FUNCTION check_employee_hire_date_for_payroll() IS 'Valida que funcionário não tenha folha gerada para competência anterior à sua data de admissão';
