-- Migration: Make accounting entries the single source of truth
-- All screens should consume from accounting views, not auxiliary tables
-- Flow: Bank Statement / Invoices -> Accounting Entries -> Chart of Accounts -> All Screens

BEGIN;

-- ============================================
-- VIEW: Balancete (Trial Balance) - THE SOURCE OF TRUTH
-- All other views consume from this
-- ============================================

CREATE OR REPLACE VIEW v_balancete AS
WITH account_balances AS (
    SELECT
        coa.id as account_id,
        coa.code as account_code,
        coa.name as account_name,
        coa.account_type,
        coa.nature,
        coa.is_analytical,
        coa.parent_id,
        EXTRACT(YEAR FROM ae.entry_date) as year,
        EXTRACT(MONTH FROM ae.entry_date) as month,
        COALESCE(SUM(ael.debit), 0) as total_debit,
        COALESCE(SUM(ael.credit), 0) as total_credit
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    LEFT JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.nature,
             coa.is_analytical, coa.parent_id,
             EXTRACT(YEAR FROM ae.entry_date), EXTRACT(MONTH FROM ae.entry_date)
)
SELECT
    account_id,
    account_code,
    account_name,
    account_type,
    nature,
    is_analytical,
    parent_id,
    year,
    month,
    total_debit,
    total_credit,
    -- Balance calculation based on nature
    CASE
        WHEN nature = 'DEVEDORA' THEN total_debit - total_credit
        WHEN nature = 'CREDORA' THEN total_credit - total_debit
        ELSE total_debit - total_credit
    END as balance
FROM account_balances
WHERE total_debit > 0 OR total_credit > 0;

-- ============================================
-- VIEW: Bank Balance (from Balancete)
-- ============================================

CREATE OR REPLACE VIEW v_saldo_banco AS
SELECT
    account_code,
    account_name,
    year,
    month,
    total_debit,
    total_credit,
    balance as saldo
FROM v_balancete
WHERE account_code = '1.1.1.05';

-- ============================================
-- VIEW: Accounts Receivable (from Balancete)
-- ============================================

CREATE OR REPLACE VIEW v_contas_a_receber AS
SELECT
    account_code,
    account_name,
    year,
    month,
    total_debit,
    total_credit,
    balance as saldo
FROM v_balancete
WHERE account_code = '1.1.2.01';

-- ============================================
-- VIEW: Partner Advances (from Balancete)
-- ============================================

CREATE OR REPLACE VIEW v_adiantamentos_socios AS
SELECT
    account_code,
    account_name,
    year,
    month,
    total_debit,
    total_credit,
    balance as saldo
FROM v_balancete
WHERE account_code LIKE '1.1.3.04%'
  AND is_analytical = true;

-- ============================================
-- VIEW: Revenue (from Balancete)
-- ============================================

CREATE OR REPLACE VIEW v_receitas AS
SELECT
    account_code,
    account_name,
    year,
    month,
    total_debit,
    total_credit,
    balance as saldo
FROM v_balancete
WHERE account_code LIKE '3%'
  AND is_analytical = true;

-- ============================================
-- VIEW: Expenses (from Balancete)
-- ============================================

CREATE OR REPLACE VIEW v_despesas AS
SELECT
    account_code,
    account_name,
    year,
    month,
    total_debit,
    total_credit,
    balance as saldo
FROM v_balancete
WHERE account_code LIKE '4%'
  AND is_analytical = true;

-- ============================================
-- VIEW: Cash Flow Summary (from Balancete)
-- ============================================

DROP VIEW IF EXISTS v_cash_flow_summary;
CREATE OR REPLACE VIEW v_cash_flow_summary AS
SELECT
    -- Bank balance from Balancete
    (SELECT COALESCE(SUM(balance), 0)
     FROM v_balancete
     WHERE account_code = '1.1.1.05') as bank_balance,

    -- Accounts receivable from Balancete
    (SELECT COALESCE(SUM(balance), 0)
     FROM v_balancete
     WHERE account_code = '1.1.2.01') as accounts_receivable,

    -- Partner advances from Balancete
    (SELECT COALESCE(SUM(balance), 0)
     FROM v_balancete
     WHERE account_code LIKE '1.1.3.04%'
       AND is_analytical = true) as partner_advances,

    -- Total revenue from Balancete
    (SELECT COALESCE(SUM(balance), 0)
     FROM v_balancete
     WHERE account_code LIKE '3%'
       AND is_analytical = true) as total_revenue,

    -- Total expenses from Balancete
    (SELECT COALESCE(SUM(balance), 0)
     FROM v_balancete
     WHERE account_code LIKE '4%'
       AND is_analytical = true) as total_expenses;

-- ============================================
-- VIEW: DRE Summary (from Balancete)
-- ============================================

CREATE OR REPLACE VIEW v_dre_summary AS
SELECT
    year,
    month,
    SUM(CASE WHEN account_code LIKE '3%' THEN balance ELSE 0 END) as receitas,
    SUM(CASE WHEN account_code LIKE '4%' THEN balance ELSE 0 END) as despesas,
    SUM(CASE WHEN account_code LIKE '3%' THEN balance ELSE 0 END) -
    SUM(CASE WHEN account_code LIKE '4%' THEN balance ELSE 0 END) as resultado
FROM v_balancete
WHERE is_analytical = true
GROUP BY year, month
ORDER BY year, month;

-- ============================================
-- VIEW: Balance Sheet Summary (from Balancete)
-- ============================================

CREATE OR REPLACE VIEW v_balanco_patrimonial AS
SELECT
    year,
    month,
    SUM(CASE WHEN account_code LIKE '1%' THEN balance ELSE 0 END) as ativo,
    SUM(CASE WHEN account_code LIKE '2%' THEN balance ELSE 0 END) as passivo,
    SUM(CASE WHEN account_code LIKE '5%' THEN balance ELSE 0 END) as patrimonio_liquido
FROM v_balancete
WHERE is_analytical = true
GROUP BY year, month
ORDER BY year, month;

-- ============================================
-- Comments
-- ============================================

COMMENT ON VIEW v_balancete IS 'Balancete - THE SOURCE OF TRUTH. All other views consume from this.';
COMMENT ON VIEW v_saldo_banco IS 'Bank balance from accounting entries (via Balancete)';
COMMENT ON VIEW v_contas_a_receber IS 'Accounts receivable from accounting entries (via Balancete)';
COMMENT ON VIEW v_adiantamentos_socios IS 'Partner advances from accounting entries (via Balancete)';
COMMENT ON VIEW v_receitas IS 'Revenue accounts from accounting entries (via Balancete)';
COMMENT ON VIEW v_despesas IS 'Expense accounts from accounting entries (via Balancete)';
COMMENT ON VIEW v_cash_flow_summary IS 'Cash flow summary consuming from Balancete';
COMMENT ON VIEW v_dre_summary IS 'DRE summary consuming from Balancete';
COMMENT ON VIEW v_balanco_patrimonial IS 'Balance sheet summary consuming from Balancete';

COMMIT;
