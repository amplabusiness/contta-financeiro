-- Migration: Create accounting entries for January 2025 transactions
-- Based on bank statement audit (source of truth)
--
-- This creates entries for all 183 bank transactions:
-- - 31 credit entries (receipts): R$ 298,527.29
-- - 152 debit entries (outflows): R$ 370,698.81
--   - 24 partner advances: R$ 217,535.10 (ATIVO)
--   - 128 expenses: R$ 153,163.71 (DRE)

BEGIN;

-- ============================================
-- PART 1: Create entries for CREDIT transactions (receipts)
-- All go to: D - Sicredi, C - Clientes a Receber
-- ============================================

-- We'll use the bank_transactions table directly
-- For each credit (amount > 0), create an entry

INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced,
    reference_type
)
SELECT
    bt.transaction_date,
    bt.transaction_date,
    CONCAT('Recebimento: ', LEFT(bt.description, 80)),
    'recebimento',
    bt.amount,
    bt.amount,
    true,
    'bank_transaction'
FROM bank_transactions bt
WHERE bt.transaction_date >= '2025-01-01'
  AND bt.transaction_date <= '2025-01-31'
  AND bt.amount > 0;

-- Create debit lines (D - Sicredi)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'D - Sicredi',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'recebimento'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_entry_lines ael
    WHERE ael.entry_id = ae.id
  );

-- Create credit lines (C - Clientes a Receber)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01' OR name = 'Clientes a Receber' LIMIT 1),
    'C - Clientes a Receber',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'recebimento'
  AND EXISTS (
    SELECT 1 FROM accounting_entry_lines ael
    WHERE ael.entry_id = ae.id
    HAVING COUNT(*) = 1
  );

-- ============================================
-- PART 2: Create entries for DEBIT transactions
-- Need to classify by category
-- ============================================

-- 2.1: Partner advances (Sergio Carneiro)
INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced
)
SELECT
    bt.transaction_date,
    bt.transaction_date,
    CONCAT('Adiantamento Socio: ', LEFT(bt.description, 60)),
    'adiantamento_socio',
    ABS(bt.amount),
    ABS(bt.amount),
    true
FROM bank_transactions bt
WHERE bt.transaction_date >= '2025-01-01'
  AND bt.transaction_date <= '2025-01-31'
  AND bt.amount < 0
  AND UPPER(bt.description) LIKE '%SERGIO CARNEIRO%';

-- Lines for Sergio Carneiro advances
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04.01'),
    'D - Adiant. Sergio Carneiro',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND ae.description LIKE '%SERGIO CARNEIRO%'
  AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id);

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'C - Sicredi',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND ae.description LIKE '%SERGIO CARNEIRO%'
  AND EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id HAVING COUNT(*) = 1);

-- 2.2: Partner advances (Nayara)
INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced
)
SELECT
    bt.transaction_date,
    bt.transaction_date,
    CONCAT('Adiantamento Socio: ', LEFT(bt.description, 60)),
    'adiantamento_socio',
    ABS(bt.amount),
    ABS(bt.amount),
    true
FROM bank_transactions bt
WHERE bt.transaction_date >= '2025-01-01'
  AND bt.transaction_date <= '2025-01-31'
  AND bt.amount < 0
  AND UPPER(bt.description) LIKE '%NAYARA%';

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04.04'),
    'D - Adiant. Nayara',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND ae.description LIKE '%NAYARA%'
  AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id);

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'C - Sicredi',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND ae.description LIKE '%NAYARA%'
  AND EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id HAVING COUNT(*) = 1);

-- 2.3: Partner advances (Victor Hugo)
INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced
)
SELECT
    bt.transaction_date,
    bt.transaction_date,
    CONCAT('Adiantamento Socio: ', LEFT(bt.description, 60)),
    'adiantamento_socio',
    ABS(bt.amount),
    ABS(bt.amount),
    true
