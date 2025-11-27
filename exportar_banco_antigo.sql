-- ==========================================
-- SCRIPT PARA EXPORTAR DADOS DO BANCO ANTIGO
-- ==========================================

-- Execute este SQL no banco ANTIGO (nrodnjassdrvqtgfdodf)
-- Acesse: https://supabase.com/dashboard/project/nrodnjassdrvqtgfdodf/sql/new

-- 1. EXPORTAR CLIENTES
SELECT 
  id,
  name,
  cnpj,
  email,
  phone,
  monthly_fee,
  fee_due_day,
  is_active,
  opening_balance,
  opening_balance_details,
  opening_balance_date,
  created_at,
  updated_at
FROM clients
ORDER BY created_at;

-- 2. EXPORTAR CONTAS BANCÁRIAS
SELECT 
  id,
  bank_code,
  bank_name,
  agency,
  account_number,
  account_digit,
  account_type,
  is_active,
  balance,
  notes,
  created_at,
  updated_at
FROM bank_accounts
ORDER BY created_at;

-- 3. EXPORTAR FATURAS/HONORÁRIOS
SELECT 
  id,
  client_id,
  competence,
  amount,
  due_date,
  status,
  paid_date,
  paid_amount,
  boleto_digitable_line,
  external_charge_id,
  notes,
  created_at,
  updated_at
FROM invoices
ORDER BY created_at;

-- 4. EXPORTAR TRANSAÇÕES BANCÁRIAS
SELECT 
  id,
  bank_account_id,
  transaction_date,
  description,
  amount,
  type,
  balance_after,
  document_number,
  reconciled,
  invoice_id,
  created_at
FROM bank_transactions
ORDER BY transaction_date;

-- 5. EXPORTAR SALDO DE ABERTURA (se existir)
SELECT 
  id,
  client_id,
  competence,
  amount,
  due_date,
  original_invoice_id,
  description,
  status,
  paid_amount,
  paid_date,
  notes,
  created_at,
  updated_at,
  created_by
FROM client_opening_balance
ORDER BY created_at;
