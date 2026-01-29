-- =====================================================
-- FIX: Corrigir função get_account_balances
-- 1. Case insensitive para entry_type
-- 2. Buscar em AMBAS as tabelas (accounting_entry_lines E accounting_entry_items)
-- 3. Usar entry_date quando competence_date for NULL
-- 4. TOTALIZAÇÃO DE CONTAS SINTÉTICAS:
--    - Contas ANALÍTICAS (nível 5, ex: 1.1.2.01.0006) recebem lançamentos diretos
--    - Contas SINTÉTICAS (níveis 1-4) são TOTALIZADORAS - somam automaticamente as filhas
--    - Totalização usa prefixo: 1.1.2.01 soma 1.1.2.01.*, 1.1.2 soma 1.1.2.*, etc.
-- =====================================================

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
  -- Combinar dados de AMBAS as tabelas (accounting_entry_lines E accounting_entry_items)
  all_entries AS (
    -- De accounting_entry_lines
    SELECT
      ael.account_id,
      COALESCE(ae.competence_date, ae.entry_date) as effective_date,
      ae.entry_type,
      ael.debit,
      ael.credit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id

    UNION ALL

    -- De accounting_entry_items
    SELECT
      aei.account_id,
      COALESCE(ae.competence_date, ae.entry_date) as effective_date,
      ae.entry_type,
      aei.debit,
      aei.credit
    FROM accounting_entry_items aei
    JOIN accounting_entries ae ON ae.id = aei.entry_id
  ),
  -- Saldo de abertura: lançamentos ANTES do período + saldo_abertura DO período
  -- Agora vinculado ao código da conta para permitir agregação hierárquica
  opening_by_code AS (
    SELECT
      coa.code as account_code,
      SUM(COALESCE(ae.debit, 0)) as debits,
      SUM(COALESCE(ae.credit, 0)) as credits
    FROM all_entries ae
    JOIN chart_of_accounts coa ON coa.id = ae.account_id
    WHERE (
      -- Lançamentos anteriores ao período
      ae.effective_date < p_period_start
      OR
      -- OU lançamentos saldo_abertura dentro do período (case insensitive)
      (ae.effective_date >= p_period_start
       AND ae.effective_date <= p_period_end
       AND UPPER(ae.entry_type) = 'SALDO_ABERTURA')
    )
    GROUP BY coa.code
  ),
  -- Movimentação do período (exceto saldo_abertura)
  -- Agora vinculado ao código da conta para permitir agregação hierárquica
  movement_by_code AS (
    SELECT
      coa.code as account_code,
      SUM(COALESCE(ae.debit, 0)) as debits,
      SUM(COALESCE(ae.credit, 0)) as credits
    FROM all_entries ae
    JOIN chart_of_accounts coa ON coa.id = ae.account_id
    WHERE ae.effective_date >= p_period_start
      AND ae.effective_date <= p_period_end
      AND UPPER(ae.entry_type) != 'SALDO_ABERTURA'
    GROUP BY coa.code
  ),
  -- Calcular totais para TODAS as contas (analíticas e sintéticas)
  -- Para sintéticas: soma todas as contas filhas usando LIKE 'codigo.%'
  account_totals AS (
    SELECT
      coa.id,
      coa.code,
      coa.name,
      coa.account_type,
      coa.nature,
      coa.is_analytical,
      -- Para contas ANALÍTICAS: pegar valores diretos
      -- Para contas SINTÉTICAS: somar valores de todas as contas filhas
      CASE
        WHEN coa.is_analytical = true THEN
          COALESCE((SELECT o.debits FROM opening_by_code o WHERE o.account_code = coa.code), 0)
        ELSE
          COALESCE((
            SELECT SUM(o.debits)
            FROM opening_by_code o
            WHERE o.account_code LIKE coa.code || '.%'
          ), 0)
      END as opening_debits,
      CASE
        WHEN coa.is_analytical = true THEN
          COALESCE((SELECT o.credits FROM opening_by_code o WHERE o.account_code = coa.code), 0)
        ELSE
          COALESCE((
            SELECT SUM(o.credits)
            FROM opening_by_code o
            WHERE o.account_code LIKE coa.code || '.%'
          ), 0)
      END as opening_credits,
      CASE
        WHEN coa.is_analytical = true THEN
          COALESCE((SELECT m.debits FROM movement_by_code m WHERE m.account_code = coa.code), 0)
        ELSE
          COALESCE((
            SELECT SUM(m.debits)
            FROM movement_by_code m
            WHERE m.account_code LIKE coa.code || '.%'
          ), 0)
      END as movement_debits,
      CASE
        WHEN coa.is_analytical = true THEN
          COALESCE((SELECT m.credits FROM movement_by_code m WHERE m.account_code = coa.code), 0)
        ELSE
          COALESCE((
            SELECT SUM(m.credits)
            FROM movement_by_code m
            WHERE m.account_code LIKE coa.code || '.%'
          ), 0)
      END as movement_credits
    FROM chart_of_accounts coa
    WHERE coa.is_active = true
      -- Ignorar contas [CONSOLIDADO] que são duplicadas
      AND coa.name NOT ILIKE '%[CONSOLIDADO]%'
  )
  SELECT
    at.id as account_id,
    at.code::VARCHAR(20) as account_code,
    at.name::VARCHAR(255) as account_name,
    at.account_type::VARCHAR(50),
    at.nature::VARCHAR(20),
    at.is_analytical,
    -- Saldo de abertura considera natureza da conta
    CASE
      WHEN at.nature = 'DEVEDORA' THEN at.opening_debits - at.opening_credits
      ELSE at.opening_credits - at.opening_debits
    END as opening_balance,
    at.movement_debits as total_debits,
    at.movement_credits as total_credits,
    -- Saldo final
    CASE
      WHEN at.nature = 'DEVEDORA' THEN
        (at.opening_debits - at.opening_credits) + at.movement_debits - at.movement_credits
      ELSE
        (at.opening_credits - at.opening_debits) + at.movement_credits - at.movement_debits
    END as closing_balance
  FROM account_totals at
  ORDER BY at.code;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION get_account_balances(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_balances(DATE, DATE) TO service_role;
