-- Migration: Cleanup and reorganize January 2025 data
-- Based on bank statement audit (source of truth)
--
-- SUMMARY JANUARY 2025:
-- Opening Balance: R$ 90,725.06
-- Receipts (Bank): R$ 298,527.29 (31 transactions)
-- Outflows (Bank): R$ 370,698.81 (152 transactions)
--   - Partner Advances (Asset): R$ 217,535.10 (24 tx)
--   - Expenses (DRE): R$ 153,163.71 (128 tx)
-- Closing Balance: R$ 18,553.54
--
-- DRE (Accrual for Revenue, Cash for Expenses):
-- - Revenue (Competence 01/2025): R$ 136,821.59
-- - Expenses (Cash): R$ 153,163.71
-- - Result: R$ -16,342.12

BEGIN;

-- ============================================
-- STEP 1: Create Sicredi account in chart of accounts
-- ============================================

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '1.1.1.05', 'Sicredi - Conta Movimento', 'ATIVO', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.1.05');

-- ============================================
-- STEP 2: Delete incorrect/duplicate accounting entries for January 2025
-- ============================================

DELETE FROM accounting_entry_lines
WHERE entry_id IN (
    SELECT id FROM accounting_entries
    WHERE entry_date >= '2025-01-01' AND entry_date <= '2025-01-31'
);

DELETE FROM accounting_entries
WHERE entry_date >= '2025-01-01' AND entry_date <= '2025-01-31';

-- ============================================
-- STEP 3: Clean up expenses table for January 2025
-- ============================================

DELETE FROM expenses
WHERE due_date >= '2025-01-01' AND due_date <= '2025-01-31';

-- ============================================
-- STEP 4: Create partner advance accounts
-- ============================================

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '1.1.3', 'Adiantamentos', 'ATIVO', 'DEVEDORA', 2, false, true,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1'),
    true, false
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.3');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '1.1.3.01', 'Adiantamentos a Socios', 'ATIVO', 'DEVEDORA', 3, false, true,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3'),
    true, false
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.3.01');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '1.1.3.01.01', 'Adiant. Sergio Carneiro Leao', 'ATIVO', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.01'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.3.01.01');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '1.1.3.01.02', 'Adiant. Nayara', 'ATIVO', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.01'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.3.01.02');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '1.1.3.01.03', 'Adiant. Victor Hugo', 'ATIVO', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.01'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.3.01.03');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '1.1.3.01.04', 'Adiant. Sergio Augusto', 'ATIVO', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.01'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.3.01.04');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '1.1.3.01.05', 'Adiant. Socios via Empresa', 'ATIVO', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.01'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.3.01.05');

-- ============================================
-- STEP 5: Create expense accounts (if not exist)
-- ============================================

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4', 'DESPESAS', 'DESPESA', 'DEVEDORA', 1, false, true, NULL, true, false
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1', 'Despesas Operacionais', 'DESPESA', 'DEVEDORA', 2, false, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4'),
    true, false
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1', 'Despesas Administrativas', 'DESPESA', 'DEVEDORA', 3, false, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1'),
    true, false
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1.01', 'Folha de Pagamento e Terceiros', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.01');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1.02', 'Servicos de Terceiros', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.02');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1.03', 'Aluguel e Locacoes', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.03');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1.04', 'Obras e Reformas', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.04');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1.05', 'Encargos Sociais (FGTS)', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.05');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1.06', 'Fornecedores Diversos', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.06');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1.07', 'Boletos Pagos', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.07');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.1.08', 'Outras Despesas', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.1.08');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.2', 'Impostos e Taxas', 'DESPESA', 'DEVEDORA', 3, false, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1'),
    true, false
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.2');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.2.01', 'Simples Nacional', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.2.01');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.2.02', 'IPVA/DETRAN/Taxas Veiculares', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.2.02');

INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_synthetic, parent_id, is_active, accepts_entries)
SELECT '4.1.2.03', 'Taxas Bancarias', 'DESPESA', 'DEVEDORA', 4, true, false,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2'),
    true, true
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.1.2.03');

-- ============================================
-- STEP 6: Create opening balance entry for bank account
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
VALUES (
    '2025-01-01',
    '2025-01-01',
    'Saldo de Abertura - Sicredi Janeiro/2025',
    'saldo_abertura',
    90725.06,
    90725.06,
    true
);

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    (SELECT id FROM accounting_entries WHERE description = 'Saldo de Abertura - Sicredi Janeiro/2025' LIMIT 1),
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.1.05'),
    'D - Saldo Inicial Sicredi',
    90725.06,
    0;

INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
SELECT
    (SELECT id FROM accounting_entries WHERE description = 'Saldo de Abertura - Sicredi Janeiro/2025' LIMIT 1),
    (SELECT id FROM chart_of_accounts WHERE code = '5.3.02.01'),
    'C - Saldo de Abertura - Disponibilidades',
    0,
    90725.06;

COMMIT;
