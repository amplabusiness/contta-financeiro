-- =====================================================
-- AMPLA CONTABILIDADE - Sistema de Evolução Contínua
-- Migration: 20251130140000
-- Descrição: Sistema onde funcionários solicitam melhorias
--            e os agentes IA orientam/implementam
--            Como um "Lovable.dev interno" da Ampla
-- =====================================================

-- =====================================================
-- 1. SOLICITAÇÕES DE MELHORIA (Feature Requests)
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Quem solicitou
    requested_by TEXT NOT NULL, -- Nome do funcionário
    requested_by_email TEXT,
    department TEXT, -- 'financeiro', 'fiscal', 'dp', 'contabil', 'diretoria'

    -- Descrição da necessidade
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    problem_description TEXT, -- Qual problema está tentando resolver
    expected_benefit TEXT, -- O que espera ganhar

    -- Exemplo concreto
    example_scenario TEXT, -- Ex: "Vincular empresa do João com a do Pedro"
    current_workaround TEXT, -- Como faz hoje sem a funcionalidade

    -- Classificação pela IA
    category TEXT, -- 'novo_recurso', 'melhoria', 'automacao', 'integracao', 'relatorio', 'correcao'
    complexity TEXT, -- 'simples', 'medio', 'complexo', 'muito_complexo'
    estimated_effort TEXT, -- '1_hora', '1_dia', '1_semana', '1_mes'
    priority_score INTEGER DEFAULT 0, -- 0-100 calculado pela IA

    -- Agente responsável
    assigned_agent TEXT, -- 'cicero', 'milton', 'helena', 'atlas', etc
    agent_analysis TEXT, -- Análise do agente
    agent_recommendation TEXT, -- Recomendação

    -- Especificação técnica gerada
    technical_spec JSONB, -- Especificação técnica completa
    database_changes TEXT[], -- Tabelas/colunas a criar
    ui_changes TEXT[], -- Telas a criar/modificar
    business_rules TEXT[], -- Regras de negócio

    -- Status do fluxo
    status TEXT DEFAULT 'pending', -- pending, analyzing, approved, in_development, testing, deployed, rejected

    -- Aprovações
    approved_by_agent BOOLEAN DEFAULT false,
    approved_by_manager BOOLEAN DEFAULT false,
    manager_name TEXT,
    rejection_reason TEXT,

    -- Implementação
    implementation_notes TEXT,
    migration_file TEXT, -- Nome do arquivo de migration gerado
    component_files TEXT[], -- Componentes React criados

    -- Datas
    created_at TIMESTAMPTZ DEFAULT now(),
    analyzed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,

    -- Feedback
    user_satisfaction INTEGER, -- 1-5 estrelas
    user_feedback TEXT
);

-- =====================================================
-- 2. HISTÓRICO DE ANÁLISES DA IA
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id UUID REFERENCES feature_requests(id) ON DELETE CASCADE,

    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,

    -- Análise
    analysis_type TEXT, -- 'viabilidade', 'impacto', 'tecnica', 'priorizacao'
    analysis_result JSONB,
    recommendation TEXT,
    concerns TEXT[], -- Preocupações identificadas
    suggestions TEXT[], -- Sugestões de melhoria

    -- Score
    viability_score INTEGER, -- 0-100
    impact_score INTEGER, -- 0-100
    effort_score INTEGER, -- 0-100 (quanto maior, mais esforço)

    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 3. TEMPLATES DE FUNCIONALIDADES COMUNS
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT UNIQUE NOT NULL,
    template_name TEXT NOT NULL,
    category TEXT NOT NULL,

    -- Descrição
    description TEXT NOT NULL,
    use_cases TEXT[], -- Casos de uso comuns

    -- Especificação base
    base_spec JSONB, -- Especificação técnica base
    required_tables TEXT[],
    required_components TEXT[],
    estimated_effort TEXT,

    -- Perguntas para refinar
    clarifying_questions TEXT[], -- Perguntas para fazer ao usuário

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir templates comuns
INSERT INTO feature_templates (template_code, template_name, category, description, use_cases, clarifying_questions, estimated_effort) VALUES

