-- Adicionar cost_center_id à tabela accounting_entries
-- Permite classificar lançamentos contábeis por departamento

-- 1. Adicionar coluna cost_center_id
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES cost_centers(id);

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_accounting_entries_cost_center
ON accounting_entries(cost_center_id);

-- 3. Comentário explicativo
COMMENT ON COLUMN accounting_entries.cost_center_id IS 'Centro de custo/departamento do lançamento (DP, Fiscal, Contabil, Legalizacao, Administrativo, Financeiro)';

-- 4. Criar view para relatório de custos por departamento
CREATE OR REPLACE VIEW vw_costs_by_department AS
SELECT
  cc.id AS cost_center_id,
  cc.code AS department_code,
  cc.name AS department_name,
  DATE_TRUNC('month', ae.entry_date) AS month,
  ae.entry_type,
  COUNT(*) AS total_entries,
  SUM(ae.total_debit) AS total_amount
FROM accounting_entries ae
LEFT JOIN cost_centers cc ON ae.cost_center_id = cc.id
WHERE ae.entry_type IN ('despesa', 'pagamento_despesa')
GROUP BY cc.id, cc.code, cc.name, DATE_TRUNC('month', ae.entry_date), ae.entry_type
ORDER BY month DESC, department_name;

COMMENT ON VIEW vw_costs_by_department IS 'Custos mensais agrupados por departamento';
