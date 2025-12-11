-- ============================================================================
-- CORREÇÃO: "ISS Completo" na verdade é IPTU da Sede
-- ============================================================================
-- O lançamento "ISS Completo" de R$ 3.684,74 é IPTU, não ISS
-- ============================================================================

DO $$
DECLARE
  v_entry RECORD;
  v_iss_account_id UUID;
  v_iptu_account_id UUID;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
BEGIN
  -- Buscar contas
  SELECT id INTO v_iss_account_id FROM chart_of_accounts WHERE code = '4.1.4.02';
  SELECT id INTO v_iptu_account_id FROM chart_of_accounts WHERE code = '4.1.4.03';

  IF v_iss_account_id IS NULL OR v_iptu_account_id IS NULL THEN
    RAISE NOTICE 'Conta ISS ou IPTU não encontrada!';
    RETURN;
  END IF;

  RAISE NOTICE '=== CORRIGINDO ISS COMPLETO -> IPTU ===';

  -- Mover "ISS Completo" para IPTU
  FOR v_entry IN
    SELECT ael.id, ae.description, ael.debit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_iss_account_id AND ael.debit > 0
      AND ae.description ILIKE '%ISS Completo%'
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_iptu_account_id WHERE id = v_entry.id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Movido para IPTU: % | R$ %', v_entry.description, v_entry.debit;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== RESULTADO ===';
  RAISE NOTICE 'Lançamentos corrigidos: %', v_count;
  RAISE NOTICE 'Valor movido de ISS para IPTU: R$ %', v_total;
END $$;

-- Verificar saldos atualizados
DO $$
DECLARE
  v_iss NUMERIC;
  v_iptu NUMERIC;
BEGIN
  SELECT COALESCE(SUM(ael.debit), 0) INTO v_iss
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '4.1.4.02';

  SELECT COALESCE(SUM(ael.debit), 0) INTO v_iptu
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '4.1.4.03';

  RAISE NOTICE '';
  RAISE NOTICE '=== SALDOS ATUALIZADOS ===';
  RAISE NOTICE '4.1.4.02 - ISS: R$ %', v_iss;
  RAISE NOTICE '4.1.4.03 - IPTU Sede: R$ %', v_iptu;
END $$;
