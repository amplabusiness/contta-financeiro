-- FASE 3: BACKFILL (PROCESSAR DADOS DE JANEIRO/2026)
-- Autor: Dr. Cicero
-- Objetivo: Gerar contabilidade para o que já foi lançado antes dos triggers existirem

DO $$
DECLARE
  r_invoice RECORD;
  r_expense RECORD;
  v_credit_account_id UUID;
  v_debit_account_id UUID;
  v_entry_id UUID;
  v_history TEXT;
  v_count_invoices INTEGER := 0;
  v_count_expenses INTEGER := 0;
BEGIN
  -- ====================================================================
  -- 1. BACKFILL DE INVOICES (RECEITAS) - JAN/2025 EM DIANTE
  -- ====================================================================
  RAISE NOTICE 'Iniciando Backfill de Invoices...';

  -- Receita de Serviços (3.1.1.01)
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '3.1.1.01';

  FOR r_invoice IN 
    SELECT i.*, c.account_id as client_account_id, c.name as client_name
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    WHERE i.created_at >= '2025-01-01' -- Filtrar desde o início do sistema (Jan/25)
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae 
      WHERE ae.reference_type = 'invoice' AND ae.reference_id = i.id
    )
  LOOP
    -- Se cliente não tem conta, tenta buscar ou ignora (já foi feito script de criação)
    IF r_invoice.client_account_id IS NOT NULL AND v_credit_account_id IS NOT NULL THEN
      
      v_history := 'Provisão de Honorários (Backfill) - ' || COALESCE(r_invoice.description, r_invoice.client_name) || ' - Comp: ' || COALESCE(r_invoice.competence, TO_CHAR(r_invoice.due_date, 'MM/YYYY'));

      INSERT INTO accounting_entries (
        entry_date, 
        competence_date, 
        description, 
        entry_type, 
        reference_type, 
        reference_id, 
        total_debit, 
        total_credit, 
        balanced,
        created_by
      ) VALUES (
        r_invoice.created_at::DATE, 
        COALESCE(TO_DATE(r_invoice.competence, 'MM/YYYY'), r_invoice.due_date), 
        v_history, 
        'PROVISAO_RECEITA', 
        'invoice', 
        r_invoice.id, 
        r_invoice.amount, 
        r_invoice.amount, 
        true,
        r_invoice.created_by
      ) RETURNING id INTO v_entry_id;

      -- DÉBITO: Conta ESPECÍFICA do Cliente
      INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description) 
      VALUES (v_entry_id, r_invoice.client_account_id, r_invoice.amount, 0, v_history);

      -- CRÉDITO: Receita
      INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description) 
      VALUES (v_entry_id, v_credit_account_id, 0, r_invoice.amount, v_history);

      v_count_invoices := v_count_invoices + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill Invoices Concluído. % lançamentos gerados.', v_count_invoices;

  -- ====================================================================
  -- 2. BACKFILL DE EXPENSES (DESPESAS) - JAN/2025 EM DIANTE
  -- ====================================================================
  RAISE NOTICE 'Iniciando Backfill de Expenses...';

  FOR r_expense IN 
    SELECT e.*, s.account_id as supplier_account_id, s.name as supplier_name
    FROM expenses e
    LEFT JOIN suppliers s ON s.id = e.supplier_id
    WHERE e.created_at >= '2025-01-01'
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae 
      WHERE ae.reference_type = 'expense' AND ae.reference_id = e.id
    )
  LOOP
    -- Lógica de Conta de Despesa (Mesma do Trigger)
    v_debit_account_id := r_expense.chart_account_id;
    
    IF v_debit_account_id IS NULL THEN
       CASE r_expense.category
         WHEN 'Aluguel' THEN SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.01.01' LIMIT 1; 
         ELSE SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.12' OR code LIKE '4.1.12%' LIMIT 1;
       END CASE;
       -- Garantir que temos um ID válido se code exato falhar
       IF v_debit_account_id IS NULL THEN
          SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code LIKE '4%' AND is_analytical = true LIMIT 1;
       END IF;
    END IF;

    -- Conta do Fornecedor (Crédito)
    v_credit_account_id := r_expense.supplier_account_id;

    -- Se tiver ambas as contas, lança
    IF v_debit_account_id IS NOT NULL AND v_credit_account_id IS NOT NULL THEN
      
      v_history := 'Provisão Despesa (Backfill) - ' || r_expense.description;

      INSERT INTO accounting_entries (
        entry_date, 
        competence_date, 
        description, 
        entry_type, 
        reference_type, 
        reference_id,
        total_debit, 
        total_credit, 
        balanced,
        created_by
      ) VALUES (
        r_expense.created_at::DATE, 
        r_expense.due_date, 
        v_history, 
        'PROVISAO_DESPESA', 
        'expense',
        r_expense.id,
        r_expense.amount, 
        r_expense.amount, 
        true,
        r_expense.created_by
      ) RETURNING id INTO v_entry_id;

      -- DÉBITO: Despesa
      INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description) 
      VALUES (v_entry_id, v_debit_account_id, r_expense.amount, 0, v_history);

      -- CRÉDITO: Fornecedor
      INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description) 
      VALUES (v_entry_id, v_credit_account_id, 0, r_expense.amount, v_history);

      v_count_expenses := v_count_expenses + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill Expenses Concluído. % lançamentos gerados.', v_count_expenses;

END $$;
