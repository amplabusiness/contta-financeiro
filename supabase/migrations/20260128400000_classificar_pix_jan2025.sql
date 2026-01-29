-- Migration: Classificar PIX de Janeiro/2025
-- Data: 2026-01-28
-- Descrição: Classifica os PIX recebidos em janeiro/2025 como receita de honorários
-- Os PIX estão na conta transitória e precisam ser classificados como receita
-- Lançamento: D Transitória (1.1.9.01) / C Receita Honorários (3.1.1.01)

-- Desabilitar RLS para esta operação
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_conta_transitoria_id UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
  v_conta_honorarios_id UUID := '3273fd5b-a16f-4a10-944e-55c8cb27f363';
  v_entry_id UUID;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== CLASSIFICAÇÃO PIX JANEIRO 2025 ===';

  -- 1. ACTION SOLUCOES - R$ 74.761,78 (2,85% faturamento)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_ACTION_74761' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-21', '2025-01-21', 'NORMAL', 'Classificação PIX ACTION SOLUCOES - Honorários 2,85% faturamento', 'PIX_CLASS_ACTION_74761', 74761.78, 74761.78, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 74761.78, 0, 'Classificação PIX ACTION SOLUCOES'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 74761.78, 'Receita Honorários ACTION SOLUCOES 2,85%');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: ACTION SOLUCOES R$ 74.761,78';
  END IF;

  -- 2. ACTION SOLUCOES - R$ 70.046,90 (2,85% faturamento)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_ACTION_70046' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-14', '2025-01-14', 'NORMAL', 'Classificação PIX ACTION SOLUCOES - Honorários 2,85% faturamento', 'PIX_CLASS_ACTION_70046', 70046.90, 70046.90, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 70046.90, 0, 'Classificação PIX ACTION SOLUCOES'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 70046.90, 'Receita Honorários ACTION SOLUCOES 2,85%');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: ACTION SOLUCOES R$ 70.046,90';
  END IF;

  -- 3. MATA PRAGAS - R$ 29.660,14 (2,85% faturamento)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_MATAPRAGAS_29660' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-21', '2025-01-21', 'NORMAL', 'Classificação PIX MATA PRAGAS - Honorários 2,85% faturamento', 'PIX_CLASS_MATAPRAGAS_29660', 29660.14, 29660.14, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 29660.14, 0, 'Classificação PIX MATA PRAGAS'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 29660.14, 'Receita Honorários MATA PRAGAS 2,85%');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: MATA PRAGAS R$ 29.660,14';
  END IF;

  -- 4. JULIANA PERILLO (Agropecuárias EDSON) - R$ 4.043,05
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_JULIANA_4043' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-22', '2025-01-22', 'NORMAL', 'Classificação PIX JULIANA PERILLO - Honorários Agropecuárias EDSON DE SÁ', 'PIX_CLASS_JULIANA_4043', 4043.05, 4043.05, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 4043.05, 0, 'Classificação PIX JULIANA PERILLO'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 4043.05, 'Receita Honorários Agropecuárias EDSON DE SÁ');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: JULIANA PERILLO R$ 4.043,05';
  END IF;

  -- 5. ENZO DE AQUINO (Crystal/ECD) - R$ 4.000,00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_ENZO_4000' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-08', '2025-01-08', 'NORMAL', 'Classificação PIX ENZO DE AQUINO - Honorários CRYSTAL/ECD', 'PIX_CLASS_ENZO_4000', 4000.00, 4000.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 4000.00, 0, 'Classificação PIX ENZO DE AQUINO'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 4000.00, 'Receita Honorários CRYSTAL/ECD');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: ENZO DE AQUINO R$ 4.000,00';
  END IF;

  -- 6. ENZO DE AQUINO (Crystal/ECD) - R$ 1.718,81
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_ENZO_1718' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-30', '2025-01-30', 'NORMAL', 'Classificação PIX ENZO DE AQUINO - Honorários CRYSTAL/ECD', 'PIX_CLASS_ENZO_1718', 1718.81, 1718.81, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 1718.81, 0, 'Classificação PIX ENZO DE AQUINO'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 1718.81, 'Receita Honorários CRYSTAL/ECD');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: ENZO DE AQUINO R$ 1.718,81';
  END IF;

  -- 7. EMILIA GONCALVES (L.F. Confecções) - R$ 2.118,00 (1ª)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_EMILIA_2118_01' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-06', '2025-01-06', 'NORMAL', 'Classificação PIX EMILIA GONCALVES - Honorários L.F. CONFECCOES', 'PIX_CLASS_EMILIA_2118_01', 2118.00, 2118.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2118.00, 0, 'Classificação PIX EMILIA GONCALVES'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 2118.00, 'Receita Honorários L.F. GONCALVES CONFECCOES');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: EMILIA GONCALVES R$ 2.118,00 (1)';
  END IF;

  -- 8. EMILIA GONCALVES (L.F. Confecções) - R$ 2.118,00 (2ª)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_EMILIA_2118_02' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-20', '2025-01-20', 'NORMAL', 'Classificação PIX EMILIA GONCALVES - Honorários L.F. CONFECCOES', 'PIX_CLASS_EMILIA_2118_02', 2118.00, 2118.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2118.00, 0, 'Classificação PIX EMILIA GONCALVES'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 2118.00, 'Receita Honorários L.F. GONCALVES CONFECCOES');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: EMILIA GONCALVES R$ 2.118,00 (2)';
  END IF;

  -- 9. IVAIR GONCALVES (Mineração Serrano) - R$ 2.826,00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_IVAIR_2826' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-14', '2025-01-14', 'NORMAL', 'Classificação PIX IVAIR GONCALVES - Honorários MINERAÇÃO SERRANO', 'PIX_CLASS_IVAIR_2826', 2826.00, 2826.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 2826.00, 0, 'Classificação PIX IVAIR GONCALVES'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 2826.00, 'Receita Honorários MINERAÇÃO SERRANO');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: IVAIR GONCALVES R$ 2.826,00';
  END IF;

  -- 10. CANAL PET - R$ 706,00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_CANALPET_706' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-23', '2025-01-23', 'NORMAL', 'Classificação PIX CANAL PET - Honorários', 'PIX_CLASS_CANALPET_706', 706.00, 706.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 706.00, 0, 'Classificação PIX CANAL PET'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 706.00, 'Receita Honorários CANAL PET');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: CANAL PET R$ 706,00';
  END IF;

  -- 11. A.I EMPREENDIMENTOS (Grupo) - R$ 375,00 (1ª semana)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_AI_375_01' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-06', '2025-01-06', 'NORMAL', 'Classificação PIX A.I EMPREENDIMENTOS - Honorários Grupo (A.I/P.A./CAGI/Cleiton/Gisele)', 'PIX_CLASS_AI_375_01', 375.00, 375.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 375.00, 0, 'Classificação PIX A.I EMPREENDIMENTOS'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 375.00, 'Receita Honorários Grupo A.I EMPREENDIMENTOS');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: A.I EMPREENDIMENTOS R$ 375,00 (1)';
  END IF;

  -- 12. A.I EMPREENDIMENTOS (Grupo) - R$ 375,00 (2ª semana)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_AI_375_02' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-13', '2025-01-13', 'NORMAL', 'Classificação PIX A.I EMPREENDIMENTOS - Honorários Grupo (A.I/P.A./CAGI/Cleiton/Gisele)', 'PIX_CLASS_AI_375_02', 375.00, 375.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 375.00, 0, 'Classificação PIX A.I EMPREENDIMENTOS'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 375.00, 'Receita Honorários Grupo A.I EMPREENDIMENTOS');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: A.I EMPREENDIMENTOS R$ 375,00 (2)';
  END IF;

  -- 13. A.I EMPREENDIMENTOS (Grupo) - R$ 375,00 (3ª semana)
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_AI_375_03' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-20', '2025-01-20', 'NORMAL', 'Classificação PIX A.I EMPREENDIMENTOS - Honorários Grupo (A.I/P.A./CAGI/Cleiton/Gisele)', 'PIX_CLASS_AI_375_03', 375.00, 375.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 375.00, 0, 'Classificação PIX A.I EMPREENDIMENTOS'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 375.00, 'Receita Honorários Grupo A.I EMPREENDIMENTOS');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: A.I EMPREENDIMENTOS R$ 375,00 (3)';
  END IF;

  -- 14. PAULA MILHOMEM (Restaurante IUVACI) - R$ 200,00
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_PAULA_200' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-27', '2025-01-27', 'NORMAL', 'Classificação PIX PAULA MILHOMEM - Honorários RESTAURANTE IUVACI (semanal)', 'PIX_CLASS_PAULA_200', 200.00, 200.00, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 200.00, 0, 'Classificação PIX PAULA MILHOMEM'),
      (v_tenant_id, v_entry_id, v_conta_honorarios_id, 0, 200.00, 'Receita Honorários RESTAURANTE IUVACI');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: PAULA MILHOMEM R$ 200,00';
  END IF;

  -- 15. TAYLANE BELLE FERREIRA (Reembolso de multa) - R$ 6,03
  -- Este vai para Outras Receitas (4.1.9.01), não honorários
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = 'PIX_CLASS_TAYLANE_6' AND tenant_id = v_tenant_id) THEN
    INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
    VALUES (v_tenant_id, '2025-01-20', '2025-01-20', 'NORMAL', 'Classificação PIX TAYLANE BELLE - Reembolso de multa (funcionária)', 'PIX_CLASS_TAYLANE_6', 6.03, 6.03, true)
    RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description)
    VALUES 
      (v_tenant_id, v_entry_id, v_conta_transitoria_id, 6.03, 0, 'Classificação PIX TAYLANE BELLE - Reembolso'),
      (v_tenant_id, v_entry_id, '5f5dc029-0a64-4fa1-b555-eef16754bd05', 0, 6.03, 'Reembolso de multa - TAYLANE BELLE FERREIRA');
    v_count := v_count + 1;
    RAISE NOTICE 'Criado: TAYLANE BELLE (Reembolso) R$ 6,03';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== RESUMO ===';
  RAISE NOTICE 'Classificações criadas: %', v_count;
  RAISE NOTICE 'Total classificado: R$ 193.329,71';
  
END $$;

-- Reabilitar RLS
SET session_replication_role = 'origin';

-- Verificar saldo da conta transitória após classificação
SELECT 
  'Conta Transitória 1.1.9.01' as conta,
  SUM(ael.debit) as total_debito,
  SUM(ael.credit) as total_credito,
  SUM(ael.credit) - SUM(ael.debit) as saldo
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
WHERE ael.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
  AND ae.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31';
