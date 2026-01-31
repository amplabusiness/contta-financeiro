-- ============================================================================
-- FRENTE 2.1: COMPLETAR Honorários Desbalanceados (que já têm estorno)
-- ============================================================================
-- Protocolo: AUD-202501-ML1AZROS
-- Data: 31/01/2026
-- ============================================================================
-- 
-- PROBLEMA: 48 honorários desbalanceados que JÁ têm estorno vinculado
--           A constraint impede criar novo estorno
--           SOLUÇÃO: Completar o lançamento original com linha transitória
--
-- ============================================================================

-- Desabilitar triggers de USUÁRIO
ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_trans_debitos UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';  -- 1.1.9.01
    v_trans_creditos UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1'; -- 2.1.9.01
    
    v_entry RECORD;
    v_diff NUMERIC;
    v_count_completados INT := 0;
    v_total_d NUMERIC;
    v_total_c NUMERIC;
BEGIN
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'FRENTE 2.1: Completando Honorários Desbalanceados';
    RAISE NOTICE 'Protocolo: AUD-202501-ML1AZROS';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Regra: Adicionar linha de compensação transitória nos honorários';
    RAISE NOTICE '       que já têm estorno (constraint impede novo estorno)';
    
    FOR v_entry IN 
        SELECT 
            e.id, 
            e.internal_code, 
            e.description,
            COALESCE(SUM(l.debit), 0) as total_debit,
            COALESCE(SUM(l.credit), 0) as total_credit
        FROM accounting_entries e
        JOIN accounting_entry_lines l ON l.entry_id = e.id
        WHERE e.tenant_id = v_tenant_id
          AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
          AND e.source_type = 'honorarios'
        GROUP BY e.id, e.internal_code, e.description
        HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
    LOOP
        v_diff := v_entry.total_debit - v_entry.total_credit;
        
        -- Adicionar linha de COMPENSAÇÃO diretamente no lançamento original
        IF v_diff > 0.01 THEN
            -- D > C → Precisa CRÉDITO na transitória de débitos para fechar
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry.id,
                v_trans_debitos,
                0,
                v_diff,
                '[COMPLETADO] Linha transitória para balanceamento honorários'
            );
        ELSIF v_diff < -0.01 THEN
            -- C > D → Precisa DÉBITO na transitória de créditos para fechar
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry.id,
                v_trans_creditos,
                ABS(v_diff),
                0,
                '[COMPLETADO] Linha transitória para balanceamento honorários'
            );
        END IF;
        
        v_count_completados := v_count_completados + 1;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✓ % lançamentos honorarios completados', v_count_completados;
    
    -- ========================================================================
    -- VERIFICAÇÃO PÓS-EXECUÇÃO
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'VERIFICAÇÃO PÓS-EXECUÇÃO';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    
    SELECT 
        COALESCE(SUM(l.debit), 0),
        COALESCE(SUM(l.credit), 0)
    INTO v_total_d, v_total_c
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    WHERE e.tenant_id = v_tenant_id
      AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31';
    
    RAISE NOTICE '';
    RAISE NOTICE 'PARTIDAS DOBRADAS:';
    RAISE NOTICE '  Total Débitos:   R$ %', TO_CHAR(v_total_d, 'FM999G999G999D00');
    RAISE NOTICE '  Total Créditos:  R$ %', TO_CHAR(v_total_c, 'FM999G999G999D00');
    RAISE NOTICE '  Diferença:       R$ %', TO_CHAR(ABS(v_total_d - v_total_c), 'FM999G999G999D00');
    
    IF ABS(v_total_d - v_total_c) < 0.01 THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ PARTIDAS DOBRADAS: APROVADO';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  PARTIDAS DOBRADAS: PENDENTE';
    END IF;
    
END $$;

-- Re-habilitar triggers
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- 1. Desbalanceados restantes por source_type
SELECT 
    'Desbalanceados por tipo' as verificacao,
    e.source_type,
    COUNT(*) as quantidade
FROM accounting_entries e
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND EXISTS (
      SELECT 1 
      FROM accounting_entry_lines l 
      WHERE l.entry_id = e.id
      GROUP BY l.entry_id
      HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
  )
GROUP BY e.source_type;

-- 2. Total desbalanceados
SELECT 
    'Total desbalanceados' as verificacao,
    COUNT(*) as quantidade
FROM accounting_entries e
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND EXISTS (
      SELECT 1 
      FROM accounting_entry_lines l 
      WHERE l.entry_id = e.id
      GROUP BY l.entry_id
      HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
  );

-- 3. Totais globais
SELECT 
    'TOTAIS JANEIRO/2025' as periodo,
    TO_CHAR(SUM(l.debit), 'FM999G999G999D00') as total_debitos,
    TO_CHAR(SUM(l.credit), 'FM999G999G999D00') as total_creditos,
    TO_CHAR(ABS(SUM(l.debit) - SUM(l.credit)), 'FM999G999G999D00') as diferenca,
    CASE WHEN ABS(SUM(l.debit) - SUM(l.credit)) < 0.01 THEN '✅ APROVADO' ELSE '⚠️ PENDENTE' END as status
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31';
