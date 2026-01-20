-- =====================================================
-- AMPLA CONTABILIDADE - Sistema de Rescisão de Contrato
-- Migration: 20251211300000
-- Descrição: Sistema completo de rescisão de funcionários
--            com cálculos rescisórios, integração com Dr. Advocato
--            e lançamentos contábeis automáticos
-- =====================================================

-- =====================================================
-- TABELA: RESCISÕES DE CONTRATO
-- =====================================================

CREATE TABLE IF NOT EXISTS employee_terminations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id),

    -- Datas importantes
    termination_date DATE NOT NULL,  -- Data da rescisão
    last_working_day DATE NOT NULL,  -- Último dia trabalhado
    notice_start_date DATE,          -- Início do aviso prévio
    payment_deadline DATE,           -- Prazo para pagamento (10 dias)

    -- Tipo de rescisão
    termination_type TEXT NOT NULL CHECK (termination_type IN (
        'dispensa_sem_justa_causa',    -- Empresa demite sem justa causa
        'dispensa_com_justa_causa',    -- Empresa demite com justa causa
        'pedido_demissao',             -- Funcionário pede demissão
        'acordo_mutuo',                -- Acordo entre as partes (Lei 13.467/2017)
        'termino_contrato',            -- Término de contrato por prazo determinado
        'aposentadoria',               -- Aposentadoria
        'falecimento',                 -- Falecimento do funcionário
        'rescisao_indireta'            -- Rescisão por culpa do empregador
    )),
    termination_reason TEXT,         -- Motivo detalhado

    -- Aviso prévio
    notice_type TEXT CHECK (notice_type IN (
        'trabalhado',                  -- Aviso prévio trabalhado
        'indenizado',                  -- Aviso prévio indenizado pelo empregador
        'dispensado',                  -- Empregador dispensa o aviso
        'nao_cumprido'                 -- Funcionário não cumpre (desconto)
    )),
    notice_days INTEGER DEFAULT 30,   -- Dias de aviso (30 + 3 por ano trabalhado)

    -- Dados do funcionário no momento da rescisão
    salary_at_termination DECIMAL(15,2) NOT NULL,
    months_worked INTEGER NOT NULL,
    years_worked INTEGER NOT NULL,
    vacation_days_balance INTEGER DEFAULT 0,    -- Saldo de férias
    thirteenth_months_due INTEGER DEFAULT 0,    -- Meses de 13º devidos

    -- Valores calculados - PROVENTOS
    saldo_salario DECIMAL(15,2) DEFAULT 0,      -- Saldo de salário
    aviso_previo DECIMAL(15,2) DEFAULT 0,       -- Aviso prévio indenizado
    ferias_vencidas DECIMAL(15,2) DEFAULT 0,    -- Férias vencidas
    ferias_proporcionais DECIMAL(15,2) DEFAULT 0, -- Férias proporcionais
    terco_constitucional DECIMAL(15,2) DEFAULT 0, -- 1/3 das férias
    decimo_terceiro_proporcional DECIMAL(15,2) DEFAULT 0, -- 13º proporcional
    multa_fgts DECIMAL(15,2) DEFAULT 0,         -- Multa 40% ou 20% FGTS
    saldo_fgts DECIMAL(15,2) DEFAULT 0,         -- Saldo FGTS para saque

    -- Valores calculados - DESCONTOS
    desconto_aviso DECIMAL(15,2) DEFAULT 0,     -- Desc. aviso não cumprido
    desconto_vale_transporte DECIMAL(15,2) DEFAULT 0,
    desconto_vale_alimentacao DECIMAL(15,2) DEFAULT 0,
    desconto_inss DECIMAL(15,2) DEFAULT 0,
    desconto_irrf DECIMAL(15,2) DEFAULT 0,
    outros_descontos DECIMAL(15,2) DEFAULT 0,

    -- Totais
    total_proventos DECIMAL(15,2) DEFAULT 0,
    total_descontos DECIMAL(15,2) DEFAULT 0,
    valor_liquido DECIMAL(15,2) DEFAULT 0,

    -- Guias e encargos
    guia_fgts_rescisorio DECIMAL(15,2) DEFAULT 0,  -- GRRF
    guia_darf_irrf DECIMAL(15,2) DEFAULT 0,

    -- Status e controle
    status TEXT DEFAULT 'rascunho' CHECK (status IN (
        'rascunho',
        'calculada',
        'aprovada',
        'homologada',
        'paga',
        'cancelada'
    )),

    -- Integração contábil
    accounting_entry_id UUID REFERENCES accounting_entries(id),

    -- Consulta Dr. Advocato
    advocato_consultation TEXT,      -- Orientações do Dr. Advocato
    advocato_warnings TEXT[],        -- Alertas importantes

    -- Documentos
    documents JSONB DEFAULT '[]',    -- Lista de documentos gerados

    -- Auditoria
    calculated_at TIMESTAMPTZ,
    calculated_by UUID,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    paid_at TIMESTAMPTZ,
    paid_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_terminations_employee ON employee_terminations(employee_id);
