-- =====================================================
-- CORREÇÃO: LANÇAMENTOS DE RECEITA NÃO DEBITAM BANCO
-- =====================================================
-- Problema identificado:
-- - Quando uma receita é recebida, deveria ter:
--   D - Banco (1.1.1.02) = AUMENTA o saldo
--   C - Receita (3.x) = AUMENTA a receita
-- - Mas os lançamentos de receita não estão entrando no banco!
-- =====================================================

-- 1. Verificar quantas receitas têm lançamento no banco
DO $$
DECLARE
  v_total_receitas INTEGER;
  v_com_banco INTEGER;
  v_sem_banco INTEGER;
BEGIN
  -- Total de lançamentos de receita
  SELECT COUNT(DISTINCT ae.id) INTO v_total_receitas
  FROM accounting_entries ae
  JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3%';

  -- Receitas COM contrapartida em Banco
  SELECT COUNT(DISTINCT ae.id) INTO v_com_banco
  FROM accounting_entries ae
  JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3%'
  AND EXISTS (
    SELECT 1 FROM accounting_entry_lines ael2
    JOIN chart_of_accounts coa2 ON coa2.id = ael2.account_id
    WHERE ael2.entry_id = ae.id AND coa2.code = '1.1.1.02'
  );

  v_sem_banco := v_total_receitas - v_com_banco;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'LANÇAMENTOS DE RECEITA:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de receitas: %', v_total_receitas;
  RAISE NOTICE 'Com contrapartida em Banco: %', v_com_banco;
  RAISE NOTICE 'SEM contrapartida em Banco: %', v_sem_banco;
END;
$$;

-- 2. Ver como estão os lançamentos de receita (amostra)
DO $$
DECLARE
  v_receita RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AMOSTRA DE LANÇAMENTOS DE RECEITA:';
  RAISE NOTICE '========================================';

  FOR v_receita IN
    SELECT
      ae.id,
      ae.entry_date,
      ae.description,
      STRING_AGG(coa.code || ' (D:' || ael.debit || ' C:' || ael.credit || ')', ' | ') as linhas
    FROM accounting_entries ae
    JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN chart_of_accounts coa ON coa.id = ael.account_id
    WHERE EXISTS (
      SELECT 1 FROM accounting_entry_lines ael2
      JOIN chart_of_accounts coa2 ON coa2.id = ael2.account_id
      WHERE ael2.entry_id = ae.id AND coa2.code LIKE '3%'
    )
    GROUP BY ae.id, ae.entry_date, ae.description
    ORDER BY ae.entry_date DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '% | % | %', v_receita.entry_date, LEFT(v_receita.description, 30), v_receita.linhas;
  END LOOP;
END;
$$;

-- 3. Identificar receitas registradas na tabela invoices que foram pagas
-- e não têm lançamento de entrada no banco
DO $$
DECLARE
  v_invoice RECORD;
  v_total_valor NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FATURAS PAGAS SEM ENTRADA NO BANCO:';
  RAISE NOTICE '========================================';

  FOR v_invoice IN
    SELECT
      i.id,
      i.amount,
      i.due_date,
      c.name as client_name
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    WHERE i.status = 'paid'
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
      JOIN chart_of_accounts coa ON coa.id = ael.account_id
      WHERE ae.reference_id = i.id
        AND ae.reference_type = 'invoice'
        AND coa.code = '1.1.1.02'
        AND ael.debit > 0  -- Débito no banco = entrada
    )
    ORDER BY i.due_date
    LIMIT 20
  LOOP
    RAISE NOTICE 'Fatura % - R$ % (Venc: %)',
      LEFT(v_invoice.client_name, 25),
      v_invoice.amount,
      v_invoice.due_date;
    v_total_valor := v_total_valor + v_invoice.amount;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Total de faturas sem entrada: %', v_count;
  RAISE NOTICE 'Valor total: R$ %', v_total_valor;
END;
$$;

