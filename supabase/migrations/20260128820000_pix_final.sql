-- Migration: Reclassificar PIX Janeiro 2025
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_tenant UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_trans UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
  v_hon UUID := '3273fd5b-a16f-4a10-944e-55c8cb27f363';
  v_id UUID;
  v_cnt INT := 0;
BEGIN
  -- 1. ACTION 74761.78
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_ACTION_74761' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-21', '2025-01-21', 'NORMAL', 'PIX ACTION', 'PIX_CLASS_ACTION_74761', 74761.78, 74761.78, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 74761.78, 0, 'PIX ACTION'),
           (v_tenant, v_id, v_hon, 0, 74761.78, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 2. ACTION 70046.90
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_ACTION_70046' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-14', '2025-01-14', 'NORMAL', 'PIX ACTION', 'PIX_CLASS_ACTION_70046', 70046.90, 70046.90, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 70046.90, 0, 'PIX ACTION'),
           (v_tenant, v_id, v_hon, 0, 70046.90, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 3. G3 31253.06
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_G3_31253' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-10', '2025-01-10', 'NORMAL', 'PIX G3', 'PIX_CLASS_G3_31253', 31253.06, 31253.06, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 31253.06, 0, 'PIX G3'),
           (v_tenant, v_id, v_hon, 0, 31253.06, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 4. ESSER 8000.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_ESSER_8000' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-03', '2025-01-03', 'NORMAL', 'PIX ESSER', 'PIX_CLASS_ESSER_8000', 8000.00, 8000.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 8000.00, 0, 'PIX ESSER'),
           (v_tenant, v_id, v_hon, 0, 8000.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 5. ESSER 2000.00 (13)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_ESSER_2000' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-13', '2025-01-13', 'NORMAL', 'PIX ESSER', 'PIX_CLASS_ESSER_2000', 2000.00, 2000.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 2000.00, 0, 'PIX ESSER'),
           (v_tenant, v_id, v_hon, 0, 2000.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 6. ESSER 2000.00 (20)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_ESSER_2000_2' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-20', '2025-01-20', 'NORMAL', 'PIX ESSER', 'PIX_CLASS_ESSER_2000_2', 2000.00, 2000.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 2000.00, 0, 'PIX ESSER'),
           (v_tenant, v_id, v_hon, 0, 2000.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 7. FABY 1461.19
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_FABY_1461' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-23', '2025-01-23', 'NORMAL', 'PIX FABY', 'PIX_CLASS_FABY_1461', 1461.19, 1461.19, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 1461.19, 0, 'PIX FABY'),
           (v_tenant, v_id, v_hon, 0, 1461.19, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 8. FABY 1206.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_FABY_1206' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-14', '2025-01-14', 'NORMAL', 'PIX FABY', 'PIX_CLASS_FABY_1206', 1206.00, 1206.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 1206.00, 0, 'PIX FABY'),
           (v_tenant, v_id, v_hon, 0, 1206.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 9. AI 375.00 (06)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_AI_375_01' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-06', '2025-01-06', 'NORMAL', 'PIX AI', 'PIX_CLASS_AI_375_01', 375.00, 375.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 375.00, 0, 'PIX AI'),
           (v_tenant, v_id, v_hon, 0, 375.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 10. AI 375.00 (27)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_AI_375_04' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-27', '2025-01-27', 'NORMAL', 'PIX AI', 'PIX_CLASS_AI_375_04', 375.00, 375.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 375.00, 0, 'PIX AI'),
           (v_tenant, v_id, v_hon, 0, 375.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 11. SERGIO 650.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_SERGIOFILHO_650' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-09', '2025-01-09', 'NORMAL', 'PIX SERGIO', 'PIX_CLASS_SERGIOFILHO_650', 650.00, 650.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 650.00, 0, 'PIX SERGIO'),
           (v_tenant, v_id, v_hon, 0, 650.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 12. AI 375.00 (13)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_AI_375_02' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-13', '2025-01-13', 'NORMAL', 'PIX AI', 'PIX_CLASS_AI_375_02', 375.00, 375.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 375.00, 0, 'PIX AI'),
           (v_tenant, v_id, v_hon, 0, 375.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 13. AI 375.00 (20)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_AI_375_03' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-20', '2025-01-20', 'NORMAL', 'PIX AI', 'PIX_CLASS_AI_375_03', 375.00, 375.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 375.00, 0, 'PIX AI'),
           (v_tenant, v_id, v_hon, 0, 375.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 14. PAULA 200.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_PAULA_200' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-27', '2025-01-27', 'NORMAL', 'PIX PAULA', 'PIX_CLASS_PAULA_200', 200.00, 200.00, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 200.00, 0, 'PIX PAULA'),
           (v_tenant, v_id, v_hon, 0, 200.00, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  -- 15. TAYLANE 6.03
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code='PIX_CLASS_TAYLANE_6' AND tenant_id=v_tenant) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant, '2025-01-20', '2025-01-20', 'NORMAL', 'PIX TAYLANE', 'PIX_CLASS_TAYLANE_6', 6.03, 6.03, true)
    RETURNING id INTO v_id;
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES (v_tenant, v_id, v_trans, 6.03, 0, 'PIX TAYLANE'),
           (v_tenant, v_id, v_hon, 0, 6.03, 'Receita');
    v_cnt := v_cnt + 1;
  END IF;

  RAISE NOTICE 'Criadas % classificacoes PIX (Total R$ 193.329,71)', v_cnt;
END $$;

SET session_replication_role = 'origin';

-- Verificar saldo
SELECT 
  'TRANSITORIA JAN/2025' as conta,
  COALESCE(SUM(CASE WHEN source = 'items' THEN credit ELSE 0 END), 0) as creditos_items,
  COALESCE(SUM(CASE WHEN source = 'items' THEN debit ELSE 0 END), 0) as debitos_items,
  COALESCE(SUM(CASE WHEN source = 'lines' THEN credit ELSE 0 END), 0) as creditos_lines,
  COALESCE(SUM(CASE WHEN source = 'lines' THEN debit ELSE 0 END), 0) as debitos_lines,
  COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) as saldo
FROM (
  SELECT 'items' as source, i.credit, i.debit
  FROM accounting_entry_items i
  JOIN accounting_entries e ON e.id = i.entry_id
  WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND i.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  UNION ALL
  SELECT 'lines' as source, l.credit, l.debit
  FROM accounting_entry_lines l
  JOIN accounting_entries e ON e.id = l.entry_id
  WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
) t;
