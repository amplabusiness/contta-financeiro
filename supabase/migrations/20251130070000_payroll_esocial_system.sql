-- =====================================================
-- AMPLA CONTABILIDADE - Sistema de Folha de Pagamento eSocial
-- Migration: 20251130070000
-- Descrição: Sistema completo de folha de pagamento com rubricas
--            eSocial, detalhamento de pagamentos oficiais e extras
-- =====================================================

-- =====================================================
-- RUBRICAS eSocial (Eventos de Pagamento)
-- =====================================================

CREATE TABLE IF NOT EXISTS esocial_rubricas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL, -- Código da rubrica (ex: 1000, 1001)
    descricao TEXT NOT NULL,
    natureza TEXT NOT NULL, -- 'provento', 'desconto', 'informativa'
    tipo_rubrica TEXT NOT NULL, -- 'salario', 'hora_extra', 'adicional', 'desconto', etc
    incide_inss BOOLEAN DEFAULT false,
    incide_irrf BOOLEAN DEFAULT false,
    incide_fgts BOOLEAN DEFAULT false,
    incide_ferias BOOLEAN DEFAULT false,
    incide_13 BOOLEAN DEFAULT false,
    formula_calculo TEXT, -- Fórmula para cálculo automático
    percentual_padrao DECIMAL(5,2), -- Se for percentual
    cod_incidencia_cp TEXT, -- Código incidência contribuição previdenciária
    cod_incidencia_irrf TEXT, -- Código incidência IRRF
    cod_incidencia_fgts TEXT, -- Código incidência FGTS
    is_oficial BOOLEAN DEFAULT true, -- Se é oficial (vai na carteira) ou "por fora"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir rubricas padrão eSocial (principais)
INSERT INTO esocial_rubricas (codigo, descricao, natureza, tipo_rubrica, incide_inss, incide_irrf, incide_fgts, incide_ferias, incide_13, is_oficial) VALUES
-- PROVENTOS OFICIAIS
('1000', 'Salário Base', 'provento', 'salario', true, true, true, true, true, true),
('1001', 'Salário Hora', 'provento', 'salario', true, true, true, true, true, true),
('1002', 'Salário Tarefa/Produção', 'provento', 'salario', true, true, true, true, true, true),
('1003', 'Comissão', 'provento', 'comissao', true, true, true, true, true, true),
('1010', 'Adicional de Insalubridade', 'provento', 'adicional', true, true, true, true, true, true),
('1011', 'Adicional de Periculosidade', 'provento', 'adicional', true, true, true, true, true, true),
('1012', 'Adicional Noturno', 'provento', 'adicional', true, true, true, true, true, true),
('1020', 'Hora Extra 50%', 'provento', 'hora_extra', true, true, true, true, true, true),
('1021', 'Hora Extra 100%', 'provento', 'hora_extra', true, true, true, true, true, true),
('1030', 'DSR - Descanso Semanal Remunerado', 'provento', 'dsr', true, true, true, true, true, true),
('1040', 'Gratificação de Função', 'provento', 'gratificacao', true, true, true, true, true, true),
('1041', 'Gratificação Natalina (13º)', 'provento', '13_salario', true, true, true, false, false, true),
('1050', 'Férias Gozadas', 'provento', 'ferias', true, true, true, false, false, true),
('1051', '1/3 Constitucional de Férias', 'provento', 'ferias', true, true, true, false, false, true),
('1060', 'Abono Pecuniário de Férias', 'provento', 'ferias', false, true, false, false, false, true),
('1070', 'Salário-Família', 'provento', 'beneficio', false, false, false, false, false, true),
('1080', 'Vale Transporte (parte empresa)', 'provento', 'beneficio', false, false, false, false, false, true),
('1090', 'Vale Alimentação/Refeição', 'provento', 'beneficio', false, false, false, false, false, true),
('1100', 'Ajuda de Custo', 'provento', 'ajuda_custo', false, false, false, false, false, true),
('1110', 'Diárias de Viagem', 'provento', 'diaria', false, false, false, false, false, true),

