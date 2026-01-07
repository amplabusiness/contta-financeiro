
-- ============================================================================
-- 🛡️ BLINDAGEM CONTÁBIL - JAN/2026
-- Garantia de Integridade: Todo documento gera contabilidade automaticamente.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. FUNCTION: Gerar Contabilidade para Saldos de Abertura
CREATE OR REPLACE FUNCTION public.fn_auto_contabilizar_saldo_abertura()
RETURNS TRIGGER AS $$
DECLARE
    v_account_debit UUID;
    v_account_credit UUID;
    v_entry_id UUID;
    v_client_name TEXT;
    v_source_hash TEXT;
BEGIN
    -- Busca conta de cliente (1.1.2.01)
    SELECT id INTO v_account_debit 
    FROM chart_of_accounts 
    WHERE code = '1.1.2.01' LIMIT 1;

    -- Busca conta de contrapartida (Saldo Abertura - 5.3.02.02)
    SELECT id INTO v_account_credit
    FROM chart_of_accounts
    WHERE code = '5.3.02.02' LIMIT 1;

    -- Fallback se não achar
    IF v_account_debit IS NULL OR v_account_credit IS NULL THEN
        RAISE WARNING 'Contas contábeis não encontradas para blindagem de saldo abertura.';
        RETURN NEW;
    END IF;

    -- Busca nome do cliente
    SELECT name INTO v_client_name FROM clients WHERE id = NEW.client_id;

    -- Gera Hash Único (Certidão de Nascimento)
    v_source_hash := encode(digest(NEW.id::text || now()::text, 'sha256'), 'hex');

    -- Cria o lançamento (Entry)
    INSERT INTO accounting_entries (
        entry_date,
        competence_date,
        description,
        history,
        entry_type,
        document_type,
        reference_type,
        reference_id,
        total_debit,
        total_credit,
        balanced,
        source_type,
        source_id,
        source_hash,
        created_by
    ) VALUES (
        COALESCE(NEW.due_date, '2025-01-01'), -- Data do lançamento
        to_date(NEW.competence, 'MM/YYYY'),   -- Competência
        'Saldo Abertura - ' || v_client_name,
        'Importação Automática via Trigger (Blindagem)',
        'opening_balance',
        'opening_balance',
        'client_opening_balance',
        NEW.id,
        NEW.amount,
        NEW.amount,
        TRUE,
        'client_opening_balance',
        NEW.id,
        v_source_hash,
        NEW.created_by
    ) RETURNING id INTO v_entry_id;

    -- Cria as Linhas (Lines)
    -- Débito
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, v_account_debit, NEW.amount, 0, 'Débito: ' || v_client_name);

    -- Crédito
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, v_account_credit, 0, NEW.amount, 'Crédito: Saldo de Abertura');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER: Saldos de Abertura
DROP TRIGGER IF EXISTS trg_blindagem_saldo_abertura ON client_opening_balance;
CREATE TRIGGER trg_blindagem_saldo_abertura
AFTER INSERT ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_contabilizar_saldo_abertura();


-- 3. FUNCTION: Gerar Contabilidade para Invoices (Honorários)
CREATE OR REPLACE FUNCTION public.fn_auto_contabilizar_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_account_debit UUID;
    v_account_credit UUID;
    v_entry_id UUID;
    v_client_name TEXT;
    v_source_hash TEXT;
BEGIN
    -- Busca conta de cliente (1.1.2.01)
    SELECT id INTO v_account_debit 
    FROM chart_of_accounts 
    WHERE code = '1.1.2.01' LIMIT 1;

    -- Busca conta de Receita de Honorários (3.1.1.01 - Exemplo, ajustar se necessário)
    -- Vou buscar por nome 'Receita de Honorários' ou código comum de receita
    SELECT id INTO v_account_credit
    FROM chart_of_accounts
    WHERE name ILIKE '%Honorários%' AND account_type = 'Revenue' LIMIT 1;
    
    -- Se não achar receita específica, pega genérica
    IF v_account_credit IS NULL THEN
        SELECT id INTO v_account_credit
        FROM chart_of_accounts
        WHERE code LIKE '3.1%' AND account_type = 'Revenue' LIMIT 1;
    END IF;

    IF v_account_debit IS NULL OR v_account_credit IS NULL THEN
         RAISE WARNING 'Contas contábeis não encontradas para blindagem de invoice.';
         RETURN NEW;
    END IF;

    SELECT name INTO v_client_name FROM clients WHERE id = NEW.client_id;
    v_source_hash := encode(digest(NEW.id::text || now()::text, 'sha256'), 'hex');

    INSERT INTO accounting_entries (
        entry_date,
        competence_date,
        description,
        history,
        entry_type,
        document_type,
        reference_type,
        reference_id,
        total_debit,
        total_credit,
        balanced,
        source_type,
        source_id,
        source_hash,
        created_by
    ) VALUES (
        NEW.created_at::date,
        to_date(NEW.competence, 'MM/YYYY'),
        'Honorários - ' || v_client_name,
        'Emissão de Nota (Blindagem)',
        'revenue',
        'invoice',
        'invoice',
        NEW.id,
        NEW.amount,
        NEW.amount,
        TRUE,
        'invoices',
        NEW.id,
        v_source_hash,
        NEW.created_by
    ) RETURNING id INTO v_entry_id;

    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, v_account_debit, NEW.amount, 0, 'Débito: Clientes');

    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, v_account_credit, 0, NEW.amount, 'Crédito: Receita Honorários');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER: Invoices
DROP TRIGGER IF EXISTS trg_blindagem_invoices ON invoices;
CREATE TRIGGER trg_blindagem_invoices
AFTER INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_contabilizar_invoice();

-- Note: Para Payroll, como não há tabela 'payroll' clara, a blindagem fica pendente de criação da tabela.
-- Atualmente o 'usePayrollAccounting' insere direto. Recomendação: Criar tabela 'payroll_batches' e colocar trigger nela.
