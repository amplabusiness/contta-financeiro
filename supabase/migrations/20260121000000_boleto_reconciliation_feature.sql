-- ============================================================================
-- MIGRATION: Funcionalidade de Conciliação de Boletos
-- ============================================================================
-- Esta migration consolida todas as mudanças necessárias para a funcionalidade
-- de conciliação automática de boletos.
--
-- IMPORTANTE: Antes de rodar em produção, verificar:
-- 1. SELECT code, COUNT(*), COUNT(DISTINCT tenant_id)
--    FROM chart_of_accounts GROUP BY code HAVING COUNT(*) > 1;
--    -> Todos os códigos duplicados devem ter tenants diferentes
--
-- 2. Fazer backup do banco antes de aplicar
-- ============================================================================

-- ============================================================================
-- PARTE 1: Funções Auxiliares
-- ============================================================================

-- Função para obter o tenant_id do usuário atual
CREATE OR REPLACE FUNCTION get_current_user_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM profiles
    WHERE id = auth.uid();
    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_current_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_tenant_id() TO service_role;

-- ============================================================================
-- PARTE 2: Ajuste de Constraint do Plano de Contas
-- ============================================================================
-- Permitir mesmo código de conta para diferentes tenants

-- Remover constraint antiga (código único globalmente) se existir
ALTER TABLE chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_code_key;

-- Criar nova constraint (código único por tenant) se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chart_of_accounts_code_tenant_key'
    ) THEN
        ALTER TABLE chart_of_accounts
        ADD CONSTRAINT chart_of_accounts_code_tenant_key UNIQUE (code, tenant_id);
    END IF;
END $$;

-- ============================================================================
-- PARTE 3: Estrutura Básica do Plano de Contas
-- ============================================================================

-- Função para criar plano de contas básico para um tenant
CREATE OR REPLACE FUNCTION ensure_basic_chart_of_accounts(p_tenant_id UUID)
RETURNS TABLE(account_code VARCHAR, account_name VARCHAR, was_created BOOLEAN) AS $$
DECLARE
    v_parent_id UUID;
    v_account_code VARCHAR;
    v_account_name VARCHAR;