-- DESCONTOS OFICIAIS
('2000', 'INSS', 'desconto', 'contribuicao', false, false, false, false, false, true),
('2001', 'IRRF', 'desconto', 'imposto', false, false, false, false, false, true),
('2010', 'Desc. Vale Transporte (6%)', 'desconto', 'beneficio', false, false, false, false, false, true),
('2011', 'Desc. Vale Alimentação', 'desconto', 'beneficio', false, false, false, false, false, true),
('2020', 'Contribuição Sindical', 'desconto', 'sindical', false, false, false, false, false, true),
('2021', 'Mensalidade Sindical', 'desconto', 'sindical', false, false, false, false, false, true),
('2030', 'Faltas', 'desconto', 'falta', false, false, false, false, false, true),
('2031', 'Atrasos', 'desconto', 'falta', false, false, false, false, false, true),
('2040', 'Adiantamento Salarial', 'desconto', 'adiantamento', false, false, false, false, false, true),
('2050', 'Empréstimo Consignado', 'desconto', 'consignado', false, false, false, false, false, true),
('2060', 'Pensão Alimentícia', 'desconto', 'judicial', false, false, false, false, false, true),
('2070', 'Plano de Saúde', 'desconto', 'beneficio', false, false, false, false, false, true),
('2080', 'Seguro de Vida', 'desconto', 'beneficio', false, false, false, false, false, true),

-- PAGAMENTOS "POR FORA" (não oficiais - para controle interno)
('9000', 'Complemento Salarial (por fora)', 'provento', 'extra_oficial', false, false, false, false, false, false),
('9001', 'Bonificação Extra (por fora)', 'provento', 'extra_oficial', false, false, false, false, false, false),
('9002', 'Ajuda de Custo Extra (por fora)', 'provento', 'extra_oficial', false, false, false, false, false, false),
('9003', 'Comissão Extra (por fora)', 'provento', 'extra_oficial', false, false, false, false, false, false),
('9004', 'Gratificação Extra (por fora)', 'provento', 'extra_oficial', false, false, false, false, false, false),
('9010', 'Reembolso de Despesas (não documentado)', 'provento', 'extra_oficial', false, false, false, false, false, false);

-- =====================================================
-- EXPANDIR TABELA DE FUNCIONÁRIOS
-- =====================================================

-- Adicionar colunas detalhadas de remuneração
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS payment_day INTEGER DEFAULT 5; -- Dia do pagamento
ALTER TABLE employees ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pix'; -- pix, transferencia, dinheiro
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account JSONB DEFAULT '{}'::jsonb; -- Dados bancários
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_schedule JSONB DEFAULT '{}'::jsonb; -- Horário de trabalho
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'clt'; -- clt, temporario, experiencia
ALTER TABLE employees ADD COLUMN IF NOT EXISTS workload_hours INTEGER DEFAULT 220; -- Carga horária mensal
ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_insalubrity BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS insalubrity_grade TEXT; -- minimo, medio, maximo
ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_periculosity BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS transport_voucher_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS meal_voucher_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_plan_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS health_plan_discount DECIMAL(10,2) DEFAULT 0;

-- Atualizar dados dos funcionários com detalhes
UPDATE employees SET
    salary_details = jsonb_build_object(
        'base_oficial', 1412.00,
        'complemento_por_fora', 2588.00,
        'justificativa_por_fora', 'Complemento para atingir valor de mercado para a função',
        'forma_pagamento_por_fora', 'PIX pessoal',
        'dia_pagamento_por_fora', 10
    ),
    payment_day = 5,
    payment_method = 'transferencia',
    contract_type = 'clt',
    workload_hours = 220
WHERE name = 'Rose Maria da Silva';

