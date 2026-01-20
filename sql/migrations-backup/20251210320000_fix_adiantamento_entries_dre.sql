-- ============================================================================
-- CORREÇÃO CRÍTICA: Adiantamentos a Sócios NÃO são Despesas
-- ============================================================================
-- Problema: Lançamentos de adiantamento estão debitando conta 4.1.2.99 (Despesa)
-- quando deveriam debitar conta 1.1.3.xx (Ativo - Adiantamentos)
--
-- Impacto: DRE está inflado com ~R$ 216.000 de "despesas" que na verdade
-- são movimentações patrimoniais (não afetam resultado)
-- ============================================================================

-- Passo 1: Estatísticas antes da correção
DO $$
DECLARE
  v_total_despesa NUMERIC;
  v_total_adiant_entries INTEGER;
  v_despesa_account_id UUID;
BEGIN
  -- Buscar conta de despesa genérica
  SELECT id INTO v_despesa_account_id
  FROM chart_of_accounts WHERE code = '4.1.2.99';

  -- Total em lançamentos na conta de despesa
  SELECT COALESCE(SUM(debit), 0) INTO v_total_despesa
  FROM accounting_entry_lines
  WHERE account_id = v_despesa_account_id;

  RAISE NOTICE '=== ANTES DA CORREÇÃO ===';
  RAISE NOTICE 'Total debitado em 4.1.2.99: R$ %', v_total_despesa;
END $$;

-- Passo 2: Identificar lançamentos de adiantamento que estão na conta errada
-- Vamos buscar pela descrição que contém "adiantamento"
DO $$
DECLARE
  v_entry RECORD;
  v_despesa_account_id UUID;
  v_correct_account_id UUID;
  v_count INTEGER := 0;
  v_total_corrigido NUMERIC := 0;
BEGIN
  -- Buscar conta de despesa genérica
  SELECT id INTO v_despesa_account_id
  FROM chart_of_accounts WHERE code = '4.1.2.99';

  -- Buscar conta de adiantamentos genérica
  SELECT id INTO v_correct_account_id
  FROM chart_of_accounts WHERE code = '1.1.3.04';

  IF v_correct_account_id IS NULL THEN
    -- Criar conta se não existir
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
    VALUES ('1.1.3.04', 'Adiantamentos a Sócios', 'ATIVO', 'DEVEDORA', 4, true, true)
    RETURNING id INTO v_correct_account_id;
    RAISE NOTICE 'Conta 1.1.3.04 criada';
  END IF;

  -- Corrigir linhas de lançamento que debitam despesa mas são adiantamentos
  FOR v_entry IN
    SELECT ael.id, ael.debit, ael.description, ae.id as entry_id, ae.description as entry_desc
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
      AND (
        ae.description ILIKE '%adiantamento%'
        OR ae.entry_type = 'adiantamento_socio'
        OR ael.description ILIKE '%adiantamento%'
      )
  LOOP
    -- Atualizar para conta correta de ativo
    UPDATE accounting_entry_lines
    SET account_id = v_correct_account_id
    WHERE id = v_entry.id;

    -- Atualizar tipo do lançamento
    UPDATE accounting_entries
    SET entry_type = 'adiantamento_socio'
    WHERE id = v_entry.entry_id
      AND entry_type NOT IN ('adiantamento_socio');

    v_count := v_count + 1;
    v_total_corrigido := v_total_corrigido + COALESCE(v_entry.debit, 0);

    RAISE NOTICE 'Corrigido: % - R$ %', v_entry.entry_desc, v_entry.debit;
  END LOOP;

  RAISE NOTICE '=== RESULTADO ===';
  RAISE NOTICE 'Lançamentos corrigidos: %', v_count;
  RAISE NOTICE 'Valor removido do DRE: R$ %', v_total_corrigido;
END $$;

-- Passo 3: Corrigir também pela referência a expenses que são adiantamentos
DO $$
DECLARE
  v_expense RECORD;
  v_despesa_account_id UUID;
  v_correct_account_id UUID;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
BEGIN
  SELECT id INTO v_despesa_account_id FROM chart_of_accounts WHERE code = '4.1.2.99';
  SELECT id INTO v_correct_account_id FROM chart_of_accounts WHERE code = '1.1.3.04';

  -- Buscar expenses que são adiantamentos
  FOR v_expense IN
    SELECT e.id, e.category, e.amount, e.description
    FROM expenses e
    WHERE e.category ILIKE '%adiantamento%'
  LOOP
    -- Corrigir linhas de lançamento relacionadas
    UPDATE accounting_entry_lines ael
    SET account_id = v_correct_account_id
    FROM accounting_entries ae
    WHERE ael.entry_id = ae.id
      AND ae.reference_id = v_expense.id
      AND ae.reference_type IN ('expenses', 'expense')
      AND ael.account_id = v_despesa_account_id
      AND ael.debit > 0;

    IF FOUND THEN
      v_count := v_count + 1;
      v_total := v_total + v_expense.amount;
    END IF;
  END LOOP;

  RAISE NOTICE 'Corrigidos por referência a expenses: %', v_count;
  RAISE NOTICE 'Valor adicional removido: R$ %', v_total;
END $$;

-- Passo 4: Estatísticas depois da correção
DO $$
DECLARE
  v_total_despesa NUMERIC;
  v_total_adiantamento NUMERIC;
  v_despesa_account_id UUID;
  v_adiant_account_id UUID;
BEGIN
  SELECT id INTO v_despesa_account_id FROM chart_of_accounts WHERE code = '4.1.2.99';
  SELECT id INTO v_adiant_account_id FROM chart_of_accounts WHERE code = '1.1.3.04';

  SELECT COALESCE(SUM(debit), 0) INTO v_total_despesa
  FROM accounting_entry_lines WHERE account_id = v_despesa_account_id;

  SELECT COALESCE(SUM(debit), 0) INTO v_total_adiantamento
  FROM accounting_entry_lines WHERE account_id = v_adiant_account_id;

  RAISE NOTICE '=== APÓS CORREÇÃO ===';
  RAISE NOTICE 'Total em Outras Despesas (4.1.2.99): R$ %', v_total_despesa;
  RAISE NOTICE 'Total em Adiantamentos (1.1.3.04): R$ %', v_total_adiantamento;
END $$;

-- ============================================================================
-- COMENTÁRIO
-- ============================================================================
COMMENT ON TABLE accounting_entry_lines IS 'Linhas de lançamentos - Corrigido: adiantamentos agora em conta 1.1.3.04';