-- 4. Verificar transações bancárias de CRÉDITO (entradas) que não têm lançamento
DO $$
DECLARE
  v_trans RECORD;
  v_total NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TRANSAÇÕES BANCÁRIAS DE ENTRADA SEM LANÇAMENTO:';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT
      bt.id,
      bt.transaction_date,
      bt.description,
      bt.amount,
      bt.is_reconciled,
      bt.matched
    FROM bank_transactions bt
    WHERE bt.amount > 0  -- Crédito bancário = entrada de dinheiro
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.transaction_id = bt.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.reference_type = 'bank_transaction'
        AND ae.reference_id = bt.id
    )
    ORDER BY bt.transaction_date
    LIMIT 20
  LOOP
    RAISE NOTICE '% | R$ % | % | Rec: % Match: %',
      v_trans.transaction_date,
      v_trans.amount,
      LEFT(v_trans.description, 30),
      v_trans.is_reconciled,
      v_trans.matched;
    v_total := v_total + v_trans.amount;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Total de transações sem lançamento: %', v_count;
  RAISE NOTICE 'Valor total: R$ %', v_total;
END;
$$;

-- 5. CORREÇÃO: Criar lançamentos de entrada no banco para transações de crédito
-- Cada entrada bancária deve ter:
-- D - Banco (1.1.1.02)
-- C - Receita ou conta apropriada
DO $$
DECLARE
  v_trans RECORD;
  v_banco_id UUID;
  v_receita_id UUID;
  v_entry_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Buscar IDs das contas
  SELECT id INTO v_banco_id FROM chart_of_accounts WHERE code = '1.1.1.02';
  SELECT id INTO v_receita_id FROM chart_of_accounts WHERE code = '3.1.1.01'; -- Receita de Serviços Contábeis

  IF v_banco_id IS NULL OR v_receita_id IS NULL THEN
    RAISE WARNING 'Contas não encontradas: Banco=%, Receita=%', v_banco_id IS NOT NULL, v_receita_id IS NOT NULL;
    RETURN;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CRIANDO LANÇAMENTOS PARA ENTRADAS BANCÁRIAS:';
  RAISE NOTICE '========================================';

  FOR v_trans IN
    SELECT
      bt.id,
      bt.transaction_date,
      bt.description,
      bt.amount
    FROM bank_transactions bt
    WHERE bt.amount > 0  -- Apenas entradas
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.transaction_id = bt.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.reference_type = 'bank_transaction' AND ae.reference_id = bt.id
    )
    ORDER BY bt.transaction_date
  LOOP
    -- Criar lançamento contábil
    INSERT INTO accounting_entries (
      entry_date,
      competence_date,
      description,
      entry_type,
      transaction_id,
      reference_type,
      reference_id,
      created_at
    ) VALUES (
      v_trans.transaction_date,
      v_trans.transaction_date,
      'Receita: ' || v_trans.description,
      'receipt',
      v_trans.id,
      'bank_transaction',
      v_trans.id,
      NOW()
    ) RETURNING id INTO v_entry_id;

    -- Linha 1: DÉBITO no Banco (entrada de dinheiro)
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit)
    VALUES (v_entry_id, v_banco_id, v_trans.amount, 0);

    -- Linha 2: CRÉDITO na Receita
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit)
    VALUES (v_entry_id, v_receita_id, 0, v_trans.amount);

    -- Marcar transação como reconciliada
    UPDATE bank_transactions
    SET is_reconciled = true, matched = true
    WHERE id = v_trans.id;

    v_count := v_count + 1;

    RAISE NOTICE 'Lançamento criado: % - R$ % - %',
      v_trans.transaction_date, v_trans.amount, LEFT(v_trans.description, 30);
  END LOOP;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Total de lançamentos criados: %', v_count;
END;
$$;

-- 6. Verificar saldo atualizado do banco
DO $$
DECLARE
  v_saldo_antes NUMERIC;
  v_saldo_depois NUMERIC;
BEGIN
  SELECT COALESCE(SUM(debit - credit), 0) INTO v_saldo_depois
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code = '1.1.1.02';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SALDO ATUALIZADO DO BANCO (1.1.1.02):';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Saldo Contábil Atual: R$ %', v_saldo_depois;

  -- Comparar com transações
  SELECT COALESCE(SUM(amount), 0) INTO v_saldo_antes
  FROM bank_transactions;

  RAISE NOTICE 'Saldo Transações: R$ %', v_saldo_antes + 90725.10; -- + saldo abertura

  IF ABS(v_saldo_depois - (v_saldo_antes + 90725.10)) < 1 THEN
    RAISE NOTICE 'SALDOS CONFEREM!';
  ELSE
    RAISE NOTICE 'Diferença: R$ %', v_saldo_depois - (v_saldo_antes + 90725.10);
  END IF;
END;
$$;

