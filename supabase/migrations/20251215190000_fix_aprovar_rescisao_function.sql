-- =====================================================
-- FIX: Corrigir função aprovar_rescisao
-- A função usa coluna 'history' mas a tabela tem 'description'
-- =====================================================

CREATE OR REPLACE FUNCTION aprovar_rescisao(
    p_termination_id UUID,
    p_approved_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_termination RECORD;
    v_employee RECORD;
    v_entry_id UUID;
    v_entry_number INTEGER;
    v_conta_rescisao_id UUID;
    v_conta_banco_id UUID;
    v_conta_despesa_id UUID;
BEGIN
    -- Buscar rescisão
    SELECT * INTO v_termination FROM employee_terminations WHERE id = p_termination_id;

    IF v_termination IS NULL THEN
        RAISE EXCEPTION 'Rescisão não encontrada';
    END IF;

    IF v_termination.status != 'calculada' THEN
        RAISE EXCEPTION 'Rescisão não está em status calculada';
    END IF;

    -- Buscar funcionário
    SELECT * INTO v_employee FROM employees WHERE id = v_termination.employee_id;

    -- Buscar contas contábeis
    SELECT id INTO v_conta_rescisao_id FROM chart_of_accounts WHERE code = '2.1.2.10.01';
    SELECT id INTO v_conta_despesa_id FROM chart_of_accounts WHERE code = '4.2.10';

    -- Criar número do lançamento
    SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number FROM accounting_entries;

    -- Criar lançamento contábil (provisão da rescisão)
    INSERT INTO accounting_entries (
        entry_number,
        entry_date,
        competence_date,
        description,
        entry_type,
        document_type,
        total_debit,
        total_credit,
        is_draft,
        created_by
    ) VALUES (
        v_entry_number,
        v_termination.termination_date,
        v_termination.termination_date,
        'Rescisão contratual - ' || v_employee.name,
        'RESCISAO',
        'TRCT',
        v_termination.valor_liquido,
        v_termination.valor_liquido,
        false,
        p_approved_by
    ) RETURNING id INTO v_entry_id;

    -- Lançamento: Débito em Despesa, Crédito em Rescisões a Pagar
    -- CORRIGIDO: usar 'description' ao invés de 'history'
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description) VALUES
    -- Débito: Despesas com Indenizações
    (v_entry_id, v_conta_despesa_id, v_termination.valor_liquido, 0,
     'Rescisão ' || v_employee.name || ' - ' || v_termination.termination_type),
    -- Crédito: Rescisões a Pagar
    (v_entry_id, v_conta_rescisao_id, 0, v_termination.valor_liquido,
     'Rescisão ' || v_employee.name || ' - ' || v_termination.termination_type);

    -- Atualizar rescisão
    UPDATE employee_terminations SET
        status = 'aprovada',
        accounting_entry_id = v_entry_id,
        approved_at = now(),
        approved_by = p_approved_by,
        updated_at = now()
    WHERE id = p_termination_id;

    -- Marcar funcionário como inativo
    UPDATE employees SET
        is_active = false,
        termination_date = v_termination.termination_date,
        updated_at = now()
    WHERE id = v_termination.employee_id;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aprovar_rescisao IS 'Aprova rescisão e gera lançamento contábil - CORRIGIDO: usa description ao invés de history';
