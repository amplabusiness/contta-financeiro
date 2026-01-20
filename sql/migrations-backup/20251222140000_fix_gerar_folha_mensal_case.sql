-- =====================================================
-- CORREÇÃO: Função gerar_folha_mensal
-- O filtro contract_type = 'clt' é case-sensitive
-- Mudar para UPPER() ou ILIKE para aceitar 'CLT', 'clt', 'Clt'
-- =====================================================

CREATE OR REPLACE FUNCTION gerar_folha_mensal(p_competencia DATE)
RETURNS TABLE (
    employee_name TEXT,
    payroll_id UUID,
    liquido_oficial DECIMAL,
    total_por_fora DECIMAL,
    liquido_real DECIMAL
) AS $$
DECLARE
    v_emp RECORD;
BEGIN
    -- CORREÇÃO: usar UPPER() para comparação case-insensitive
    FOR v_emp IN SELECT id, name FROM employees WHERE is_active AND UPPER(contract_type) = 'CLT' LOOP
        RETURN QUERY
        SELECT
            v_emp.name,
            gerar_folha_funcionario(v_emp.id, p_competencia),
            p.liquido_oficial,
            p.total_por_fora,
            p.liquido_total_real
        FROM payroll p
        WHERE p.employee_id = v_emp.id AND p.competencia = p_competencia;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Também corrigir a função gerar_folha_funcionario que filtra por contract_type
CREATE OR REPLACE FUNCTION auto_generate_payroll()
RETURNS TRIGGER AS $$
BEGIN
    -- CORREÇÃO: usar UPPER() para comparação case-insensitive
    IF UPPER(NEW.contract_type) = 'CLT' AND NEW.is_active THEN
        PERFORM gerar_folha_funcionario(NEW.id, date_trunc('month', CURRENT_DATE)::date);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION gerar_folha_mensal IS 'Gera folha de pagamento mensal para todos funcionários CLT ativos';