CREATE INDEX IF NOT EXISTS idx_terminations_date ON employee_terminations(termination_date);
CREATE INDEX IF NOT EXISTS idx_terminations_status ON employee_terminations(status);
CREATE INDEX IF NOT EXISTS idx_terminations_type ON employee_terminations(termination_type);

-- =====================================================
-- RUBRICAS eSocial PARA RESCISÃO
-- =====================================================

INSERT INTO esocial_rubricas (codigo, descricao, natureza, tipo_rubrica, incide_inss, incide_irrf, incide_fgts, incide_ferias, incide_13, is_oficial) VALUES
-- PROVENTOS RESCISÓRIOS
('3000', 'Saldo de Salário', 'provento', 'rescisao', true, true, true, false, false, true),
('3001', 'Aviso Prévio Indenizado', 'provento', 'rescisao', false, true, true, false, false, true),
('3002', 'Aviso Prévio Trabalhado', 'provento', 'rescisao', true, true, true, false, false, true),
('3010', 'Férias Vencidas', 'provento', 'rescisao', false, true, false, false, false, true),
('3011', 'Férias Proporcionais', 'provento', 'rescisao', false, true, false, false, false, true),
('3012', '1/3 Constitucional de Férias', 'provento', 'rescisao', false, true, false, false, false, true),
('3020', '13º Salário Proporcional', 'provento', 'rescisao', true, true, false, false, false, true),
('3030', 'Multa 40% FGTS', 'provento', 'rescisao', false, false, false, false, false, true),
('3031', 'Multa 20% FGTS (Acordo)', 'provento', 'rescisao', false, false, false, false, false, true),
('3040', 'Indenização Adicional (Art. 9º Lei 7238)', 'provento', 'rescisao', false, false, false, false, false, true),

-- DESCONTOS RESCISÓRIOS
('4000', 'Desconto Aviso Prévio Não Cumprido', 'desconto', 'rescisao', false, false, false, false, false, true),
('4001', 'INSS Rescisão', 'desconto', 'rescisao', false, false, false, false, false, true),
('4002', 'IRRF Rescisão', 'desconto', 'rescisao', false, false, false, false, false, true),
('4010', 'Desconto Vale Transporte', 'desconto', 'rescisao', false, false, false, false, false, true),
('4011', 'Desconto Vale Alimentação', 'desconto', 'rescisao', false, false, false, false, false, true),
('4020', 'Adiantamento de Salário', 'desconto', 'rescisao', false, false, false, false, false, true),
('4030', 'Empréstimo Consignado', 'desconto', 'rescisao', false, false, false, false, false, true),
('4040', 'Pensão Alimentícia', 'desconto', 'rescisao', false, false, false, false, false, true)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- CONTAS CONTÁBEIS PARA RESCISÃO
-- =====================================================

-- Adicionar contas para rescisão se não existirem
-- Nota: account_type e nature devem ser em MAIÚSCULAS, type pode ser NULL
DO $$
DECLARE
  v_parent_id UUID;
