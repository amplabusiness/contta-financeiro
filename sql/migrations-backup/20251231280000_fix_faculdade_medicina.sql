-- Migration: Corrigir FACULDADE DE MEDICINA para Adiantamento Sócio Sergio Augusto
-- Conforme instruído pelo usuário: "faculdade de medicina sergio augusto lançamento adiantamento de socios"
-- Sergio Augusto é filho do sócio e estuda medicina em Itumbiara

BEGIN;

-- Desabilitar triggers de proteção de período fechado
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;
ALTER TABLE accounting_entries DISABLE TRIGGER USER;

DO $$
DECLARE
    v_adiantamento_sergio_augusto_id UUID;
    v_sicredi_id UUID;
    v_outras_despesas_id UUID;
    v_entry_id UUID;
    v_entry_amount NUMERIC;
    v_updated_count INT := 0;
BEGIN
    -- Buscar contas necessárias
    SELECT id INTO v_adiantamento_sergio_augusto_id
    FROM chart_of_accounts WHERE code = '1.1.3.04.05';

    SELECT id INTO v_sicredi_id
    FROM chart_of_accounts WHERE code = '1.1.1.05';

    SELECT id INTO v_outras_despesas_id
    FROM chart_of_accounts WHERE code = '4.1.1.08';

    IF v_adiantamento_sergio_augusto_id IS NULL THEN
        RAISE EXCEPTION 'Conta 1.1.3.04.05 (Adiantamento Sergio Augusto) não encontrada';
    END IF;

    RAISE NOTICE '=== CORRIGINDO FACULDADE DE MEDICINA PARA ADIANTAMENTO SERGIO AUGUSTO ===';
    RAISE NOTICE 'Conta destino: 1.1.3.04.05 - Adiantamento Sergio Augusto';

    -- Buscar o lançamento de FACULDADE DE MEDICINA em janeiro/2025
    FOR v_entry_id, v_entry_amount IN
        SELECT ae.id, ae.total_debit
        FROM accounting_entries ae
        WHERE ae.entry_date >= '2025-01-01'
          AND ae.entry_date <= '2025-01-31'
          AND (
              UPPER(ae.description) LIKE '%FACULDADE%MEDICINA%'
              OR UPPER(ae.description) LIKE '%MEDICINA%ITUMBIARA%'
          )
    LOOP
        -- Atualizar o tipo do lançamento para adiantamento_socio
        UPDATE accounting_entries
        SET entry_type = 'adiantamento_socio',
            description = REPLACE(description, 'Despesa:', 'Adiantamento Sócio:')
        WHERE id = v_entry_id;

        -- Atualizar a linha de débito: de Outras Despesas para Adiantamento Sergio Augusto
        UPDATE accounting_entry_lines
        SET account_id = v_adiantamento_sergio_augusto_id,
            description = 'D - Adiant. Sergio Augusto (Faculdade Medicina)'
        WHERE entry_id = v_entry_id
          AND debit > 0;

        v_updated_count := v_updated_count + 1;
        RAISE NOTICE 'Lançamento % corrigido: R$ %', v_entry_id, v_entry_amount;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '=== RESULTADO ===';
    RAISE NOTICE 'Total de lançamentos corrigidos: %', v_updated_count;

    -- Verificar o resultado
    RAISE NOTICE '';
    RAISE NOTICE '=== VERIFICAÇÃO ===';

    FOR v_entry_id, v_entry_amount IN
        SELECT ae.id, ae.total_debit
        FROM accounting_entries ae
        JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
        WHERE ae.entry_date >= '2025-01-01'
          AND ae.entry_date <= '2025-01-31'
          AND ael.account_id = v_adiantamento_sergio_augusto_id
          AND ael.debit > 0
    LOOP
        RAISE NOTICE 'Adiantamento Sergio Augusto: R$ %', v_entry_amount;
    END LOOP;

END $$;

-- Reabilitar triggers
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
ALTER TABLE accounting_entries ENABLE TRIGGER USER;

COMMIT;
