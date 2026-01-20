-- FASE 2: GATILHO DE SALDO DE ABERTURA (MIGRAÇÃO)
-- Autor: Dr. Cicero
-- Objetivo: Contabilizar automaticamente os saldos iniciais de clientes importados

CREATE OR REPLACE FUNCTION fn_auto_accounting_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_account_id UUID;  -- Clientes (1.1.2.01)
  v_credit_account_id UUID; -- Ajustes Anteriores (5.3.02.02 - Saldo de Abertura Clientes)
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- 1. Identificar Contas
  SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02.02'; -- Saldo de Abertura - Clientes

  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
     -- Tenta fallback genérico se a específica de abertura não existir
     SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02'; 
  END IF;

  v_history := 'Saldo Inicial Migração - Comp: ' || NEW.competence || ' - ' || COALESCE(NEW.description, '');

  -- 2. Criar Lançamento de Abertura
  INSERT INTO accounting_entries (
    entry_date, 
    competence_date, 
    description, 
    history, 
    entry_type, 
    document_type, 
    total_debit, 
    total_credit, 
    created_by
  ) VALUES (
    '2025-01-01', -- Data fixa de abertura do exercício
    TO_DATE(NEW.competence, 'MM/YYYY'), 
    'Implantação de Saldo',
    v_history,
    'SALDO_ABERTURA',
    'MEMORANDO',
    NEW.amount,
    NEW.amount,
    NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- 3. Partidas
  
  -- DÉBITO: Clientes
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_debit_account_id, NEW.amount, 0, v_history, NEW.client_id
  );

  -- CRÉDITO: Saldo de Abertura (PL)
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_credit_account_id, 0, NEW.amount, v_history, NEW.client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_auto_accounting_opening_balance ON client_opening_balance;
CREATE TRIGGER trg_auto_accounting_opening_balance
AFTER INSERT ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION fn_auto_accounting_opening_balance();
