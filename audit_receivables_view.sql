CREATE OR REPLACE VIEW v_audit_receivables AS
WITH 
  op_invoices AS (
    SELECT 
      COALESCE(SUM(amount), 0) as total
    FROM invoices 
    WHERE status IN ('pending', 'overdue')
  ),
  op_opening_balances AS (
    SELECT 
      COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as total
    FROM client_opening_balance 
    WHERE status IN ('pending', 'partial', 'overdue')
  ),
  accounting AS (
    -- Balance for 1.1.2.01 aggregated across ALL time (all years/months)
    -- v_balancete groups by year/month, so we must sum here
    SELECT 
      COALESCE(SUM(balance), 0) as total
    FROM v_balancete 
    WHERE account_code = '1.1.2.01'
  )
SELECT 
  (i.total + ob.total) as operational_value,
  acc.total as accounting_value,
  ((i.total + ob.total) - acc.total) as difference,
  CASE 
    WHEN ABS((i.total + ob.total) - acc.total) < 0.05 THEN 'OK'
    ELSE 'DIVERGENCE_DETECTED'
  END as status,
  NOW() as checked_at
FROM op_invoices i, op_opening_balances ob, accounting acc;

COMMENT ON VIEW v_audit_receivables IS 'Audit View to compare Operational Receivables (Invoices + OpeningBalance) vs Accounting Ledger (1.1.2.01)';
