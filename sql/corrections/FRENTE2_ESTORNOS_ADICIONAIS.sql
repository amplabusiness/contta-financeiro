-- ============================================================================
-- FRENTE 2 ADICIONAL: Estornos para Lançamentos Desbalanceados Restantes
-- ============================================================================
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================================

-- Desabilitar triggers de USUÁRIO
ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_entry_id UUID;
    v_entry RECORD;
    v_line RECORD;
    v_internal_code TEXT;
    v_count_estorno INT := 0;
    v_total_d NUMERIC;
    v_total_c NUMERIC;
BEGIN
    RAISE NOTICE 'FRENTE 2 ADICIONAL: Criando estornos restantes...';
    
    FOR v_entry IN 
        SELECT e.id, e.internal_code, e.description, e.entry_date
        FROM accounting_entries e
        WHERE e.tenant_id = v_tenant_id
          AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
          -- Apenas lançamentos desbalanceados
          AND EXISTS (
              SELECT 1 
              FROM accounting_entry_lines l 
              WHERE l.entry_id = e.id
              GROUP BY l.entry_id
              HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
          )
          -- Que ainda não têm estorno
          AND NOT EXISTS (
              SELECT 1 
              FROM accounting_entries e2 
              WHERE e2.internal_code = 'ESTORNO_' || e.internal_code
                AND e2.tenant_id = v_tenant_id
          )
          -- E não são estornos
          AND e.source_type != 'reversal'
    LOOP
        v_entry_id := gen_random_uuid();
        v_internal_code := 'ESTORNO_' || COALESCE(v_entry.internal_code, LEFT(v_entry.id::TEXT, 8));
        
        -- Verificar se já existe
        IF EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = v_internal_code AND tenant_id = v_tenant_id) THEN
            CONTINUE;
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
            '[ESTORNO TÉCNICO] ' || COALESCE(v_entry.description, 'Lançamento desbalanceado'),
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
        
        v_count_estorno := v_count_estorno + 1;
    END LOOP;
    
    RAISE NOTICE '✅ FRENTE 2: % estornos adicionais criados', v_count_estorno;

    -- Verificação
    SELECT 
        COALESCE(SUM(l.debit), 0),
        COALESCE(SUM(l.credit), 0)
    INTO v_total_d, v_total_c
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    WHERE e.tenant_id = v_tenant_id
      AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31';
    
    RAISE NOTICE 'Total Débitos:   R$ %', TO_CHAR(v_total_d, 'FM999G999G999D00');
    RAISE NOTICE 'Total Créditos:  R$ %', TO_CHAR(v_total_c, 'FM999G999G999D00');
    RAISE NOTICE 'Diferença:       R$ %', TO_CHAR(ABS(v_total_d - v_total_c), 'FM999G999G999D00');
    
END $$;

-- Re-habilitar triggers
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;

-- Verificação final
SELECT 'Desbalanceados restantes' as verificacao, COUNT(*) as quantidade
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
