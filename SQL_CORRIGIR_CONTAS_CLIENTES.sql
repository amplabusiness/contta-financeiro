-- ============================================================================
-- CORREÇÃO DA ESTRUTURA DE CONTAS DE CLIENTES A RECEBER
-- Execute este SQL no Supabase Dashboard: SQL Editor
-- Dr. Cícero - Auditoria Contábil
-- ============================================================================
-- 
-- PROBLEMA: 
--   Os lançamentos de recebimento estão indo para a conta genérica 1.1.2.01
--   sem identificar QUAL cliente pagou.
--
-- SOLUÇÃO:
--   1. Tornar 1.1.2.01 SINTÉTICA (apenas soma)
--   2. Cada cliente terá sua subconta analítica (1.1.2.01.XXXX)
--   3. Vincular cliente à sua conta contábil
--   4. Atualizar função de lançamento para usar conta do cliente
-- ============================================================================

-- ========== PASSO 0: Desabilitar TODOS os triggers user-defined da tabela clients ==========
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'clients'::regclass 
        AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE clients DISABLE TRIGGER %I', r.tgname);
        RAISE NOTICE 'Trigger desabilitado: %', r.tgname;
    END LOOP;
END $$;

-- ========== PASSO 1: Adicionar coluna accounting_account_id na tabela clients ==========
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS accounting_account_id UUID REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN clients.accounting_account_id IS 
'ID da conta contábil do cliente em Clientes a Receber (1.1.2.01.XXXX)';

-- ========== PASSO 2: Tornar 1.1.2.01 conta SINTÉTICA ==========
UPDATE chart_of_accounts 
SET 
    is_synthetic = true,
    is_analytical = false
WHERE code = '1.1.2.01';

-- ========== PASSO 3: Ativar subcontas existentes e torná-las analíticas ==========
UPDATE chart_of_accounts 
SET 
    is_active = true,
    is_analytical = true,
    is_synthetic = false
WHERE code LIKE '1.1.2.01.%';

-- ========== PASSO 4: Criar função para gerar código sequencial ==========
CREATE OR REPLACE FUNCTION get_next_client_account_code()
RETURNS VARCHAR AS $$
DECLARE
    v_max_code VARCHAR;
    v_next_num INT;
BEGIN
    SELECT MAX(code) INTO v_max_code 
    FROM chart_of_accounts 
    WHERE code LIKE '1.1.2.01.%' AND code ~ '^1\.1\.2\.01\.[0-9]+$';
    
    IF v_max_code IS NULL THEN
        v_next_num := 1;
    ELSE
        v_next_num := CAST(SUBSTRING(v_max_code FROM '\.([0-9]+)$') AS INT) + 1;
    END IF;
    
    RETURN '1.1.2.01.' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ========== PASSO 5: Função para criar conta contábil para um cliente ==========
CREATE OR REPLACE FUNCTION create_client_accounting_account(
    p_client_id UUID
) RETURNS UUID AS $$
DECLARE
    v_client RECORD;
    v_parent_id UUID;
    v_account_id UUID;
    v_code VARCHAR;
    v_existing_id UUID;
BEGIN
    -- Buscar dados do cliente
    SELECT * INTO v_client FROM clients WHERE id = p_client_id;
    
    IF v_client IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado: %', p_client_id;
    END IF;
    
    -- Verificar se cliente já tem conta
    IF v_client.accounting_account_id IS NOT NULL THEN
        RETURN v_client.accounting_account_id;
    END IF;
    
    -- Buscar conta pai (1.1.2.01)
    SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1.2.01';
    
    -- Verificar se já existe conta com o nome do cliente
    SELECT id INTO v_existing_id 
    FROM chart_of_accounts 
    WHERE code LIKE '1.1.2.01.%' 
    AND (
        UPPER(name) LIKE '%' || UPPER(COALESCE(v_client.razao_social, v_client.name)) || '%'
        OR UPPER(name) LIKE '%' || UPPER(v_client.cnpj) || '%'
    )
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
        -- Usar conta existente
        v_account_id := v_existing_id;
        
        -- Ativar se estiver inativa
        UPDATE chart_of_accounts SET is_active = true WHERE id = v_account_id;
    ELSE
        -- Criar nova conta
        v_code := get_next_client_account_code();
        
        INSERT INTO chart_of_accounts (
            code,
            name,
            parent_id,
            account_type,
            nature,
            level,
            is_synthetic,
            is_analytical,
            is_active
        ) VALUES (
            v_code,
            COALESCE(v_client.razao_social, v_client.name),
            v_parent_id,
            'asset',
            'debit',
            5,
            false,
            true,
            true
        ) RETURNING id INTO v_account_id;
    END IF;
    
    -- Vincular conta ao cliente
    UPDATE clients SET accounting_account_id = v_account_id WHERE id = p_client_id;
    
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- ========== PASSO 6: Criar contas para TODOS os clientes ativos ==========
DO $$
DECLARE
    v_client RECORD;
    v_count INT := 0;
