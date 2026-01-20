-- Limpeza de provisões de folha de pagamento que não deveriam estar no DRE
-- Lançamentos de "Folha de Pagamento - Dep. X" são provisões, não pagamentos reais
-- Apenas pagamentos reais via banco (com referência a PIX, TED, etc.) devem estar no DRE

-- 1. Excluir linhas de lançamentos contábeis de provisões de folha
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT id FROM accounting_entries
  WHERE description ILIKE 'folha de pagamento%'
  AND description NOT ILIKE '%PIX%'
  AND description NOT ILIKE '%TED%'
  AND description NOT ILIKE '%DOC%'
  AND description NOT ILIKE '%pagamento%banco%'
);

-- 2. Excluir os lançamentos contábeis de provisões de folha
DELETE FROM accounting_entries
WHERE description ILIKE 'folha de pagamento%'
AND description NOT ILIKE '%PIX%'
AND description NOT ILIKE '%TED%'
AND description NOT ILIKE '%DOC%'
AND description NOT ILIKE '%pagamento%banco%';

-- 3. Comentário explicativo
COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis. Provisões de folha de pagamento (Folha de Pagamento - Dep. X) NÃO devem aparecer aqui. Apenas pagamentos reais via banco.';
