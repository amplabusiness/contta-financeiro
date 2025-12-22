-- =====================================================
-- CORREÇÃO: Adicionar coluna dependents na tabela employees
-- Necessário para cálculo de IRRF na folha de pagamento
-- =====================================================

-- Adicionar coluna de dependentes
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dependents INTEGER DEFAULT 0;

COMMENT ON COLUMN employees.dependents IS 'Número de dependentes para cálculo do IRRF';

-- Atualizar função gerar_folha_funcionario para usar COALESCE com 0
CREATE OR REPLACE FUNCTION gerar_folha_funcionario(
    p_employee_id UUID,
    p_competencia DATE
) RETURNS UUID AS $$
DECLARE
    v_payroll_id UUID;
    v_employee RECORD;
    v_salario_base DECIMAL;
    v_complemento DECIMAL;
    v_total_proventos DECIMAL := 0;
    v_total_descontos DECIMAL := 0;
    v_base_inss DECIMAL;
    v_inss DECIMAL;
    v_irrf DECIMAL;
    v_fgts DECIMAL;
BEGIN
    -- Buscar dados do funcionário
    SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;

    IF v_employee IS NULL THEN
        RAISE EXCEPTION 'Funcionário não encontrado';
    END IF;

    -- Extrair valores do salary_details
    v_salario_base := COALESCE((v_employee.salary_details->>'base_oficial')::decimal, v_employee.official_salary);
    v_complemento := COALESCE(
        (v_employee.salary_details->>'complemento_por_fora')::decimal,
        v_employee.unofficial_salary
    );

    -- Criar registro da folha
    INSERT INTO payroll (employee_id, competencia, status, data_calculo)
    VALUES (p_employee_id, p_competencia, 'calculada', now())
    ON CONFLICT (employee_id, competencia) DO UPDATE SET
        status = 'calculada',
        data_calculo = now(),
        updated_at = now()
    RETURNING id INTO v_payroll_id;

    -- Limpar eventos anteriores
    DELETE FROM payroll_events WHERE payroll_id = v_payroll_id;

    -- ===== PROVENTOS OFICIAIS =====

    -- 1. Salário Base
    INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
    VALUES (v_payroll_id, '1000', 'Salário Base', '30 dias', v_salario_base, true, false);
    v_total_proventos := v_total_proventos + v_salario_base;

    -- 2. DSR (se horista - não aplicável para mensalista)
    -- Para mensalistas o DSR já está incluso no salário base

    -- 3. Vale Transporte (crédito para desconto)
    IF COALESCE(v_employee.transport_voucher_value, 0) > 0 THEN
        INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
        VALUES (v_payroll_id, '1080', 'Vale Transporte', '22 dias', v_employee.transport_voucher_value, true, false);
    END IF;

    -- 4. Vale Refeição/Alimentação
    IF COALESCE(v_employee.meal_voucher_value, 0) > 0 THEN
        INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
        VALUES (v_payroll_id, '1090', 'Vale Alimentação', '22 dias', v_employee.meal_voucher_value, true, false);
    END IF;

    -- ===== DESCONTOS OFICIAIS =====
    v_base_inss := v_total_proventos;

    -- 1. INSS
    v_inss := calcular_inss(v_base_inss);
    INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
    VALUES (v_payroll_id, '2000', 'INSS', ROUND(v_inss * 100 / NULLIF(v_base_inss, 0), 2)::text || '%', v_inss, true, true);
    v_total_descontos := v_total_descontos + v_inss;

    -- 2. IRRF (CORREÇÃO: usar COALESCE para dependents)
    v_irrf := calcular_irrf(v_base_inss - v_inss, COALESCE(v_employee.dependents, 0));
    IF v_irrf > 0 THEN
        INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
        VALUES (v_payroll_id, '2001', 'IRRF', '', v_irrf, true, true);
        v_total_descontos := v_total_descontos + v_irrf;
    END IF;

    -- 3. Desconto Vale Transporte (6% do salário, máx do VT)
    IF COALESCE(v_employee.transport_voucher_value, 0) > 0 THEN
        DECLARE v_desc_vt DECIMAL;
        BEGIN
            v_desc_vt := LEAST(v_salario_base * 0.06, v_employee.transport_voucher_value);
            INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
            VALUES (v_payroll_id, '2010', 'Desc. Vale Transporte', '6%', v_desc_vt, true, true);
            v_total_descontos := v_total_descontos + v_desc_vt;
        END;
    END IF;

    -- 4. Plano de Saúde
    IF COALESCE(v_employee.health_plan_discount, 0) > 0 THEN
        INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
        VALUES (v_payroll_id, '2070', 'Plano de Saúde', '', v_employee.health_plan_discount, true, true);
        v_total_descontos := v_total_descontos + v_employee.health_plan_discount;
    END IF;

    -- ===== PAGAMENTOS "POR FORA" =====
    IF v_complemento > 0 THEN
        INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto, observacao)
        VALUES (
            v_payroll_id,
            '9000',
            'Complemento Salarial (por fora)',
            '',
            v_complemento,
            false,
            false,
            v_employee.salary_details->>'justificativa_por_fora'
        );
    END IF;

    -- ===== CALCULAR ENCARGOS =====
    v_fgts := v_base_inss * 0.08;

    -- ===== ATUALIZAR TOTAIS =====
    UPDATE payroll SET
        total_proventos_oficial = v_total_proventos,
        total_descontos_oficial = v_total_descontos,
        liquido_oficial = v_total_proventos - v_total_descontos,
        total_por_fora = v_complemento,
        liquido_total_real = (v_total_proventos - v_total_descontos) + v_complemento,
        fgts_valor = v_fgts,
        inss_empresa = v_base_inss * 0.20, -- 20% patronal
        provisao_ferias = v_base_inss / 12 * 1.3333, -- 1 mês + 1/3
        provisao_13 = v_base_inss / 12,
        custo_total_empresa = v_total_proventos + v_fgts + (v_base_inss * 0.20) + (v_base_inss * 0.058) -- RAT + Terceiros
    WHERE id = v_payroll_id;

    RETURN v_payroll_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION gerar_folha_funcionario IS 'Gera folha de pagamento individual para um funcionário';
