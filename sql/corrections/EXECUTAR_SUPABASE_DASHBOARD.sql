-- ============================================================================
-- CORREÇÃO TÉCNICA JANEIRO/2025 — DR. CÍCERO
-- ============================================================================
-- INSTRUÇÕES:
-- 1. Copie este script COMPLETO
-- 2. Cole no Supabase Dashboard > SQL Editor
-- 3. Execute
-- ============================================================================

-- Primeiro, corrigir a função trigger para permitir tenant_id explícito
CREATE OR REPLACE FUNCTION "public"."fn_auto_set_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Se o tenant_id já foi fornecido, aceita sem validação
    IF NEW.tenant_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Tenta obter do usuário logado
    v_tenant_id := public.get_my_tenant_id();

    -- Se não conseguiu obter tenant_id, lança erro explicativo
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Não foi possível determinar o tenant_id. Usuário pode não estar autenticado ou não vinculado a um tenant.';
    END IF;

    NEW.tenant_id := v_tenant_id;
    RETURN NEW;
END;
$$;

-- Desabilitar triggers de USUÁRIO (não os do sistema) que causam problemas durante a correção
ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;
ALTER TABLE bank_transactions DISABLE TRIGGER USER;
ALTER TABLE domain_events DISABLE TRIGGER USER;

