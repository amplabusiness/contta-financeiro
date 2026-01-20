-- =====================================================
-- AMPLA CONTABILIDADE - Análise de Maturidade Empresarial
-- Migration: 20251130120000
-- Descrição: Antes de propor PLR, incentivos ou qualquer programa
--            os agentes ESTUDAM a empresa, analisam balancetes
--            e determinam o MOMENTO CERTO para cada ação
-- =====================================================

-- Adicionar coluna category à bank_transactions se não existir
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- =====================================================
-- 1. ANÁLISE DE MATURIDADE DA EMPRESA
-- Os agentes avaliam se a empresa está pronta
-- =====================================================

CREATE TABLE IF NOT EXISTS business_maturity_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_period TEXT NOT NULL, -- '2025-01', '2025-Q1', '2025'
    analysis_date DATE DEFAULT CURRENT_DATE,
    analyzed_by TEXT[] DEFAULT ARRAY['cicero', 'milton', 'helena'],

    -- SITUAÇÃO FINANCEIRA (Dr. Cícero + Prof. Milton)
    has_updated_balancete BOOLEAN DEFAULT false,
    balancete_date DATE,
    total_assets DECIMAL(15,2),
    total_liabilities DECIMAL(15,2),
    equity DECIMAL(15,2),
    current_ratio DECIMAL(5,2), -- Liquidez corrente
    debt_ratio DECIMAL(5,2), -- Endividamento

    -- RESULTADO (Prof. Milton)
    revenue_ytd DECIMAL(15,2),
    expenses_ytd DECIMAL(15,2),
    profit_ytd DECIMAL(15,2),
    profit_margin DECIMAL(5,2),
    is_profitable BOOLEAN DEFAULT false,
    months_profitable INTEGER DEFAULT 0, -- Meses consecutivos com lucro

    -- FLUXO DE CAIXA (Prof. Milton)
    cash_balance DECIMAL(15,2),
    average_monthly_revenue DECIMAL(15,2),
    average_monthly_expenses DECIMAL(15,2),
    runway_months DECIMAL(5,2), -- Meses que aguenta com caixa atual
    has_cash_flow_issues BOOLEAN DEFAULT false,

    -- ESTRUTURA CONTÁBIL (Dr. Cícero)
    chart_of_accounts_complete BOOLEAN DEFAULT false,
    opening_balance_done BOOLEAN DEFAULT false,
    reconciliation_updated BOOLEAN DEFAULT false,
    pending_entries INTEGER DEFAULT 0,
    accounting_score INTEGER DEFAULT 0, -- 0-100

    -- COMPLIANCE (Dr. Advocato)
    labor_risks_count INTEGER DEFAULT 0,
    labor_risk_value DECIMAL(15,2) DEFAULT 0,
    contracts_pending INTEGER DEFAULT 0,
    tax_compliance_score INTEGER DEFAULT 0, -- 0-100

    -- ESTRUTURA SOCIETÁRIA (Sr. Empresário)
    partners_registered BOOLEAN DEFAULT false,
    capital_structure_clear BOOLEAN DEFAULT false,
    succession_plan BOOLEAN DEFAULT false,

    -- SCORE GERAL DE MATURIDADE (0-100)
    maturity_score INTEGER,
    maturity_level TEXT, -- 'critical', 'developing', 'structured', 'mature', 'excellent'

    -- DIAGNÓSTICO DOS AGENTES
    cicero_diagnosis TEXT,
    milton_diagnosis TEXT,
    helena_diagnosis TEXT,
    advocato_diagnosis TEXT,
    empresario_diagnosis TEXT,

    -- RECOMENDAÇÕES
    recommendations JSONB DEFAULT '[]'::jsonb,
    blockers JSONB DEFAULT '[]'::jsonb, -- O que impede de avançar
    next_steps JSONB DEFAULT '[]'::jsonb,

    -- PROGRAMAS LIBERADOS
    can_implement_plr BOOLEAN DEFAULT false,
    can_implement_incentives BOOLEAN DEFAULT false,
    can_implement_referrals BOOLEAN DEFAULT false,
    can_attract_investors BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 2. CRITÉRIOS PARA LIBERAR PROGRAMAS
-- =====================================================

