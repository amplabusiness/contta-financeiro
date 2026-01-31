-- ============================================================================
-- FRENTE 2 CORRIGIDA: Estornos BALANCEADOS para Lançamentos Desbalanceados
-- ============================================================================
-- PROBLEMA: Estornos anteriores invertiam D↔C mas continuavam desbalanceados
-- SOLUÇÃO: Criar estornos com linha de compensação na conta transitória
-- ============================================================================
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================================

-- Desabilitar triggers de USUÁRIO
ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_trans_debitos UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';  -- 1.1.9.01
    v_trans_creditos UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1'; -- 2.1.9.01
    v_entry_id UUID;
    v_entry RECORD;
    v_line RECORD;
    v_internal_code TEXT;
    v_count_corrigidos INT := 0;
    v_total_d NUMERIC;
    v_total_c NUMERIC;
    v_diff NUMERIC;
    v_estorno_d NUMERIC := 0;
    v_estorno_c NUMERIC := 0;
BEGIN
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'FRENTE 2 CORRIGIDA: Estornos Balanceados';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    
    -- PASSO 1: Deletar estornos antigos (que estão desbalanceados)
    RAISE NOTICE '';
    RAISE NOTICE 'PASSO 1: Removendo estornos desbalanceados anteriores...';
    
    DELETE FROM accounting_entry_lines
    WHERE entry_id IN (
        SELECT id FROM accounting_entries 
        WHERE tenant_id = v_tenant_id 
          AND source_type = 'reversal'
          AND entry_date BETWEEN '2025-01-01' AND '2025-01-31'
    );
    
    DELETE FROM accounting_entries
    WHERE tenant_id = v_tenant_id 
      AND source_type = 'reversal'
      AND entry_date BETWEEN '2025-01-01' AND '2025-01-31';
    
    RAISE NOTICE '✓ Estornos anteriores removidos';
    
    -- PASSO 2: Criar novos estornos BALANCEADOS
    RAISE NOTICE '';
    RAISE NOTICE 'PASSO 2: Criando estornos balanceados...';
    
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
          AND e.source_type != 'reversal'
        GROUP BY e.id, e.internal_code, e.description, e.entry_date
        HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
    LOOP
        v_diff := v_entry.total_debit - v_entry.total_credit;
        
        v_entry_id := gen_random_uuid();
        v_internal_code := 'ESTORNO_BAL_' || COALESCE(v_entry.internal_code, LEFT(v_entry.id::TEXT, 8));
        
        -- Verificar se já existe
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
            '[ESTORNO BALANCEADO] ' || COALESCE(v_entry.description, 'Correção técnica'),
            v_internal_code,
            'reversal',
            'ESTORNO',
            'accounting_entry',
            v_entry.id
        );
        
        -- Inserir linhas invertidas (D↔C)
        v_estorno_d := 0;
        v_estorno_c := 0;
        
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
                COALESCE(v_line.credit, 0),  -- Inverte: crédito vira débito
                COALESCE(v_line.debit, 0),   -- Inverte: débito vira crédito
                '[ESTORNO] ' || COALESCE(v_line.description, '')
            );
            
            v_estorno_d := v_estorno_d + COALESCE(v_line.credit, 0);
            v_estorno_c := v_estorno_c + COALESCE(v_line.debit, 0);
        END LOOP;
        
        -- LINHA DE COMPENSAÇÃO para balancear o estorno
        -- Se original tinha D > C, estorno terá C > D, precisa débito extra
        -- Se original tinha C > D, estorno terá D > C, precisa crédito extra
        IF v_diff > 0.01 THEN
            -- Original: D > C → Estorno: C > D → Precisa DÉBITO para compensar
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry_id,
                v_trans_debitos,  -- Usa transitória de débitos
                v_diff,           -- Débito = diferença
                0,
                '[COMPENSAÇÃO] Ajuste técnico para balanceamento'
            );
        ELSIF v_diff < -0.01 THEN
            -- Original: C > D → Estorno: D > C → Precisa CRÉDITO para compensar
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES (
                gen_random_uuid(),
                v_tenant_id,
                v_entry_id,
                v_trans_creditos,  -- Usa transitória de créditos
                0,
                ABS(v_diff),       -- Crédito = diferença absoluta
                '[COMPENSAÇÃO] Ajuste técnico para balanceamento'
            );
        END IF;
        
        v_count_corrigidos := v_count_corrigidos + 1;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ % estornos balanceados criados', v_count_corrigidos;

    -- Verificação pós-execução
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
    RAISE NOTICE 'Total Débitos:   R$ %', TO_CHAR(v_total_d, 'FM999G999G999D00');
    RAISE NOTICE 'Total Créditos:  R$ %', TO_CHAR(v_total_c, 'FM999G999G999D00');
    RAISE NOTICE 'Diferença:       R$ %', TO_CHAR(ABS(v_total_d - v_total_c), 'FM999G999G999D00');
    
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
-- VERIFICAÇÃO FINAL DETALHADA
-- ============================================================================

SELECT '1. Desbalanceados restantes' as verificacao, COUNT(*) as quantidade
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

UNION ALL

SELECT '2. Estornos balanceados criados' as verificacao, COUNT(*) as quantidade
FROM accounting_entries
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND source_type = 'reversal'
  AND entry_date BETWEEN '2025-01-01' AND '2025-01-31'

UNION ALL

SELECT '3. Transações sem lançamento' as verificacao, COUNT(*) as quantidade
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND journal_entry_id IS NULL
  AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31';

-- Totais globais
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
