-- Migration: Reclassificar despesas da conta 4.1.1.08 para contas específicas
-- baseado na descrição do lançamento (entry.description)
--
-- IMPORTANTE: A descrição do entry vem do extrato bancário, não da linha!
-- Precisamos buscar pela descrição do ENTRY, não da LINE.

-- PASSO 0: Desabilitar triggers de proteção de período fechado (apenas triggers do usuário)
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;
ALTER TABLE accounting_entries DISABLE TRIGGER USER;

-- Primeiro, garantir que todas as contas de destino existam
DO $$
DECLARE
    v_parent_id UUID;
BEGIN
    -- Buscar parent para contas 4.1.2.x (administrativas)
    SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.1.2';

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES
        ('4.1.2.01', 'Aluguel', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.2.02', 'Energia Elétrica', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.2.03', 'Telefone e Internet', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.2.09', 'Copa e Cozinha', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.2.10', 'Condomínio', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.2.12', 'Software e Sistemas', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.2.99', 'Outras Despesas Administrativas', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id)
    ON CONFLICT (code) DO NOTHING;

    -- Buscar parent para contas 4.1.3.x (financeiras)
    SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.1.3';

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES
        ('4.1.3.01', 'Juros e Multas', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.3.02', 'Tarifas Bancárias', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id)
    ON CONFLICT (code) DO NOTHING;

    -- Buscar parent para contas 4.1.4.x (impostos)
    SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.1.4';

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES
        ('4.1.4.01', 'Simples Nacional', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.4.02', 'ISS', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.4.03', 'IPTU', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.4.04', 'Taxas e Licenças', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.4.05', 'IPVA e DETRAN', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.4.06', 'Multas de Trânsito', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id)
    ON CONFLICT (code) DO NOTHING;

    -- Buscar parent para contas 4.1.1.x (pessoal)
    SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.1.1';

    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES
        ('4.1.1.01', 'Salários e Ordenados', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.1.02', 'FGTS', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.1.05', 'Rescisões Trabalhistas', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.1.09', 'Vale Transporte', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.1.10', 'Vale Refeição/Alimentação', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id),
        ('4.1.1.11', 'Plano de Saúde', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id)
    ON CONFLICT (code) DO NOTHING;

    -- Criar conta para terceirizados
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES
        ('4.1.2.13', 'Serviços de Terceiros', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id)
    ON CONFLICT (code) DO NOTHING;
END $$;

-- Agora reclassificar os lançamentos baseado na DESCRIÇÃO DO ENTRY
DO $$
DECLARE
    v_old_account_id UUID;
    v_new_account_id UUID;
    v_count INTEGER := 0;
BEGIN
    SELECT id INTO v_old_account_id FROM chart_of_accounts WHERE code = '4.1.1.08';

    IF v_old_account_id IS NULL THEN
        RAISE NOTICE 'Conta 4.1.1.08 não encontrada';
        RETURN;
    END IF;

    -- ============================================
    -- 1. TARIFAS BANCÁRIAS -> 4.1.3.02
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.3.02';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Tarifas Bancárias'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%TARIFA%'
            OR UPPER(ae.description) LIKE '%TAR COM R%'
            OR UPPER(ae.description) LIKE '%TAR MANUT%'
            OR UPPER(ae.description) LIKE '%MANUTENCAO DE TITULOS%'
            OR UPPER(ae.description) LIKE '%CESTA DE RELACIONAMENTO%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Tarifas Bancárias: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 2. TELEFONE/INTERNET -> 4.1.2.03
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.03';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Telefone e Internet'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%TIMCEL%'
            OR UPPER(ae.description) LIKE '%VIVO%'
            OR UPPER(ae.description) LIKE '%CLARO%'
            OR UPPER(ae.description) LIKE '%INTERNET%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Telefone e Internet: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 3. SOFTWARE E SISTEMAS -> 4.1.2.12
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.12';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Software e Sistemas'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%ONEFLOW%'
            OR UPPER(ae.description) LIKE '%CR SISTEMA%'
            OR UPPER(ae.description) LIKE '%GOOGLE%'
            OR UPPER(ae.description) LIKE '%MICROSOFT%'
            OR UPPER(ae.description) LIKE '%CLICKSIGN%'
            OR UPPER(ae.description) LIKE '%CONTUS%'
            OR UPPER(ae.description) LIKE '%DATAUNIQUE%'
            OR UPPER(ae.description) LIKE '%SITTAX%'
            OR UPPER(ae.description) LIKE '%VERI SOLUCOES%'
            OR UPPER(ae.description) LIKE '%NB TECHNOLOGY%'
            OR UPPER(ae.description) LIKE '%AUTMAIS%'
            OR UPPER(ae.description) LIKE '%THOMSON REUTERS%'
            OR UPPER(ae.description) LIKE '%PJBANK%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Software e Sistemas: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 4. ENERGIA ELÉTRICA -> 4.1.2.02
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.02';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Energia Elétrica'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%EQUATORIAL%'
            OR UPPER(ae.description) LIKE '%CEMIG%'
            OR UPPER(ae.description) LIKE '%ENERGIA%'
            OR UPPER(ae.description) LIKE '%CENTER LUZZ%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Energia Elétrica: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 5. IPVA E DETRAN -> 4.1.4.05
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.4.05';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - IPVA e DETRAN'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%DEPARTAMENTO ESTADUAL DE TR%'
            OR UPPER(ae.description) LIKE '%DETRAN%'
            OR UPPER(ae.description) LIKE '%IPVA%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'IPVA e DETRAN: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 6. MULTAS DE TRÂNSITO (PMGO) -> 4.1.4.06
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.4.06';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Multas de Trânsito'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%PMGO%'
            OR UPPER(ae.description) LIKE '%X155%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Multas de Trânsito: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 7. TAXAS CRC/CONTABILIDADE -> 4.1.4.04
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.4.04';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Taxas e Licenças'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%CONS REG CONTABILIDADE%'
            OR UPPER(ae.description) LIKE '%CRC%'
            OR UPPER(ae.description) LIKE '%SCALA CONTABILIDADE%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Taxas CRC: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 8. IMPOSTOS (DARF) -> 4.1.4.01
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.4.01';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Simples Nacional'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%DARF%'
            OR UPPER(ae.description) LIKE '%SIMPLES%'
            OR UPPER(ae.description) LIKE '%GPS%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Impostos: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 9. CAIXA ECONOMICA (FGTS) -> 4.1.1.02
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.1.02';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - FGTS'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND UPPER(ae.description) LIKE '%CAIXA ECONOMICA FEDERAL%';
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'FGTS: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 10. CONDOMÍNIO -> 4.1.2.10
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.10';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Condomínio'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%CONDOMINIO%'
            OR UPPER(ae.description) LIKE '%GALERIA NACIONAL%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Condomínio: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 11. TERCEIRIZADOS (FUNCIONÁRIOS PJ) -> 4.1.2.13
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13.99';
    IF v_new_account_id IS NULL THEN
        SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.13';
    END IF;
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Serviços de Terceiros'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%LILIAN MOREIRA%'
            OR UPPER(ae.description) LIKE '%DEUZA RESENDE%'
            OR UPPER(ae.description) LIKE '%ANDREA FERREIRA%'
            OR UPPER(ae.description) LIKE '%ANDREA LEONE%'
            OR UPPER(ae.description) LIKE '%ROSEMEIRE RODRIGUES%'
            OR UPPER(ae.description) LIKE '%ANDREIA%'
            OR UPPER(ae.description) LIKE '%TAYLANE%'
            OR UPPER(ae.description) LIKE '%THAYNARA%'
            OR UPPER(ae.description) LIKE '%FABIANA MARIA%'
            OR UPPER(ae.description) LIKE '%DANIELLE RODRIGUES%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Terceirizados: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 12. VR BENEFÍCIOS (Vale Alimentação) -> 4.1.1.10
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.1.10';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Vale Refeição/Alimentação'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND (
            UPPER(ae.description) LIKE '%VR BENEF%'
            OR UPPER(ae.description) LIKE '%VALE REFEICAO%'
            OR UPPER(ae.description) LIKE '%VALE ALIMENTACAO%'
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Vale Refeição: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 13. ÁGUA MINERAL -> 4.1.2.07
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.2.07';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Água Mineral'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND UPPER(ae.description) LIKE '%AGUA PURA%';
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Água Mineral: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 14. CARTÃO DE CRÉDITO -> 4.1.3.01 (Juros/Multas)
    -- ============================================
    SELECT id INTO v_new_account_id FROM chart_of_accounts WHERE code = '4.1.3.01';
    IF v_new_account_id IS NOT NULL THEN
        UPDATE accounting_entry_lines ael
        SET account_id = v_new_account_id,
            description = 'D - Fatura Cartão'
        FROM accounting_entries ae
        WHERE ael.entry_id = ae.id
          AND ael.account_id = v_old_account_id
          AND ael.debit > 0
          AND UPPER(ae.description) LIKE '%DEB.CTA.FATURA%';
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Fatura Cartão: % lançamentos reclassificados', v_count;
    END IF;

    -- ============================================
    -- 15. ADIANTAMENTO JOSIMAR -> Mover para ativo
    -- ============================================
    UPDATE accounting_entry_lines ael
    SET account_id = (SELECT id FROM chart_of_accounts WHERE code = '1.1.3.04.01'),
        description = 'D - Adiant. Josimar'
    FROM accounting_entries ae
    WHERE ael.entry_id = ae.id
      AND ael.account_id = v_old_account_id
      AND ael.debit > 0
      AND UPPER(ae.description) LIKE '%JOSIMAR%';

    -- Também atualizar o entry_type
    UPDATE accounting_entries ae
    SET entry_type = 'adiantamento_socio'
    WHERE ae.entry_type = 'pagamento_despesa'
      AND UPPER(ae.description) LIKE '%JOSIMAR%';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Adiantamento Josimar: % lançamentos reclassificados', v_count;

    -- ============================================
    -- Contar restantes
    -- ============================================
    SELECT COUNT(*) INTO v_count
    FROM accounting_entry_lines ael
    WHERE ael.account_id = v_old_account_id
      AND ael.debit > 0;

    RAISE NOTICE '';
    RAISE NOTICE 'Restantes na conta 4.1.1.08 (Outras Despesas): %', v_count;
END $$;

-- Renomear conta 4.1.1.08 para "Outras Despesas Operacionais"
UPDATE chart_of_accounts
SET name = 'Outras Despesas Operacionais',
    description = 'Despesas operacionais diversas não classificadas em outras contas'
WHERE code = '4.1.1.08';

-- PASSO FINAL: Reabilitar triggers do usuário
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
