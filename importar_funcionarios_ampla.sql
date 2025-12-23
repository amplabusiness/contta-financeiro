-- Importar funcionários extraídos da folha de pagamento de janeiro de 2025

-- Limpar funcionários antigos (opcional - comentado por padrão)
-- DELETE FROM employees WHERE hire_date < '2022-01-01';

-- Inserir os 6 funcionários da Ampla
INSERT INTO employees (name, role, department, contract_type, official_salary, unofficial_salary, hire_date, work_area, is_active)
VALUES 
  ('DEUZA RESENDE DE JESUS', 'ANALISTA DE DEPARTAMENTO PESSOAL', 'Operacional', 'CLT', 3000.00, 0, '2024-12-03', '413105', true),
  ('FABIANA MARIA DA SILVA MENDONCA', 'BABA', 'Administrativo', 'CLT', 2300.00, 0, '2024-08-20', '516205', true),
  ('JOSIMAR DOS SANTOS MOTA', 'COORDENADOR CONTABIL', 'Operacional', 'CLT', 3762.00, 0, '2023-07-27', '252210', true),
  ('RAIMUNDO PEREIRA MOREIRA', 'CASEIRO', 'Administrativo', 'CLT', 2687.50, 0, '2024-02-22', '514325', true),
  ('SERGIO AUGUSTO DE OLIVEIRA LEAO', 'AUXILIAR ADMINISTRATIVO', 'Administrativo', 'CLT', 2950.00, 0, '2022-10-03', '411010', true),
  ('THAYNARA CONCEICAO DE MELO', 'ANALISTA CONTABIL', 'Operacional', 'CLT', 3727.75, 0, '2024-05-02', '252210', true)
ON CONFLICT (name) DO NOTHING;

-- Verificar dados inseridos
SELECT id, name, role, department, official_salary, hire_date, is_active 
FROM employees 
WHERE name IN ('DEUZA RESENDE DE JESUS', 'FABIANA MARIA DA SILVA MENDONCA', 'JOSIMAR DOS SANTOS MOTA', 'RAIMUNDO PEREIRA MOREIRA', 'SERGIO AUGUSTO DE OLIVEIRA LEAO', 'THAYNARA CONCEICAO DE MELO')
ORDER BY hire_date DESC;

-- Exibir resumo
SELECT 
  COUNT(*) as total_funcionarios,
  COUNT(CASE WHEN is_active THEN 1 END) as funcionarios_ativos,
  SUM(official_salary) as folha_total,
  AVG(official_salary) as salario_medio
FROM employees
WHERE is_active = true;
