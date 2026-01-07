BEGIN;

-- 1. Fix the Trigger Function to use accounting_entry_lines
CREATE OR REPLACE FUNCTION fn_auto_accounting_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_account_id UUID;
  v_credit_account_id UUID;
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- 1. Identificar Contas
  SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02.02';

  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
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
    '2025-01-01', 
    TO_DATE(NEW.competence, 'MM/YYYY'), 
    'Implantação de Saldo',
    v_history,
    'SALDO_ABERTURA',
    'MEMORANDO',
    NEW.amount,
    NEW.amount,
    NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- 3. Partidas -> NOW IN accounting_entry_lines
  -- DÉBITO: Clientes
  INSERT INTO accounting_entry_lines (
    entry_id, account_id, debit, credit, description
  ) VALUES (
    v_entry_id, v_debit_account_id, NEW.amount, 0, v_history
  );

  -- CRÉDITO: Saldo de Abertura (PL)
  INSERT INTO accounting_entry_lines (
    entry_id, account_id, debit, credit, description
  ) VALUES (
    v_entry_id, v_credit_account_id, 0, NEW.amount, v_history
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. MIGRATE DATA: Create Lines for existing Entries that use Items (if any)
INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
SELECT 
    i.entry_id, 
    i.account_id, 
    i.debit, 
    i.credit, 
    i.history
FROM accounting_entry_items i
JOIN accounting_entries e ON e.id = i.entry_id
WHERE e.entry_type = 'SALDO_ABERTURA'
AND NOT EXISTS (
    SELECT 1 FROM accounting_entry_lines l 
    WHERE l.entry_id = i.entry_id
);

COMMIT;
