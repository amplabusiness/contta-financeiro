-- ============================================================================
-- CORREÇÃO DRE JANEIRO/2025 - AUTORIZADO POR DR. CÍCERO
-- ============================================================================
-- Data: 30/01/2026
-- Autorização: Parecer Técnico Dr. Cícero
-- 
-- CORREÇÕES APROVADAS:
-- ✅ Estorno dos PIX indevidamente classificados como Receita
-- ✅ Recálculo da DRE Janeiro/2025
--
-- REGRAS APLICADAS:
-- 🔴 PIX NUNCA gera receita automaticamente
-- 🔴 Receita SÓ nasce de honorários/contratos
-- ============================================================================

-- ============================================================================
-- ETAPA 0: DESABILITAR TRIGGERS DE USUÁRIO TEMPORARIAMENTE
-- ============================================================================

-- Desabilitar apenas triggers de usuário (não os de sistema/FK)
ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;

-- Configurar tenant
DO $$ BEGIN PERFORM set_config('app.tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421', false); END $$;

-- IDs das contas
DO $$
DECLARE
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
    v_receita_id UUID;
    v_transitoria_id UUID;
    v_entry_id UUID;
    v_pix RECORD;
    v_total_estornado DECIMAL := 0;
    v_contador INT := 0;
BEGIN
    -- Buscar IDs das contas
    SELECT id INTO v_receita_id FROM chart_of_accounts 
    WHERE code = '3.1.1.01' AND tenant_id = v_tenant_id;
    
    SELECT id INTO v_transitoria_id FROM chart_of_accounts 
    WHERE code = '2.1.9.01' AND tenant_id = v_tenant_id;
    
    IF v_receita_id IS NULL THEN
        RAISE EXCEPTION 'Conta de Receita não encontrada';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '╔═══════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     CORREÇÃO DRE JAN/2025 - AUTORIZADO POR DR. CÍCERO            ║';
    RAISE NOTICE '╚═══════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'Conta Receita: %', v_receita_id;
    RAISE NOTICE 'Conta Transitória: %', v_transitoria_id;
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  ETAPA 1: ESTORNO DOS PIX CLASSIFICADOS COMO RECEITA';
    RAISE NOTICE '════════════════════════════════════════════════════════════════════';
    
    -- Loop pelos PIX classificados como receita
    FOR v_pix IN 
        SELECT 
            el.id AS line_id,
            el.credit,
            ae.id AS entry_id,
            ae.internal_code,
            ae.description
        FROM accounting_entry_lines el
        JOIN accounting_entries ae ON ae.id = el.entry_id
        WHERE el.account_id = v_receita_id
          AND el.tenant_id = v_tenant_id
          AND ae.entry_date >= '2025-01-01'
          AND ae.entry_date <= '2025-01-31'
          AND ae.internal_code LIKE 'PIX_CLASS%'
          AND el.credit > 0
    LOOP
        v_contador := v_contador + 1;
        v_total_estornado := v_total_estornado + v_pix.credit;
        
        RAISE NOTICE '';
        RAISE NOTICE '🔄 [%] Estornando: % = R$ %', v_contador, v_pix.internal_code, v_pix.credit;
        
        -- Gerar ID para o estorno
        v_entry_id := gen_random_uuid();
        
        -- Criar lançamento de ESTORNO
        INSERT INTO accounting_entries (
            id,
            tenant_id,
            entry_date,
            competence_date,
            description,
            internal_code,
            source_type,
            entry_type,
            reference_type,
            reference_id,
            total_debit,
            total_credit,
            balanced
        ) VALUES (
            v_entry_id,
            v_tenant_id,
            '2025-01-31',
            '2025-01-31',
            'ESTORNO DR. CÍCERO: ' || v_pix.description || ' - PIX não é receita (NBC TG 51)',
            'ESTORNO_' || v_pix.internal_code || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
            'correction',
            'ESTORNO',
            'accounting_entry',
            v_pix.entry_id,
            v_pix.credit,
            v_pix.credit,
            TRUE
        );
        
        -- Linha 1: Débito em Receita (estorna o crédito original)
        INSERT INTO accounting_entry_lines (
            id,
            tenant_id,
            entry_id,
            account_id,
            debit,
            credit,
            description
        ) VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_entry_id,
            v_receita_id,
            v_pix.credit,
            0,
            'Estorno receita indevida - PIX não gera receita (NBC TG 51)'
        );
        
        -- Linha 2: Crédito na Transitória
        INSERT INTO accounting_entry_lines (
            id,
            tenant_id,
            entry_id,
            account_id,
            debit,
            credit,
            description
        ) VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_entry_id,
            v_transitoria_id,
            0,
            v_pix.credit,
            'Aguardando classificação correta - baixa de cliente ou aporte'
        );
        
        RAISE NOTICE '   ✅ Estorno criado com sucesso';
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  RESUMO';
    RAISE NOTICE '════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  PIX estornados: %', v_contador;
    RAISE NOTICE '  Total estornado: R$ %', v_total_estornado;
    RAISE NOTICE '';
    
END $$;

-- ============================================================================
-- VERIFICAR RESULTADO
-- ============================================================================

SELECT 
    'DRE APÓS CORREÇÃO' AS verificacao,
    SUM(el.credit) - SUM(el.debit) AS saldo_receita
FROM accounting_entry_lines el
JOIN accounting_entries ae ON ae.id = el.entry_id
WHERE el.account_id = (SELECT id FROM chart_of_accounts WHERE code = '3.1.1.01' AND tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421')
  AND el.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND ae.entry_date >= '2025-01-01'
  AND ae.entry_date <= '2025-01-31';

-- ============================================================================
-- ETAPA FINAL: REABILITAR TRIGGERS DE USUÁRIO
-- ============================================================================

ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;

-- ============================================================================
-- FIM - AUTORIZADO POR DR. CÍCERO - 30/01/2026
-- ============================================================================
