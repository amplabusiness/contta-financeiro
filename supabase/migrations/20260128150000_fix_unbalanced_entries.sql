-- Correção de entries contábeis desbalanceados
-- Data: 2026-01-28
-- Problema: 101 entries de bank_transaction com apenas crédito (saída do banco) sem débito (despesa)

-- Desabilitar triggers temporariamente
SET session_replication_role = 'replica';

-- 1. Criar tabela temporária para mapear descrições -> contas
CREATE TEMP TABLE temp_mapeamento_despesas (
    pattern TEXT,
    account_code TEXT
);

INSERT INTO temp_mapeamento_despesas (pattern, account_code) VALUES
    ('fgts', '4.1.1.02.02'),
    ('inss', '4.1.1.02.01'),
    ('taxas e licenças', '4.1.2.14'),
    ('licenças', '4.1.2.14'),
    ('crc', '4.1.2.14'),
    ('softwares e sistemas', '4.1.2.12'),
    ('software', '4.1.2.12'),
    ('sistemas', '4.1.2.12'),
    ('vale transporte', '4.1.1.09'),
    ('vale refeição', '4.1.1.10'),
    ('vale alimentação', '4.1.1.10'),
    ('adiantamento', '1.1.2.02'),  -- Adiantamentos a Funcionários (ativo)
    ('empréstimos de sócios', '2.1.2.01'),  -- Empréstimos de Sócios (passivo)
    ('empréstimo', '2.1.2.01'),
    ('energia', '4.1.2.02'),
    ('cemig', '4.1.2.02'),
    ('telefone', '4.1.2.03'),
    ('internet', '4.1.2.05'),
    ('aluguel', '4.1.2.01'),
    ('material de escritório', '4.1.2.04'),
    ('material de limpeza', '4.1.2.08'),
    ('copa e cozinha', '4.1.2.09'),
    ('honorários', '4.1.2.13.01'),
    ('contador', '4.1.2.13.01'),
    ('iptu', '4.1.2.14'),
    ('ipva', '4.1.2.14'),
    ('seguro', '4.1.2.15'),
    ('combustível', '4.1.2.16'),
    ('gasolina', '4.1.2.16'),
    ('etanol', '4.1.2.16'),
    ('manutenção', '4.1.2.17'),
    ('obras', '4.1.2.11'),
    ('reforma', '4.1.2.11'),
    ('condomínio', '4.1.2.10'),
    ('gás', '4.1.2.06'),
    ('água', '4.1.2.07');

-- 2. Identificar e corrigir entries desbalanceados
DO $$
DECLARE
    v_entry RECORD;
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_valor_faltante NUMERIC;
    v_account_code TEXT;
    v_account_id UUID;
    v_tenant_id UUID;
    v_corrigidos INT := 0;
    v_erros INT := 0;
BEGIN
    RAISE NOTICE 'Iniciando correção de entries desbalanceados...';

    -- Buscar entries desbalanceados
    FOR v_entry IN
        SELECT
            ae.id,
            ae.description,
            ae.entry_date,
            ae.tenant_id,
            COALESCE(SUM(aei.debit), 0) AS total_debit,
            COALESCE(SUM(aei.credit), 0) AS total_credit
        FROM accounting_entries ae
        JOIN accounting_entry_items aei ON aei.entry_id = ae.id
        WHERE ae.source_type = 'bank_transaction'
          AND COALESCE(ae.is_draft, false) = false
        GROUP BY ae.id, ae.description, ae.entry_date, ae.tenant_id
        HAVING ABS(COALESCE(SUM(aei.debit), 0) - COALESCE(SUM(aei.credit), 0)) > 0.01
           AND COALESCE(SUM(aei.credit), 0) > COALESCE(SUM(aei.debit), 0)
    LOOP
        v_valor_faltante := v_entry.total_credit - v_entry.total_debit;
        v_tenant_id := v_entry.tenant_id;

        -- Buscar conta apropriada baseado na descrição
        SELECT account_code INTO v_account_code
        FROM temp_mapeamento_despesas
        WHERE LOWER(v_entry.description) LIKE '%' || pattern || '%'
        ORDER BY LENGTH(pattern) DESC
        LIMIT 1;

        -- Fallback para "Outras Despesas Operacionais"
        IF v_account_code IS NULL THEN
            v_account_code := '4.1.1.08';
        END IF;

        -- Buscar ID da conta
        SELECT id INTO v_account_id
        FROM chart_of_accounts
        WHERE code = v_account_code;

        IF v_account_id IS NULL THEN
            RAISE NOTICE 'Conta % não encontrada para entry %', v_account_code, v_entry.id;
            v_erros := v_erros + 1;
            CONTINUE;
        END IF;

        -- Inserir item de débito faltante (com tenant_id)
        INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, tenant_id)
        VALUES (v_entry.id, v_account_id, v_valor_faltante, 0, 'Débito corretivo - ' || v_entry.description, v_tenant_id);

        v_corrigidos := v_corrigidos + 1;

        IF v_corrigidos % 10 = 0 THEN
            RAISE NOTICE 'Corrigidos: %', v_corrigidos;
        END IF;
    END LOOP;

    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'CORREÇÃO CONCLUÍDA: % entries corrigidos, % erros', v_corrigidos, v_erros;
    RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
END;
$$;

-- 3. Verificar resultado
DO $$
DECLARE
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_diferenca NUMERIC;
BEGIN
    SELECT
        COALESCE(SUM(aei.debit), 0),
        COALESCE(SUM(aei.credit), 0)
    INTO v_total_debit, v_total_credit
    FROM accounting_entry_items aei
    JOIN accounting_entries ae ON ae.id = aei.entry_id
    WHERE COALESCE(ae.is_draft, false) = false;

    v_diferenca := ABS(v_total_debit - v_total_credit);

    RAISE NOTICE '';
    RAISE NOTICE 'VERIFICAÇÃO FINAL:';
    RAISE NOTICE '  Total Débitos: R$ %', TO_CHAR(v_total_debit, 'FM999,999,999.00');
    RAISE NOTICE '  Total Créditos: R$ %', TO_CHAR(v_total_credit, 'FM999,999,999.00');
    RAISE NOTICE '  Diferença: R$ %', TO_CHAR(v_diferenca, 'FM999,999,999.00');

    IF v_diferenca < 0.01 THEN
        RAISE NOTICE '  Status: ✅ PARTIDA DOBRADA BALANCEADA!';
    ELSE
        RAISE NOTICE '  Status: ⚠️ AINDA EXISTE DIFERENÇA';
    END IF;
END;
$$;

-- Limpar tabela temporária
DROP TABLE IF EXISTS temp_mapeamento_despesas;

-- Reabilitar triggers
SET session_replication_role = 'origin';

-- Log
DO $$
BEGIN
    RAISE NOTICE '[Dr. Cícero] Correção de entries desbalanceados concluída!';
END $$;
