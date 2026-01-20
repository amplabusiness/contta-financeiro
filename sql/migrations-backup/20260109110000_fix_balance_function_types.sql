-- =====================================================
-- FIX: Corrigir tipos de retorno da função get_account_balances
-- =====================================================

-- Precisa dropar primeiro porque mudança de tipos de retorno
DROP FUNCTION IF EXISTS get_account_balances(DATE, DATE);

CREATE OR REPLACE FUNCTION get_account_balances(
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  account_id UUID,
  account_code VARCHAR(20),
  account_name VARCHAR(255),
  account_type VARCHAR(50),
  nature VARCHAR(20),
  is_analytical BOOLEAN,
  opening_balance NUMERIC,
  total_debits NUMERIC,
  total_credits NUMERIC,
  closing_balance NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Saldo de abertura: lançamentos ANTES do período + saldo_abertura DO período
  opening AS (
    SELECT 
      ael.account_id,
      SUM(COALESCE(ael.debit, 0)) as debits,
      SUM(COALESCE(ael.credit, 0)) as credits
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE (
      -- Lançamentos anteriores ao período
      ae.competence_date < p_period_start
      OR 
      -- OU lançamentos saldo_abertura dentro do período
      (ae.competence_date >= p_period_start 
       AND ae.competence_date <= p_period_end 
       AND ae.entry_type = 'saldo_abertura')
    )
    GROUP BY ael.account_id
  ),
  -- Movimentação do período (exceto saldo_abertura)
  movement AS (
    SELECT 
      ael.account_id,
      SUM(COALESCE(ael.debit, 0)) as debits,
      SUM(COALESCE(ael.credit, 0)) as credits
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ae.competence_date >= p_period_start 
      AND ae.competence_date <= p_period_end
      AND ae.entry_type != 'saldo_abertura'
    GROUP BY ael.account_id
  )
  SELECT 
    coa.id as account_id,
    coa.code as account_code,
    coa.name as account_name,
    coa.account_type,
    coa.nature,
    coa.is_analytical,
    -- Saldo de abertura considera natureza da conta
    CASE 
      WHEN coa.nature = 'DEVEDORA' THEN COALESCE(o.debits, 0) - COALESCE(o.credits, 0)
      ELSE COALESCE(o.credits, 0) - COALESCE(o.debits, 0)
    END as opening_balance,
    COALESCE(m.debits, 0) as total_debits,
    COALESCE(m.credits, 0) as total_credits,
    -- Saldo final
    CASE 
      WHEN coa.nature = 'DEVEDORA' THEN 
        (COALESCE(o.debits, 0) - COALESCE(o.credits, 0)) + COALESCE(m.debits, 0) - COALESCE(m.credits, 0)
      ELSE 
        (COALESCE(o.credits, 0) - COALESCE(o.debits, 0)) + COALESCE(m.credits, 0) - COALESCE(m.debits, 0)
    END as closing_balance
  FROM chart_of_accounts coa
  LEFT JOIN opening o ON o.account_id = coa.id
  LEFT JOIN movement m ON m.account_id = coa.id
  WHERE coa.is_active = true
  ORDER BY coa.code;
END;
$$;