UPDATE employees SET
    salary_details = jsonb_build_object(
        'base_oficial', 3500.00,
        'complemento_por_fora', 4500.00,
        'justificativa_por_fora', 'Complemento gerencial + responsabilidade técnica',
        'forma_pagamento_por_fora', 'PIX pessoal',
        'dia_pagamento_por_fora', 10
    ),
    payment_day = 5,
    payment_method = 'transferencia',
    contract_type = 'clt',
    workload_hours = 220
WHERE name = 'Josimar Santos Ferreira';

UPDATE employees SET
    salary_details = jsonb_build_object(
        'valor_diaria', 150.00,
        'dias_semana', 2,
        'forma_pagamento', 'dinheiro',
        'dia_pagamento', 'após serviço'
    ),
    payment_method = 'dinheiro',
    contract_type = 'diarista',
    workload_hours = 16
WHERE name = 'Lilian Souza';

-- =====================================================
-- TABELA DE FOLHA DE PAGAMENTO
-- =====================================================

CREATE TABLE IF NOT EXISTS payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    competencia DATE NOT NULL, -- YYYY-MM-01 (mês de referência)
    status TEXT DEFAULT 'rascunho', -- rascunho, calculada, conferida, fechada, paga

    -- Totais calculados
    total_proventos_oficial DECIMAL(12,2) DEFAULT 0,
    total_descontos_oficial DECIMAL(12,2) DEFAULT 0,
    liquido_oficial DECIMAL(12,2) DEFAULT 0,
    total_por_fora DECIMAL(12,2) DEFAULT 0,
    liquido_total_real DECIMAL(12,2) DEFAULT 0, -- Oficial + por fora

    -- Encargos
    inss_empresa DECIMAL(12,2) DEFAULT 0,
    fgts_valor DECIMAL(12,2) DEFAULT 0,
    provisao_ferias DECIMAL(12,2) DEFAULT 0,
    provisao_13 DECIMAL(12,2) DEFAULT 0,
    custo_total_empresa DECIMAL(12,2) DEFAULT 0,

    -- Comparação com sistema externo
    valor_sistema_externo DECIMAL(12,2), -- Valor do sistema de folha oficial
    diferenca_detectada DECIMAL(12,2), -- Diferença para investigar

    -- Datas
    data_calculo TIMESTAMPTZ,
    data_conferencia TIMESTAMPTZ,
    data_fechamento TIMESTAMPTZ,
    data_pagamento TIMESTAMPTZ,

    -- Auditoria
    conferido_por UUID,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(employee_id, competencia)
);

-- =====================================================
-- TABELA DE EVENTOS DA FOLHA (Lançamentos)
-- =====================================================

CREATE TABLE IF NOT EXISTS payroll_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID REFERENCES payroll(id) ON DELETE CASCADE,
    rubrica_codigo TEXT REFERENCES esocial_rubricas(codigo),
    descricao TEXT NOT NULL,
    referencia TEXT, -- Horas, dias, percentual, etc
    valor DECIMAL(12,2) NOT NULL,
    is_oficial BOOLEAN DEFAULT true,
    is_desconto BOOLEAN DEFAULT false,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABELAS DO eSocial
-- =====================================================

