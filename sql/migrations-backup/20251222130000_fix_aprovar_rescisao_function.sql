-- =====================================================
-- CORREÇÃO: Função aprovar_rescisao
-- A coluna correta é "description", não "history"
-- =====================================================

-- Dropar função existente para recriar com assinatura correta
DROP FUNCTION IF EXISTS aprovar_rescisao(UUID, UUID);

CREATE OR REPLACE FUNCTION aprovar_rescisao(
    p_termination_id UUID,
    p_approved_by UUID
) RETURNS UUID AS $$
DECLARE
    v_termination RECORD;
    v_employee RECORD;
    v_entry_id UUID;
    v_entry_number TEXT;
    v_conta_despesa_id UUID;
    v_conta_rescisao_id UUID;
BEGIN
    -- Buscar rescisão
    SELECT * INTO v_termination FROM employee_terminations WHERE id = p_termination_id;

    IF v_termination IS NULL THEN
        RAISE EXCEPTION 'Rescisão não encontrada';
    END IF;

    IF v_termination.status != 'pendente' THEN
        RAISE EXCEPTION 'Rescisão já foi processada';
    END IF;

    -- Buscar funcionário
    SELECT * INTO v_employee FROM employees WHERE id = v_termination.employee_id;

    IF v_employee IS NULL THEN
        RAISE EXCEPTION 'Funcionário não encontrado';
    END IF;

    -- Buscar contas contábeis (ou criar se não existirem)
    SELECT id INTO v_conta_despesa_id FROM chart_of_accounts
    WHERE code = '3.1.1.01' OR name ILIKE '%despesas%indeniza%' LIMIT 1;

    IF v_conta_despesa_id IS NULL THEN
        -- Usar conta genérica de despesas
        SELECT id INTO v_conta_despesa_id FROM chart_of_accounts
        WHERE type = 'expense' LIMIT 1;
    END IF;

    SELECT id INTO v_conta_rescisao_id FROM chart_of_accounts
    WHERE code = '2.1.2.01' OR name ILIKE '%rescis%pagar%' LIMIT 1;

    IF v_conta_rescisao_id IS NULL THEN
        -- Usar conta genérica de passivo
        SELECT id INTO v_conta_rescisao_id FROM chart_of_accounts
        WHERE type = 'liability' LIMIT 1;
    END IF;

    -- Gerar número do lançamento
    v_entry_number := 'RESC-' || to_char(now(), 'YYYYMMDD') || '-' ||
                      lpad((SELECT COALESCE(COUNT(*), 0) + 1 FROM accounting_entries
                            WHERE entry_date = CURRENT_DATE)::TEXT, 4, '0');

    -- Criar lançamento contábil
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
    -- CORREÇÃO: usar "description" ao invés de "history"
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

COMMENT ON FUNCTION aprovar_rescisao IS 'Aprova rescisão de funcionário e cria lançamento contábil';
