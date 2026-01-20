-- FASE 2.4 (PARTE 2): ATUALIZAR GATILHOS PARA USAR CONTA ESPECÍFICA DO CLIENTE
-- Autor: Dr. Cicero

-- 1. Atualizar Gatilho de Faturamento (Invoice)
CREATE OR REPLACE FUNCTION fn_auto_accounting_invoice_provision()
RETURNS TRIGGER AS $$
DECLARE
  v_credit_account_id UUID; -- Receita
  v_debit_account_id UUID;  -- Clientes (Específica)
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- Verifica duplicidade
  PERFORM 1 FROM accounting_entries 
  WHERE invoice_id = NEW.id AND entry_type = 'PROVISAO_RECEITA';
  IF FOUND THEN RETURN NEW; END IF;

  -- 1. Identificar Contas
  -- Receita de Serviços (3.1.1.01)
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '3.1.1.01';
  
  -- Busca a CONTA DO CLIENTE na tabela clients
  SELECT account_id INTO v_debit_account_id FROM clients WHERE id = NEW.client_id;
  
  -- Se o cliente não tiver conta, tenta fallback para a genérica (mas o ideal é ter)
  IF v_debit_account_id IS NULL THEN
     SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  END IF;

  IF v_credit_account_id IS NULL OR v_debit_account_id IS NULL THEN
    RAISE WARNING 'Contas contábeis não encontradas para Invoice %', NEW.id;
    RETURN NEW;
  END IF;

  v_history := 'Provisão de Honorários - ' || COALESCE(NEW.description, 'Serviços Contábeis') || ' - Comp: ' || COALESCE(NEW.competence, TO_CHAR(NEW.due_date, 'MM/YYYY'));

  INSERT INTO accounting_entries (
    entry_date, competence_date, description, history, entry_type, document_type, invoice_id, total_debit, total_credit, created_by
  ) VALUES (
    NEW.created_at::DATE, COALESCE(TO_DATE(NEW.competence, 'MM/YYYY'), NEW.due_date), 
    'Provisão de Receita', v_history, 'PROVISAO_RECEITA', 'FATURA', NEW.id, NEW.amount, NEW.amount, NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- DÉBITO: Conta ESPECÍFICA do Cliente
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_debit_account_id, NEW.amount, 0, v_history, NEW.client_id);

  -- CRÉDITO: Receita
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_credit_account_id, 0, NEW.amount, v_history, NEW.client_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Atualizar Gatilho de Recebimento (Reconciliation)
CREATE OR REPLACE FUNCTION fn_auto_accounting_reconciliation()
RETURNS TRIGGER AS $$
DECLARE
  v_bank_account_id UUID;
  v_bank_chart_account_id UUID;
  v_client_account_id UUID;     -- Conta Clientes (Específica)
  v_amount DECIMAL;
  v_date DATE;
  v_history TEXT;
  v_entry_id UUID;
  v_client_id UUID;
  v_invoice_id UUID;
BEGIN
  SELECT bank_account_id, amount, transaction_date, description 
  INTO v_bank_account_id, v_amount, v_date, v_history
  FROM bank_transactions WHERE id = NEW.transaction_id;

  IF NEW.invoice_id IS NOT NULL THEN
     SELECT client_id INTO v_client_id FROM invoices WHERE id = NEW.invoice_id;
     v_invoice_id := NEW.invoice_id;
  END IF;

  -- Banco (Fallback Sicredi)
  SELECT id INTO v_bank_chart_account_id FROM chart_of_accounts WHERE code = '1.1.1.05'; 

  -- Conta Clientes: Busca a específica do cliente
  IF v_client_id IS NOT NULL THEN
     SELECT account_id INTO v_client_account_id FROM clients WHERE id = v_client_id;
  END IF;

  -- Fallback se não achou cliente ou conta do cliente
  IF v_client_account_id IS NULL THEN
     SELECT id INTO v_client_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  END IF;

  v_history := 'Recebimento Fatura - ' || v_history;

  INSERT INTO accounting_entries (
    entry_date, competence_date, description, history, entry_type, document_type, transaction_id, invoice_id, total_debit, total_credit
  ) VALUES (
    v_date, v_date, 'Recebimento de Cliente', v_history, 'RECEBIMENTO', 'EXTRATO', NEW.transaction_id, v_invoice_id, v_amount, v_amount
  ) RETURNING id INTO v_entry_id;

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_bank_chart_account_id, v_amount, 0, v_history, v_client_id);

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_client_account_id, 0, v_amount, v_history, v_client_id);

  UPDATE bank_reconciliation SET accounting_entry_id = v_entry_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Atualizar Gatilho de Saldo de Abertura
CREATE OR REPLACE FUNCTION fn_auto_accounting_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_account_id UUID;  -- Clientes (Específica)
  v_credit_account_id UUID; -- Ajustes (5.3.02.02)
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- Busca Conta do Cliente
  SELECT account_id INTO v_debit_account_id FROM clients WHERE id = NEW.client_id;
  
  -- Fallback Genérico
  IF v_debit_account_id IS NULL THEN
    SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  END IF;

  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02.02';
  IF v_credit_account_id IS NULL THEN
     SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02'; 
  END IF;

  v_history := 'Saldo Inicial Migração - Comp: ' || NEW.competence || ' - ' || COALESCE(NEW.description, '');

  INSERT INTO accounting_entries (
    entry_date, competence_date, description, history, entry_type, document_type, total_debit, total_credit, created_by
  ) VALUES (
    '2025-01-01', TO_DATE(NEW.competence, 'MM/YYYY'), 'Implantação de Saldo', v_history, 'SALDO_ABERTURA', 'MEMORANDO', NEW.amount, NEW.amount, NEW.created_by
  ) RETURNING id INTO v_entry_id;

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_debit_account_id, NEW.amount, 0, v_history, NEW.client_id);

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_credit_account_id, 0, NEW.amount, v_history, NEW.client_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