CREATE TABLE IF NOT EXISTS program_prerequisites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_code TEXT UNIQUE NOT NULL,
    program_name TEXT NOT NULL,
    description TEXT,

    -- Pré-requisitos
    min_maturity_score INTEGER NOT NULL, -- Score mínimo
    required_conditions JSONB NOT NULL, -- Condições obrigatórias
    recommended_conditions JSONB, -- Condições recomendadas

    -- Riscos se implementar sem estar pronto
    risks_if_premature TEXT[],

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir pré-requisitos para cada programa
INSERT INTO program_prerequisites (program_code, program_name, description, min_maturity_score, required_conditions, recommended_conditions, risks_if_premature) VALUES

('PLR',
 'Participação nos Lucros e Resultados',
 'Distribuição de parte do lucro para funcionários',
 70,
 '{
   "is_profitable": true,
   "months_profitable": 6,
   "has_updated_balancete": true,
   "opening_balance_done": true,
   "profit_margin_min": 10,
   "cash_balance_min_months": 3
 }'::jsonb,
 '{
   "accounting_score_min": 80,
   "reconciliation_updated": true,
   "labor_risks_count_max": 0
 }'::jsonb,
 ARRAY[
   'Distribuir lucro que não existe = prejuízo para empresa',
   'Sem balancete atualizado, não sabe se realmente tem lucro',
   'Funcionários criam expectativa que não pode ser atendida',
   'Pode descapitalizar a empresa'
 ]),

('EMPLOYEE_INCENTIVES',
 'Programa de Incentivos (Comissões)',
 'Comissões por indicação e venda de serviços',
 50,
 '{
   "has_updated_balancete": true,
   "is_profitable": true,
   "profit_margin_min": 5,
   "cash_balance_min_months": 2
 }'::jsonb,
 '{
   "accounting_score_min": 60,
   "months_profitable": 3
 }'::jsonb,
 ARRAY[
   'Pagar comissões sem margem = aumentar prejuízo',
   'Sem controle, pode pagar mais do que gera',
   'Funcionários desacreditam se não pagar'
 ]),

('REFERRAL_PROGRAM',
 'Programa de Indicações (Clientes)',
 'Clientes indicam novos clientes com desconto',
 40,
 '{
   "has_updated_balancete": true,
   "revenue_ytd_min": 50000
 }'::jsonb,
 '{
   "is_profitable": true,
   "accounting_score_min": 50
 }'::jsonb,
 ARRAY[
   'Dar desconto sem margem = prejuízo',
   'Sem estrutura, não consegue atender novos clientes'
 ]),

('INVESTOR_READY',
 'Pronto para Investidores',
 'Empresa estruturada para receber investimento',
 85,
 '{
   "is_profitable": true,
   "months_profitable": 12,
   "has_updated_balancete": true,
   "opening_balance_done": true,
   "reconciliation_updated": true,
   "accounting_score_min": 90,
   "partners_registered": true,
   "capital_structure_clear": true,
   "labor_risks_count_max": 0,
   "contracts_pending_max": 0
 }'::jsonb,
 '{
   "profit_margin_min": 15,
   "succession_plan": true,
   "runway_months_min": 6
 }'::jsonb,
 ARRAY[
   'Investidor vai analisar balanços - se mal feitos, não investe',
   'Riscos trabalhistas podem virar passivo oculto',
   'Sem estrutura clara, não tem como avaliar a empresa',
   'Due diligence vai encontrar todos os problemas'
 ]);

