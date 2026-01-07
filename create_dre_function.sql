
-- Function to generate DRE (Demonstração do Resultado do Exercício)
-- Calculates balances for Revenue (Group 3) and Expenses (Group 4)
-- Groups by Account Code hierarchy

CREATE OR REPLACE FUNCTION get_dre_report(start_date DATE, end_date DATE)
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  level INTEGER,
  nature TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH raw_data AS (
    SELECT
      ca.code,
      ca.name,
      ca.nature, 
      ael.debit,
      ael.credit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    JOIN chart_of_accounts ca ON ca.id = ael.account_id
    WHERE ae.entry_date BETWEEN start_date AND end_date
      AND (ca.code LIKE '3%' OR ca.code LIKE '4%')
      -- AND ae.entry_type != 'closing' -- Optional, keeping it simple for now
  ),
  
  -- Aggregate at Analytical Level first
  analytical_balances AS (
    SELECT
      code,
      name,
      SUM(debit) as debits,
      SUM(credit) as credits
    FROM raw_data
    GROUP BY code, name
  ),

  -- Standardize results (Revenue = Credit - Debit, Expense = Debit - Credit)
  -- BUT for a standard financial report output, we usually keep standard sign 
  -- and let the UI handle presentation (Revenue +, Expense -).
  -- Here we will calculate the 'Accounting Balance' (Credit - Debit).
  -- So Revenue (Credit Nature) will be Positive.
  -- Expenses (Debit Nature) will be Negative (because Debit > Credit means Negative Result balance).
  
  result_set AS (
    SELECT
      code,
      name,
      debits,
      credits,
      (credits - debits) as val -- Standard Accounting convention: Credit +, Debit -
    FROM analytical_balances
  )

  -- Now we need to roll up the hierarchy (Synthetic Levels)
  -- This approach assumes the chart of accounts structure is consistent (X.X.X.XX...)
  -- A recursive CTE or a simple grouping by substrings is needed.
  -- Simpler approach: Use the Chart of Accounts table itself to build the tree structure
  -- and sum up children.
  
  SELECT
    ca.code::TEXT,
    ca.name::TEXT,
    ca.level,
    ca.nature::TEXT, -- 'DEVEDORA' or 'CREDORA'
    COALESCE(SUM(rd.debit), 0) as total_debit,
    COALESCE(SUM(rd.credit), 0) as total_credit,
    
    -- Balance logic:
    -- If CREDORA (Revenue): Credit - Debit
    -- If DEVEDORA (Expense): Debit - Credit
    CASE 
      WHEN ca.nature = 'CREDORA' THEN COALESCE(SUM(rd.credit), 0) - COALESCE(SUM(rd.debit), 0)
      WHEN ca.nature = 'DEVEDORA' THEN COALESCE(SUM(rd.debit), 0) - COALESCE(SUM(rd.credit), 0)
      ELSE 0
    END as balance

  FROM chart_of_accounts ca
  -- Join with raw data lines that START WITH the parent code (Simulating Rollup)
  LEFT JOIN (
    SELECT
      ca_inner.code,
      ael.debit,
      ael.credit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    JOIN chart_of_accounts ca_inner ON ca_inner.id = ael.account_id
    WHERE ae.entry_date BETWEEN start_date AND end_date
  ) rd ON rd.code LIKE ca.code || '%' -- The rollup condition

  WHERE (ca.code LIKE '3%' OR ca.code LIKE '4%')
  GROUP BY ca.code, ca.name, ca.level, ca.nature
  ORDER BY ca.code;

END;
$$ LANGUAGE plpgsql;
