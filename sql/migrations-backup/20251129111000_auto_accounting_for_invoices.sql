-- Migration: Automatic Accounting Entries for Invoices
-- Date: 2025-11-29
-- Description: Creates accounting entries automatically when invoices are inserted
--              Uses due_date and competence columns (correct for invoices table)

-- Function to create accounting entry for a single invoice (for trigger)
CREATE OR REPLACE FUNCTION create_invoice_accounting_entry()
RETURNS TRIGGER AS $$
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
  -- Get client name
  SELECT name INTO v_client_name FROM clients WHERE id = NEW.client_id;

  -- Get revenue account (3.1.1.01)
  SELECT id INTO v_revenue_account_id FROM chart_of_accounts WHERE code = '3.1.1.01';
  IF v_revenue_account_id IS NULL THEN
    RAISE WARNING 'Revenue account 3.1.1.01 not found, skipping accounting entry';
    RETURN NEW;
  END IF;

  -- Get or create client account (1.1.2.01.xxx)
  SELECT id INTO v_client_account_id
  FROM chart_of_accounts
  WHERE code LIKE '1.1.2.01.%' AND name ILIKE '%' || v_client_name || '%';

  IF v_client_account_id IS NULL THEN
    -- Find next available client account number
    SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '.', 5) AS INT)), 0) + 1
    INTO v_last_num FROM chart_of_accounts WHERE code LIKE '1.1.2.01.%';

    v_next_code := '1.1.2.01.' || LPAD(v_last_num::TEXT, 3, '0');

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES (v_next_code, 'Cliente: ' || COALESCE(v_client_name, 'Desconhecido'), 'ATIVO', 'DEVEDORA', 5, true, true,
            (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01'))
    RETURNING id INTO v_client_account_id;
  END IF;

  -- Determine entry date (use due_date or created_at)
  v_entry_date := COALESCE(NEW.due_date, NEW.created_at::DATE, CURRENT_DATE);

  -- Parse competence (format: MM/YYYY or YYYY-MM)
  IF NEW.competence IS NOT NULL AND NEW.competence ~ '^\d{2}/\d{4}$' THEN
    v_competence_date := (SPLIT_PART(NEW.competence, '/', 2) || '-' || SPLIT_PART(NEW.competence, '/', 1) || '-01')::DATE;
  ELSIF NEW.competence IS NOT NULL AND NEW.competence ~ '^\d{4}-\d{2}$' THEN
    v_competence_date := (NEW.competence || '-01')::DATE;
  ELSE
    v_competence_date := v_entry_date;
  END IF;

  -- Check if accounting entry already exists for this invoice
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE reference_type = 'invoice' AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Create accounting entry
  INSERT INTO accounting_entries (
    entry_date, competence_date, entry_type, description,
    reference_type, reference_id, total_debit, total_credit, balanced, created_by
  ) VALUES (
    v_entry_date, v_competence_date, 'receita_honorarios',
    'Honorários: ' || COALESCE(v_client_name, 'Cliente') || ' - ' || NEW.competence,
    'invoice', NEW.id, NEW.amount, NEW.amount, true, NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- Create debit line (Cliente a Receber)
  INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
  VALUES (v_entry_id, v_client_account_id, 'D - ' || v_client_name, NEW.amount, 0);

  -- Create credit line (Receita de Honorários)
  INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
  VALUES (v_entry_id, v_revenue_account_id, 'C - Receita Honorários', 0, NEW.amount);

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

-- Function to batch process existing invoices without accounting entries
CREATE OR REPLACE FUNCTION process_invoices_without_accounting()
RETURNS TABLE(processed INT, skipped INT, errors INT) AS $$
DECLARE
  v_invoice RECORD;
  v_entry_id UUID;
  v_client_account_id UUID;
  v_revenue_account_id UUID;
  v_competence_date DATE;
  v_processed INT := 0;
  v_skipped INT := 0;
  v_errors INT := 0;
BEGIN
  -- Get revenue account
  SELECT id INTO v_revenue_account_id FROM chart_of_accounts WHERE code = '3.1.1.01';

  IF v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Revenue account 3.1.1.01 not found';
  END IF;

  FOR v_invoice IN
    SELECT i.*, c.name as client_name
    FROM invoices i
    JOIN clients c ON i.client_id = c.id
    LEFT JOIN accounting_entries ae ON ae.reference_id = i.id AND ae.reference_type = 'invoice'
    WHERE ae.id IS NULL
    LIMIT 500
  LOOP
    BEGIN
      -- Get client account
      SELECT id INTO v_client_account_id FROM chart_of_accounts
      WHERE code LIKE '1.1.2.01.%' AND name ILIKE '%' || v_invoice.client_name || '%' LIMIT 1;

      IF v_client_account_id IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Parse competence date
      IF v_invoice.competence ~ '^\d{2}/\d{4}$' THEN
        v_competence_date := (SPLIT_PART(v_invoice.competence, '/', 2) || '-' || SPLIT_PART(v_invoice.competence, '/', 1) || '-01')::DATE;
      ELSE
        v_competence_date := COALESCE(v_invoice.due_date, CURRENT_DATE);
      END IF;

      -- Create entry
      INSERT INTO accounting_entries (entry_date, competence_date, entry_type, description, reference_type, reference_id, total_debit, total_credit, balanced, created_by)
      VALUES (COALESCE(v_invoice.due_date, CURRENT_DATE), v_competence_date, 'receita_honorarios',
              'Honorários: ' || v_invoice.client_name || ' - ' || v_invoice.competence,
              'invoice', v_invoice.id, v_invoice.amount, v_invoice.amount, true, v_invoice.created_by)
      RETURNING id INTO v_entry_id;

      -- Create lines
      INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
      VALUES
        (v_entry_id, v_client_account_id, 'D - ' || v_invoice.client_name, v_invoice.amount, 0),
        (v_entry_id, v_revenue_account_id, 'C - Receita Honorários', 0, v_invoice.amount);

      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Error processing invoice %: %', v_invoice.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_invoice_accounting_entry() TO authenticated;
GRANT EXECUTE ON FUNCTION process_invoices_without_accounting() TO authenticated;

COMMENT ON FUNCTION create_invoice_accounting_entry() IS 'Trigger function: creates accounting entry when invoice is inserted';
COMMENT ON FUNCTION process_invoices_without_accounting() IS 'Batch process existing invoices without accounting entries (max 500 per call)';