BEGIN
    FOR v_client IN 
        SELECT id, name FROM clients 
        WHERE status = 'active' 
        AND accounting_account_id IS NULL
    LOOP
        PERFORM create_client_accounting_account(v_client.id);
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Contas criadas/vinculadas para % clientes', v_count;
END $$;

-- ========== PASSO 7: Vincular contas existentes aos clientes pelo nome/CNPJ ==========
DO $$
DECLARE
    v_client RECORD;
    v_conta RECORD;
    v_matched INT := 0;
BEGIN
    -- Para cada cliente sem conta
    FOR v_client IN 
        SELECT id, name, razao_social, cnpj 
        FROM clients 
        WHERE accounting_account_id IS NULL
    LOOP
        -- Buscar conta existente que case com o nome ou CNPJ
        SELECT id INTO v_conta 
        FROM chart_of_accounts 
        WHERE code LIKE '1.1.2.01.%'
        AND (
            UPPER(name) LIKE '%' || UPPER(SUBSTRING(COALESCE(v_client.razao_social, v_client.name) FROM 1 FOR 20)) || '%'
            OR (v_client.cnpj IS NOT NULL AND UPPER(name) LIKE '%' || v_client.cnpj || '%')
        )
        LIMIT 1;
        
        IF v_conta.id IS NOT NULL THEN
            UPDATE clients SET accounting_account_id = v_conta.id WHERE id = v_client.id;
            UPDATE chart_of_accounts SET is_active = true WHERE id = v_conta.id;
            v_matched := v_matched + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Vinculadas % contas existentes a clientes', v_matched;
END $$;

-- ========== PASSO 8: Atualizar função de criação de lançamentos ==========
CREATE OR REPLACE FUNCTION create_entry_from_bank_transaction(
    p_transaction_id UUID
) RETURNS UUID AS $$
DECLARE
    v_tx RECORD;
    v_entry_id UUID;
    v_entry_type VARCHAR;
    v_debit_account_id UUID;
    v_credit_account_id UUID;
    v_bank_account_id UUID;
    v_description VARCHAR;
    v_client_id UUID;
    v_client_account_id UUID;
