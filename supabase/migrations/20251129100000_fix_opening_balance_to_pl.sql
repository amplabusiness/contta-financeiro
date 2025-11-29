-- Migration: Fix Opening Balance entries to use PL instead of Revenue
-- Date: 2025-11-29
-- Description: Opening balance was incorrectly crediting Revenue (3.1.1.01).
--              It should credit Patrimônio Líquido (5.2.1.02 - Saldos de Abertura)
--              because opening balance represents assets from previous periods,
--              not current period revenue.

-- Step 1: Create PL accounts if they don't exist
DO $$
DECLARE
  v_parent_id UUID;
BEGIN
  -- 5 - PATRIMÔNIO LÍQUIDO
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
  VALUES ('5', 'PATRIMÔNIO LÍQUIDO', 'PATRIMONIO_LIQUIDO', 'CREDORA', 1, false, true)
  ON CONFLICT (code) DO NOTHING;

  -- Get parent ID for 5.1
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5';

  -- 5.1 - CAPITAL SOCIAL
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.1', 'CAPITAL SOCIAL', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- Get parent ID for 5.1.1
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.1';

  -- 5.1.1 - Capital Integralizado
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.1.1', 'Capital Integralizado', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- Get parent ID for 5.1.1.01
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.1.1';

  -- 5.1.1.01 - Capital Social
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.1.1.01', 'Capital Social', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- Get parent ID for 5.2
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5';

  -- 5.2 - LUCROS OU PREJUÍZOS ACUMULADOS
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.2', 'LUCROS OU PREJUÍZOS ACUMULADOS', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- Get parent ID for 5.2.1
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.2';

  -- 5.2.1 - Resultados Acumulados
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.2.1', 'Resultados Acumulados', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- Get parent ID for 5.2.1.01 and 5.2.1.02
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.2.1';

  -- 5.2.1.01 - Lucros Acumulados
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.2.1.01', 'Lucros Acumulados', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 5.2.1.02 - Saldos de Abertura
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.2.1.02', 'Saldos de Abertura', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  RAISE NOTICE 'PL accounts created successfully';
END $$;

-- Step 2: Fix existing opening balance entries
-- Update credit lines that incorrectly point to Revenue (3.1.1.01)
-- to point to Saldos de Abertura (5.2.1.02) for opening_balance entries
DO $$
DECLARE
  v_revenue_account_id UUID;
  v_pl_account_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Get Revenue account ID (3.1.1.01)
  SELECT id INTO v_revenue_account_id
  FROM chart_of_accounts
  WHERE code = '3.1.1.01';

  -- Get PL account ID (5.2.1.02)
  SELECT id INTO v_pl_account_id
  FROM chart_of_accounts
  WHERE code = '5.2.1.02';

  IF v_revenue_account_id IS NULL THEN
    RAISE NOTICE 'Revenue account 3.1.1.01 not found - no entries to fix';
    RETURN;
  END IF;

  IF v_pl_account_id IS NULL THEN
    RAISE EXCEPTION 'PL account 5.2.1.02 not found - migration failed';
  END IF;

  -- Update the credit lines for opening_balance entries
  UPDATE accounting_entry_lines ael
  SET account_id = v_pl_account_id,
      description = REPLACE(description, 'C - Saldo de Abertura', 'C - Saldo de Abertura (PL)')
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
    AND ae.reference_type = 'opening_balance'
    AND ael.account_id = v_revenue_account_id
    AND ael.credit > 0;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RAISE NOTICE 'Fixed % opening balance entries (moved from Revenue to PL)', v_updated_count;
END $$;

-- Step 3: Verify the fix
DO $$
DECLARE
  v_wrong_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_wrong_count
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ael.entry_id = ae.id
  JOIN chart_of_accounts coa ON ael.account_id = coa.id
  WHERE ae.reference_type = 'opening_balance'
    AND coa.code = '3.1.1.01'
    AND ael.credit > 0;

  IF v_wrong_count > 0 THEN
    RAISE WARNING 'Still have % opening balance entries incorrectly pointing to Revenue', v_wrong_count;
  ELSE
    RAISE NOTICE 'All opening balance entries are now correctly pointing to PL';
  END IF;
END $$;