BEGIN
  -- Passivo - Obrigações Trabalhistas Rescisórias (2.1.2.10)
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1.2';

  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, parent_id, is_analytical, is_active, description)
  VALUES ('2.1.2.10', 'Rescisões a Pagar', 'PASSIVO', 'CREDORA', 4, v_parent_id, false, true, 'Valores rescisórios a pagar')
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1.2.10';

  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, parent_id, is_analytical, is_active, description) VALUES
    ('2.1.2.10.01', 'Saldo de Salário a Pagar', 'PASSIVO', 'CREDORA', 5, v_parent_id, true, true, 'Saldo de salário da rescisão'),
    ('2.1.2.10.02', 'Aviso Prévio a Pagar', 'PASSIVO', 'CREDORA', 5, v_parent_id, true, true, 'Aviso prévio indenizado'),
    ('2.1.2.10.03', 'Férias Rescisórias a Pagar', 'PASSIVO', 'CREDORA', 5, v_parent_id, true, true, 'Férias vencidas e proporcionais'),
    ('2.1.2.10.04', '13º Rescisório a Pagar', 'PASSIVO', 'CREDORA', 5, v_parent_id, true, true, '13º proporcional rescisão'),
    ('2.1.2.10.05', 'FGTS Rescisório a Recolher', 'PASSIVO', 'CREDORA', 5, v_parent_id, true, true, 'FGTS sobre rescisão + multa'),
    ('2.1.2.10.06', 'INSS Rescisório a Recolher', 'PASSIVO', 'CREDORA', 5, v_parent_id, true, true, 'INSS sobre verbas rescisórias')
  ON CONFLICT (code) DO NOTHING;

  -- Despesas - Indenizações Trabalhistas (4.2.10)
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.2';

  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, parent_id, is_analytical, is_active, description)
  VALUES ('4.2.10', 'Indenizações Trabalhistas', 'DESPESA', 'DEVEDORA', 3, v_parent_id, false, true, 'Despesas com rescisões')
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.2.10';

  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, parent_id, is_analytical, is_active, description) VALUES
    ('4.2.10.01', 'Aviso Prévio Indenizado', 'DESPESA', 'DEVEDORA', 4, v_parent_id, true, true, 'Despesa com aviso prévio'),
    ('4.2.10.02', 'Férias Indenizadas', 'DESPESA', 'DEVEDORA', 4, v_parent_id, true, true, 'Férias pagas na rescisão'),
    ('4.2.10.03', '13º Salário Proporcional', 'DESPESA', 'DEVEDORA', 4, v_parent_id, true, true, '13º pago na rescisão'),
    ('4.2.10.04', 'Multa FGTS', 'DESPESA', 'DEVEDORA', 4, v_parent_id, true, true, 'Multa 40% ou 20% FGTS'),
    ('4.2.10.05', 'Outras Indenizações', 'DESPESA', 'DEVEDORA', 4, v_parent_id, true, true, 'Outras verbas indenizatórias')
  ON CONFLICT (code) DO NOTHING;
END $$;