-- =====================================================
-- 3. FUNÇÃO: CALCULAR MATURIDADE DA EMPRESA
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_business_maturity(p_period TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_analysis_id UUID;
    v_score INTEGER := 0;
    v_level TEXT;
    v_recommendations JSONB := '[]'::jsonb;
    v_blockers JSONB := '[]'::jsonb;

    -- Dados financeiros (simulados - integrar com dados reais)
    v_revenue DECIMAL := 0;
    v_expenses DECIMAL := 0;
    v_profit DECIMAL := 0;
    v_cash DECIMAL := 0;

    -- Scores parciais
    v_accounting_score INTEGER := 0;
    v_financial_score INTEGER := 0;
    v_compliance_score INTEGER := 0;
    v_structure_score INTEGER := 0;

    -- Flags
    v_has_balancete BOOLEAN := false;
    v_is_profitable BOOLEAN := false;
    v_labor_risks INTEGER := 0;
BEGIN
    -- Definir período
    IF p_period IS NULL THEN
        p_period := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
    END IF;

    -- 1. VERIFICAR ESTRUTURA CONTÁBIL (Dr. Cícero)
    -- Verificar se tem plano de contas
    IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE is_active LIMIT 1) THEN
        v_accounting_score := v_accounting_score + 20;
    ELSE
        v_blockers := v_blockers || jsonb_build_array(
            jsonb_build_object('area', 'contabilidade', 'blocker', 'Plano de contas não configurado')
        );
    END IF;

    -- Verificar se tem lançamento de abertura
    IF EXISTS (SELECT 1 FROM journal_entries WHERE description ILIKE '%abertura%' LIMIT 1) THEN
        v_accounting_score := v_accounting_score + 20;
        v_has_balancete := true;
    ELSE
        v_blockers := v_blockers || jsonb_build_array(
            jsonb_build_object('area', 'contabilidade', 'blocker', 'Saldo de abertura não registrado')
        );
    END IF;

    -- Verificar transações pendentes de classificação
    IF EXISTS (SELECT 1 FROM bank_transactions WHERE category IS NULL AND status != 'ignored' LIMIT 1) THEN
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object('area', 'contabilidade', 'action', 'Classificar transações bancárias pendentes')
        );
    ELSE
        v_accounting_score := v_accounting_score + 20;
    END IF;

    -- 2. VERIFICAR SITUAÇÃO FINANCEIRA (Prof. Milton)
    -- Por enquanto, usar dados simulados
    -- TODO: Integrar com dados reais de receita/despesa
    v_financial_score := 50; -- Score base

    -- 3. VERIFICAR COMPLIANCE TRABALHISTA (Dr. Advocato)
    SELECT COUNT(*) INTO v_labor_risks FROM vw_all_labor_alerts;

    IF v_labor_risks = 0 THEN
        v_compliance_score := 100;
    ELSIF v_labor_risks <= 2 THEN
        v_compliance_score := 70;
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object('area', 'trabalhista', 'action', 'Regularizar ' || v_labor_risks || ' pendências trabalhistas')
        );
    ELSE
        v_compliance_score := 30;
        v_blockers := v_blockers || jsonb_build_array(
            jsonb_build_object('area', 'trabalhista', 'blocker', v_labor_risks || ' riscos trabalhistas identificados')
        );
    END IF;

    -- 4. VERIFICAR ESTRUTURA SOCIETÁRIA (Sr. Empresário)
    IF EXISTS (SELECT 1 FROM company_partners WHERE is_active LIMIT 1) THEN
        v_structure_score := v_structure_score + 50;
    ELSE
        v_recommendations := v_recommendations || jsonb_build_array(
            jsonb_build_object('area', 'societario', 'action', 'Cadastrar sócios da empresa')
        );
    END IF;

    IF EXISTS (SELECT 1 FROM company_profile LIMIT 1) THEN
        v_structure_score := v_structure_score + 50;
    ELSE
        v_blockers := v_blockers || jsonb_build_array(
            jsonb_build_object('area', 'societario', 'blocker', 'Perfil da empresa não cadastrado')
        );
    END IF;

    -- CALCULAR SCORE GERAL
    v_score := (v_accounting_score * 0.30 +
                v_financial_score * 0.30 +
                v_compliance_score * 0.20 +
                v_structure_score * 0.20)::integer;

    -- DETERMINAR NÍVEL
    v_level := CASE
        WHEN v_score >= 85 THEN 'excellent'
        WHEN v_score >= 70 THEN 'mature'
        WHEN v_score >= 50 THEN 'structured'
        WHEN v_score >= 30 THEN 'developing'
        ELSE 'critical'
    END;

    -- SALVAR ANÁLISE
    INSERT INTO business_maturity_analysis (
        analysis_period,
        accounting_score,
        labor_risks_count,
        maturity_score,
        maturity_level,
        recommendations,
        blockers,
        cicero_diagnosis,
        milton_diagnosis,
        advocato_diagnosis,
        can_implement_plr,
        can_implement_incentives,
        can_implement_referrals
    ) VALUES (
        p_period,
        v_accounting_score,
        v_labor_risks,
        v_score,
        v_level,
        v_recommendations,
        v_blockers,
        'Dr. Cícero: Score contábil ' || v_accounting_score || '/100. ' ||
            CASE WHEN v_accounting_score >= 60 THEN 'Estrutura básica OK.' ELSE 'ATENÇÃO: Estrutura contábil precisa ser organizada.' END,
        'Prof. Milton: Aguardando dados financeiros para análise completa.',
        'Dr. Advocato: ' || v_labor_risks || ' riscos identificados. ' ||
            CASE WHEN v_labor_risks = 0 THEN 'Compliance OK.' ELSE 'AÇÃO NECESSÁRIA!' END,
        v_score >= 70 AND v_labor_risks = 0,
        v_score >= 50,
        v_score >= 40
    )
    RETURNING id INTO v_analysis_id;

    -- RETORNAR RESULTADO
    RETURN jsonb_build_object(
        'analysis_id', v_analysis_id,
        'period', p_period,
        'maturity_score', v_score,
        'maturity_level', v_level,
        'scores', jsonb_build_object(
            'contabilidade', v_accounting_score,
            'financeiro', v_financial_score,
            'compliance', v_compliance_score,
            'estrutura', v_structure_score
        ),
        'can_implement', jsonb_build_object(
            'plr', v_score >= 70 AND v_labor_risks = 0,
            'incentivos', v_score >= 50,
            'indicacoes', v_score >= 40,
            'investidores', v_score >= 85
        ),
        'blockers_count', jsonb_array_length(v_blockers),
        'blockers', v_blockers,
        'recommendations', v_recommendations,
        'message', CASE v_level
            WHEN 'excellent' THEN 'Dra. Helena: Empresa em excelente situação! Todos os programas podem ser implementados.'
            WHEN 'mature' THEN 'Dra. Helena: Empresa madura. PLR e incentivos podem ser implementados após resolver pendências menores.'
            WHEN 'structured' THEN 'Dra. Helena: Empresa em estruturação. Incentivos básicos podem começar, mas PLR deve esperar.'
            WHEN 'developing' THEN 'Dra. Helena: ATENÇÃO! Empresa em desenvolvimento. Foco deve ser em organizar a estrutura antes de criar programas.'
            ELSE 'Dra. Helena: SITUAÇÃO CRÍTICA! Todos os agentes devem se reunir URGENTE para organizar a empresa.'
        END
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FUNÇÃO: VERIFICAR SE PODE IMPLEMENTAR PROGRAMA
-- =====================================================

CREATE OR REPLACE FUNCTION can_implement_program(p_program_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_prereq RECORD;
    v_analysis RECORD;
    v_missing JSONB := '[]'::jsonb;
    v_can_implement BOOLEAN := true;
    v_condition_key TEXT;
    v_condition_value JSONB;
BEGIN
    -- Buscar pré-requisitos
    SELECT * INTO v_prereq
    FROM program_prerequisites
    WHERE program_code = p_program_code AND is_active;

    IF v_prereq IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Programa não encontrado');
    END IF;

    -- Buscar última análise
    SELECT * INTO v_analysis
    FROM business_maturity_analysis
    ORDER BY created_at DESC LIMIT 1;

    IF v_analysis IS NULL THEN
        -- Executar análise primeiro
        PERFORM calculate_business_maturity();
        SELECT * INTO v_analysis
        FROM business_maturity_analysis
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Verificar score mínimo
    IF v_analysis.maturity_score < v_prereq.min_maturity_score THEN
        v_can_implement := false;
        v_missing := v_missing || jsonb_build_array(
            jsonb_build_object(
                'condition', 'maturity_score',
                'required', v_prereq.min_maturity_score,
                'actual', v_analysis.maturity_score,
                'message', 'Score de maturidade insuficiente'
            )
        );
    END IF;

    -- Verificar condições obrigatórias
    FOR v_condition_key, v_condition_value IN
        SELECT * FROM jsonb_each(v_prereq.required_conditions)
    LOOP
        -- Verificar cada condição
        CASE v_condition_key
            WHEN 'is_profitable' THEN
                IF NOT COALESCE(v_analysis.is_profitable, false) THEN
                    v_can_implement := false;
                    v_missing := v_missing || jsonb_build_array(
                        jsonb_build_object(
                            'condition', 'is_profitable',
                            'required', true,
                            'actual', false,
                            'message', 'Empresa precisa estar lucrativa'
                        )
                    );
                END IF;
            WHEN 'months_profitable' THEN
                IF COALESCE(v_analysis.months_profitable, 0) < (v_condition_value::integer) THEN
                    v_can_implement := false;
                    v_missing := v_missing || jsonb_build_array(
                        jsonb_build_object(
                            'condition', 'months_profitable',
                            'required', v_condition_value,
                            'actual', v_analysis.months_profitable,
                            'message', 'Precisa de mais meses consecutivos de lucro'
                        )
                    );
                END IF;
            WHEN 'has_updated_balancete' THEN
                IF NOT COALESCE(v_analysis.has_updated_balancete, false) THEN
                    v_can_implement := false;
                    v_missing := v_missing || jsonb_build_array(
                        jsonb_build_object(
                            'condition', 'has_updated_balancete',
                            'required', true,
                            'actual', false,
                            'message', 'Balancete precisa estar atualizado'
                        )
                    );
                END IF;
            WHEN 'labor_risks_count_max' THEN
                IF COALESCE(v_analysis.labor_risks_count, 99) > (v_condition_value::integer) THEN
                    v_can_implement := false;
                    v_missing := v_missing || jsonb_build_array(
                        jsonb_build_object(
                            'condition', 'labor_risks_count',
                            'required', '<= ' || v_condition_value::text,
                            'actual', v_analysis.labor_risks_count,
                            'message', 'Riscos trabalhistas precisam ser resolvidos'
                        )
                    );
                END IF;
            ELSE
                NULL; -- Ignorar condições não implementadas ainda
        END CASE;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'program', v_prereq.program_name,
        'can_implement', v_can_implement,
        'maturity_score', v_analysis.maturity_score,
        'min_score_required', v_prereq.min_maturity_score,
        'missing_conditions', v_missing,
        'risks_if_premature', v_prereq.risks_if_premature,
        'message', CASE
            WHEN v_can_implement THEN
                'Dra. Helena: ✅ Empresa APTA para implementar ' || v_prereq.program_name || '!'
            ELSE
                'Dra. Helena: ⚠️ Empresa ainda NÃO está pronta para ' || v_prereq.program_name ||
                '. Resolver ' || jsonb_array_length(v_missing) || ' pendência(s) primeiro.'
        END
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. VIEW: RESUMO DE MATURIDADE
-- =====================================================

CREATE OR REPLACE VIEW vw_business_maturity_summary AS
SELECT
    bma.analysis_period,
    bma.maturity_score,
    bma.maturity_level,
    bma.accounting_score,
    bma.labor_risks_count,
    bma.is_profitable,
    bma.can_implement_plr,
    bma.can_implement_incentives,
    bma.can_implement_referrals,
    bma.can_attract_investors,
    jsonb_array_length(bma.blockers) as blockers_count,
    jsonb_array_length(bma.recommendations) as recommendations_count,
    bma.cicero_diagnosis,
    bma.milton_diagnosis,
    bma.advocato_diagnosis,
    bma.created_at
FROM business_maturity_analysis bma
ORDER BY bma.created_at DESC;

-- =====================================================
-- 6. VIEW: PRÓXIMOS PASSOS PARA LIBERAR PROGRAMAS
-- =====================================================

CREATE OR REPLACE VIEW vw_program_readiness AS
SELECT
    pp.program_code,
    pp.program_name,
    pp.min_maturity_score,
    bma.maturity_score as current_score,
    CASE
        WHEN bma.maturity_score >= pp.min_maturity_score THEN '✅ Score OK'
        ELSE '❌ Score ' || bma.maturity_score || '/' || pp.min_maturity_score
    END as score_status,
    CASE pp.program_code
        WHEN 'PLR' THEN bma.can_implement_plr
        WHEN 'EMPLOYEE_INCENTIVES' THEN bma.can_implement_incentives
        WHEN 'REFERRAL_PROGRAM' THEN bma.can_implement_referrals
        WHEN 'INVESTOR_READY' THEN bma.can_attract_investors
    END as is_ready,
    pp.risks_if_premature
FROM program_prerequisites pp
CROSS JOIN (
    SELECT * FROM business_maturity_analysis ORDER BY created_at DESC LIMIT 1
) bma
WHERE pp.is_active
ORDER BY pp.min_maturity_score;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE business_maturity_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_maturity_analysis_all" ON business_maturity_analysis FOR ALL TO authenticated USING (true);
CREATE POLICY "program_prerequisites_read" ON program_prerequisites FOR SELECT TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE business_maturity_analysis IS 'Análise de maturidade da empresa pelos agentes IA';
COMMENT ON TABLE program_prerequisites IS 'Pré-requisitos para implementar cada programa';
COMMENT ON FUNCTION calculate_business_maturity IS 'Calcula o score de maturidade analisando contabilidade, finanças, compliance e estrutura';
COMMENT ON FUNCTION can_implement_program IS 'Verifica se a empresa pode implementar um programa específico';

-- =====================================================
-- EXECUTAR PRIMEIRA ANÁLISE
-- =====================================================

SELECT calculate_business_maturity();
