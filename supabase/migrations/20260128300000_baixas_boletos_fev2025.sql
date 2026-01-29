-- supabase/migrations/20260128300000_baixas_boletos_fev2025.sql
-- Desmembramento de cobranças agrupadas - Fevereiro 2025 (Competência Janeiro 2025)
-- Dr. Cícero - Guardião Contábil MCP
-- Gerado em: 28/01/2026, 22:20:24

-- Desabilitar triggers temporariamente
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_tenant_id uuid := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_conta_transitoria_id uuid;
  v_entry_id uuid;
  v_conta_cliente_id uuid;
  v_count int := 0;
BEGIN
  -- Buscar conta transitória
  SELECT id INTO v_conta_transitoria_id 
  FROM chart_of_accounts 
  WHERE code = '1.1.9.01' AND tenant_id = v_tenant_id;

  RAISE NOTICE 'Conta Transitória: %', v_conta_transitoria_id;


  -- MARO - AGROPECUARIA E PARTICIPACOES S/A - R$ 2897.90
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200076-6_COB000002' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0417' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-03', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200076-6 - MARO - AGROPECUARIA E PARTICIP', 'boleto_25_200076-6_COB000002', 2897.90, 2897.90, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2897.90, 0, 'Desmembramento COB000002'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 2897.90, 'Recebimento boleto 25/200076-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MUNDIM SA E GUIMARAES ADVOGADOS ASSOCIAD - R$ 2194.11
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200083-9_COB000002' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0418' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-03', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200083-9 - MUNDIM SA E GUIMARAES ADVOGADO', 'boleto_25_200083-9_COB000002', 2194.11, 2194.11, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2194.11, 0, 'Desmembramento COB000002'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 2194.11, 'Recebimento boleto 25/200083-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- HOLDINGS BCS GUIMARAES LTDA - R$ 931.52
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_24_205261-5_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0013' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 24/205261-5 - HOLDINGS BCS GUIMARAES LTDA', 'boleto_24_205261-5_COB000009', 931.52, 931.52, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 931.52, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 931.52, 'Recebimento boleto 24/205261-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- BCS MINAS SERVICOS MEDICOS LTDA - R$ 929.61
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_24_205328-0_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0060' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 24/205328-0 - BCS MINAS SERVICOS MEDICOS LTD', 'boleto_24_205328-0_COB000009', 929.61, 929.61, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 929.61, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 929.61, 'Recebimento boleto 24/205328-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- HOLDINGS BCS GUIMARAES LTDA - R$ 929.61
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_24_205365-4_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0013' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 24/205365-4 - HOLDINGS BCS GUIMARAES LTDA', 'boleto_24_205365-4_COB000009', 929.61, 929.61, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 929.61, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 929.61, 'Recebimento boleto 24/205365-4');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- L F GONCALVES CONFECCOES LTDA - R$ 2276.86
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200064-2_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0358' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200064-2 - L F GONCALVES CONFECCOES LTDA', 'boleto_25_200064-2_COB000009', 2276.86, 2276.86, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2276.86, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 2276.86, 'Recebimento boleto 25/200064-2');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- LAJES MORADA LTDA - R$ 1138.48
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200066-9_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0040' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200066-9 - LAJES MORADA LTDA', 'boleto_25_200066-9_COB000009', 1138.48, 1138.48, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1138.48, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1138.48, 'Recebimento boleto 25/200066-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- LAJES NUNES EIRELI - R$ 3036.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200067-7_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0402' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200067-7 - LAJES NUNES EIRELI', 'boleto_25_200067-7_COB000009', 3036.00, 3036.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 3036.00, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 3036.00, 'Recebimento boleto 25/200067-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MARCUS VINICIUS LEAL PIRES 75208709104 - R$ 152.10
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200073-1_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0416' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200073-1 - MARCUS VINICIUS LEAL PIRES 752', 'boleto_25_200073-1_COB000009', 152.10, 152.10, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 152.10, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 152.10, 'Recebimento boleto 25/200073-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- NUNES MOTA AGROPECUARIA LTDA - R$ 322.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200085-5_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0094' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200085-5 - NUNES MOTA AGROPECUARIA LTDA', 'boleto_25_200085-5_COB000009', 322.50, 322.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 322.50, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 322.50, 'Recebimento boleto 25/200085-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- PATRICIA PEREZ ACESSORIOS PARA NOIVAS LT - R$ 581.04
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200087-1_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0400' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-04', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200087-1 - PATRICIA PEREZ ACESSORIOS PARA', 'boleto_25_200087-1_COB000009', 581.04, 581.04, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 581.04, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 581.04, 'Recebimento boleto 25/200087-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- ADMIR OLIVEIRA ALVES - R$ 766.82
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200009-0_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0401' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200009-0 - ADMIR OLIVEIRA ALVES', 'boleto_25_200009-0_COB000009', 766.82, 766.82, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 766.82, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 766.82, 'Recebimento boleto 25/200009-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- AGROPECUARIA ADM LTDA - R$ 537.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200010-3_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0022' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200010-3 - AGROPECUARIA ADM LTDA', 'boleto_25_200010-3_COB000009', 537.50, 537.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 537.50, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 537.50, 'Recebimento boleto 25/200010-3');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- AGROPECUARIA SCA LTDA - R$ 537.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200011-1_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0026' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200011-1 - AGROPECUARIA SCA LTDA', 'boleto_25_200011-1_COB000009', 537.50, 537.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 537.50, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 537.50, 'Recebimento boleto 25/200011-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- FAZENDA DA TOCA PARTICIPACOES LTDA - R$ 2182.01
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200047-2_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0063' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200047-2 - FAZENDA DA TOCA PARTICIPACOES ', 'boleto_25_200047-2_COB000009', 2182.01, 2182.01, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2182.01, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 2182.01, 'Recebimento boleto 25/200047-2');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- GEANINNE AGROPECUARIA LTDA - R$ 363.15
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200052-9_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0336' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200052-9 - GEANINNE AGROPECUARIA LTDA', 'boleto_25_200052-9_COB000009', 363.15, 363.15, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 363.15, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 363.15, 'Recebimento boleto 25/200052-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- LIVRE VISTORIA VEICULAR LTDA - ME - R$ 603.75
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200070-7_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0054' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200070-7 - LIVRE VISTORIA VEICULAR LTDA -', 'boleto_25_200070-7_COB000009', 603.75, 603.75, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 603.75, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 603.75, 'Recebimento boleto 25/200070-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- R&P AVIACAO COMERCIO IMPORTACAO E EXPORT - R$ 3036.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200093-6_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0419' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200093-6 - R&P AVIACAO COMERCIO IMPORTACA', 'boleto_25_200093-6_COB000009', 3036.00, 3036.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 3036.00, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 3036.00, 'Recebimento boleto 25/200093-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- SAO LUIS INDUSTRIA E COMERCIO DE AGUA MI - R$ 334.97
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200098-7_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0399' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200098-7 - SAO LUIS INDUSTRIA E COMERCIO ', 'boleto_25_200098-7_COB000009', 334.97, 334.97, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 334.97, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 334.97, 'Recebimento boleto 25/200098-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- ABRIGO NOSSO LAR - R$ 1518.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200112-6_COB000009' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0396' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-05', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200112-6 - ABRIGO NOSSO LAR', 'boleto_25_200112-6_COB000009', 1518.00, 1518.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1518.00, 0, 'Desmembramento COB000009'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1518.00, 'Recebimento boleto 25/200112-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- C D C OLIVEIRA - ESTACAO DA ALEGRIA - R$ 1034.97
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200019-7_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0065' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200019-7 - C D C OLIVEIRA - ESTACAO DA AL', 'boleto_25_200019-7_COB000019', 1034.97, 1034.97, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1034.97, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1034.97, 'Recebimento boleto 25/200019-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- CDC PLAYGROUND E BRINQUEDOS LTDA - R$ 603.73
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200026-0_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0062' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200026-0 - CDC PLAYGROUND E BRINQUEDOS LT', 'boleto_25_200026-0_COB000019', 603.73, 603.73, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 603.73, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 603.73, 'Recebimento boleto 25/200026-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- ELETROSOL ENERGIA SOLAR LTDA - R$ 322.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200042-1_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0083' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200042-1 - ELETROSOL ENERGIA SOLAR LTDA', 'boleto_25_200042-1_COB000019', 322.50, 322.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 322.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 322.50, 'Recebimento boleto 25/200042-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- ELETROSOL SOLUCOES EM ENERGIA LTDA - R$ 322.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200043-0_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0363' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200043-0 - ELETROSOL SOLUCOES EM ENERGIA ', 'boleto_25_200043-0_COB000019', 322.50, 322.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 322.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 322.50, 'Recebimento boleto 25/200043-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- EVEREST GESTAO E ADMINISTRACAO DE PROPRI - R$ 1518.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200045-6_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0403' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200045-6 - EVEREST GESTAO E ADMINISTRACAO', 'boleto_25_200045-6_COB000019', 1518.00, 1518.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1518.00, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1518.00, 'Recebimento boleto 25/200045-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- INNOVARE DESPACHANTES LTDA - R$ 537.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200055-3_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0337' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200055-3 - INNOVARE DESPACHANTES LTDA', 'boleto_25_200055-3_COB000019', 537.50, 537.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 537.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 537.50, 'Recebimento boleto 25/200055-3');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- JR SOLUCOES INDUSTRIAIS LTDA - R$ 1518.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200058-8_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.10011' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200058-8 - JR SOLUCOES INDUSTRIAIS LTDA', 'boleto_25_200058-8_COB000019', 1518.00, 1518.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1518.00, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1518.00, 'Recebimento boleto 25/200058-8');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- L.A.R. CONSTRUTORA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200065-0_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0358' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200065-0 - L.A.R. CONSTRUTORA', 'boleto_25_200065-0_COB000019', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200065-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MARCUS ABDULMASSIH DEL PAPA - R$ 172.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200072-3_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0073' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200072-3 - MARCUS ABDULMASSIH DEL PAPA', 'boleto_25_200072-3_COB000019', 172.50, 172.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 172.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 172.50, 'Recebimento boleto 25/200072-3');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- PORTO FINO MAQUINAS LTDA - R$ 537.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200090-1_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0036' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200090-1 - PORTO FINO MAQUINAS LTDA', 'boleto_25_200090-1_COB000019', 537.50, 537.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 537.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 537.50, 'Recebimento boleto 25/200090-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- QUICK COMERCIO DE PECAS PARA VEICULOS LT - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200092-8_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0420' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200092-8 - QUICK COMERCIO DE PECAS PARA V', 'boleto_25_200092-8_COB000019', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200092-8');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- RAMAYOLE CASA DOS SALGADOS EIRELI - ME - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200094-4_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0066' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200094-4 - RAMAYOLE CASA DOS SALGADOS EIR', 'boleto_25_200094-4_COB000019', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200094-4');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- RBC DESPACHANTE LTDA - R$ 537.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200095-2_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0392' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200095-2 - RBC DESPACHANTE LTDA', 'boleto_25_200095-2_COB000019', 537.50, 537.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 537.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 537.50, 'Recebimento boleto 25/200095-2');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- SOLUTTI TECNOLOGIA LTDA - R$ 724.88
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200099-5_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0018' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200099-5 - SOLUTTI TECNOLOGIA LTDA', 'boleto_25_200099-5_COB000019', 724.88, 724.88, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 724.88, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 724.88, 'Recebimento boleto 25/200099-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- TANNUS E MOTA LTDA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200102-9_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0072' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200102-9 - TANNUS E MOTA LTDA', 'boleto_25_200102-9_COB000019', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200102-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- TEREZA CRISTINA DA SILVA PAES FERREIRA - R$ 172.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200103-7_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0081' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200103-7 - TEREZA CRISTINA DA SILVA PAES ', 'boleto_25_200103-7_COB000019', 172.50, 172.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 172.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 172.50, 'Recebimento boleto 25/200103-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- THC LOCACAO DE MAQUINAS LTDA - R$ 537.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200104-5_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0393' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200104-5 - THC LOCACAO DE MAQUINAS LTDA', 'boleto_25_200104-5_COB000019', 537.50, 537.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 537.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 537.50, 'Recebimento boleto 25/200104-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- UPPER DESPACHANTES LTDA - R$ 537.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200107-0_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0394' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200107-0 - UPPER DESPACHANTES LTDA', 'boleto_25_200107-0_COB000019', 537.50, 537.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 537.50, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 537.50, 'Recebimento boleto 25/200107-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- WESLEY MARTINS DE MOURA ME - R$ 766.88
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200111-8_COB000019' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0019' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-06', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200111-8 - WESLEY MARTINS DE MOURA ME', 'boleto_25_200111-8_COB000019', 766.88, 766.88, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 766.88, 0, 'Desmembramento COB000019'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 766.88, 'Recebimento boleto 25/200111-8');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- ALLIANCE EMPREENDIMENTOS LTDA - R$ 1548.51
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200012-0_COB000001' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0027' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-07', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200012-0 - ALLIANCE EMPREENDIMENTOS LTDA', 'boleto_25_200012-0_COB000001', 1548.51, 1548.51, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1548.51, 0, 'Desmembramento COB000001'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1548.51, 'Recebimento boleto 25/200012-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- ACTION SOLUCOES INDUSTRIAIS LTDA - R$ 12143.72
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200008-1_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0334' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200008-1 - ACTION SOLUCOES INDUSTRIAIS LT', 'boleto_25_200008-1_COB000033', 12143.72, 12143.72, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 12143.72, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 12143.72, 'Recebimento boleto 25/200008-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- AMG INDUSTRIA E COMERCIO DE GESSO LTDA - R$ 2322.80
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200014-6_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0030' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200014-6 - AMG INDUSTRIA E COMERCIO DE GE', 'boleto_25_200014-6_COB000033', 2322.80, 2322.80, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2322.80, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 2322.80, 'Recebimento boleto 25/200014-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- ARANTES NEGOCIOS LTDA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200016-2_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0034' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200016-2 - ARANTES NEGOCIOS LTDA', 'boleto_25_200016-2_COB000033', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200016-2');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- CANAL PET DISTRIBUIDORA LTDA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200021-9_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0037' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200021-9 - CANAL PET DISTRIBUIDORA LTDA', 'boleto_25_200021-9_COB000033', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200021-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- CARLA DAIANE CASTRO OLIVEIRA - R$ 162.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200022-7_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0068' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200022-7 - CARLA DAIANE CASTRO OLIVEIRA', 'boleto_25_200022-7_COB000033', 162.00, 162.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 162.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 162.00, 'Recebimento boleto 25/200022-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- CARVALHO E MELO ADM. E PARTIPA AO EIRELI - R$ 301.41
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200024-3_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0405' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200024-3 - CARVALHO E MELO ADM. E PARTIPA', 'boleto_25_200024-3_COB000033', 301.41, 301.41, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 301.41, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 301.41, 'Recebimento boleto 25/200024-3');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- CASA NOVA TINTAS LTDA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200025-1_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0061' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200025-1 - CASA NOVA TINTAS LTDA', 'boleto_25_200025-1_COB000033', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200025-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- COLLOR GEL COMERCIO E INDUSTRIA DE TINTA - R$ 1518.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200030-8_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0406' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200030-8 - COLLOR GEL COMERCIO E INDUSTRI', 'boleto_25_200030-8_COB000033', 1518.00, 1518.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1518.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1518.00, 'Recebimento boleto 25/200030-8');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- COMERCIAL DINIZ EIRELI - ME - R$ 637.80
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200031-6_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0056' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200031-6 - COMERCIAL DINIZ EIRELI - ME', 'boleto_25_200031-6_COB000033', 637.80, 637.80, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 637.80, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 637.80, 'Recebimento boleto 25/200031-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- CONTRONWEB TECNOLOGIA LTDA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200032-4_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0023' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200032-4 - CONTRONWEB TECNOLOGIA LTDA', 'boleto_25_200032-4_COB000033', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200032-4');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- COVALE USINAGEM INDUSTRIA E COMERCIO DE - R$ 1525.86
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200033-2_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0407' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200033-2 - COVALE USINAGEM INDUSTRIA E CO', 'boleto_25_200033-2_COB000033', 1525.86, 1525.86, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1525.86, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1525.86, 'Recebimento boleto 25/200033-2');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- COVAS SERVICOS DE PINTURAS LTDA - R$ 379.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200034-0_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0080' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200034-0 - COVAS SERVICOS DE PINTURAS LTD', 'boleto_25_200034-0_COB000033', 379.50, 379.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 379.50, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 379.50, 'Recebimento boleto 25/200034-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- D ANGE COMERCIO DE BICHO DE PELUCIA LTDA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200036-7_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0398' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200036-7 - D ANGE COMERCIO DE BICHO DE PE', 'boleto_25_200036-7_COB000033', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200036-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- D ANGE2 COMERCIO DE BICHO DE PELUCIA LTD - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200037-5_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0398' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200037-5 - D ANGE2 COMERCIO DE BICHO DE P', 'boleto_25_200037-5_COB000033', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200037-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- DEL PAPA ARQUITETURA LTDA - R$ 577.85
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200038-3_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0043' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200038-3 - DEL PAPA ARQUITETURA LTDA', 'boleto_25_200038-3_COB000033', 577.85, 577.85, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 577.85, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 577.85, 'Recebimento boleto 25/200038-3');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- EXPRESS RIOVERDENSE LTDA - R$ 963.10
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200046-4_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0011' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200046-4 - EXPRESS RIOVERDENSE LTDA', 'boleto_25_200046-4_COB000033', 963.10, 963.10, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 963.10, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 963.10, 'Recebimento boleto 25/200046-4');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- FE CONSULTORIA JURIDICA - R$ 472.06
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200048-0_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0408' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200048-0 - FE CONSULTORIA JURIDICA', 'boleto_25_200048-0_COB000033', 472.06, 472.06, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 472.06, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 472.06, 'Recebimento boleto 25/200048-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- FERNANDA COVAS DO VALE - R$ 379.48
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200049-9_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0091' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200049-9 - FERNANDA COVAS DO VALE', 'boleto_25_200049-9_COB000033', 379.48, 379.48, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 379.48, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 379.48, 'Recebimento boleto 25/200049-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- FORMA COMUNICA AO VISUAL LTDA-ME - R$ 379.48
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200051-0_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0409' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200051-0 - FORMA COMUNICA AO VISUAL LTDA-', 'boleto_25_200051-0_COB000033', 379.48, 379.48, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 379.48, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 379.48, 'Recebimento boleto 25/200051-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- HOKMA ELETROMONTAGEM LTDA - R$ 551.97
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200053-7_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0105' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200053-7 - HOKMA ELETROMONTAGEM LTDA', 'boleto_25_200053-7_COB000033', 551.97, 551.97, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 551.97, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 551.97, 'Recebimento boleto 25/200053-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- JJC PRESTADORA DE SERVICOS LTDA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200056-1_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0100' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200056-1 - JJC PRESTADORA DE SERVICOS LTD', 'boleto_25_200056-1_COB000033', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200056-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- JULIANO SOUZA GARROTE - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200059-6_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0103' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200059-6 - JULIANO SOUZA GARROTE', 'boleto_25_200059-6_COB000033', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200059-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- KOPA REVESTIMENTOS DE MADEIRAS LTDA - R$ 1518.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200061-8_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0039' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200061-8 - KOPA REVESTIMENTOS DE MADEIRAS', 'boleto_25_200061-8_COB000033', 1518.00, 1518.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1518.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1518.00, 'Recebimento boleto 25/200061-8');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- KORSICA COMERCIO ATACADISTA DE PNEUS LTD - R$ 500.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200062-6_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0410' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200062-6 - KORSICA COMERCIO ATACADISTA DE', 'boleto_25_200062-6_COB000033', 500.00, 500.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 500.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 500.00, 'Recebimento boleto 25/200062-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- LEMS HOLDINGS LTDA - R$ 250.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200069-3_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0044' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200069-3 - LEMS HOLDINGS LTDA', 'boleto_25_200069-3_COB000033', 250.00, 250.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 250.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 250.00, 'Recebimento boleto 25/200069-3');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- M L PINHEIRO MILAZZO EIRELI - R$ 1655.93
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200071-5_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0411' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200071-5 - M L PINHEIRO MILAZZO EIRELI', 'boleto_25_200071-5_COB000033', 1655.93, 1655.93, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1655.93, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1655.93, 'Recebimento boleto 25/200071-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MARIO LUCIO PINHEIRO MILAZZO - FAZ - R$ 125.25
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200075-8_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0017' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200075-8 - MARIO LUCIO PINHEIRO MILAZZO -', 'boleto_25_200075-8_COB000033', 125.25, 125.25, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 125.25, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 125.25, 'Recebimento boleto 25/200075-8');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MATA PRAGAS CONTROLE DE PRAGAS LTDA - R$ 3556.72
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200077-4_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0086' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200077-4 - MATA PRAGAS CONTROLE DE PRAGAS', 'boleto_25_200077-4_COB000033', 3556.72, 3556.72, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 3556.72, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 3556.72, 'Recebimento boleto 25/200077-4');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MOTTA COMERCIO DE INFORMATICA LTDA - R$ 767.58
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200082-0_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0412' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200082-0 - MOTTA COMERCIO DE INFORMATICA ', 'boleto_25_200082-0_COB000033', 767.58, 767.58, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 767.58, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 767.58, 'Recebimento boleto 25/200082-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- PREMIER SOLU OES INDUSTRIAIS LTDA - R$ 344.98
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200091-0_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0413' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200091-0 - PREMIER SOLU OES INDUSTRIAIS L', 'boleto_25_200091-0_COB000033', 344.98, 344.98, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 344.98, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 344.98, 'Recebimento boleto 25/200091-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- SUITE MOTEL LTDA ME - R$ 2889.92
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200101-0_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0077' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200101-0 - SUITE MOTEL LTDA ME', 'boleto_25_200101-0_COB000033', 2889.92, 2889.92, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2889.92, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 2889.92, 'Recebimento boleto 25/200101-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- TSD DISTRIBUIDORA DE CARTOES - R$ 4563.02
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200105-3_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0414' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200105-3 - TSD DISTRIBUIDORA DE CARTOES', 'boleto_25_200105-3_COB000033', 4563.02, 4563.02, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 4563.02, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 4563.02, 'Recebimento boleto 25/200105-3');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- UNICAIXAS DESPACHANTE LTDA - R$ 1725.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200106-1_COB000033' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0101' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-11', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200106-1 - UNICAIXAS DESPACHANTE LTDA', 'boleto_25_200106-1_COB000033', 1725.00, 1725.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1725.00, 0, 'Desmembramento COB000033'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1725.00, 'Recebimento boleto 25/200106-1');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- AMAGU FESTAS LTDA - R$ 759.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200003-0_COB000002' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0362' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-12', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200003-0 - AMAGU FESTAS LTDA', 'boleto_25_200003-0_COB000002', 759.00, 759.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 759.00, 0, 'Desmembramento COB000002'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 759.00, 'Recebimento boleto 25/200003-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MARIO CESAR PEREIRA DA SILVA - R$ 860.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200074-0_COB000002' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0075' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-12', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200074-0 - MARIO CESAR PEREIRA DA SILVA', 'boleto_25_200074-0_COB000002', 860.00, 860.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 860.00, 0, 'Desmembramento COB000002'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 860.00, 'Recebimento boleto 25/200074-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- KROVER ENGENHARIA E SERVICOS - R$ 963.10
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200063-4_COB000004' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0404' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-13', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200063-4 - KROVER ENGENHARIA E SERVICOS', 'boleto_25_200063-4_COB000004', 963.10, 963.10, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 963.10, 0, 'Desmembramento COB000004'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 963.10, 'Recebimento boleto 25/200063-4');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MV LG CLINICA VETERINARIA PET FERA LTDA - R$ 586.56
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200084-7_COB000004' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0087' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-13', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200084-7 - MV LG CLINICA VETERINARIA PET ', 'boleto_25_200084-7_COB000004', 586.56, 586.56, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 586.56, 0, 'Desmembramento COB000004'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 586.56, 'Recebimento boleto 25/200084-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- FUTURA AGROPECUARIA  LTDA - R$ 300.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200114-2_COB000004' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0274' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-13', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200114-2 - FUTURA AGROPECUARIA  LTDA', 'boleto_25_200114-2_COB000004', 300.00, 300.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 300.00, 0, 'Desmembramento COB000004'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 300.00, 'Recebimento boleto 25/200114-2');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- HOLDING BOM FUTURO LTDA - R$ 300.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200115-0_COB000004' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0089' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-13', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200115-0 - HOLDING BOM FUTURO LTDA', 'boleto_25_200115-0_COB000004', 300.00, 300.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 300.00, 0, 'Desmembramento COB000004'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 300.00, 'Recebimento boleto 25/200115-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- AMETISTA GESTAO EMPRESARIAL LTDA - R$ 375.73
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200013-8_COB000006' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0029' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-18', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200013-8 - AMETISTA GESTAO EMPRESARIAL LT', 'boleto_25_200013-8_COB000006', 375.73, 375.73, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 375.73, 0, 'Desmembramento COB000006'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 375.73, 'Recebimento boleto 25/200013-8');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- C.R.J MANUTENCAO EM AR CONDICIONADO LTDA - R$ 275.98
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200020-0_COB000006' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.10013' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-18', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200020-0 - C.R.J MANUTENCAO EM AR CONDICI', 'boleto_25_200020-0_COB000006', 275.98, 275.98, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 275.98, 0, 'Desmembramento COB000006'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 275.98, 'Recebimento boleto 25/200020-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- CHRISTIANE RODRIGUES MACHADO LOPES LTDA - R$ 275.98
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200029-4_COB000006' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0352' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-18', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200029-4 - CHRISTIANE RODRIGUES MACHADO L', 'boleto_25_200029-4_COB000006', 275.98, 275.98, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 275.98, 0, 'Desmembramento COB000006'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 275.98, 'Recebimento boleto 25/200029-4');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- LEM ESCOLA DE IDIOMAS LTDA - R$ 375.73
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200068-5_COB000006' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0058' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-18', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200068-5 - LEM ESCOLA DE IDIOMAS LTDA', 'boleto_25_200068-5_COB000006', 375.73, 375.73, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 375.73, 0, 'Desmembramento COB000006'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 375.73, 'Recebimento boleto 25/200068-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- RODRIGO AUGUSTO RODRIGUES LTDA - R$ 275.98
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200097-9_COB000006' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0053' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-18', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200097-9 - RODRIGO AUGUSTO RODRIGUES LTDA', 'boleto_25_200097-9_COB000006', 275.98, 275.98, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 275.98, 0, 'Desmembramento COB000006'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 275.98, 'Recebimento boleto 25/200097-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- STAR EMPORIO DE BEBIDAS LTDA - R$ 709.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200100-2_COB000006' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0055' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-18', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200100-2 - STAR EMPORIO DE BEBIDAS LTDA', 'boleto_25_200100-2_COB000006', 709.50, 709.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 709.50, 0, 'Desmembramento COB000006'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 709.50, 'Recebimento boleto 25/200100-2');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- VR CONSULTORIA LTDA - ME - R$ 165.45
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200110-0_COB000001' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0059' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-19', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200110-0 - VR CONSULTORIA LTDA - ME', 'boleto_25_200110-0_COB000001', 165.45, 165.45, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 165.45, 0, 'Desmembramento COB000001'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 165.45, 'Recebimento boleto 25/200110-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- BCS GOIAS SERVICOS MEDICOS LTDA - R$ 998.55
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200017-0_COB000005' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0050' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-27', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200017-0 - BCS GOIAS SERVICOS MEDICOS LTD', 'boleto_25_200017-0_COB000005', 998.55, 998.55, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 998.55, 0, 'Desmembramento COB000005'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 998.55, 'Recebimento boleto 25/200017-0');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- BCS MINAS SERVICOS MEDICOS LTDA - R$ 998.55
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200018-9_COB000005' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0060' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-27', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200018-9 - BCS MINAS SERVICOS MEDICOS LTD', 'boleto_25_200018-9_COB000005', 998.55, 998.55, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 998.55, 0, 'Desmembramento COB000005'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 998.55, 'Recebimento boleto 25/200018-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- DR BERNARDO GUIMARAES LTDA - R$ 998.55
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200040-5_COB000005' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0355' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-27', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200040-5 - DR BERNARDO GUIMARAES LTDA', 'boleto_25_200040-5_COB000005', 998.55, 998.55, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 998.55, 0, 'Desmembramento COB000005'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 998.55, 'Recebimento boleto 25/200040-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- HOLDINGS BCS GUIMARAES LTDA - R$ 998.55
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200054-5_COB000005' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0013' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-27', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200054-5 - HOLDINGS BCS GUIMARAES LTDA', 'boleto_25_200054-5_COB000005', 998.55, 998.55, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 998.55, 0, 'Desmembramento COB000005'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 998.55, 'Recebimento boleto 25/200054-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- KRYAS CONSTRUCAO E MAQUINAS LTDA - R$ 1551.54
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200113-4_COB000005' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0014' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-27', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200113-4 - KRYAS CONSTRUCAO E MAQUINAS LT', 'boleto_25_200113-4_COB000005', 1551.54, 1551.54, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1551.54, 0, 'Desmembramento COB000005'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1551.54, 'Recebimento boleto 25/200113-4');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- CARRO DE OURO LTDA - R$ 939.44
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200023-5_COB000008' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0074' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-28', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200023-5 - CARRO DE OURO LTDA', 'boleto_25_200023-5_COB000008', 939.44, 939.44, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 939.44, 0, 'Desmembramento COB000008'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 939.44, 'Recebimento boleto 25/200023-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- LAJES MORADA LTDA - R$ 1138.48
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200178-9_COB000008' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0040' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-28', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200178-9 - LAJES MORADA LTDA', 'boleto_25_200178-9_COB000008', 1138.48, 1138.48, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1138.48, 0, 'Desmembramento COB000008'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1138.48, 'Recebimento boleto 25/200178-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- LAJES NUNES EIRELI - R$ 3036.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200179-7_COB000008' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0402' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-28', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200179-7 - LAJES NUNES EIRELI', 'boleto_25_200179-7_COB000008', 3036.00, 3036.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 3036.00, 0, 'Desmembramento COB000008'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 3036.00, 'Recebimento boleto 25/200179-7');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MARO - AGROPECUARIA E PARTICIPACOES S/A - R$ 2897.90
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200188-6_COB000008' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0417' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-28', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200188-6 - MARO - AGROPECUARIA E PARTICIP', 'boleto_25_200188-6_COB000008', 2897.90, 2897.90, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2897.90, 0, 'Desmembramento COB000008'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 2897.90, 'Recebimento boleto 25/200188-6');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- MUNDIM SA E GUIMARAES ADVOGADOS ASSOCIAD - R$ 2194.11
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200193-2_COB000008' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0418' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-28', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200193-2 - MUNDIM SA E GUIMARAES ADVOGADO', 'boleto_25_200193-2_COB000008', 2194.11, 2194.11, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2194.11, 0, 'Desmembramento COB000008'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 2194.11, 'Recebimento boleto 25/200193-2');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- NUNES MOTA AGROPECUARIA LTDA - R$ 322.50
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200195-9_COB000008' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0094' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-28', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200195-9 - NUNES MOTA AGROPECUARIA LTDA', 'boleto_25_200195-9_COB000008', 322.50, 322.50, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 322.50, 0, 'Desmembramento COB000008'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 322.50, 'Recebimento boleto 25/200195-9');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- PET SHOP E CAOPANHIA LTDA - R$ 1518.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200197-5_COB000008' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0031' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-28', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200197-5 - PET SHOP E CAOPANHIA LTDA', 'boleto_25_200197-5_COB000008', 1518.00, 1518.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1518.00, 0, 'Desmembramento COB000008'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 1518.00, 'Recebimento boleto 25/200197-5');
      v_count := v_count + 1;
    END IF;
  END IF;

  -- TAISSA TORMIN MUNDIM - R$ 100.00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'boleto_25_200240-8_COB000008' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '1.1.2.01.0078' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '2025-02-28', '2025-01-01', 'RECEBIMENTO_BOLETO', 'Recebimento boleto 25/200240-8 - TAISSA TORMIN MUNDIM', 'boleto_25_200240-8_COB000008', 100.00, 100.00, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, 100.00, 0, 'Desmembramento COB000008'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, 100.00, 'Recebimento boleto 25/200240-8');
      v_count := v_count + 1;
    END IF;
  END IF;

  RAISE NOTICE 'Processados: % lançamentos', v_count;
END $$;

-- Reabilitar triggers
SET session_replication_role = 'origin';