-- Agora executar as correções
DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_banco_sicredi UUID := '10d5892d-a843-4034-8d62-9fec95b8fd56';
    v_trans_debitos UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
    v_trans_creditos UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1';
    v_entry_id UUID;
    v_tx RECORD;
    v_entry RECORD;
    v_line RECORD;
    v_internal_code TEXT;
    v_amount NUMERIC;
    v_count_trans INT := 0;
    v_count_estorno INT := 0;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  CORREÇÃO TÉCNICA JANEIRO/2025 — DR. CÍCERO';
    RAISE NOTICE '  Protocolo: AUD-202501-ML1AZROS';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';

    -- ========================================================================
    -- FRENTE 1: Lançamentos Transitórios
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '  FRENTE 1: Criando lançamentos transitórios...';
    
    FOR v_tx IN 
        SELECT id, fitid, amount, transaction_date, description
        FROM bank_transactions
        WHERE tenant_id = v_tenant_id
          AND journal_entry_id IS NULL
          AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
        ORDER BY transaction_date
    LOOP
        v_entry_id := gen_random_uuid();
        -- Usar ID da transação para garantir unicidade
        v_internal_code := 'OFX_TRANS_' || LEFT(v_tx.id::TEXT, 8) || '_' || LEFT(COALESCE(v_tx.fitid, v_entry_id::text), 8);
        v_amount := ABS(v_tx.amount);
        
        -- Verificar se já existe lançamento com este código
        IF EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = v_internal_code AND tenant_id = v_tenant_id) THEN
            CONTINUE; -- Pula para próxima transação
        END IF;
        
        -- Inserir cabeçalho
        INSERT INTO accounting_entries (
            id, tenant_id, entry_date, competence_date, description,
            internal_code, source_type, entry_type, reference_type, reference_id
        ) VALUES (
            v_entry_id,
            v_tenant_id,
            v_tx.transaction_date,
            v_tx.transaction_date,
            '[TRANSITÓRIO] ' || COALESCE(v_tx.description, 'Sem descrição'),
            v_internal_code,
            'ofx_transit',
            'MOVIMENTO',
            'bank_transaction',
            v_tx.id
        );
        
        -- Inserir linhas conforme tipo (entrada ou saída)
        IF v_tx.amount > 0 THEN
            -- ENTRADA: D Banco / C Transitória Créditos
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES 
                (gen_random_uuid(), v_tenant_id, v_entry_id, v_banco_sicredi, v_amount, 0, 'Entrada conforme extrato'),
                (gen_random_uuid(), v_tenant_id, v_entry_id, v_trans_creditos, 0, v_amount, 'Pendente classificação');
        ELSE
            -- SAÍDA: D Transitória Débitos / C Banco
            INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
            VALUES 
                (gen_random_uuid(), v_tenant_id, v_entry_id, v_trans_debitos, v_amount, 0, 'Pendente classificação'),
                (gen_random_uuid(), v_tenant_id, v_entry_id, v_banco_sicredi, 0, v_amount, 'Saída conforme extrato');
        END IF;
        
        -- Vincular transação ao lançamento
        UPDATE bank_transactions 
        SET journal_entry_id = v_entry_id 
        WHERE id = v_tx.id;
        
        v_count_trans := v_count_trans + 1;
    END LOOP;
    
    RAISE NOTICE '  ✅ FRENTE 1: % lançamentos transitórios criados', v_count_trans;

    -- ========================================================================
    -- FRENTE 2: Estornos de Lançamentos Desbalanceados
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '  FRENTE 2: Criando estornos para lançamentos desbalanceados...';
    
    FOR v_entry IN 
        SELECT e.id, e.internal_code, e.description, e.entry_date
        FROM accounting_entries e
        WHERE e.tenant_id = v_tenant_id
          AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
          AND EXISTS (
              SELECT 1 
              FROM accounting_entry_lines l 
              WHERE l.entry_id = e.id
              GROUP BY l.entry_id
              HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
          )
          AND NOT EXISTS (
              SELECT 1 
              FROM accounting_entries e2 
              WHERE e2.internal_code = 'ESTORNO_' || e.internal_code
                AND e2.tenant_id = v_tenant_id
          )
    LOOP
        v_entry_id := gen_random_uuid();
        v_internal_code := 'ESTORNO_' || COALESCE(v_entry.internal_code, LEFT(v_entry.id::TEXT, 8));
        
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
                COALESCE(v_line.credit, 0),  -- Inverte: crédito vira débito
                COALESCE(v_line.debit, 0),   -- Inverte: débito vira crédito
                '[ESTORNO] ' || COALESCE(v_line.description, '')
            );
        END LOOP;
        
        v_count_estorno := v_count_estorno + 1;
    END LOOP;
    
    RAISE NOTICE '  ✅ FRENTE 2: % estornos criados', v_count_estorno;

    -- ========================================================================
    -- VERIFICAÇÃO FINAL
    -- ========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  VERIFICAÇÃO FINAL';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    
    -- Transações sem lançamento
    SELECT COUNT(*) INTO v_count_trans
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND journal_entry_id IS NULL
      AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31';
    
    RAISE NOTICE '  Transações sem lançamento: %', v_count_trans;
    
    -- Partidas dobradas
    SELECT 
        COALESCE(SUM(l.debit), 0),
        COALESCE(SUM(l.credit), 0)
    INTO v_amount, v_count_estorno -- reutilizando variáveis
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    WHERE e.tenant_id = v_tenant_id
      AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31';
    
    RAISE NOTICE '  Total Débitos:    R$ %', TO_CHAR(v_amount, 'FM999G999G999D00');
    RAISE NOTICE '  Total Créditos:   R$ %', TO_CHAR(v_count_estorno, 'FM999G999G999D00');
    RAISE NOTICE '  Diferença Global: R$ %', TO_CHAR(ABS(v_amount - v_count_estorno), 'FM999G999G999D00');
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  CORREÇÃO CONCLUÍDA — DR. CÍCERO';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════';
    
END $$;

-- Re-habilitar triggers de USUÁRIO
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
ALTER TABLE bank_transactions ENABLE TRIGGER USER;
ALTER TABLE domain_events ENABLE TRIGGER USER;

-- Mostrar resultados finais
SELECT 'Transações sem lançamento' as verificacao, 
       COUNT(*) as quantidade
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND journal_entry_id IS NULL
  AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'

UNION ALL

SELECT 'Total Lançamentos Jan/2025', COUNT(*)
FROM accounting_entries
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND entry_date BETWEEN '2025-01-01' AND '2025-01-31'

UNION ALL

SELECT 'Lançamentos Desbalanceados', COUNT(*)
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
