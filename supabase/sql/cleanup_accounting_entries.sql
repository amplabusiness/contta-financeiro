-- PASSO 1: Desabilitar trigger problemático em accounting_entry_lines
DROP TRIGGER IF EXISTS check_balance_after_line_change ON accounting_entry_lines;

-- PASSO 2: Desabilitar triggers antigos em invoices/expenses
DROP TRIGGER IF EXISTS trg_invoice_provision ON invoices;
DROP TRIGGER IF EXISTS trg_invoice_payment ON invoices;
DROP TRIGGER IF EXISTS trg_expense_provision ON expenses;
DROP TRIGGER IF EXISTS trg_expense_payment ON expenses;

-- PASSO 3: Remover lançamentos órfãos (sem linhas associadas)
DELETE FROM accounting_entries
WHERE id NOT IN (
  SELECT DISTINCT entry_id
  FROM accounting_entry_lines
  WHERE entry_id IS NOT NULL
);

-- PASSO 4: Conferir contagem de entries e lines
SELECT
  (SELECT COUNT(*) FROM accounting_entries) AS entries,
  (SELECT COUNT(*) FROM accounting_entry_lines) AS lines;

-- PASSO 5: Confirmar que não restaram triggers problemáticos
SELECT tgname, tgrelid::regclass AS tabela
FROM pg_trigger
WHERE tgname IN (
  'check_balance_after_line_change',
  'trg_invoice_provision',
  'trg_invoice_payment',
  'trg_expense_provision',
  'trg_expense_payment'
);
