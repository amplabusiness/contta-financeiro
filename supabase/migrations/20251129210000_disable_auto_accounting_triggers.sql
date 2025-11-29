-- Migration: Disable automatic accounting triggers
-- Date: 2025-11-29
-- Purpose: Disable triggers that create accounting entries automatically
--          to prevent conflicts with the smart-accounting Edge Function
--          which handles retroactive entry creation

-- Disable invoice provision trigger
DROP TRIGGER IF EXISTS trg_invoice_provision ON invoices;

-- Disable invoice payment trigger
DROP TRIGGER IF EXISTS trg_invoice_payment ON invoices;

-- Disable expense provision trigger
DROP TRIGGER IF EXISTS trg_expense_provision ON expenses;

-- Disable expense payment trigger
DROP TRIGGER IF EXISTS trg_expense_payment ON expenses;

-- Note: The functions still exist and can be called manually if needed:
-- create_invoice_provision_entry()
-- create_invoice_payment_entry()
-- create_expense_provision_entry()
-- create_expense_payment_entry()

-- Also, clean up any orphan entries (entries without lines)
DELETE FROM accounting_entries
WHERE id NOT IN (
  SELECT DISTINCT entry_id FROM accounting_entry_lines
);