FROM bank_transactions bt
WHERE bt.transaction_date >= '2025-01-01'
  AND bt.transaction_date <= '2025-01-31'
  AND bt.amount < 0
  AND UPPER(bt.description) LIKE '%VICTOR HUGO%';

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04.03'),
    'D - Adiant. Victor Hugo',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND ae.description LIKE '%VICTOR HUGO%'
  AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id);

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'C - Sicredi',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND ae.description LIKE '%VICTOR HUGO%'
  AND EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id HAVING COUNT(*) = 1);

-- 2.4: Partner advances (Sergio Augusto)
INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced
)
SELECT
    bt.transaction_date,
    bt.transaction_date,
    CONCAT('Adiantamento Socio: ', LEFT(bt.description, 60)),
    'adiantamento_socio',
    ABS(bt.amount),
    ABS(bt.amount),
    true
FROM bank_transactions bt
WHERE bt.transaction_date >= '2025-01-01'
  AND bt.transaction_date <= '2025-01-31'
  AND bt.amount < 0
  AND UPPER(bt.description) LIKE '%SERGIO AUGUSTO%';

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04.05'),
    'D - Adiant. Sergio Augusto',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND ae.description LIKE '%SERGIO AUGUSTO%'
  AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id);

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'C - Sicredi',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND ae.description LIKE '%SERGIO AUGUSTO%'
  AND EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id HAVING COUNT(*) = 1);

-- 2.5: Partner advances (via AMPLA)
INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced
)
SELECT
    bt.transaction_date,
    bt.transaction_date,
    CONCAT('Adiantamento Socio: ', LEFT(bt.description, 60)),
    'adiantamento_socio',
    ABS(bt.amount),
    ABS(bt.amount),
    true
FROM bank_transactions bt
WHERE bt.transaction_date >= '2025-01-01'
  AND bt.transaction_date <= '2025-01-31'
  AND bt.amount < 0
  AND (UPPER(bt.description) LIKE '%AMPLA CONTABILIDADE%' OR UPPER(bt.description) LIKE '%AMPLA SAUDE%');

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04.02'),
    'D - Adiant. Socios via Empresa',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND (ae.description LIKE '%AMPLA CONTABILIDADE%' OR ae.description LIKE '%AMPLA SAUDE%')
  AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id);

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'C - Sicredi',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'adiantamento_socio'
  AND (ae.description LIKE '%AMPLA CONTABILIDADE%' OR ae.description LIKE '%AMPLA SAUDE%')
  AND EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id HAVING COUNT(*) = 1);

-- ============================================
-- PART 3: Create entries for remaining EXPENSES
-- All other debit transactions go to Outras Despesas
-- ============================================

INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    entry_type,
    total_debit,
    total_credit,
    balanced
)
SELECT
    bt.transaction_date,
    bt.transaction_date,
    CONCAT('Despesa: ', LEFT(bt.description, 70)),
    'pagamento_despesa',
    ABS(bt.amount),
    ABS(bt.amount),
    true
FROM bank_transactions bt
WHERE bt.transaction_date >= '2025-01-01'
  AND bt.transaction_date <= '2025-01-31'
  AND bt.amount < 0
  AND UPPER(bt.description) NOT LIKE '%SERGIO CARNEIRO%'
  AND UPPER(bt.description) NOT LIKE '%NAYARA%'
  AND UPPER(bt.description) NOT LIKE '%VICTOR HUGO%'
  AND UPPER(bt.description) NOT LIKE '%SERGIO AUGUSTO%'
  AND UPPER(bt.description) NOT LIKE '%AMPLA CONTABILIDADE%'
  AND UPPER(bt.description) NOT LIKE '%AMPLA SAUDE%';

-- Debit lines for expenses (to expense account)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1.08'),
    'D - Outras Despesas',
    ae.total_debit,
    0
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'pagamento_despesa'
  AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id);

-- Credit lines for expenses (from bank)
INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    ae.id,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'C - Sicredi',
    0,
    ae.total_credit
FROM accounting_entries ae
WHERE ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31'
  AND ae.entry_type = 'pagamento_despesa'
  AND EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id HAVING COUNT(*) = 1);

COMMIT;