-- Tabela INSS (alíquotas progressivas 2024)
CREATE TABLE IF NOT EXISTS tabela_inss (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    faixa INTEGER NOT NULL,
    valor_inicial DECIMAL(12,2) NOT NULL,
    valor_final DECIMAL(12,2) NOT NULL,
    aliquota DECIMAL(5,2) NOT NULL,
    parcela_deduzir DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Inserir tabela INSS 2024
INSERT INTO tabela_inss (vigencia_inicio, faixa, valor_inicial, valor_final, aliquota, parcela_deduzir) VALUES
('2024-01-01', 1, 0.00, 1412.00, 7.50, 0.00),
('2024-01-01', 2, 1412.01, 2666.68, 9.00, 21.18),
('2024-01-01', 3, 2666.69, 4000.03, 12.00, 101.18),
('2024-01-01', 4, 4000.04, 7786.02, 14.00, 181.18);

-- Tabela IRRF 2024
CREATE TABLE IF NOT EXISTS tabela_irrf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    faixa INTEGER NOT NULL,
    valor_inicial DECIMAL(12,2) NOT NULL,
    valor_final DECIMAL(12,2) NOT NULL,
    aliquota DECIMAL(5,2) NOT NULL,
    parcela_deduzir DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Inserir tabela IRRF 2024
INSERT INTO tabela_irrf (vigencia_inicio, faixa, valor_inicial, valor_final, aliquota, parcela_deduzir) VALUES
('2024-01-01', 1, 0.00, 2259.20, 0.00, 0.00),
('2024-01-01', 2, 2259.21, 2826.65, 7.50, 169.44),
('2024-01-01', 3, 2826.66, 3751.05, 15.00, 381.44),
('2024-01-01', 4, 3751.06, 4664.68, 22.50, 662.77),
('2024-01-01', 5, 4664.69, 999999.99, 27.50, 896.00);

-- Valor dedução por dependente IRRF
CREATE TABLE IF NOT EXISTS parametros_folha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parametro TEXT UNIQUE NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    descricao TEXT
);

INSERT INTO parametros_folha (parametro, valor, vigencia_inicio, descricao) VALUES
('deducao_dependente_irrf', 189.59, '2024-01-01', 'Valor dedução por dependente para cálculo IRRF'),
('salario_minimo', 1412.00, '2024-01-01', 'Salário mínimo nacional'),
('teto_inss', 7786.02, '2024-01-01', 'Teto de contribuição INSS'),
('aliquota_fgts', 8.00, '2024-01-01', 'Alíquota FGTS'),
('aliquota_inss_empresa', 20.00, '2024-01-01', 'Alíquota INSS patronal'),
('rat_fap', 2.00, '2024-01-01', 'RAT ajustado pelo FAP'),
('terceiros', 5.80, '2024-01-01', 'Contribuição para terceiros (Sistema S)');