-- =====================================================
-- FUNÇÃO: CALCULAR RESCISÃO
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_rescisao(
    p_employee_id UUID,
    p_termination_date DATE,
    p_last_working_day DATE,
    p_termination_type TEXT,
    p_notice_type TEXT DEFAULT 'indenizado'
) RETURNS UUID AS $$
DECLARE
    v_termination_id UUID;
    v_employee RECORD;
    v_salary DECIMAL;
    v_hire_date DATE;
    v_months_worked INTEGER;
    v_years_worked INTEGER;
    v_notice_days INTEGER;
    v_vacation_days INTEGER;
    v_thirteenth_months INTEGER;

    -- Proventos
    v_saldo_salario DECIMAL := 0;
    v_aviso_previo DECIMAL := 0;
    v_ferias_vencidas DECIMAL := 0;
    v_ferias_proporcionais DECIMAL := 0;
    v_terco_ferias DECIMAL := 0;
    v_decimo_terceiro DECIMAL := 0;
    v_multa_fgts DECIMAL := 0;
    v_saldo_fgts DECIMAL := 0;

    -- Descontos
    v_desconto_aviso DECIMAL := 0;
    v_desconto_inss DECIMAL := 0;
    v_desconto_irrf DECIMAL := 0;

    -- Totais
    v_total_proventos DECIMAL := 0;
    v_total_descontos DECIMAL := 0;
    v_valor_liquido DECIMAL := 0;

    -- Dr. Advocato
    v_advocato_consultation TEXT;
    v_advocato_warnings TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Buscar dados do funcionário
    SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;

    IF v_employee IS NULL THEN
        RAISE EXCEPTION 'Funcionário não encontrado';
    END IF;

    -- Dados básicos
    v_salary := COALESCE(v_employee.official_salary, 0);
    v_hire_date := v_employee.hire_date;

    -- Calcular tempo trabalhado
    v_months_worked := EXTRACT(YEAR FROM age(p_termination_date, v_hire_date)) * 12 +
                       EXTRACT(MONTH FROM age(p_termination_date, v_hire_date));
    v_years_worked := v_months_worked / 12;

    -- Dias de aviso prévio (30 + 3 por ano, máximo 90)
    v_notice_days := LEAST(30 + (v_years_worked * 3), 90);

    -- Saldo de férias e 13º
    v_vacation_days := COALESCE(v_employee.vacation_days_accrued, 0);
    v_thirteenth_months := EXTRACT(MONTH FROM p_termination_date)::INTEGER;

    -- ========== CÁLCULOS POR TIPO DE RESCISÃO ==========

    -- 1. SALDO DE SALÁRIO (sempre devido)
    v_saldo_salario := (v_salary / 30) * EXTRACT(DAY FROM p_last_working_day);

    -- 2. AVISO PRÉVIO
    IF p_termination_type IN ('dispensa_sem_justa_causa', 'rescisao_indireta') THEN
        IF p_notice_type = 'indenizado' THEN
            v_aviso_previo := (v_salary / 30) * v_notice_days;
            v_advocato_warnings := array_append(v_advocato_warnings,
                'Aviso prévio indenizado de ' || v_notice_days || ' dias será pago');
        END IF;
    ELSIF p_termination_type = 'pedido_demissao' THEN
        IF p_notice_type = 'nao_cumprido' THEN
            v_desconto_aviso := v_salary; -- Desconta 30 dias
            v_advocato_warnings := array_append(v_advocato_warnings,
                'Funcionário não cumpriu aviso - será descontado');
        END IF;
    ELSIF p_termination_type = 'acordo_mutuo' THEN
        v_aviso_previo := (v_salary / 30) * v_notice_days * 0.5; -- 50% do aviso
        v_advocato_warnings := array_append(v_advocato_warnings,
            'Acordo mútuo: aviso prévio de 50% = R$ ' || v_aviso_previo::TEXT);
    END IF;

    -- 3. FÉRIAS
    IF p_termination_type != 'dispensa_com_justa_causa' THEN
        -- Férias vencidas (se houver)
        IF v_vacation_days >= 30 THEN
            v_ferias_vencidas := v_salary * (v_vacation_days / 30);
        END IF;

        -- Férias proporcionais (meses no período aquisitivo atual)
        v_ferias_proporcionais := (v_salary / 12) * (v_months_worked % 12);

        -- 1/3 constitucional
        v_terco_ferias := (v_ferias_vencidas + v_ferias_proporcionais) / 3;
    ELSE
        v_advocato_warnings := array_append(v_advocato_warnings,
            'JUSTA CAUSA: Funcionário perde férias proporcionais');
    END IF;

    -- 4. 13º SALÁRIO
    IF p_termination_type != 'dispensa_com_justa_causa' THEN
        v_decimo_terceiro := (v_salary / 12) * v_thirteenth_months;
    ELSE
        v_advocato_warnings := array_append(v_advocato_warnings,
            'JUSTA CAUSA: Funcionário perde 13º proporcional');
    END IF;

    -- 5. FGTS E MULTA
    IF p_termination_type = 'dispensa_sem_justa_causa' OR p_termination_type = 'rescisao_indireta' THEN
        v_saldo_fgts := COALESCE(v_employee.fgts_balance, v_salary * 0.08 * v_months_worked);
        v_multa_fgts := v_saldo_fgts * 0.40; -- 40%
        v_advocato_warnings := array_append(v_advocato_warnings,
            'Multa 40% FGTS: R$ ' || v_multa_fgts::TEXT || ' - funcionário pode sacar');
    ELSIF p_termination_type = 'acordo_mutuo' THEN
        v_saldo_fgts := COALESCE(v_employee.fgts_balance, v_salary * 0.08 * v_months_worked);
        v_multa_fgts := v_saldo_fgts * 0.20; -- 20% no acordo
        v_advocato_warnings := array_append(v_advocato_warnings,
            'Acordo: Multa 20% FGTS + saque de 80% do saldo');
    ELSIF p_termination_type = 'pedido_demissao' THEN
        v_advocato_warnings := array_append(v_advocato_warnings,
            'Pedido de demissão: sem multa FGTS, saldo fica retido');
    ELSIF p_termination_type = 'dispensa_com_justa_causa' THEN
        v_advocato_warnings := array_append(v_advocato_warnings,
            'JUSTA CAUSA: sem multa FGTS, saldo fica retido');
    END IF;

    -- 6. DESCONTOS (INSS e IRRF)
    v_desconto_inss := calcular_inss(v_saldo_salario + v_decimo_terceiro);
    v_desconto_irrf := calcular_irrf(
        v_saldo_salario + v_decimo_terceiro - v_desconto_inss,
        0  -- Número de dependentes (não temos essa informação na tabela atual)
    );

    -- ========== TOTAIS ==========
    v_total_proventos := v_saldo_salario + v_aviso_previo + v_ferias_vencidas +
                         v_ferias_proporcionais + v_terco_ferias + v_decimo_terceiro + v_multa_fgts;

    v_total_descontos := v_desconto_aviso + v_desconto_inss + v_desconto_irrf;

    v_valor_liquido := v_total_proventos - v_total_descontos;

    -- ========== CONSULTA DR. ADVOCATO ==========
    v_advocato_consultation := 'Dr. Advocato analisou a rescisão de ' || v_employee.name || E':\n\n';
    v_advocato_consultation := v_advocato_consultation ||
        'TIPO: ' || CASE p_termination_type
            WHEN 'dispensa_sem_justa_causa' THEN 'Dispensa sem justa causa'
            WHEN 'dispensa_com_justa_causa' THEN 'Dispensa com justa causa'
            WHEN 'pedido_demissao' THEN 'Pedido de demissão'
            WHEN 'acordo_mutuo' THEN 'Acordo mútuo (Art. 484-A CLT)'
            WHEN 'termino_contrato' THEN 'Término de contrato'
            WHEN 'aposentadoria' THEN 'Aposentadoria'
            WHEN 'falecimento' THEN 'Falecimento'
            WHEN 'rescisao_indireta' THEN 'Rescisão indireta'
        END || E'\n';

    v_advocato_consultation := v_advocato_consultation ||
        'TEMPO DE SERVIÇO: ' || v_years_worked || ' anos e ' || (v_months_worked % 12) || E' meses\n';
    v_advocato_consultation := v_advocato_consultation ||
        'PRAZO PAGAMENTO: ' || CASE
            WHEN p_notice_type = 'trabalhado' THEN '1º dia útil após término do aviso'
            ELSE '10 dias corridos após a data da rescisão'
        END || E'\n\n';

    v_advocato_consultation := v_advocato_consultation ||
        'VERBAS DEVIDAS: Saldo salário, ';

    IF v_aviso_previo > 0 THEN
        v_advocato_consultation := v_advocato_consultation || 'aviso prévio, ';
    END IF;
    IF v_ferias_vencidas > 0 OR v_ferias_proporcionais > 0 THEN
        v_advocato_consultation := v_advocato_consultation || 'férias + 1/3, ';
    END IF;
    IF v_decimo_terceiro > 0 THEN
        v_advocato_consultation := v_advocato_consultation || '13º proporcional, ';
    END IF;
    IF v_multa_fgts > 0 THEN
        v_advocato_consultation := v_advocato_consultation || 'multa FGTS';
    END IF;

    v_advocato_consultation := v_advocato_consultation || E'\n\n';
    v_advocato_consultation := v_advocato_consultation ||
        'DOCUMENTOS NECESSÁRIOS: TRCT, Guia FGTS (GRRF), Comunicado de dispensa (se aplicável), Exame demissional';

    -- ========== INSERIR RESCISÃO ==========
    INSERT INTO employee_terminations (
        employee_id,
        termination_date,
        last_working_day,
        termination_type,
        termination_reason,
        notice_type,
        notice_days,
        salary_at_termination,
        months_worked,
        years_worked,
        vacation_days_balance,
        thirteenth_months_due,
        saldo_salario,
        aviso_previo,
        ferias_vencidas,
        ferias_proporcionais,
        terco_constitucional,
        decimo_terceiro_proporcional,
        multa_fgts,
        saldo_fgts,
        desconto_aviso,
        desconto_inss,
        desconto_irrf,
        total_proventos,
        total_descontos,
        valor_liquido,
        status,
        advocato_consultation,
        advocato_warnings,
        calculated_at
    ) VALUES (
        p_employee_id,
        p_termination_date,
        p_last_working_day,
        p_termination_type,
        p_termination_type,
        p_notice_type,
        v_notice_days,
        v_salary,
        v_months_worked,
        v_years_worked,
        v_vacation_days,
        v_thirteenth_months,
        v_saldo_salario,
        v_aviso_previo,
        v_ferias_vencidas,
        v_ferias_proporcionais,
        v_terco_ferias,
        v_decimo_terceiro,
        v_multa_fgts,
        v_saldo_fgts,
        v_desconto_aviso,
        v_desconto_inss,
        v_desconto_irrf,
        v_total_proventos,
        v_total_descontos,
        v_valor_liquido,
        'calculada',
        v_advocato_consultation,
        v_advocato_warnings,
        now()
    ) RETURNING id INTO v_termination_id;

    RETURN v_termination_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO: APROVAR E GERAR LANÇAMENTO CONTÁBIL
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
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, history) VALUES
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

