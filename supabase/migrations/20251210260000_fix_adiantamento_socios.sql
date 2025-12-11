-- ============================================================================
-- CORREÇÃO: Adiantamentos a Sócios NÃO são Despesas
-- ============================================================================
-- Problema: Adiantamentos a sócios estão sendo classificados como DESPESA
-- quando na verdade são movimentações patrimoniais (ATIVO).
--
-- Lançamento CORRETO para adiantamento:
--   D: 1.1.3.04.xx - Adiantamentos a Sócios (ATIVO)
--   C: 1.1.1.02    - Banco (ATIVO)
--
-- Isso NÃO afeta o DRE - é apenas uma troca entre ativos.
-- ============================================================================

-- Passo 1: Criar/garantir contas de adiantamento para cada sócio
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  ('1.1.3.04.03', 'Adiantamentos - Victor Hugo', 'ATIVO', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04')),
  ('1.1.3.04.04', 'Adiantamentos - Nayara', 'ATIVO', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04')),
  ('1.1.3.04.05', 'Adiantamentos - Sérgio Augusto', 'ATIVO', 'DEVEDORA', 5, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04'))
ON CONFLICT (code) DO NOTHING;

-- Passo 2: Remover conta de despesa incorreta (4.1.01.005 - Adiantamentos a Sócios)
-- Primeiro precisamos reclassificar os lançamentos que usam essa conta

-- Função auxiliar para obter conta de adiantamento do sócio baseado na categoria
CREATE OR REPLACE FUNCTION get_socio_adiantamento_account(p_category TEXT)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_code TEXT;
BEGIN
  -- Mapear categoria para código de conta de ATIVO
  v_code := CASE
    WHEN p_category ILIKE '%sergio%' AND p_category NOT ILIKE '%augusto%' THEN '1.1.3.04.01'  -- Sergio Carneiro Leão
    WHEN p_category ILIKE '%sergio augusto%' THEN '1.1.3.04.05'  -- Sérgio Augusto
    WHEN p_category ILIKE '%victor%' THEN '1.1.3.04.03'  -- Victor Hugo
    WHEN p_category ILIKE '%nayara%' THEN '1.1.3.04.04'  -- Nayara
    ELSE '1.1.3.04.02'  -- Outros Sócios (fallback)
  END;

  SELECT id INTO v_account_id
  FROM chart_of_accounts
  WHERE code = v_code;

  -- Fallback para conta genérica se não encontrar
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM chart_of_accounts
    WHERE code = '1.1.3.04';
  END IF;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Passo 3: Corrigir lançamentos contábeis existentes de adiantamentos
-- Precisamos mudar a conta de débito de DESPESA para ATIVO
DO $$
DECLARE
  v_expense RECORD;
  v_entry_id UUID;
  v_new_account_id UUID;
  v_old_account_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Buscar conta de despesa errada
  SELECT id INTO v_old_account_id
  FROM chart_of_accounts
  WHERE code = '4.1.2.99';  -- Outras Despesas Administrativas

  -- Processar cada despesa de adiantamento
  FOR v_expense IN
    SELECT e.id, e.category, e.description
    FROM expenses e
    WHERE e.category ILIKE '%adiantamento%'
  LOOP
    -- Obter conta correta de adiantamento
    v_new_account_id := get_socio_adiantamento_account(v_expense.category);

    IF v_new_account_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Atualizar linhas de lançamento (débito) - mudar de despesa para ativo
    UPDATE accounting_entry_lines ael
    SET account_id = v_new_account_id
    FROM accounting_entries ae
    WHERE ael.entry_id = ae.id
      AND ae.reference_type IN ('expenses', 'expense')
      AND ae.reference_id = v_expense.id
      AND ael.debit > 0;

    -- Atualizar tipo do lançamento para indicar que é adiantamento (não despesa)
    UPDATE accounting_entries
    SET entry_type = 'adiantamento_socio',
        description = 'Adiantamento: ' || v_expense.description
    WHERE reference_type IN ('expenses', 'expense')
      AND reference_id = v_expense.id
      AND entry_type = 'despesa';

    GET DIAGNOSTICS v_count = ROW_COUNT;
  END LOOP;

  RAISE NOTICE 'Lançamentos de adiantamento corrigidos';
END $$;

-- Passo 4: Atualizar lançamentos de pagamento de adiantamento
-- Mudar: D: Fornecedores / C: Banco
-- Para:  D: Adiantamento Sócio / C: Banco (já foi corrigido no passo 3)

-- O lançamento de "pagamento" de adiantamento não deveria existir
-- Adiantamento é apenas: D: Adiantamento / C: Banco (feito quando pago)
-- Vamos remover os lançamentos de pagamento duplicados

DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT ae.id
  FROM accounting_entries ae
  JOIN expenses e ON ae.reference_id = e.id
  WHERE ae.reference_type IN ('expenses_payment', 'expense_payment')
    AND e.category ILIKE '%adiantamento%'
);

DELETE FROM accounting_entries ae
USING expenses e
WHERE ae.reference_id = e.id
  AND ae.reference_type IN ('expenses_payment', 'expense_payment')
  AND e.category ILIKE '%adiantamento%';

-- Passo 5: Estatísticas
DO $$
DECLARE
  v_total_adiantamentos NUMERIC;
  v_entries_count INTEGER;
BEGIN
  SELECT SUM(amount) INTO v_total_adiantamentos
  FROM expenses
  WHERE category ILIKE '%adiantamento%';

  SELECT COUNT(*) INTO v_entries_count
  FROM accounting_entries
  WHERE entry_type = 'adiantamento_socio';

  RAISE NOTICE 'Total em Adiantamentos: R$ %', COALESCE(v_total_adiantamentos, 0);
  RAISE NOTICE 'Lançamentos de adiantamento: %', v_entries_count;
END $$;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON FUNCTION get_socio_adiantamento_account IS 'Retorna conta de adiantamento do sócio baseado na categoria';
