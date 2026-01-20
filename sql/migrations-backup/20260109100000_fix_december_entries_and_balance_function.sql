-- =====================================================
-- FIX: Remover lançamentos de dezembro/2024 que não são saldos de abertura
-- E criar função para calcular saldos corretamente
-- =====================================================

-- 1. DELETAR lançamentos errados de dezembro/2024
-- Primeiro as linhas (FK)
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT id FROM accounting_entries
  WHERE competence_date >= '2024-12-01' 
    AND competence_date <= '2024-12-31'
    AND entry_type IN ('pagamento_despesa', 'adiantamento_socio')
);

-- Depois os entries
DELETE FROM accounting_entries
WHERE competence_date >= '2024-12-01' 
  AND competence_date <= '2024-12-31'
  AND entry_type IN ('pagamento_despesa', 'adiantamento_socio');

-- 2. CRIAR FUNÇÃO para calcular saldos por conta e período
CREATE OR REPLACE FUNCTION get_account_balances(
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  account_id UUID,
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  nature TEXT,
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

-- 3. CRIAR CHECK CONSTRAINT para prevenir entry_type errado em dezembro
-- (Opcional - comentado por segurança, descomentar se quiser ativar)
-- ALTER TABLE accounting_entries 
-- ADD CONSTRAINT chk_december_only_opening_balance
-- CHECK (
--   NOT (
--     competence_date >= '2024-12-01' 
--     AND competence_date <= '2024-12-31' 
--     AND entry_type NOT IN ('saldo_abertura', 'opening_balance', 'PROVISAO_RECEITA', 'receita_honorarios')
--   )
-- );

-- 4. Comentário para documentação
COMMENT ON FUNCTION get_account_balances IS 'Calcula saldos de abertura, débitos, créditos e saldo final por conta para um período. Usado pelo Plano de Contas.';
