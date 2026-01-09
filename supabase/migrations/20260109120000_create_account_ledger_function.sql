-- =====================================================
-- Criar função para Razão Contábil (Account Ledger)
-- Retorna histórico completo de uma conta com saldo corrente
-- =====================================================

CREATE OR REPLACE FUNCTION get_account_ledger(
  p_account_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  line_id UUID,
  entry_id UUID,
  entry_date DATE,
  competence_date DATE,
  entry_number INTEGER,
  entry_type VARCHAR(50),
  document_number VARCHAR(100),
  description TEXT,
  history TEXT,
  debit NUMERIC,
  credit NUMERIC,
  running_balance NUMERIC,
  source_type VARCHAR(50),
  is_opening_balance BOOLEAN
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_opening_balance NUMERIC;
  v_account_nature VARCHAR(20);
BEGIN
  -- Buscar natureza da conta
  SELECT nature INTO v_account_nature
  FROM chart_of_accounts
  WHERE id = p_account_id;

  -- Calcular saldo de abertura (lançamentos antes do período + saldo_abertura do período)
  SELECT 
    CASE 
      WHEN v_account_nature = 'DEVEDORA' THEN 
        COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0)
      ELSE 
        COALESCE(SUM(ael.credit), 0) - COALESCE(SUM(ael.debit), 0)
    END
  INTO v_opening_balance
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  WHERE ael.account_id = p_account_id
    AND (
      ae.competence_date < p_period_start
      OR (ae.competence_date >= p_period_start 
          AND ae.competence_date <= p_period_end 
          AND ae.entry_type = 'saldo_abertura')
    );

  v_opening_balance := COALESCE(v_opening_balance, 0);

  -- Retornar linha de saldo inicial primeiro
  RETURN QUERY
  SELECT 
    NULL::UUID as line_id,
    NULL::UUID as entry_id,
    p_period_start as entry_date,
    p_period_start as competence_date,
    0 as entry_number,
    'saldo_inicial'::VARCHAR(50) as entry_type,
    NULL::VARCHAR(100) as document_number,
    'SALDO ANTERIOR'::TEXT as description,
    'Saldo transportado do período anterior'::TEXT as history,
    CASE WHEN v_account_nature = 'DEVEDORA' AND v_opening_balance > 0 THEN v_opening_balance ELSE 0 END as debit,
    CASE WHEN v_account_nature = 'CREDORA' AND v_opening_balance > 0 THEN v_opening_balance 
         WHEN v_account_nature = 'DEVEDORA' AND v_opening_balance < 0 THEN ABS(v_opening_balance)
         ELSE 0 END as credit,
    v_opening_balance as running_balance,
    'opening'::VARCHAR(50) as source_type,
    true as is_opening_balance;

  -- Retornar movimentações do período com saldo corrente calculado
  RETURN QUERY
  WITH ordered_entries AS (
    SELECT 
      ael.id as line_id,
      ae.id as entry_id,
      ae.entry_date,
      ae.competence_date,
      ae.entry_number,
      ae.entry_type,
      ae.document_number,
      COALESCE(ae.description, ael.description) as description,
      ae.history,
      COALESCE(ael.debit, 0) as debit,
      COALESCE(ael.credit, 0) as credit,
      ae.source_type,
      ROW_NUMBER() OVER (ORDER BY ae.competence_date, ae.entry_number, ae.created_at) as rn
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = p_account_id
      AND ae.competence_date >= p_period_start 
      AND ae.competence_date <= p_period_end
      AND ae.entry_type != 'saldo_abertura'
    ORDER BY ae.competence_date, ae.entry_number, ae.created_at
  )
  SELECT 
    oe.line_id,
    oe.entry_id,
    oe.entry_date,
    oe.competence_date,
    oe.entry_number,
    oe.entry_type::VARCHAR(50),
    oe.document_number::VARCHAR(100),
    oe.description::TEXT,
    oe.history::TEXT,
    oe.debit,
    oe.credit,
    v_opening_balance + SUM(
      CASE 
        WHEN v_account_nature = 'DEVEDORA' THEN oe.debit - oe.credit
        ELSE oe.credit - oe.debit
      END
    ) OVER (ORDER BY oe.rn) as running_balance,
    oe.source_type::VARCHAR(50),
    false as is_opening_balance
  FROM ordered_entries oe;
END;
$$;

-- Criar função para resumo do razão (totais)
CREATE OR REPLACE FUNCTION get_account_ledger_summary(
  p_account_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  account_id UUID,
  account_code VARCHAR(20),
  account_name VARCHAR(255),
  account_type VARCHAR(50),
  nature VARCHAR(20),
  opening_balance NUMERIC,
  total_debits NUMERIC,
  total_credits NUMERIC,
  closing_balance NUMERIC,
  entry_count BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH 
  account_info AS (
    SELECT 
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      coa.nature
    FROM chart_of_accounts coa
    WHERE coa.id = p_account_id
  ),
  opening AS (
    SELECT 
      SUM(COALESCE(ael.debit, 0)) as debits,
      SUM(COALESCE(ael.credit, 0)) as credits
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = p_account_id
      AND (
        ae.competence_date < p_period_start
        OR (ae.competence_date >= p_period_start 
            AND ae.competence_date <= p_period_end 
            AND ae.entry_type = 'saldo_abertura')
      )
  ),
  movement AS (
    SELECT 
      SUM(COALESCE(ael.debit, 0)) as debits,
      SUM(COALESCE(ael.credit, 0)) as credits,
      COUNT(*) as cnt
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = p_account_id
      AND ae.competence_date >= p_period_start 
      AND ae.competence_date <= p_period_end
      AND ae.entry_type != 'saldo_abertura'
  )
  SELECT 
    ai.id as account_id,
    ai.code as account_code,
    ai.name as account_name,
    ai.account_type,
    ai.nature,
    CASE 
      WHEN ai.nature = 'DEVEDORA' THEN COALESCE(o.debits, 0) - COALESCE(o.credits, 0)
      ELSE COALESCE(o.credits, 0) - COALESCE(o.debits, 0)
    END as opening_balance,
    COALESCE(m.debits, 0) as total_debits,
    COALESCE(m.credits, 0) as total_credits,
    CASE 
      WHEN ai.nature = 'DEVEDORA' THEN 
        (COALESCE(o.debits, 0) - COALESCE(o.credits, 0)) + COALESCE(m.debits, 0) - COALESCE(m.credits, 0)
      ELSE 
        (COALESCE(o.credits, 0) - COALESCE(o.debits, 0)) + COALESCE(m.credits, 0) - COALESCE(m.debits, 0)
    END as closing_balance,
    COALESCE(m.cnt, 0) as entry_count
  FROM account_info ai
  CROSS JOIN opening o
  CROSS JOIN movement m;
END;
$$;

COMMENT ON FUNCTION get_account_ledger IS 'Retorna o razão contábil de uma conta com saldo corrente acumulado para um período';
COMMENT ON FUNCTION get_account_ledger_summary IS 'Retorna resumo do razão contábil (totais) de uma conta para um período';