BEGIN
    -- Verificar se já existe estrutura básica para ESTE tenant
    IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.2.01' AND tenant_id = p_tenant_id) THEN
        RETURN;
    END IF;

    -- 1. ATIVO
    v_account_code := '1';
    v_account_name := 'ATIVO';
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id) THEN
        INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, is_synthetic, accepts_entries, tenant_id)
        VALUES (v_account_code, v_account_name, 'ativo', 'devedora', 1, false, true, true, false, p_tenant_id)
        RETURNING id INTO v_parent_id;
        RETURN QUERY SELECT v_account_code::VARCHAR, v_account_name::VARCHAR, true::BOOLEAN;
    ELSE
        SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id;
    END IF;

    -- 1.1 ATIVO CIRCULANTE
    v_account_code := '1.1';
    v_account_name := 'ATIVO CIRCULANTE';
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id) THEN
        INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, is_synthetic, accepts_entries, parent_id, tenant_id)
        VALUES (v_account_code, v_account_name, 'ativo', 'devedora', 2, false, true, true, false, v_parent_id, p_tenant_id)
        RETURNING id INTO v_parent_id;
        RETURN QUERY SELECT v_account_code::VARCHAR, v_account_name::VARCHAR, true::BOOLEAN;
    ELSE
        SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id;
    END IF;

    -- 1.1.1 DISPONIBILIDADES
    v_account_code := '1.1.1';
    v_account_name := 'DISPONIBILIDADES';
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id) THEN
        INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, is_synthetic, accepts_entries, parent_id, tenant_id)
        VALUES (v_account_code, v_account_name, 'ativo', 'devedora', 3, false, true, true, false, v_parent_id, p_tenant_id);
        RETURN QUERY SELECT v_account_code::VARCHAR, v_account_name::VARCHAR, true::BOOLEAN;
    END IF;

    -- 1.1.1.05 BANCO SICREDI
    v_account_code := '1.1.1.05';
    v_account_name := 'BANCO SICREDI';
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id) THEN
        SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1.1' AND tenant_id = p_tenant_id;
        INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, is_synthetic, accepts_entries, parent_id, tenant_id)
        VALUES (v_account_code, v_account_name, 'ativo', 'devedora', 4, true, true, false, true, v_parent_id, p_tenant_id);
        RETURN QUERY SELECT v_account_code::VARCHAR, v_account_name::VARCHAR, true::BOOLEAN;
    END IF;

    -- 1.1.2 CRÉDITOS
    v_account_code := '1.1.2';
    v_account_name := 'CREDITOS';
    SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1' AND tenant_id = p_tenant_id;
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id) THEN
        INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, is_synthetic, accepts_entries, parent_id, tenant_id)
        VALUES (v_account_code, v_account_name, 'ativo', 'devedora', 3, false, true, true, false, v_parent_id, p_tenant_id)
        RETURNING id INTO v_parent_id;
        RETURN QUERY SELECT v_account_code::VARCHAR, v_account_name::VARCHAR, true::BOOLEAN;
    ELSE
        SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id;
    END IF;

    -- 1.1.2.01 CLIENTES A RECEBER
    v_account_code := '1.1.2.01';
    v_account_name := 'CLIENTES A RECEBER';
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = v_account_code AND tenant_id = p_tenant_id) THEN
        INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, is_synthetic, accepts_entries, parent_id, tenant_id)
        VALUES (v_account_code, v_account_name, 'ativo', 'devedora', 4, false, true, true, false, v_parent_id, p_tenant_id);
        RETURN QUERY SELECT v_account_code::VARCHAR, v_account_name::VARCHAR, true::BOOLEAN;
    END IF;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ensure_basic_chart_of_accounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_basic_chart_of_accounts(UUID) TO service_role;

-- ============================================================================
-- PARTE 4: Funções RPC para Conciliação
-- ============================================================================

