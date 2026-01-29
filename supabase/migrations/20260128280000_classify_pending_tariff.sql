-- Migração para classificar a tarifa pendente de Janeiro 2025
-- Data: 28/01/2026

SET session_replication_role = 'replica';

WITH new_entry AS (
  INSERT INTO accounting_entries (
    tenant_id, entry_date, competence_date, description, entry_type, 
    is_draft, transaction_id, total_debit, total_credit, balanced
  ) VALUES (
    'a53a4957-fe97-4856-b3ca-70045157b421'::uuid,
    '2025-01-02',
    '2025-01-02',
    'Tarifa bancária - TARIFA COM R LIQUIDACAO-COB000005',
    'expense',
    false,
    '03577ef9-3bf6-486c-b2c6-deb50df971fe'::uuid,
    9.45,
    9.45,
    true
  ) RETURNING id
),
items AS (
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, tenant_id)
  SELECT 
    id as entry_id,
    '38edefd5-70ea-4728-8ba2-ff65779444fd'::uuid as account_id, -- 4.1.3.02.01 Manutenção Títulos
    9.45 as debit,
    0 as credit,
    'a53a4957-fe97-4856-b3ca-70045157b421'::uuid as tenant_id
  FROM new_entry
  UNION ALL
  SELECT 
    id as entry_id,
    '10d5892d-a843-4034-8d62-9fec95b8fd56'::uuid as account_id, -- 1.1.1.05 Banco Sicredi
    0 as debit,
    9.45 as credit,
    'a53a4957-fe97-4856-b3ca-70045157b421'::uuid as tenant_id
  FROM new_entry
),
upd AS (
  UPDATE bank_transactions 
  SET matched = true, journal_entry_id = (SELECT id FROM new_entry)
  WHERE id = '03577ef9-3bf6-486c-b2c6-deb50df971fe'::uuid
)
SELECT id FROM new_entry;

SET session_replication_role = 'origin';
