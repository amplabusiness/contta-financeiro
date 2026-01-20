-- ============================================================================
-- VERIFICAÇÃO: Adiantamentos têm lançamentos contábeis?
-- ============================================================================

-- Verificar expenses de adiantamento e seus lançamentos
DO $$
DECLARE
  v_exp RECORD;
  v_entry_count INTEGER;
  v_sem_lancamento INTEGER := 0;
  v_com_lancamento INTEGER := 0;
BEGIN
  RAISE NOTICE '=== EXPENSES DE ADIANTAMENTO ===';

  FOR v_exp IN
    SELECT id, category, description, amount, status
    FROM expenses
    WHERE category ILIKE '%adiantamento%'
    ORDER BY amount DESC
  LOOP
    -- Verificar se tem lançamento
    SELECT COUNT(*) INTO v_entry_count
    FROM accounting_entries
    WHERE reference_id = v_exp.id
      AND reference_type IN ('expenses', 'expense');

    IF v_entry_count = 0 THEN
      v_sem_lancamento := v_sem_lancamento + 1;
      RAISE NOTICE 'SEM LANÇAMENTO: % | % | R$ % | Status: %',
        v_exp.category, LEFT(v_exp.description, 30), v_exp.amount, v_exp.status;
    ELSE
      v_com_lancamento := v_com_lancamento + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '=== RESUMO ===';
  RAISE NOTICE 'Com lançamento: %', v_com_lancamento;
  RAISE NOTICE 'Sem lançamento: %', v_sem_lancamento;
END $$;

-- Verificar lançamentos com entry_type = 'adiantamento_socio'
DO $$
DECLARE
  v_count INTEGER;
  v_total NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_debit), 0)
  INTO v_count, v_total
  FROM accounting_entries
  WHERE entry_type = 'adiantamento_socio';

  RAISE NOTICE '=== LANÇAMENTOS TIPO adiantamento_socio ===';
  RAISE NOTICE 'Quantidade: %, Total: R$ %', v_count, v_total;
END $$;

-- Verificar saldo na conta 1.1.3.04 (Adiantamentos)
DO $$
DECLARE
  v_debito NUMERIC;
  v_credito NUMERIC;
  v_account_id UUID;
BEGIN
  SELECT id INTO v_account_id FROM chart_of_accounts WHERE code = '1.1.3.04';

  IF v_account_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO v_debito, v_credito
    FROM accounting_entry_lines
    WHERE account_id = v_account_id;

    RAISE NOTICE '=== SALDO 1.1.3.04 (Adiantamentos) ===';
    RAISE NOTICE 'Débitos: R$ %, Créditos: R$ %, Saldo: R$ %', v_debito, v_credito, v_debito - v_credito;
  ELSE
    RAISE NOTICE 'Conta 1.1.3.04 não encontrada!';
  END IF;
END $$;
