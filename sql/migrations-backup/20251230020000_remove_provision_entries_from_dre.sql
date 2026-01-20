-- Remover lançamentos de provisionamento de despesas que não deveriam estar no DRE
-- Provisionamentos são expectativas, não despesas reais
-- Só devem virar lançamento contábil quando a compra for aprovada e realizada
--
-- Exemplo do problema:
-- "Provisionamento Despesa: Água Mineral - Jan/2025" (R$ 192,00) - FICTÍCIO, deve ser removido
-- "Provisionamento Despesa: PAGAMENTO PIX..." (R$ 96,00) - REAL, veio do extrato, deve ser mantido

-- 1. Excluir TODAS as linhas de "Provisionamento Despesa:" que NÃO contêm referência a pagamento bancário
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT id FROM accounting_entries
  WHERE description ILIKE 'provisionamento despesa:%'
  -- Manter apenas os que têm evidência de pagamento real
  AND description NOT ILIKE '%PIX%'
  AND description NOT ILIKE '%TED%'
  AND description NOT ILIKE '%DOC%'
  AND description NOT ILIKE '%PAGAMENTO PIX%'
  AND description NOT ILIKE '%PIX_DEB%'
);

-- 2. Excluir os lançamentos contábeis de provisionamento fictício
DELETE FROM accounting_entries
WHERE description ILIKE 'provisionamento despesa:%'
-- Manter apenas os que têm evidência de pagamento real
AND description NOT ILIKE '%PIX%'
AND description NOT ILIKE '%TED%'
AND description NOT ILIKE '%DOC%'
AND description NOT ILIKE '%PAGAMENTO PIX%'
AND description NOT ILIKE '%PIX_DEB%';

-- 3. Comentário explicativo
COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis. Provisionamentos de despesas NÃO devem gerar lançamentos aqui até serem aprovados/realizados. Apenas despesas com comprovação bancária devem existir.';
