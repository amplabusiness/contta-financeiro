-- Limpeza de lançamentos contábeis de folha de pagamento indevidos
-- Problema: Funcionários admitidos após a competência tiveram folha lançada no DRE
-- Exemplo: Amanda e Jordana admitidas após Jan/2025 mas com lançamentos em Dez/2024
--
-- IMPORTANTE: Lançamentos de folha são PROVISÕES (expectativas)
-- Só devem virar despesa real quando o pagamento for feito via banco
-- Portanto, removemos TODOS os lançamentos de "Folha: X - Salário Base"

-- 1. Excluir linhas de lançamentos contábeis de folha (provisões)
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT id FROM accounting_entries
  WHERE description ILIKE 'folha:%'
  AND description ILIKE '%salário base%'
);

-- 2. Excluir os lançamentos contábeis de folha (provisões)
DELETE FROM accounting_entries
WHERE description ILIKE 'folha:%'
AND description ILIKE '%salário base%';

-- 3. Também remover outros tipos de provisões de folha
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT id FROM accounting_entries
  WHERE description ILIKE 'folha:%'
  AND (
    description ILIKE '%inss%'
    OR description ILIKE '%fgts%'
    OR description ILIKE '%irrf%'
    OR description ILIKE '%provisão%'
  )
  AND reference_type = 'payroll'
);

DELETE FROM accounting_entries
WHERE description ILIKE 'folha:%'
AND (
  description ILIKE '%inss%'
  OR description ILIKE '%fgts%'
  OR description ILIKE '%irrf%'
  OR description ILIKE '%provisão%'
)
AND reference_type = 'payroll';

-- 4. Comentário explicativo
COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis. Folha de pagamento: provisões não geram lançamento no DRE. Apenas pagamentos reais via banco devem aparecer aqui.';
