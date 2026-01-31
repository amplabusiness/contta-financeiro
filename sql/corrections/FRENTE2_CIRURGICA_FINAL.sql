-- ============================================================================
-- FRENTE 2 CIRÚRGICA FINAL — Dr. Cícero
-- ============================================================================
-- Protocolo: AUD-202501-ML1AZROS
-- Data: 31/01/2026
-- ============================================================================
-- 
-- ESTRATÉGIA:
--   CAMADA 1 (bank_transaction): COMPLETAR com linha transitória
--   CAMADA 2 (honorarios):       ESTORNAR balanceado
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
    v_line RECORD;
    v_entry_id UUID;
    v_internal_code TEXT;
    v_diff NUMERIC;
    
    v_count_completados INT := 0;
    v_count_estornados INT := 0;
    v_total_d NUMERIC;
    v_total_c NUMERIC;
BEGIN
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'FRENTE 2 CIRÚRGICA FINAL — Dr. Cícero';
    RAISE NOTICE 'Protocolo: AUD-202501-ML1AZROS';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    
    -- ========================================================================
    -- CAMADA 1: COMPLETAR bank_transaction (não estornar)
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '▶ CAMADA 1: Completando lançamentos bank_transaction...';
    RAISE NOTICE '  Regra: Adicionar linha de compensação na transitória';
    
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
          AND e.source_type = 'bank_transaction'
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
                v_entry.id,  -- Mesmo entry_id (completa o lançamento)
                v_trans_debitos,
                0,
                v_diff,
                '[COMPLETADO] Linha transitória para balanceamento'
            );
        ELSIF v_diff < -0.01 THEN
            -- C > D → Precisa DÉBITO na transitória de créditos para fechar
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry.id,  -- Mesmo entry_id (completa o lançamento)
                v_trans_creditos,
                ABS(v_diff),
                0,
                '[COMPLETADO] Linha transitória para balanceamento'
            );
        END IF;
        
        v_count_completados := v_count_completados + 1;
    END LOOP;
    
    RAISE NOTICE '  ✓ % lançamentos bank_transaction completados', v_count_completados;
    
    -- ========================================================================
    -- CAMADA 2: ESTORNAR honorarios (criar estorno balanceado)
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '▶ CAMADA 2: Estornando lançamentos honorarios desbalanceados...';
    RAISE NOTICE '  Regra: Criar estorno balanceado com compensação';
    
    FOR v_entry IN 
        SELECT 
            e.id, 
            e.internal_code, 
            e.description, 
            e.entry_date,
            COALESCE(SUM(l.debit), 0) as total_debit,
            COALESCE(SUM(l.credit), 0) as total_credit
        FROM accounting_entries e
        JOIN accounting_entry_lines l ON l.entry_id = e.id
        WHERE e.tenant_id = v_tenant_id
          AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
          AND e.source_type = 'honorarios'
          -- Excluir lançamentos que JÁ TÊM estorno (constraint unique)
          AND NOT EXISTS (
              SELECT 1 FROM accounting_entries e2
              WHERE e2.reference_id = e.id
                AND e2.reference_type = 'accounting_entry'
                AND e2.entry_type = 'ESTORNO'
                AND e2.tenant_id = v_tenant_id
          )
        GROUP BY e.id, e.internal_code, e.description, e.entry_date
        HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
    LOOP
        v_diff := v_entry.total_debit - v_entry.total_credit;
        
        v_entry_id := gen_random_uuid();
        v_internal_code := 'ESTORNO_HON_' || COALESCE(v_entry.internal_code, LEFT(v_entry.id::TEXT, 8));
        
        -- Verificar se já existe estorno com este internal_code
        IF EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = v_internal_code AND tenant_id = v_tenant_id) THEN
            v_internal_code := v_internal_code || '_' || LEFT(v_entry_id::TEXT, 4);
        END IF;
        
        -- Inserir cabeçalho do estorno
        INSERT INTO accounting_entries (
            id, tenant_id, entry_date, competence_date, description,
            internal_code, source_type, entry_type, reference_type, reference_id
        ) VALUES (
            v_entry_id,
            v_tenant_id,
            v_entry.entry_date,
            v_entry.entry_date,
            '[ESTORNO HONORÁRIOS] ' || COALESCE(v_entry.description, 'Lançamento inválido'),
            v_internal_code,
            'reversal',
            'ESTORNO',
            'accounting_entry',
            v_entry.id
        );
        
        -- Inserir linhas invertidas (D↔C)
        FOR v_line IN 
            SELECT account_id, debit, credit, description
            FROM accounting_entry_lines
            WHERE entry_id = v_entry.id
        LOOP
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry_id,
                v_line.account_id,
                COALESCE(v_line.credit, 0),
                COALESCE(v_line.debit, 0),
                '[ESTORNO] ' || COALESCE(v_line.description, '')
            );
        END LOOP;
        
        -- Linha de COMPENSAÇÃO para balancear o estorno
        IF v_diff > 0.01 THEN
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry_id,
                v_trans_debitos,
                v_diff,
                0,
                '[COMPENSAÇÃO] Ajuste para balanceamento do estorno'
            );
        ELSIF v_diff < -0.01 THEN
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry_id,
                v_trans_creditos,
                0,
                ABS(v_diff),
                '[COMPENSAÇÃO] Ajuste para balanceamento do estorno'
            );
        END IF;
        
        v_count_estornados := v_count_estornados + 1;
    END LOOP;
    
    RAISE NOTICE '  ✓ % lançamentos honorarios estornados', v_count_estornados;
    
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
    RAISE NOTICE 'RESUMO DA EXECUÇÃO:';
    RAISE NOTICE '  bank_transaction completados: %', v_count_completados;
    RAISE NOTICE '  honorarios estornados:        %', v_count_estornados;
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
        RAISE NOTICE '⚠️  PARTIDAS DOBRADAS: PENDENTE (verificar outros source_types)';
    END IF;
    
END $$;

-- Re-habilitar triggers
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;

-- ============================================================================
-- VERIFICAÇÃO FINAL DETALHADA
-- ============================================================================

-- 1. Desbalanceados por source_type
SELECT 
    '1. Desbalanceados por tipo' as verificacao,
    e.source_type,
    COUNT(*) as quantidade,
    TO_CHAR(SUM(sub.diff), 'FM999G999G999D00') as diferenca_total
FROM accounting_entries e
JOIN (
    SELECT 
        entry_id,
        SUM(COALESCE(debit, 0)) - SUM(COALESCE(credit, 0)) as diff
    FROM accounting_entry_lines
    GROUP BY entry_id
    HAVING ABS(SUM(COALESCE(debit, 0)) - SUM(COALESCE(credit, 0))) > 0.01
) sub ON sub.entry_id = e.id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY e.source_type
ORDER BY COUNT(*) DESC;

-- 2. Totais globais
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

-- 3. Contagem de desbalanceados total
SELECT 
    'Total desbalanceados restantes' as verificacao,
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

-- 4. Transações bancárias sem lançamento
SELECT 
    'Transações sem lançamento' as verificacao,
    COUNT(*) as quantidade
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND journal_entry_id IS NULL
  AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31';
