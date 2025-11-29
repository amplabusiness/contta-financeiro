-- Remove triggers automáticos de contabilidade
-- Problema: Triggers criavam entries sem as linhas de débito/crédito
-- quando as contas contábeis referenciadas não existiam no plano de contas.
-- Solução: Remover triggers e usar Smart Accounting para criar lançamentos.

-- 1. Remover triggers de invoices
DROP TRIGGER IF EXISTS trg_invoice_provision ON invoices;
DROP TRIGGER IF EXISTS trg_invoice_payment ON invoices;

-- 2. Remover triggers de expenses
DROP TRIGGER IF EXISTS trg_expense_provision ON expenses;
DROP TRIGGER IF EXISTS trg_expense_payment ON expenses;

-- 3. Limpar entries órfãos (sem linhas de débito/crédito)
DELETE FROM accounting_entries
WHERE id NOT IN (SELECT DISTINCT entry_id FROM accounting_entry_lines);

-- 4. Opcional: Manter as funções para referência futura, mas comentar
-- As funções create_invoice_provision_entry, create_invoice_payment_entry,
-- create_expense_provision_entry, create_expense_payment_entry continuam
-- existindo mas não são mais chamadas automaticamente.

-- Nota: Para reprocessar os lançamentos contábeis, usar a funcionalidade
-- "Processar Tudo" na página Contabilidade Inteligente (/smart-accounting)