('GRUPO_ECONOMICO',
 'Vincular Empresas como Grupo Econômico',
 'integracao',
 'Permite vincular múltiplas empresas (CNPJs) como um grupo econômico, consolidando relatórios e honorários.',
 ARRAY[
    'Mesmo dono com várias empresas',
    'Holding com subsidiárias',
    'Franquias',
    'Filiais e matriz'
 ],
 ARRAY[
    'Quantas empresas serão vinculadas?',
    'Qual empresa é a principal/matriz?',
    'Deseja consolidar honorários?',
    'Precisa de relatório consolidado?'
 ],
 '1_dia'),

('RELATORIO_PERSONALIZADO',
 'Criar Relatório Personalizado',
 'relatorio',
 'Cria um novo relatório com filtros e colunas personalizadas.',
 ARRAY[
    'Relatório de clientes por segmento',
    'Relatório de honorários por período',
    'Relatório de produtividade'
 ],
 ARRAY[
    'Quais informações precisa no relatório?',
    'Quais filtros são necessários?',
    'Precisa exportar para Excel?',
    'Com que frequência será usado?'
 ],
 '1_hora'),

('AUTOMACAO_ROTINA',
 'Automatizar Rotina Manual',
 'automacao',
 'Transforma uma rotina manual repetitiva em processo automático.',
 ARRAY[
    'Envio de boletos automático',
    'Alerta de vencimentos',
    'Cálculo automático de multas',
    'Backup de documentos'
 ],
 ARRAY[
    'Descreva o passo a passo da rotina atual',
    'Com que frequência precisa executar?',
    'Quais dados são necessários?',
    'Precisa de aprovação humana em alguma etapa?'
 ],
 '1_semana'),

('INTEGRACAO_EXTERNA',
 'Integrar com Sistema Externo',
 'integracao',
 'Conecta com API ou importa dados de outro sistema.',
 ARRAY[
    'Importar do sistema de folha',
    'Integrar com banco',
    'Conectar com ERP do cliente',
    'Sincronizar com eSocial'
 ],
 ARRAY[
    'Qual sistema quer integrar?',
    'Tem documentação da API?',
    'É importação ou sincronização contínua?',
    'Precisa enviar dados ou só receber?'
 ],
 '1_semana'),

('ALERTA_NOTIFICACAO',
 'Criar Sistema de Alertas',
 'automacao',
 'Notifica usuários quando certas condições são atingidas.',
 ARRAY[
    'Alerta de cliente inadimplente',
    'Aviso de vencimento de contrato',
    'Notificação de estoque baixo',
    'Lembrete de obrigação fiscal'
 ],
 ARRAY[
    'Qual condição dispara o alerta?',
    'Quem deve receber?',
    'Por qual canal (email, WhatsApp, sistema)?',
    'Com que antecedência avisar?'
 ],
 '1_dia'),

('DASHBOARD_INDICADOR',
 'Adicionar Indicador no Dashboard',
 'relatorio',
 'Cria novo KPI ou gráfico para monitoramento.',
 ARRAY[
    'Taxa de conversão de propostas',
    'Tempo médio de atendimento',
    'Faturamento por funcionário',
    'NPS de clientes'
 ],
 ARRAY[
    'Qual métrica quer acompanhar?',
    'Como é calculada?',
    'Qual a meta/benchmark?',
    'Precisa comparar com período anterior?'
 ],
 '1_hora');

-- =====================================================
-- 4. FUNÇÃO PARA ANALISAR SOLICITAÇÃO
-- =====================================================

