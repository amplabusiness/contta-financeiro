-- Migration: Remover lançamentos duplicados de AMPLA CONTABILIDADE
-- Problema: Existem lançamentos de "Provisionamento Despesa: AMPLA CONTABILIDADE" que duplicam
--           os lançamentos de "Adiantamento: AMPLA CONTABILIDADE"
-- Os valores R$ 70.000 e R$ 73.827,26 estão sendo contabilizados 2x

-- Remover as linhas dos lançamentos duplicados
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT id FROM accounting_entries
  WHERE description = 'Provisionamento Despesa: AMPLA CONTABILIDADE'
);

-- Remover os lançamentos duplicados
DELETE FROM accounting_entries
WHERE description = 'Provisionamento Despesa: AMPLA CONTABILIDADE';

-- Também remover os pagamentos duplicados (que usam Caixa Geral ao invés de Banco)
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT id FROM accounting_entries
  WHERE description = 'Pagamento: Pagamento: AMPLA CONTABILIDADE'
);

DELETE FROM accounting_entries
WHERE description = 'Pagamento: Pagamento: AMPLA CONTABILIDADE';

-- Verificar resultado
SELECT
  ae.description,
  ael.debit,
  ael.credit,
  coa.code,
  coa.name
FROM accounting_entries ae
JOIN accounting_entry_lines ael ON ae.id = ael.entry_id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE ae.description ILIKE '%AMPLA CONTABILIDADE%';
