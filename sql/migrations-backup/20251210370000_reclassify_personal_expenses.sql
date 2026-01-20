-- ============================================================================
-- RECLASSIFICAR DESPESAS PESSOAIS COMO ADIANTAMENTOS
-- ============================================================================
-- Despesas pessoais dos sócios NÃO são despesas da empresa!
-- Devem ir para Adiantamentos a Sócios (ATIVO)
-- ============================================================================

-- Identificar despesas pessoais que estão como despesa da empresa
-- e mover para adiantamento

DO $$
DECLARE
  v_entry RECORD;
  v_despesa_account_id UUID;
  v_sergio_account_id UUID;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
BEGIN
  -- Buscar contas
  SELECT id INTO v_despesa_account_id FROM chart_of_accounts WHERE code = '4.1.2.99';
  SELECT id INTO v_sergio_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.01';

  IF v_sergio_account_id IS NULL THEN
    SELECT id INTO v_sergio_account_id FROM chart_of_accounts WHERE code = '1.1.3.04';
  END IF;

  RAISE NOTICE '=== RECLASSIFICANDO DESPESAS PESSOAIS ===';

  -- IPVA pessoal (Sergio, carretinha, CG, BIZ) -> Adiantamento Sergio
  FOR v_entry IN
    SELECT ael.id, ael.debit, ae.description, ae.id as entry_id
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
      AND (
        ae.description ILIKE '%IPVA%Sergio%'
        OR ae.description ILIKE '%IPVA Carretinha%'
        OR ae.description ILIKE '%IPVA CG%'
        OR ae.description ILIKE '%IPVA BIZ%'
      )
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_sergio_account_id WHERE id = v_entry.id;
    UPDATE accounting_entries SET entry_type = 'adiantamento_socio' WHERE id = v_entry.entry_id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'IPVA pessoal: % | R$ %', v_entry.description, v_entry.debit;
  END LOOP;

  -- Plano de Saúde pessoal (Sergio) -> Adiantamento Sergio
  FOR v_entry IN
    SELECT ael.id, ael.debit, ae.description, ae.id as entry_id
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
      AND ae.description ILIKE '%Plano de Saúde%'
      AND ae.description NOT ILIKE '%funcionário%'
      AND ae.description NOT ILIKE '%Ampla%'
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_sergio_account_id WHERE id = v_entry.id;
    UPDATE accounting_entries SET entry_type = 'adiantamento_socio' WHERE id = v_entry.entry_id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Plano Saúde pessoal: % | R$ %', v_entry.description, v_entry.debit;
  END LOOP;

  -- Condomínio Lago e Mundi (pessoal Sergio) -> Adiantamento Sergio
  FOR v_entry IN
    SELECT ael.id, ael.debit, ae.description, ae.id as entry_id
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
      AND (
        ae.description ILIKE '%Condomínio Lago%'
        OR ae.description ILIKE '%Condomínio Mundi%'
      )
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_sergio_account_id WHERE id = v_entry.id;
    UPDATE accounting_entries SET entry_type = 'adiantamento_socio' WHERE id = v_entry.entry_id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Condomínio pessoal: % | R$ %', v_entry.description, v_entry.debit;
  END LOOP;

  -- Internet pessoal (Sergio) -> Adiantamento Sergio
  FOR v_entry IN
    SELECT ael.id, ael.debit, ae.description, ae.id as entry_id
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
      AND ae.description ILIKE '%Internet%Sergio%'
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_sergio_account_id WHERE id = v_entry.id;
    UPDATE accounting_entries SET entry_type = 'adiantamento_socio' WHERE id = v_entry.entry_id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Internet pessoal: % | R$ %', v_entry.description, v_entry.debit;
  END LOOP;

  -- Gás pessoal (Sergio) -> Adiantamento Sergio
  FOR v_entry IN
    SELECT ael.id, ael.debit, ae.description, ae.id as entry_id
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
      AND ae.description ILIKE '%Gás%Sergio%'
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_sergio_account_id WHERE id = v_entry.id;
    UPDATE accounting_entries SET entry_type = 'adiantamento_socio' WHERE id = v_entry.entry_id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Gás pessoal: % | R$ %', v_entry.description, v_entry.debit;
  END LOOP;

  -- Energia pessoal (Sergio) -> Adiantamento Sergio
  FOR v_entry IN
    SELECT ael.id, ael.debit, ae.description, ae.id as entry_id
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
      AND ae.description ILIKE '%Energia%Sergio%'
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_sergio_account_id WHERE id = v_entry.id;
    UPDATE accounting_entries SET entry_type = 'adiantamento_socio' WHERE id = v_entry.entry_id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Energia pessoal: % | R$ %', v_entry.description, v_entry.debit;
  END LOOP;

  -- Obras Lago (pessoal Sergio) -> Adiantamento Sergio
  FOR v_entry IN
    SELECT ael.id, ael.debit, ae.description, ae.id as entry_id
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id
      AND ael.debit > 0
      AND ae.description ILIKE '%Obras Lago%'
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_sergio_account_id WHERE id = v_entry.id;
    UPDATE accounting_entries SET entry_type = 'adiantamento_socio' WHERE id = v_entry.entry_id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Obras Lago pessoal: % | R$ %', v_entry.description, v_entry.debit;
  END LOOP;

  RAISE NOTICE '=== RESULTADO ===';
  RAISE NOTICE 'Despesas pessoais reclassificadas: %', v_count;
  RAISE NOTICE 'Valor removido do DRE: R$ %', v_total;
END $$;

-- Estatísticas após reclassificação
DO $$
DECLARE
  v_total_despesa NUMERIC;
  v_total_adiant NUMERIC;
BEGIN
  SELECT COALESCE(SUM(debit), 0) INTO v_total_despesa
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '4.1.2.99';

  SELECT COALESCE(SUM(debit), 0) INTO v_total_adiant
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '1.1.3.04%';

  RAISE NOTICE '=== APÓS RECLASSIFICAÇÃO ===';
  RAISE NOTICE 'Total em Outras Despesas (4.1.2.99): R$ %', v_total_despesa;
  RAISE NOTICE 'Total em Adiantamentos (1.1.3.04.xx): R$ %', v_total_adiant;
END $$;
