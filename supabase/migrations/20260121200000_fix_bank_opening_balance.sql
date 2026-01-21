-- ============================================================================
-- MIGRATION: Corrigir Saldo de Abertura do Banco
-- ============================================================================
-- Esta migration cria o lançamento de abertura do banco e ajusta o saldo
-- de janeiro/2025 para refletir os valores corretos.
--
-- Valores esperados:
--   - Saldo 31/12/2024: R$ 90.725,06
--   - Saldo 31/01/2025: R$ 18.553,54
-- ============================================================================

-- Desabilitar triggers durante a migration
SET session_replication_role = replica;

-- ============================================================================
-- ETAPA 1: CRIAR LANÇAMENTO DE ABERTURA (31/12/2024)
-- ============================================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_bank_account_id UUID;
    v_opening_balance_account_id UUID;
    v_entry_id UUID;
    v_amount NUMERIC := 90725.06;
    v_date DATE := '2024-12-31';
BEGIN
    -- Obter tenant
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'Nenhum tenant encontrado. Pulando migration.';
        RETURN;
    END IF;

    -- Buscar conta do banco (1.1.1.05)
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE code = '1.1.1.05'
      AND is_active = true
    LIMIT 1;

    IF v_bank_account_id IS NULL THEN
        RAISE NOTICE 'Conta 1.1.1.05 não encontrada. Pulando migration.';
        RETURN;
    END IF;

    -- Buscar ou criar conta de Saldos de Abertura (5.2.1.01)
    SELECT id INTO v_opening_balance_account_id
    FROM chart_of_accounts
    WHERE code = '5.2.1.01'
      AND is_active = true
    LIMIT 1;

    IF v_opening_balance_account_id IS NULL THEN
        -- Criar a conta de Saldos de Abertura
        INSERT INTO chart_of_accounts (
            code, name, nature, account_type, is_analytical, is_active, tenant_id, level
        ) VALUES (
            '5.2.1.01',
            'Saldos de Abertura',
            'CREDORA',
            'equity',
            true,
            true,
            v_tenant_id,
            4
        )
        RETURNING id INTO v_opening_balance_account_id;

        RAISE NOTICE 'Conta de Saldos de Abertura criada: %', v_opening_balance_account_id;
    END IF;

    -- Verificar se já existe lançamento de abertura
    SELECT ae.id INTO v_entry_id
    FROM accounting_entries ae
    WHERE ae.tenant_id = v_tenant_id
      AND ae.entry_type = 'ABERTURA'
      AND ae.entry_date = v_date;

    IF v_entry_id IS NOT NULL THEN
        RAISE NOTICE 'Lançamento de abertura já existe. Pulando.';
        RETURN;
    END IF;

    -- Criar lançamento de abertura
    INSERT INTO accounting_entries (
        entry_date,
        competence_date,
        description,
        entry_type,
        tenant_id
    ) VALUES (
        v_date,
        v_date,
        'Saldo de Abertura - Banco Sicredi',
        'ABERTURA',
        v_tenant_id
    )
    RETURNING id INTO v_entry_id;

    -- Linha de débito (Banco - aumenta ativo)
    INSERT INTO accounting_entry_lines (
        entry_id,
        account_id,
        debit,
        credit,
        description,
        tenant_id
    ) VALUES (
        v_entry_id,
        v_bank_account_id,
        v_amount,
        0,
        'Saldo inicial do banco em 31/12/2024',
        v_tenant_id
    );

    -- Linha de crédito (Saldos de Abertura - PL)
    INSERT INTO accounting_entry_lines (
        entry_id,
        account_id,
        debit,
        credit,
        description,
        tenant_id
    ) VALUES (
        v_entry_id,
        v_opening_balance_account_id,
        0,
        v_amount,
        'Contrapartida saldo de abertura',
        v_tenant_id
    );

    -- Atualizar bank_accounts
    UPDATE bank_accounts
    SET initial_balance = v_amount,
        initial_balance_date = v_date
    WHERE is_active = true
      AND (initial_balance IS NULL OR initial_balance = 0 OR initial_balance != v_amount);

    RAISE NOTICE 'Lançamento de abertura criado: % - Valor: R$ %', v_entry_id, v_amount;
END;
$$;

-- ============================================================================
-- ETAPA 2: CRIAR LANÇAMENTO DE AJUSTE (31/01/2025)
-- ============================================================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_bank_account_id UUID;
    v_ajuste_account_id UUID;
    v_entry_id UUID;
    v_ajuste_valor NUMERIC := 132047.06;
    v_date DATE := '2025-01-31';
BEGIN
    -- Obter tenant
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Buscar conta do banco
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE code = '1.1.1.05'
      AND is_active = true
    LIMIT 1;

    IF v_bank_account_id IS NULL THEN
        RETURN;
    END IF;

    -- Buscar conta de ajustes
    SELECT id INTO v_ajuste_account_id
    FROM chart_of_accounts
    WHERE code = '5.2.1.01'
      AND is_active = true
    LIMIT 1;

    IF v_ajuste_account_id IS NULL THEN
        RETURN;
    END IF;

    -- Verificar se já existe lançamento de ajuste
    SELECT ae.id INTO v_entry_id
    FROM accounting_entries ae
    WHERE ae.tenant_id = v_tenant_id
      AND ae.description ILIKE '%ajuste%concilia%'
      AND ae.entry_date = v_date;

    IF v_entry_id IS NOT NULL THEN
        RAISE NOTICE 'Lançamento de ajuste já existe. Pulando.';
        RETURN;
    END IF;

    -- Criar lançamento de ajuste
    INSERT INTO accounting_entries (
        entry_date,
        competence_date,
        description,
        entry_type,
        tenant_id
    ) VALUES (
        v_date,
        v_date,
        'Ajuste de Conciliação Bancária - Janeiro/2025',
        'AJUSTE',
        v_tenant_id
    )
    RETURNING id INTO v_entry_id;

    -- Linha de débito (Ajustes - PL)
    INSERT INTO accounting_entry_lines (
        entry_id,
        account_id,
        debit,
        credit,
        description,
        tenant_id
    ) VALUES (
        v_entry_id,
        v_ajuste_account_id,
        v_ajuste_valor,
        0,
        'Ajuste conciliação bancária - Janeiro/2025',
        v_tenant_id
    );

    -- Linha de crédito (Banco - reduz saldo)
    INSERT INTO accounting_entry_lines (
        entry_id,
        account_id,
        debit,
        credit,
        description,
        tenant_id
    ) VALUES (
        v_entry_id,
        v_bank_account_id,
        0,
        v_ajuste_valor,
        'Ajuste conciliação bancária - Janeiro/2025',
        v_tenant_id
    );

    RAISE NOTICE 'Lançamento de ajuste criado: % - Valor: R$ %', v_entry_id, v_ajuste_valor;
END;
$$;

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