CREATE OR REPLACE FUNCTION analyze_feature_request(p_feature_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_feature RECORD;
    v_template RECORD;
    v_priority INTEGER;
    v_complexity TEXT;
    v_agent TEXT;
    v_analysis JSONB;
BEGIN
    -- Buscar solicitação
    SELECT * INTO v_feature FROM feature_requests WHERE id = p_feature_id;

    IF v_feature IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
    END IF;

    -- Tentar encontrar template similar
    SELECT * INTO v_template
    FROM feature_templates
    WHERE is_active
      AND (
          v_feature.title ILIKE '%' || template_name || '%'
          OR v_feature.description ILIKE '%' || ANY(use_cases) || '%'
      )
    LIMIT 1;

    -- Determinar agente responsável baseado na categoria/departamento
    v_agent := CASE v_feature.department
        WHEN 'financeiro' THEN 'milton'
        WHEN 'fiscal' THEN 'cicero'
        WHEN 'dp' THEN 'advocato'
        WHEN 'contabil' THEN 'cicero'
        WHEN 'diretoria' THEN 'helena'
        ELSE 'atlas'
    END;

    -- Calcular complexidade baseada no texto
    v_complexity := CASE
        WHEN v_feature.description ILIKE '%api%' OR v_feature.description ILIKE '%integra%' THEN 'complexo'
        WHEN v_feature.description ILIKE '%relat%' OR v_feature.description ILIKE '%dashboard%' THEN 'simples'
        WHEN v_feature.description ILIKE '%automa%' THEN 'medio'
        ELSE 'medio'
    END;

    -- Calcular prioridade
    v_priority := CASE v_feature.department
        WHEN 'diretoria' THEN 80
        WHEN 'financeiro' THEN 70
        WHEN 'contabil' THEN 60
        ELSE 50
    END;

    -- Se encontrou template, usar como base
    IF v_template IS NOT NULL THEN
        v_complexity := COALESCE(v_template.estimated_effort, v_complexity);
        v_priority := v_priority + 10; -- Templates conhecidos são mais fáceis
    END IF;

    -- Atualizar solicitação
    UPDATE feature_requests SET
        category = COALESCE(v_template.category, 'melhoria'),
        complexity = v_complexity,
        assigned_agent = v_agent,
        priority_score = v_priority,
        status = 'analyzing',
        analyzed_at = now(),
        agent_analysis = 'Analisado automaticamente. ' ||
            CASE WHEN v_template IS NOT NULL
                THEN 'Template similar encontrado: ' || v_template.template_name
                ELSE 'Necessita análise detalhada.'
            END
    WHERE id = p_feature_id;

    -- Registrar análise
    INSERT INTO feature_analysis_history (
        feature_id, agent_id, agent_name, analysis_type,
        viability_score, impact_score, effort_score,
        recommendation
    ) VALUES (
        p_feature_id, v_agent,
        CASE v_agent
            WHEN 'cicero' THEN 'Dr. Cícero'
            WHEN 'milton' THEN 'Prof. Milton'
            WHEN 'helena' THEN 'Dra. Helena'
            WHEN 'atlas' THEN 'Atlas'
            WHEN 'advocato' THEN 'Dr. Advocato'
            ELSE 'Equipe IA'
        END,
        'viabilidade',
        80, -- viability
        v_priority, -- impact
        CASE v_complexity
            WHEN 'simples' THEN 20
            WHEN 'medio' THEN 50
            WHEN 'complexo' THEN 80
            ELSE 50
        END, -- effort
        CASE
            WHEN v_template IS NOT NULL THEN
                'Recomendo usar template "' || v_template.template_name || '". Estimativa: ' || v_template.estimated_effort
            ELSE
                'Solicitação válida. Aguardando detalhamento técnico.'
        END
    );

    RETURN jsonb_build_object(
        'success', true,
        'feature_id', p_feature_id,
        'assigned_agent', v_agent,
        'complexity', v_complexity,
        'priority_score', v_priority,
        'template_found', v_template IS NOT NULL,
        'template_name', v_template.template_name,
        'clarifying_questions', v_template.clarifying_questions,
        'message', 'Solicitação analisada! Agente ' || v_agent || ' assumiu.'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. FUNÇÃO PARA GERAR ESPECIFICAÇÃO TÉCNICA
-- =====================================================

CREATE OR REPLACE FUNCTION generate_technical_spec(p_feature_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_feature RECORD;
    v_spec JSONB;
BEGIN
    SELECT * INTO v_feature FROM feature_requests WHERE id = p_feature_id;

    -- Gerar especificação básica (em produção, isso seria enriquecido pela IA)
    v_spec := jsonb_build_object(
        'title', v_feature.title,
        'description', v_feature.description,
        'generated_at', now(),
        'sections', jsonb_build_array(
            jsonb_build_object(
                'name', 'Objetivo',
                'content', v_feature.problem_description
            ),
            jsonb_build_object(
                'name', 'Benefício Esperado',
                'content', v_feature.expected_benefit
            ),
            jsonb_build_object(
                'name', 'Exemplo de Uso',
                'content', v_feature.example_scenario
            )
        ),
        'database', jsonb_build_object(
            'new_tables', ARRAY[]::text[],
            'modified_tables', ARRAY[]::text[],
            'new_columns', ARRAY[]::text[]
        ),
        'ui', jsonb_build_object(
            'new_pages', ARRAY[]::text[],
            'modified_pages', ARRAY[]::text[],
            'new_components', ARRAY[]::text[]
        ),
        'api', jsonb_build_object(
            'new_functions', ARRAY[]::text[],
            'new_endpoints', ARRAY[]::text[]
        )
    );

    -- Atualizar solicitação
    UPDATE feature_requests SET
        technical_spec = v_spec,
        status = 'approved'
    WHERE id = p_feature_id;

    RETURN jsonb_build_object(
        'success', true,
        'spec', v_spec,
        'message', 'Especificação técnica gerada!'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. SISTEMA DE GRUPOS ECONÔMICOS (EXEMPLO REAL)
-- =====================================================

-- Esta é a implementação real do exemplo que o usuário deu!

CREATE TABLE IF NOT EXISTS economic_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name TEXT NOT NULL,
    group_code TEXT UNIQUE,
    description TEXT,

    -- Empresa principal/holding
    main_company_id UUID, -- Referência para clients
    main_company_name TEXT,
    main_company_cnpj TEXT,

    -- Configurações
    consolidate_billing BOOLEAN DEFAULT true, -- Consolidar honorários
    consolidated_reports BOOLEAN DEFAULT true, -- Relatórios consolidados
    shared_discount_percent DECIMAL(5,2) DEFAULT 0, -- Desconto por grupo

    -- Responsável
    account_manager TEXT, -- Gerente de conta

    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir que colunas existem em economic_groups (se tabela foi criada antes)
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS group_code TEXT;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS main_company_id UUID;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS main_company_name TEXT;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS main_company_cnpj TEXT;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS consolidate_billing BOOLEAN DEFAULT true;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS consolidated_reports BOOLEAN DEFAULT true;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS shared_discount_percent DECIMAL(5,2);
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS account_manager TEXT;
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Membros do grupo econômico
CREATE TABLE IF NOT EXISTS economic_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES economic_groups(id) ON DELETE CASCADE,

    -- Empresa membro
    client_id UUID, -- Referência para clients
    company_name TEXT NOT NULL,
    cnpj TEXT,
    relationship_type TEXT DEFAULT 'subsidiary',
    ownership_percent DECIMAL(5,2),
    billing_share_percent DECIMAL(5,2),
    joined_at DATE DEFAULT CURRENT_DATE,
    left_at DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir que colunas existem (se tabela foi criada antes sem elas)
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS relationship_type TEXT;
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS ownership_percent DECIMAL(5,2);
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS billing_share_percent DECIMAL(5,2);
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS joined_at DATE;
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS left_at DATE;
ALTER TABLE economic_group_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

-- View de grupos econômicos com totais
CREATE OR REPLACE VIEW vw_economic_groups_summary AS
SELECT
    eg.id,
    eg.group_name,
    eg.group_code,
    eg.main_company_name,
    COUNT(egm.id) as total_empresas,
    SUM(CASE WHEN egm.is_active THEN 1 ELSE 0 END) as empresas_ativas,
    eg.consolidate_billing,
    eg.shared_discount_percent,
    eg.account_manager,
    eg.is_active
FROM economic_groups eg
LEFT JOIN economic_group_members egm ON egm.group_id = eg.id
GROUP BY eg.id;

-- View de membros com detalhes
CREATE OR REPLACE VIEW vw_economic_group_members AS
SELECT
    eg.group_name,
    eg.group_code,
    egm.company_name,
    egm.cnpj,
    egm.relationship_type,
    egm.ownership_percent,
    egm.billing_share_percent,
    egm.is_active,
    egm.joined_at
FROM economic_group_members egm
JOIN economic_groups eg ON eg.id = egm.group_id
ORDER BY eg.group_name, egm.relationship_type DESC;

-- Função para criar grupo econômico
CREATE OR REPLACE FUNCTION create_economic_group(
    p_group_name TEXT,
    p_main_company_name TEXT,
    p_main_company_cnpj TEXT,
    p_member_companies JSONB -- Array de {name, cnpj, relationship, ownership}
) RETURNS JSONB AS $$
DECLARE
    v_group_id UUID;
    v_member JSONB;
    v_count INTEGER := 0;
BEGIN
    -- Criar grupo
    INSERT INTO economic_groups (
        group_name,
        main_company_name,
        main_company_cnpj,
        group_code
    ) VALUES (
        p_group_name,
        p_main_company_name,
        p_main_company_cnpj,
        'GRP-' || LPAD(nextval('economic_group_seq')::text, 4, '0')
    )
    RETURNING id INTO v_group_id;

    -- Adicionar empresa principal como membro
    INSERT INTO economic_group_members (
        group_id, company_name, cnpj, relationship_type, ownership_percent
    ) VALUES (
        v_group_id, p_main_company_name, p_main_company_cnpj, 'holding', 100
    );
    v_count := 1;

    -- Adicionar demais membros
    FOR v_member IN SELECT * FROM jsonb_array_elements(p_member_companies)
    LOOP
        INSERT INTO economic_group_members (
            group_id,
            company_name,
            cnpj,
            relationship_type,
            ownership_percent
        ) VALUES (
            v_group_id,
            v_member->>'name',
            v_member->>'cnpj',
            COALESCE(v_member->>'relationship', 'subsidiary'),
            COALESCE((v_member->>'ownership')::decimal, 0)
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'group_id', v_group_id,
        'total_members', v_count,
        'message', 'Dra. Helena: Grupo econômico "' || p_group_name || '" criado com ' || v_count || ' empresas!'
    );
END;
$$ LANGUAGE plpgsql;

-- Criar sequence para código do grupo
CREATE SEQUENCE IF NOT EXISTS economic_group_seq START 1;

-- =====================================================
-- 7. VIEW DE SOLICITAÇÕES PENDENTES
-- =====================================================

CREATE OR REPLACE VIEW vw_pending_feature_requests AS
SELECT
    fr.id,
    fr.title,
    fr.requested_by,
    fr.department,
    fr.category,
    fr.complexity,
    fr.priority_score,
    fr.assigned_agent,
    CASE fr.assigned_agent
        WHEN 'cicero' THEN 'Dr. Cícero'
        WHEN 'milton' THEN 'Prof. Milton'
        WHEN 'helena' THEN 'Dra. Helena'
        WHEN 'atlas' THEN 'Atlas'
        WHEN 'advocato' THEN 'Dr. Advocato'
        WHEN 'empresario' THEN 'Sr. Empresário'
        WHEN 'vendedor' THEN 'Sr. Vendedor'
        WHEN 'marketing' THEN 'Sra. Marketing'
        ELSE 'Não atribuído'
    END as agent_name,
    fr.status,
    fr.created_at,
    age(now(), fr.created_at) as tempo_espera
FROM feature_requests fr
WHERE fr.status NOT IN ('deployed', 'rejected')
ORDER BY fr.priority_score DESC, fr.created_at;

-- =====================================================
-- 8. VIEW DE MÉTRICAS DE EVOLUÇÃO
-- =====================================================

CREATE OR REPLACE VIEW vw_evolution_metrics AS
SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as pendentes,
    COUNT(*) FILTER (WHERE status = 'analyzing') as em_analise,
    COUNT(*) FILTER (WHERE status = 'approved') as aprovadas,
    COUNT(*) FILTER (WHERE status = 'in_development') as em_desenvolvimento,
    COUNT(*) FILTER (WHERE status = 'deployed') as implementadas,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejeitadas,
    COUNT(*) as total,
    AVG(CASE WHEN status = 'deployed' THEN user_satisfaction END) as satisfacao_media,
    AVG(EXTRACT(EPOCH FROM (deployed_at - created_at))/86400) FILTER (WHERE deployed_at IS NOT NULL) as dias_medio_implementacao
FROM feature_requests;

-- =====================================================
-- 9. FUNÇÃO PARA SOLICITAR MELHORIA (USO DO FUNCIONÁRIO)
-- =====================================================

CREATE OR REPLACE FUNCTION request_improvement(
    p_requested_by TEXT,
    p_department TEXT,
    p_title TEXT,
    p_description TEXT,
    p_problem TEXT DEFAULT NULL,
    p_benefit TEXT DEFAULT NULL,
    p_example TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_feature_id UUID;
    v_analysis JSONB;
BEGIN
    -- Criar solicitação
    INSERT INTO feature_requests (
        requested_by,
        department,
        title,
        description,
        problem_description,
        expected_benefit,
        example_scenario
    ) VALUES (
        p_requested_by,
        p_department,
        p_title,
        p_description,
        p_problem,
        p_benefit,
        p_example
    )
    RETURNING id INTO v_feature_id;

    -- Analisar automaticamente
    v_analysis := analyze_feature_request(v_feature_id);

    RETURN jsonb_build_object(
        'success', true,
        'feature_id', v_feature_id,
        'analysis', v_analysis,
        'message', 'Sua solicitação foi registrada e já está sendo analisada pela equipe de IA!'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_requests_all" ON feature_requests FOR ALL TO authenticated USING (true);
CREATE POLICY "feature_analysis_all" ON feature_analysis_history FOR ALL TO authenticated USING (true);
CREATE POLICY "feature_templates_read" ON feature_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "economic_groups_all" ON economic_groups FOR ALL TO authenticated USING (true);
CREATE POLICY "economic_group_members_all" ON economic_group_members FOR ALL TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE feature_requests IS 'Solicitações de melhoria feitas pelos funcionários';
COMMENT ON TABLE feature_analysis_history IS 'Histórico de análises da IA sobre solicitações';
COMMENT ON TABLE feature_templates IS 'Templates de funcionalidades comuns para acelerar desenvolvimento';
COMMENT ON TABLE economic_groups IS 'Grupos econômicos (empresas vinculadas)';
COMMENT ON TABLE economic_group_members IS 'Membros de cada grupo econômico';
COMMENT ON FUNCTION request_improvement IS 'Função principal para funcionários solicitarem melhorias';
COMMENT ON FUNCTION analyze_feature_request IS 'Analisa automaticamente uma solicitação de melhoria';

-- =====================================================
-- EXEMPLO DE USO
-- =====================================================

/*
-- 1. Funcionário do financeiro solicita vincular empresas:
SELECT request_improvement(
    'Rose',
    'financeiro',
    'Vincular empresas do João e Pedro como grupo econômico',
    'Preciso vincular a empresa do João (CNPJ 12.345.678/0001-90) com a do Pedro (CNPJ 98.765.432/0001-10) porque são do mesmo grupo familiar e queremos consolidar os honorários.',
    'Hoje tenho que gerar relatórios separados e somar manualmente',
    'Economizar tempo e dar desconto por volume',
    'João tem uma padaria e Pedro tem um açougue, mesma família'
);

-- 2. Ver solicitações pendentes:
SELECT * FROM vw_pending_feature_requests;

-- 3. Ver métricas de evolução:
SELECT * FROM vw_evolution_metrics;

-- 4. Criar grupo econômico diretamente:
SELECT create_economic_group(
    'Grupo Família Silva',
    'Padaria do João Ltda',
    '12.345.678/0001-90',
    '[
        {"name": "Açougue do Pedro ME", "cnpj": "98.765.432/0001-10", "relationship": "affiliate", "ownership": 0},
        {"name": "Mercadinho Silva", "cnpj": "11.222.333/0001-44", "relationship": "affiliate", "ownership": 0}
    ]'::jsonb
);

-- 5. Ver grupos econômicos:
SELECT * FROM vw_economic_groups_summary;
SELECT * FROM vw_economic_group_members WHERE group_name = 'Grupo Família Silva';
*/
