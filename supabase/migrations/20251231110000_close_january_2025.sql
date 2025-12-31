-- Migration: Close January 2025 and add accounting_entries protection
-- This locks all January 2025 data from modifications

BEGIN;

-- ============================================
-- STEP 1: Add protection for accounting_entries
-- ============================================

-- Trigger to protect accounting_entries in closed periods
CREATE OR REPLACE FUNCTION protect_accounting_entry_in_closed_period()
RETURNS TRIGGER AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
    v_check_date DATE;
BEGIN
    -- Determine the date to check
    IF TG_OP = 'DELETE' THEN
        v_check_date := OLD.entry_date;
    ELSE
        v_check_date := NEW.entry_date;
    END IF;

    v_year := EXTRACT(YEAR FROM v_check_date);
    v_month := EXTRACT(MONTH FROM v_check_date);

    -- Check if period is closed
    IF is_period_closed(v_year, v_month) THEN
        RAISE EXCEPTION 'Nao e possivel modificar lancamentos contabeis no periodo fechado (%/%)', v_month, v_year;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_accounting_entry_closed_period ON accounting_entries;
CREATE TRIGGER trigger_protect_accounting_entry_closed_period
    BEFORE INSERT OR UPDATE OR DELETE ON accounting_entries
    FOR EACH ROW
    EXECUTE FUNCTION protect_accounting_entry_in_closed_period();

-- Trigger to protect accounting_entry_lines in closed periods
CREATE OR REPLACE FUNCTION protect_accounting_entry_line_in_closed_period()
RETURNS TRIGGER AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
    v_entry_date DATE;
BEGIN
    -- Get the entry date from parent entry
    IF TG_OP = 'DELETE' THEN
        SELECT entry_date INTO v_entry_date
        FROM accounting_entries WHERE id = OLD.entry_id;
    ELSE
        SELECT entry_date INTO v_entry_date
        FROM accounting_entries WHERE id = NEW.entry_id;
    END IF;

    IF v_entry_date IS NULL THEN
        -- Entry not found, allow operation (will fail on FK anyway)
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    v_year := EXTRACT(YEAR FROM v_entry_date);
    v_month := EXTRACT(MONTH FROM v_entry_date);

    -- Check if period is closed
    IF is_period_closed(v_year, v_month) THEN
        RAISE EXCEPTION 'Nao e possivel modificar linhas de lancamentos contabeis no periodo fechado (%/%)', v_month, v_year;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_accounting_entry_line_closed_period ON accounting_entry_lines;
CREATE TRIGGER trigger_protect_accounting_entry_line_closed_period
    BEFORE INSERT OR UPDATE OR DELETE ON accounting_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION protect_accounting_entry_line_in_closed_period();

-- ============================================
-- STEP 2: Close January 2025 with audited values
-- ============================================

-- Insert closing record for January 2025
INSERT INTO monthly_closings (
    year,
    month,
    status,
    closed_at,
    total_revenue,
    total_expenses,
    net_result,
    accounts_receivable,
    accounts_payable,
    bank_balances,
    balance_transferred,
    transferred_at,
    notes
) VALUES (
    2025,
    1,
    'closed',
    NOW(),
    136821.59,      -- Receitas (Competencia)
    153163.71,      -- Despesas (Caixa)
    -16342.12,      -- Resultado
    136821.59,      -- Contas a Receber (faturas janeiro a receber em fevereiro)
    0,              -- Contas a Pagar
    '[{"account_name": "Sicredi", "closing_balance": 18553.54}]'::jsonb,
    true,
    NOW(),
    'Fechamento auditado Janeiro 2025. Valores conferidos com extrato bancario. Saldo inicial: R$ 90.725,06 | Recebimentos: R$ 298.527,29 | Despesas: R$ 153.163,71 | Adiantamentos Socios: R$ 217.535,10 | Saldo final: R$ 18.553,54'
)
ON CONFLICT (year, month) DO UPDATE SET
    status = 'closed',
    closed_at = NOW(),
    total_revenue = 136821.59,
    total_expenses = 153163.71,
    net_result = -16342.12,
    accounts_receivable = 136821.59,
    bank_balances = '[{"account_name": "Sicredi", "closing_balance": 18553.54}]'::jsonb,
    balance_transferred = true,
    transferred_at = NOW(),
    notes = 'Fechamento auditado Janeiro 2025. Valores conferidos com extrato bancario. Saldo inicial: R$ 90.725,06 | Recebimentos: R$ 298.527,29 | Despesas: R$ 153.163,71 | Adiantamentos Socios: R$ 217.535,10 | Saldo final: R$ 18.553,54',
    updated_at = NOW();

-- ============================================
-- STEP 3: Create opening balance for February 2025
-- ============================================

-- First ensure bank_accounts exists with Sicredi
INSERT INTO bank_accounts (id, name, bank_code, agency, account_number, current_balance, is_active)
SELECT
    gen_random_uuid(),
    'Sicredi - Conta Movimento',
    '748',
    '0000',
    '00000-0',
    18553.54,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM bank_accounts WHERE name LIKE '%Sicredi%'
);

-- Create opening balance for February 2025
INSERT INTO bank_opening_balances (
    bank_account_id,
    year,
    month,
    opening_balance,
    source_closing_id
)
SELECT
    ba.id,
    2025,
    2,
    18553.54,
    mc.id
FROM bank_accounts ba
CROSS JOIN monthly_closings mc
WHERE ba.name LIKE '%Sicredi%'
  AND mc.year = 2025 AND mc.month = 1
ON CONFLICT (bank_account_id, year, month) DO UPDATE SET
    opening_balance = 18553.54;

COMMIT;
