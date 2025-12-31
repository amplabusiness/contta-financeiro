-- Adicionar lançamento de FGTS faltante (R$ 2.188,34 de 15/01/2025)
-- Este lançamento existe em bank_transactions mas não foi criado em accounting_entries

INSERT INTO accounting_entries (
  entry_date,
  competence_date,
  description,
  entry_type,
  total_debit,
  total_credit,
  cost_center_id,
  reference_type,
  reference_id
)
SELECT
  '2025-01-15'::date,
  '2025-01-01'::date,
  'Pagamento: FGTS - CAIXA ECONOMICA FEDERAL',
  'pagamento_despesa',
  2188.34,
  2188.34,
  (SELECT id FROM cost_centers WHERE code = '1.17'),
  'bank_transaction',
  'ed748fe1-a63c-4cb9-943a-2393162908a0'
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_entries
  WHERE reference_id = 'ed748fe1-a63c-4cb9-943a-2393162908a0'
);

-- Atualizar o lançamento existente de CAIXA ECONOMICA para clareza
UPDATE accounting_entries
SET description = 'Pagamento: FGTS - CAIXA ECONOMICA FEDERAL'
WHERE description ILIKE '%caixa economica federal%';