-- =====================================================
-- FUNÇÃO: REGISTRAR PAGAMENTO DA RESCISÃO
-- =====================================================

CREATE OR REPLACE FUNCTION pagar_rescisao(
    p_termination_id UUID,
    p_transaction_id UUID DEFAULT NULL,
    p_paid_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_termination RECORD;
BEGIN
    -- Buscar rescisão
    SELECT * INTO v_termination FROM employee_terminations WHERE id = p_termination_id;

    IF v_termination IS NULL THEN
        RAISE EXCEPTION 'Rescisão não encontrada';
    END IF;

    IF v_termination.status NOT IN ('aprovada', 'homologada') THEN
        RAISE EXCEPTION 'Rescisão precisa estar aprovada ou homologada';
    END IF;

    -- Atualizar rescisão
    UPDATE employee_terminations SET
        status = 'paga',
        paid_at = now(),
        paid_by = p_paid_by,
        updated_at = now()
    WHERE id = p_termination_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEW: RESCISÕES COM DETALHES
-- =====================================================

CREATE OR REPLACE VIEW vw_terminations_detailed AS
SELECT
    t.*,
    e.name as employee_name,
    e.role as employee_role,
    e.cpf as employee_cpf,
    e.hire_date as employee_hire_date,
    CASE t.termination_type
        WHEN 'dispensa_sem_justa_causa' THEN 'Dispensa sem Justa Causa'
        WHEN 'dispensa_com_justa_causa' THEN 'Dispensa com Justa Causa'
        WHEN 'pedido_demissao' THEN 'Pedido de Demissão'
        WHEN 'acordo_mutuo' THEN 'Acordo Mútuo'
        WHEN 'termino_contrato' THEN 'Término de Contrato'
        WHEN 'aposentadoria' THEN 'Aposentadoria'
        WHEN 'falecimento' THEN 'Falecimento'
        WHEN 'rescisao_indireta' THEN 'Rescisão Indireta'
    END as termination_type_label,
    CASE t.status
        WHEN 'rascunho' THEN 'Rascunho'
        WHEN 'calculada' THEN 'Calculada'
        WHEN 'aprovada' THEN 'Aprovada'
        WHEN 'homologada' THEN 'Homologada'
        WHEN 'paga' THEN 'Paga'
        WHEN 'cancelada' THEN 'Cancelada'
    END as status_label
FROM employee_terminations t
JOIN employees e ON e.id = t.employee_id
ORDER BY t.created_at DESC;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE employee_terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terminations_all" ON employee_terminations
    FOR ALL TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE employee_terminations IS 'Rescisões de contrato de funcionários';
COMMENT ON FUNCTION calcular_rescisao IS 'Calcula todos os valores rescisórios baseado no tipo de rescisão';
COMMENT ON FUNCTION aprovar_rescisao IS 'Aprova rescisão e gera lançamento contábil';
COMMENT ON FUNCTION pagar_rescisao IS 'Registra pagamento da rescisão';