-- Dropar versões antigas das funções (podem ter assinaturas diferentes)
DROP FUNCTION IF EXISTS find_bank_transaction_for_reconciliation(VARCHAR, NUMERIC, TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS find_bank_transaction_for_reconciliation(TEXT, NUMERIC, TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS find_bank_transaction_for_reconciliation(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS list_credit_bank_transactions(TIMESTAMP, TIMESTAMP, NUMERIC);
DROP FUNCTION IF EXISTS list_credit_bank_transactions(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS get_client_accounts(VARCHAR);
DROP FUNCTION IF EXISTS get_clients_parent_account();
DROP FUNCTION IF EXISTS get_next_client_account_code(VARCHAR);
DROP FUNCTION IF EXISTS create_client_account(VARCHAR, VARCHAR, UUID, UUID, TEXT);

-- Função para buscar transação bancária por documento, valor e data
CREATE OR REPLACE FUNCTION find_bank_transaction_for_reconciliation(
    p_documento TEXT,
    p_amount NUMERIC,
    p_start_date TEXT,
    p_end_date TEXT
)
RETURNS TABLE(
    id UUID,
    reference_id TEXT,
    amount NUMERIC,
    transaction_date DATE,
    description TEXT
) AS $$
DECLARE
    v_start DATE;
    v_end DATE;
    v_tenant_id UUID;
BEGIN
    v_start := p_start_date::DATE;
    v_end := p_end_date::DATE;
    v_tenant_id := get_current_user_tenant_id();

    IF v_tenant_id IS NULL THEN
        SELECT t.id INTO v_tenant_id FROM tenants t LIMIT 1;
    END IF;

    -- Busca com tolerância de 0.01 no valor
    RETURN QUERY
    SELECT
        bt.id,
        COALESCE(bt.fitid, bt.document_number, '')::TEXT as reference_id,
        bt.amount,
        bt.transaction_date,
        bt.description
    FROM bank_transactions bt
    WHERE bt.description ILIKE '%' || p_documento || '%'
    AND ABS(bt.amount - p_amount) < 0.01
    AND bt.transaction_date BETWEEN v_start AND v_end
    AND bt.tenant_id = v_tenant_id
    ORDER BY
        CASE WHEN bt.matched = false THEN 0 ELSE 1 END,
        bt.transaction_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION find_bank_transaction_for_reconciliation(TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION find_bank_transaction_for_reconciliation(TEXT, NUMERIC, TEXT, TEXT) TO service_role;

-- Função para buscar contas de clientes
CREATE OR REPLACE FUNCTION get_client_accounts(p_parent_code VARCHAR)
RETURNS TABLE(id UUID, code VARCHAR, name VARCHAR) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := get_current_user_tenant_id();
    IF v_tenant_id IS NULL THEN
        SELECT t.id INTO v_tenant_id FROM tenants t LIMIT 1;
    END IF;

    RETURN QUERY
    SELECT coa.id, coa.code::VARCHAR, coa.name::VARCHAR
    FROM chart_of_accounts coa
    WHERE coa.code LIKE p_parent_code || '.%'
    AND coa.tenant_id = v_tenant_id
    AND coa.is_analytical = true
    ORDER BY coa.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_client_accounts(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_client_accounts(VARCHAR) TO service_role;

-- Função para obter conta pai de clientes
CREATE OR REPLACE FUNCTION get_clients_parent_account()
RETURNS TABLE(account_id UUID, account_code VARCHAR, account_tenant_id UUID) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := get_current_user_tenant_id();
    IF v_tenant_id IS NULL THEN
        SELECT t.id INTO v_tenant_id FROM tenants t LIMIT 1;
    END IF;

    -- Criar plano de contas básico se não existir
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '1.1.2.01' AND tenant_id = v_tenant_id) THEN
        PERFORM ensure_basic_chart_of_accounts(v_tenant_id);
    END IF;

    RETURN QUERY
    SELECT coa.id AS account_id, coa.code::VARCHAR AS account_code, coa.tenant_id AS account_tenant_id
    FROM chart_of_accounts coa
    WHERE coa.code = '1.1.2.01'
    AND coa.tenant_id = v_tenant_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_clients_parent_account() TO authenticated;
GRANT EXECUTE ON FUNCTION get_clients_parent_account() TO service_role;

-- Função para obter próximo código de conta de cliente
CREATE OR REPLACE FUNCTION get_next_client_account_code(p_parent_code VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_tenant_id UUID;
    v_max_suffix INT;
    v_next_code VARCHAR;
BEGIN
    v_tenant_id := get_current_user_tenant_id();
    IF v_tenant_id IS NULL THEN
        SELECT t.id INTO v_tenant_id FROM tenants t LIMIT 1;
    END IF;

    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM LENGTH(p_parent_code) + 2) AS INT)), 0)
    INTO v_max_suffix
    FROM chart_of_accounts
    WHERE code LIKE p_parent_code || '.%'
    AND LENGTH(code) = LENGTH(p_parent_code) + 4
    AND tenant_id = v_tenant_id;

    v_next_code := p_parent_code || '.' || LPAD((v_max_suffix + 1)::TEXT, 3, '0');
    RETURN v_next_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_next_client_account_code(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_client_account_code(VARCHAR) TO service_role;

-- Função para criar conta de cliente
CREATE OR REPLACE FUNCTION create_client_account(
    p_code VARCHAR,
    p_name VARCHAR,
    p_parent_id UUID,
    p_tenant_id UUID,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, code VARCHAR, name VARCHAR) AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO chart_of_accounts (
        code, name, account_type, nature, level,
        is_analytical, is_active, is_synthetic, accepts_entries,
        parent_id, tenant_id, description
    )
    VALUES (
        p_code, p_name, 'ativo', 'devedora', 5,
        true, true, false, true,
        p_parent_id, p_tenant_id, p_description
    )
    RETURNING chart_of_accounts.id INTO v_new_id;

    RETURN QUERY SELECT v_new_id, p_code::VARCHAR, p_name::VARCHAR;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_client_account(VARCHAR, VARCHAR, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_client_account(VARCHAR, VARCHAR, UUID, UUID, TEXT) TO service_role;

-- ============================================================================
-- PARTE 5: Função para buscar clientes para matching
-- ============================================================================

-- Dropar versão antiga se existir
DROP FUNCTION IF EXISTS get_clients_for_matching();

-- Função RPC para buscar clientes para matching de boletos
-- Usa SECURITY DEFINER para bypass de RLS
CREATE OR REPLACE FUNCTION get_clients_for_matching()
RETURNS TABLE(
    id UUID,
    name TEXT,
    accounting_account_id UUID
) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Obter tenant do usuário atual
    v_tenant_id := get_current_user_tenant_id();

    -- Se não encontrou tenant do usuário, usar fallback
    IF v_tenant_id IS NULL THEN
        SELECT t.id INTO v_tenant_id FROM tenants t LIMIT 1;
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.name::TEXT,
        c.accounting_account_id
    FROM clients c
    WHERE c.tenant_id = v_tenant_id
    ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_clients_for_matching() TO authenticated;
GRANT EXECUTE ON FUNCTION get_clients_for_matching() TO service_role;

COMMENT ON FUNCTION get_clients_for_matching() IS
'Busca todos os clientes do tenant atual para matching de boletos.
Usa SECURITY DEFINER para bypass de RLS.';

-- ============================================================================
-- PARTE 6: Coluna pagador em boleto_payments
-- ============================================================================

ALTER TABLE boleto_payments ADD COLUMN IF NOT EXISTS pagador VARCHAR(255);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_boleto_payments_cob_valor ON boleto_payments(cob, valor_liquidado);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_data_extrato ON boleto_payments(data_extrato);

-- Unique index para evitar duplicatas na importação
CREATE UNIQUE INDEX IF NOT EXISTS idx_boleto_payments_unique_import
ON boleto_payments(cob, pagador, valor_liquidado, data_extrato, tenant_id)
WHERE cob IS NOT NULL AND pagador IS NOT NULL;

-- ============================================================================
-- PARTE 7: Função para criar lançamento contábil a partir de transação bancária
-- ============================================================================
-- A coluna client_id não existe na tabela accounting_entries.
-- Esta função cria lançamentos contábeis a partir de transações bancárias,
-- identificando automaticamente o cliente pela descrição quando possível.

CREATE OR REPLACE FUNCTION public.create_entry_from_bank_transaction(p_transaction_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
    v_tx RECORD;
    v_entry_id UUID;
    v_entry_type VARCHAR;
    v_debit_account_id UUID;
    v_credit_account_id UUID;
    v_bank_account_id UUID;
    v_description VARCHAR;
    v_client_account_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Get transaction data
    SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

    IF v_tx IS NULL THEN
        RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
    END IF;

    -- Get tenant_id from transaction
    v_tenant_id := v_tx.tenant_id;

    -- Check if entry already exists
    SELECT id INTO v_entry_id
    FROM accounting_entries
    WHERE source_type = 'bank_transaction' AND source_id = p_transaction_id;

    IF v_entry_id IS NOT NULL THEN
        RETURN v_entry_id;
    END IF;

    -- Get Sicredi account (for the current tenant)
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE code = '1.1.1.05' AND tenant_id = v_tenant_id;

    -- If not found, try without tenant filter (fallback)
    IF v_bank_account_id IS NULL THEN
        SELECT id INTO v_bank_account_id
        FROM chart_of_accounts WHERE code = '1.1.1.05' LIMIT 1;
    END IF;

    -- Determine entry type and accounts based on transaction
    IF v_tx.transaction_type = 'credit' THEN
        -- RECEBIMENTO (entrada de dinheiro)
        v_entry_type := 'recebimento';
        v_debit_account_id := v_bank_account_id;

        -- Tentar identificar cliente pela descrição e usar sua conta específica
        v_client_account_id := NULL;

        -- Buscar cliente pelo CNPJ na descrição
        SELECT c.accounting_account_id INTO v_client_account_id
        FROM clients c
        WHERE c.cnpj IS NOT NULL
        AND v_tx.description LIKE '%' || c.cnpj || '%'
        AND c.accounting_account_id IS NOT NULL
        AND c.tenant_id = v_tenant_id
        LIMIT 1;

        -- Se não achou pelo CNPJ, buscar por parte do nome
        IF v_client_account_id IS NULL THEN
            SELECT c.accounting_account_id INTO v_client_account_id
            FROM clients c
            WHERE c.accounting_account_id IS NOT NULL
            AND UPPER(v_tx.description) LIKE '%' || UPPER(SUBSTRING(c.name FROM 1 FOR 15)) || '%'
            AND c.tenant_id = v_tenant_id
            LIMIT 1;
        END IF;

        -- Usar conta do cliente ou conta genérica
        IF v_client_account_id IS NOT NULL THEN
            v_credit_account_id := v_client_account_id;
        ELSE
            -- Fallback: conta genérica de clientes a receber
            SELECT id INTO v_credit_account_id
            FROM chart_of_accounts
            WHERE code = '1.1.2.01' AND tenant_id = v_tenant_id;

            IF v_credit_account_id IS NULL THEN
                SELECT id INTO v_credit_account_id
                FROM chart_of_accounts WHERE code = '1.1.2.01' LIMIT 1;
            END IF;
        END IF;

        v_description := CONCAT('Recebimento: ', LEFT(v_tx.description, 70));

    ELSE
        -- PAGAMENTO (saída de dinheiro)
        v_entry_type := 'pagamento_despesa';
        v_credit_account_id := v_bank_account_id;

        -- Conta genérica de despesas operacionais
        SELECT id INTO v_debit_account_id
        FROM chart_of_accounts
        WHERE code = '4.1.1.08' AND tenant_id = v_tenant_id;

        IF v_debit_account_id IS NULL THEN
            SELECT id INTO v_debit_account_id
            FROM chart_of_accounts WHERE code = '4.1.1.08' LIMIT 1;
        END IF;

        v_description := CONCAT('Despesa: ', LEFT(v_tx.description, 70));
    END IF;

    -- Verificar se temos as contas necessárias
    IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
        -- Não criar entrada se não houver contas configuradas
        RAISE WARNING 'Contas contábeis não encontradas para transação %', p_transaction_id;
        RETURN NULL;
    END IF;

    -- Create accounting entry (SEM client_id que não existe na tabela)
    INSERT INTO accounting_entries (
        description,
        entry_date,
        competence_date,
        entry_type,
        is_draft,
        source_type,
        source_id,
        tenant_id,
        total_debit,
        total_credit,
        balanced,
        created_at,
        updated_at
    ) VALUES (
        v_description,
        v_tx.transaction_date,
        v_tx.transaction_date,
        v_entry_type,
        true,
        'bank_transaction',
        p_transaction_id,
        v_tenant_id,
        ABS(v_tx.amount),
        ABS(v_tx.amount),
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO v_entry_id;

    -- Create Debit Line
    INSERT INTO accounting_entry_lines (
        entry_id,
        account_id,
        debit,
        credit,
        description
    ) VALUES (
        v_entry_id,
        v_debit_account_id,
        ABS(v_tx.amount),
        0,
        CONCAT('D - ', (SELECT name FROM chart_of_accounts WHERE id = v_debit_account_id))
    );

    -- Create Credit Line
    INSERT INTO accounting_entry_lines (
        entry_id,
        account_id,
        debit,
        credit,
        description
    ) VALUES (
        v_entry_id,
        v_credit_account_id,
        0,
        ABS(v_tx.amount),
        CONCAT('C - ', (SELECT name FROM chart_of_accounts WHERE id = v_credit_account_id))
    );

    RETURN v_entry_id;
END;
$function$;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
