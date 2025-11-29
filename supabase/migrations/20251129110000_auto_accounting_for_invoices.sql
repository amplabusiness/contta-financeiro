-- Migration: Automatic Accounting Entries for Invoices
-- Date: 2025-11-29
-- Description: Creates accounting entries automatically when invoices are inserted
--              This replaces the manual "Processar Faturas" step

-- Function to create accounting entry for invoice
CREATE OR REPLACE FUNCTION create_invoice_accounting_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_revenue_account_id UUID;
  v_client_account_id UUID;
  v_entry_id UUID;
  v_client_name TEXT;
  v_competence_date DATE;
  v_entry_date DATE;
BEGIN
  -- Skip if invoice is from opening_balance (those use PL account, not revenue)
  IF NEW.source = 'opening_balance' THEN
    RETURN NEW;
  END IF;

  -- Get client name
  SELECT name INTO v_client_name
  FROM clients
  WHERE id = NEW.client_id;

  -- Get or create revenue account (3.1.1.01)
  SELECT id INTO v_revenue_account_id
  FROM chart_of_accounts
  WHERE code = '3.1.1.01';

  IF v_revenue_account_id IS NULL THEN
    -- Create revenue account hierarchy if needed
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
    VALUES ('3', 'RECEITAS', 'RECEITA', 'CREDORA', 1, false, true)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('3.1', 'RECEITAS OPERACIONAIS', 'RECEITA', 'CREDORA', 2, false, true,
            (SELECT id FROM chart_of_accounts WHERE code = '3'))
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('3.1.1', 'Receita de Honorários', 'RECEITA', 'CREDORA', 3, false, true,
            (SELECT id FROM chart_of_accounts WHERE code = '3.1'))
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('3.1.1.01', 'Honorários Contábeis', 'RECEITA', 'CREDORA', 4, true, true,
            (SELECT id FROM chart_of_accounts WHERE code = '3.1.1'))
    ON CONFLICT (code) DO NOTHING;

    SELECT id INTO v_revenue_account_id
    FROM chart_of_accounts
    WHERE code = '3.1.1.01';
  END IF;

  -- Get or create client account (1.1.2.01.xxx)
  SELECT id INTO v_client_account_id
  FROM chart_of_accounts
  WHERE code LIKE '1.1.2.01.%'
    AND name ILIKE '%' || v_client_name || '%';

  IF v_client_account_id IS NULL THEN
    -- Create client account hierarchy if needed
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
    VALUES ('1', 'ATIVO', 'ATIVO', 'DEVEDORA', 1, false, true)
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('1.1', 'ATIVO CIRCULANTE', 'ATIVO', 'DEVEDORA', 2, false, true,
            (SELECT id FROM chart_of_accounts WHERE code = '1'))
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('1.1.2', 'Créditos a Receber', 'ATIVO', 'DEVEDORA', 3, false, true,
            (SELECT id FROM chart_of_accounts WHERE code = '1.1'))
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('1.1.2.01', 'Clientes a Receber', 'ATIVO', 'DEVEDORA', 4, false, true,
            (SELECT id FROM chart_of_accounts WHERE code = '1.1.2'))
    ON CONFLICT (code) DO NOTHING;

    -- Find next available client account number
    DECLARE
      v_next_code TEXT;
      v_last_num INT;
    BEGIN
      SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '.', 5) AS INT)), 0) + 1
      INTO v_last_num
      FROM chart_of_accounts
      WHERE code LIKE '1.1.2.01.%';

      v_next_code := '1.1.2.01.' || LPAD(v_last_num::TEXT, 3, '0');

      INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
      VALUES (v_next_code, 'Cliente: ' || COALESCE(v_client_name, 'Desconhecido'), 'ATIVO', 'DEVEDORA', 5, true, true,
              (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01'))
      RETURNING id INTO v_client_account_id;
    END;
  END IF;

  -- Determine dates
  v_entry_date := COALESCE(NEW.issue_date, NEW.created_at::DATE, CURRENT_DATE);

  -- Parse competence (format: MM/YYYY or YYYY-MM)
  IF NEW.competence IS NOT NULL THEN
    IF NEW.competence ~ '^\d{2}/\d{4}$' THEN
      -- Format: MM/YYYY
      v_competence_date := (SPLIT_PART(NEW.competence, '/', 2) || '-' || SPLIT_PART(NEW.competence, '/', 1) || '-01')::DATE;
    ELSIF NEW.competence ~ '^\d{4}-\d{2}$' THEN
      -- Format: YYYY-MM
      v_competence_date := (NEW.competence || '-01')::DATE;
    ELSE
      v_competence_date := v_entry_date;
    END IF;
  ELSE
    v_competence_date := v_entry_date;
  END IF;

  -- Check if accounting entry already exists for this invoice
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE reference_type = 'invoice'
      AND reference_id = NEW.id
      AND entry_type = 'receita_honorarios'
  ) THEN
    RETURN NEW;
  END IF;

  -- Create accounting entry
  INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    entry_type,
    description,
    reference_type,
    reference_id,
    total_debit,
    total_credit,
    balanced,
    created_by
  ) VALUES (
    v_entry_date,
    v_competence_date,
    'receita_honorarios',
    'Provisionamento: ' || COALESCE(NEW.description, 'Fatura ' || COALESCE(NEW.invoice_number, NEW.id::TEXT)),
    'invoice',
    NEW.id,
    NEW.amount,
    NEW.amount,
    true,
    NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- Create debit line (Cliente a Receber)
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    description,
    debit,
    credit
  ) VALUES (
    v_entry_id,
    v_client_account_id,
    'D - Provisionamento: ' || COALESCE(NEW.description, 'Fatura'),
    NEW.amount,
    0
  );

  -- Create credit line (Receita de Honorários)
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    description,
    debit,
    credit
  ) VALUES (
    v_entry_id,
    v_revenue_account_id,
    'C - Provisionamento: ' || COALESCE(NEW.description, 'Fatura'),
    0,
    NEW.amount
  );

  -- Create client ledger entry
  INSERT INTO client_ledger (
    client_id,
    transaction_date,
    description,
    debit,
    credit,
    balance,
    reference_type,
    reference_id,
    created_by
  ) VALUES (
    NEW.client_id,
    v_entry_date,
    'Provisionamento: ' || COALESCE(NEW.description, 'Fatura'),
    NEW.amount,
    0,
    0,
    'invoice',
    NEW.id,
    NEW.created_by
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the invoice creation
  RAISE WARNING 'Failed to create accounting entry for invoice %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic accounting on invoice insert
DROP TRIGGER IF EXISTS trg_auto_accounting_invoice ON invoices;
CREATE TRIGGER trg_auto_accounting_invoice
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_accounting_entry();

-- Also create a function to process existing invoices without accounting entries
CREATE OR REPLACE FUNCTION process_invoices_without_accounting()
RETURNS TABLE(processed INT, skipped INT, errors INT) AS $$
DECLARE
  v_invoice RECORD;
  v_processed INT := 0;
  v_skipped INT := 0;
  v_errors INT := 0;
BEGIN
  FOR v_invoice IN
    SELECT i.*
    FROM invoices i
    LEFT JOIN accounting_entries ae ON ae.reference_type = 'invoice'
      AND ae.reference_id = i.id
      AND ae.entry_type = 'receita_honorarios'
    WHERE ae.id IS NULL
      AND i.source IS DISTINCT FROM 'opening_balance'
    ORDER BY i.created_at
    LIMIT 500
  LOOP
    BEGIN
      -- Simulate INSERT to trigger the function
      PERFORM create_invoice_accounting_entry_manual(v_invoice);
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Error processing invoice %: %', v_invoice.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Manual function to process a single invoice (for batch processing)
CREATE OR REPLACE FUNCTION create_invoice_accounting_entry_manual(p_invoice invoices)
RETURNS VOID AS $$
DECLARE
  v_revenue_account_id UUID;
  v_client_account_id UUID;
  v_entry_id UUID;
  v_client_name TEXT;
  v_competence_date DATE;
  v_entry_date DATE;
  v_next_code TEXT;
  v_last_num INT;
BEGIN
  -- Skip if invoice is from opening_balance
  IF p_invoice.source = 'opening_balance' THEN
    RETURN;
  END IF;

  -- Get client name
  SELECT name INTO v_client_name
  FROM clients
  WHERE id = p_invoice.client_id;

  -- Get revenue account
  SELECT id INTO v_revenue_account_id
  FROM chart_of_accounts
  WHERE code = '3.1.1.01';

  IF v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Revenue account 3.1.1.01 not found';
  END IF;

  -- Get or create client account
  SELECT id INTO v_client_account_id
  FROM chart_of_accounts
  WHERE code LIKE '1.1.2.01.%'
    AND name ILIKE '%' || v_client_name || '%';

  IF v_client_account_id IS NULL THEN
    -- Find next available client account number
    SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '.', 5) AS INT)), 0) + 1
    INTO v_last_num
    FROM chart_of_accounts
    WHERE code LIKE '1.1.2.01.%';

    v_next_code := '1.1.2.01.' || LPAD(v_last_num::TEXT, 3, '0');

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES (v_next_code, 'Cliente: ' || COALESCE(v_client_name, 'Desconhecido'), 'ATIVO', 'DEVEDORA', 5, true, true,
            (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01'))
    RETURNING id INTO v_client_account_id;
  END IF;

  -- Determine dates
  v_entry_date := COALESCE(p_invoice.issue_date, p_invoice.created_at::DATE, CURRENT_DATE);

  IF p_invoice.competence IS NOT NULL THEN
    IF p_invoice.competence ~ '^\d{2}/\d{4}$' THEN
      v_competence_date := (SPLIT_PART(p_invoice.competence, '/', 2) || '-' || SPLIT_PART(p_invoice.competence, '/', 1) || '-01')::DATE;
    ELSIF p_invoice.competence ~ '^\d{4}-\d{2}$' THEN
      v_competence_date := (p_invoice.competence || '-01')::DATE;
    ELSE
      v_competence_date := v_entry_date;
    END IF;
  ELSE
    v_competence_date := v_entry_date;
  END IF;

  -- Check if already exists
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE reference_type = 'invoice'
      AND reference_id = p_invoice.id
      AND entry_type = 'receita_honorarios'
  ) THEN
    RETURN;
  END IF;

  -- Create accounting entry
  INSERT INTO accounting_entries (
    entry_date, competence_date, entry_type, description,
    reference_type, reference_id, total_debit, total_credit, balanced, created_by
  ) VALUES (
    v_entry_date, v_competence_date, 'receita_honorarios',
    'Provisionamento: ' || COALESCE(p_invoice.description, 'Fatura ' || COALESCE(p_invoice.invoice_number, p_invoice.id::TEXT)),
    'invoice', p_invoice.id, p_invoice.amount, p_invoice.amount, true, p_invoice.created_by
  ) RETURNING id INTO v_entry_id;

  -- Create lines
  INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
  VALUES
    (v_entry_id, v_client_account_id, 'D - Provisionamento', p_invoice.amount, 0),
    (v_entry_id, v_revenue_account_id, 'C - Provisionamento', 0, p_invoice.amount);

  -- Create client ledger entry
  INSERT INTO client_ledger (client_id, transaction_date, description, debit, credit, balance, reference_type, reference_id, created_by)
  VALUES (p_invoice.client_id, v_entry_date, 'Provisionamento', p_invoice.amount, 0, 0, 'invoice', p_invoice.id, p_invoice.created_by);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_invoice_accounting_entry() TO authenticated;
GRANT EXECUTE ON FUNCTION create_invoice_accounting_entry_manual(invoices) TO authenticated;
GRANT EXECUTE ON FUNCTION process_invoices_without_accounting() TO authenticated;

COMMENT ON FUNCTION create_invoice_accounting_entry() IS 'Automatically creates accounting entry when invoice is inserted';
COMMENT ON FUNCTION process_invoices_without_accounting() IS 'Process existing invoices that dont have accounting entries';