-- =====================================================
-- FUNÇÃO: CALCULAR INSS PROGRESSIVO
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_inss(p_base_calculo DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    v_inss DECIMAL := 0;
    v_base_restante DECIMAL := p_base_calculo;
    v_faixa RECORD;
    v_valor_faixa DECIMAL;
BEGIN
    -- INSS progressivo por faixas
    FOR v_faixa IN
        SELECT * FROM tabela_inss
        WHERE is_active AND vigencia_fim IS NULL
        ORDER BY faixa
    LOOP
        IF v_base_restante <= 0 THEN
            EXIT;
        END IF;

        IF p_base_calculo > v_faixa.valor_inicial THEN
            v_valor_faixa := LEAST(p_base_calculo, v_faixa.valor_final) - v_faixa.valor_inicial;
            IF v_faixa.faixa = 1 THEN
                v_valor_faixa := LEAST(p_base_calculo, v_faixa.valor_final);
            END IF;
            v_inss := v_inss + (v_valor_faixa * v_faixa.aliquota / 100);
        END IF;
    END LOOP;

    -- Aplicar teto
    RETURN LEAST(v_inss, (SELECT valor FROM parametros_folha WHERE parametro = 'teto_inss') * 0.14);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO: CALCULAR IRRF
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_irrf(
    p_base_calculo DECIMAL,
    p_dependentes INTEGER DEFAULT 0
) RETURNS DECIMAL AS $$
DECLARE
    v_base_irrf DECIMAL;
    v_deducao_dep DECIMAL;
    v_faixa RECORD;
    v_irrf DECIMAL := 0;
BEGIN
    -- Obter dedução por dependente
    SELECT valor INTO v_deducao_dep
    FROM parametros_folha
    WHERE parametro = 'deducao_dependente_irrf';

    -- Calcular base IRRF
    v_base_irrf := p_base_calculo - (p_dependentes * v_deducao_dep);

    -- Encontrar faixa
    SELECT * INTO v_faixa
    FROM tabela_irrf
    WHERE is_active AND vigencia_fim IS NULL
      AND v_base_irrf BETWEEN valor_inicial AND valor_final
    LIMIT 1;

    IF v_faixa IS NOT NULL THEN
        v_irrf := (v_base_irrf * v_faixa.aliquota / 100) - v_faixa.parcela_deduzir;
    END IF;

    RETURN GREATEST(v_irrf, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO: GERAR FOLHA DO MÊS PARA FUNCIONÁRIO
-- =====================================================

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
    IF v_employee.transport_voucher_value > 0 THEN
        INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
        VALUES (v_payroll_id, '1080', 'Vale Transporte', '22 dias', v_employee.transport_voucher_value, true, false);
    END IF;

    -- 4. Vale Refeição/Alimentação
    IF v_employee.meal_voucher_value > 0 THEN
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

    -- 2. IRRF
    v_irrf := calcular_irrf(v_base_inss - v_inss, COALESCE(v_employee.dependents, 0));
    IF v_irrf > 0 THEN
        INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
        VALUES (v_payroll_id, '2001', 'IRRF', '', v_irrf, true, true);
        v_total_descontos := v_total_descontos + v_irrf;
    END IF;

    -- 3. Desconto Vale Transporte (6% do salário, máx do VT)
    IF v_employee.transport_voucher_value > 0 THEN
        DECLARE v_desc_vt DECIMAL;
        BEGIN
            v_desc_vt := LEAST(v_salario_base * 0.06, v_employee.transport_voucher_value);
            INSERT INTO payroll_events (payroll_id, rubrica_codigo, descricao, referencia, valor, is_oficial, is_desconto)
            VALUES (v_payroll_id, '2010', 'Desc. Vale Transporte', '6%', v_desc_vt, true, true);
            v_total_descontos := v_total_descontos + v_desc_vt;
        END;
    END IF;

    -- 4. Plano de Saúde
    IF v_employee.health_plan_discount > 0 THEN
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

-- =====================================================
-- FUNÇÃO: GERAR FOLHA MENSAL COMPLETA
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
    FOR v_emp IN SELECT id, name FROM employees WHERE is_active AND contract_type = 'clt' LOOP
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

-- =====================================================
-- VIEW: RESUMO DA FOLHA MENSAL
-- =====================================================

CREATE OR REPLACE VIEW vw_payroll_summary AS
SELECT
    p.competencia,
    e.name as funcionario,
    e.role as cargo,
    p.total_proventos_oficial as proventos,
    p.total_descontos_oficial as descontos,
    p.liquido_oficial,
    p.total_por_fora,
    p.liquido_total_real as liquido_real,
    p.fgts_valor as fgts,
    p.provisao_ferias,
    p.provisao_13,
    p.custo_total_empresa,
    p.status,
    CASE
        WHEN p.total_por_fora > 0 THEN '⚠️ Há valores por fora'
        ELSE '✅ Folha regular'
    END as alerta,
    ROUND(p.total_por_fora * 100 / NULLIF(p.liquido_total_real, 0), 1) as percentual_por_fora
FROM payroll p
JOIN employees e ON e.id = p.employee_id
ORDER BY p.competencia DESC, e.name;

-- =====================================================
-- VIEW: EVENTOS DA FOLHA DETALHADOS
-- =====================================================

CREATE OR REPLACE VIEW vw_payroll_events_detailed AS
SELECT
    p.competencia,
    e.name as funcionario,
    r.codigo as cod_rubrica,
    pe.descricao,
    r.natureza,
    CASE WHEN pe.is_oficial THEN 'OFICIAL' ELSE 'POR FORA' END as tipo_pagamento,
    CASE WHEN pe.is_desconto THEN 'D' ELSE 'P' END as "P/D",
    pe.referencia,
    pe.valor,
    pe.observacao
FROM payroll_events pe
JOIN payroll p ON p.id = pe.payroll_id
JOIN employees e ON e.id = p.employee_id
JOIN esocial_rubricas r ON r.codigo = pe.rubrica_codigo
ORDER BY p.competencia DESC, e.name, pe.is_oficial DESC, pe.is_desconto, r.codigo;

-- =====================================================
-- VIEW: COMPARATIVO CARTEIRA VS POR FORA
-- =====================================================

CREATE OR REPLACE VIEW vw_salary_comparison AS
SELECT
    e.name as funcionario,
    e.role as cargo,
    e.hire_date as admissao,
    e.official_salary as salario_carteira,
    e.unofficial_salary as valor_por_fora,
    e.official_salary + e.unofficial_salary as remuneracao_total,
    ROUND(e.unofficial_salary * 100 / NULLIF(e.official_salary + e.unofficial_salary, 0), 1) as percentual_por_fora,
    e.salary_details->>'justificativa_por_fora' as justificativa,
    e.salary_details->>'forma_pagamento_por_fora' as forma_pagamento_extra,
    CASE
        WHEN e.unofficial_salary = 0 THEN '✅ Regular'
        WHEN e.unofficial_salary * 100 / NULLIF(e.official_salary + e.unofficial_salary, 0) > 50 THEN '🔴 CRÍTICO'
        WHEN e.unofficial_salary * 100 / NULLIF(e.official_salary + e.unofficial_salary, 0) > 30 THEN '🟠 ALTO'
        ELSE '🟡 MODERADO'
    END as nivel_risco,
    -- Cálculo do custo se regularizar
    ROUND((e.official_salary + e.unofficial_salary) * 1.68, 2) as custo_se_regularizar,
    ROUND((e.official_salary + e.unofficial_salary) * 1.68 - (e.official_salary * 1.68 + e.unofficial_salary), 2) as diferenca_custo
FROM employees e
WHERE e.is_active AND e.contract_type = 'clt'
ORDER BY (e.unofficial_salary * 100 / NULLIF(e.official_salary + e.unofficial_salary, 0)) DESC NULLS LAST;

-- =====================================================
-- TRIGGER: GERAR FOLHA AO CADASTRAR FUNCIONÁRIO
-- =====================================================

CREATE OR REPLACE FUNCTION auto_generate_payroll()
RETURNS TRIGGER AS $$
BEGIN
    -- Gerar folha do mês atual ao cadastrar funcionário CLT
    IF NEW.contract_type = 'clt' AND NEW.is_active THEN
        PERFORM gerar_folha_funcionario(NEW.id, date_trunc('month', CURRENT_DATE)::date);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_payroll ON employees;
CREATE TRIGGER tr_auto_payroll
    AFTER INSERT ON employees
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_payroll();

-- =====================================================
-- GERAR FOLHA NOVEMBRO 2024 PARA FUNCIONÁRIOS ATUAIS
-- =====================================================

SELECT gerar_folha_funcionario(id, '2024-11-01'::date)
FROM employees
WHERE is_active AND contract_type = 'clt';

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE esocial_rubricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabela_inss ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabela_irrf ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_folha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esocial_rubricas_read" ON esocial_rubricas FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_all" ON payroll FOR ALL TO authenticated USING (true);
CREATE POLICY "payroll_events_all" ON payroll_events FOR ALL TO authenticated USING (true);
CREATE POLICY "tabela_inss_read" ON tabela_inss FOR SELECT TO authenticated USING (true);
CREATE POLICY "tabela_irrf_read" ON tabela_irrf FOR SELECT TO authenticated USING (true);
CREATE POLICY "parametros_folha_read" ON parametros_folha FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE esocial_rubricas IS 'Rubricas de pagamento conforme eSocial - oficiais e extras';
COMMENT ON TABLE payroll IS 'Folha de pagamento mensal por funcionário';
COMMENT ON TABLE payroll_events IS 'Eventos/lançamentos da folha de pagamento';
COMMENT ON VIEW vw_payroll_summary IS 'Resumo da folha com alertas de valores por fora';
COMMENT ON VIEW vw_salary_comparison IS 'Comparativo entre valor na carteira e valor por fora';