BEGIN
    -- Get transaction data
    SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

    IF v_tx IS NULL THEN
        RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
    END IF;

    -- Check if entry already exists
    SELECT id INTO v_entry_id
    FROM accounting_entries
    WHERE source_type = 'bank_transaction' AND source_id = p_transaction_id;

    IF v_entry_id IS NOT NULL THEN
        RETURN v_entry_id; 
    END IF;

    -- Get Sicredi account
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts WHERE code = '1.1.1.05';

    -- Determine entry type and accounts based on transaction
    IF v_tx.transaction_type = 'credit' THEN
        -- RECEBIMENTO (entrada de dinheiro)
        v_entry_type := 'recebimento';
        v_debit_account_id := v_bank_account_id;
        
        -- NOVO: Tentar identificar cliente pelo CNPJ/CPF na descrição
        -- e usar sua conta específica
        v_client_account_id := NULL;
        
        -- Buscar cliente pelo CNPJ na descrição
        SELECT c.accounting_account_id, c.id INTO v_client_account_id, v_client_id
        FROM clients c
        WHERE c.cnpj IS NOT NULL 
        AND v_tx.description LIKE '%' || c.cnpj || '%'
        AND c.accounting_account_id IS NOT NULL
        LIMIT 1;
        
        -- Se não achou pelo CNPJ, buscar por parte do nome
        IF v_client_account_id IS NULL THEN
            SELECT c.accounting_account_id, c.id INTO v_client_account_id, v_client_id
            FROM clients c
            WHERE c.accounting_account_id IS NOT NULL
            AND UPPER(v_tx.description) LIKE '%' || UPPER(SUBSTRING(c.name FROM 1 FOR 15)) || '%'
            LIMIT 1;
        END IF;
        
        -- Usar conta do cliente ou conta genérica
        IF v_client_account_id IS NOT NULL THEN
            v_credit_account_id := v_client_account_id;
        ELSE
            -- Fallback: conta genérica (não ideal, mas evita erro)
            SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
        END IF;
        
        v_description := CONCAT('Recebimento: ', LEFT(v_tx.description, 70));

    ELSE
        -- PAGAMENTO (saída de dinheiro)
        
        -- A. SOCIOS E ADIANTAMENTOS
        IF UPPER(v_tx.description) LIKE '%SERGIO CARNEIRO%' 
           OR UPPER(v_tx.description) LIKE '%NAYARA%' 
           OR UPPER(v_tx.description) LIKE '%VICTOR HUGO%' 
           OR UPPER(v_tx.description) LIKE '%SERGIO AUGUSTO%' 
           OR UPPER(v_tx.description) LIKE '%AMPLA CONTABILIDADE%' 
           OR UPPER(v_tx.description) LIKE '%AMPLA SAUDE%' THEN
            
            v_entry_type := 'adiantamento_socio';
            v_credit_account_id := v_bank_account_id;

            IF UPPER(v_tx.description) LIKE '%SERGIO CARNEIRO%' THEN
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.01';
            ELSIF UPPER(v_tx.description) LIKE '%NAYARA%' THEN
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.04';
            ELSIF UPPER(v_tx.description) LIKE '%VICTOR HUGO%' THEN
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.03';
            ELSIF UPPER(v_tx.description) LIKE '%SERGIO AUGUSTO%' THEN
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.05';
            ELSE
                SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.02';
            END IF;
            v_description := CONCAT('Adiantamento Socio: ', LEFT(v_tx.description, 60));

        -- B. REGRA ESPECÍFICA: ECONET / REVISTAS
        ELSIF UPPER(v_tx.description) LIKE '%ECONET%' 
           OR UPPER(v_tx.description) LIKE '%REVISTA%' 
           OR UPPER(v_tx.description) LIKE '%PERIODICO%' THEN
           
            v_entry_type := 'pagamento_despesa';
            v_credit_account_id := v_bank_account_id;
            SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.2.16';
            v_description := CONCAT('Assinatura/Revista: ', LEFT(v_tx.description, 70));

        -- C. REGRA GERAL: OUTRAS DESPESAS
        ELSE
            v_entry_type := 'pagamento_despesa';
            v_credit_account_id := v_bank_account_id;
            SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.1.08';
            v_description := CONCAT('Despesa: ', LEFT(v_tx.description, 70));
        END IF;
    END IF;

    -- Create accounting entry
    INSERT INTO accounting_entries (
        description,
        entry_date,
        competence_date,
        entry_type,
        is_draft,
        source_type,
        source_id,
        client_id,
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
        v_client_id,
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
        v_tx.amount, 
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
        v_tx.amount,
        CONCAT('C - ', (SELECT name FROM chart_of_accounts WHERE id = v_credit_account_id))
    );

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ========== PASSO 9: Criar índice para busca de cliente por CNPJ ==========
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON clients(cnpj);
CREATE INDEX IF NOT EXISTS idx_clients_accounting_account ON clients(accounting_account_id);

-- ========== PASSO 10: Reabilitar triggers da tabela clients ==========
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'clients'::regclass 
        AND NOT tgisinternal
    LOOP
        EXECUTE format('ALTER TABLE clients ENABLE TRIGGER %I', r.tgname);
        RAISE NOTICE 'Trigger reabilitado: %', r.tgname;
    END LOOP;
END $$;

-- ========== VERIFICAÇÃO FINAL ==========
DO $$
DECLARE
    v_total_clientes INT;
    v_com_conta INT;
    v_sem_conta INT;
    v_subcontas_ativas INT;
BEGIN
    SELECT COUNT(*) INTO v_total_clientes FROM clients WHERE status = 'active';
    SELECT COUNT(*) INTO v_com_conta FROM clients WHERE accounting_account_id IS NOT NULL AND status = 'active';
    SELECT COUNT(*) INTO v_sem_conta FROM clients WHERE accounting_account_id IS NULL AND status = 'active';
    SELECT COUNT(*) INTO v_subcontas_ativas FROM chart_of_accounts WHERE code LIKE '1.1.2.01.%' AND is_active = true;
    
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  RESULTADO DA CORREÇÃO DE CONTAS DE CLIENTES                 ║';
    RAISE NOTICE '╠══════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Total de clientes ativos:     %                             ║', v_total_clientes;
    RAISE NOTICE '║  Clientes COM conta contábil:  %                             ║', v_com_conta;
    RAISE NOTICE '║  Clientes SEM conta contábil:  %                             ║', v_sem_conta;
    RAISE NOTICE '║  Subcontas de clientes ativas: %                             ║', v_subcontas_ativas;
    RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
END $$;

-- Listar clientes com suas contas
SELECT 
    c.name AS cliente,
    c.cnpj,
    coa.code AS codigo_conta,
    coa.name AS nome_conta,
    coa.is_active AS conta_ativa
FROM clients c
LEFT JOIN chart_of_accounts coa ON c.accounting_account_id = coa.id
WHERE c.status = 'active'
ORDER BY c.name
LIMIT 20;
