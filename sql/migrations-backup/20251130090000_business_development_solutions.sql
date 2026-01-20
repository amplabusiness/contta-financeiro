-- =====================================================
-- AMPLA CONTABILIDADE - Sistema de Desenvolvimento de Negócios
-- Migration: 20251130090000
-- Descrição: Não basta identificar problemas - a IA propõe SOLUÇÕES
--            Sistema de vendas, retenção, indicações e prospecção
-- =====================================================

-- =====================================================
-- NOVO AGENTE: VENDEDOR IA
-- =====================================================

INSERT INTO ai_agents (agent_id, name, role, specialty, description, knowledge_sources, icon, color)
VALUES (
    'vendedor',
    'Sr. Vendedor',
    'Consultor Comercial IA',
    'Vendas e Desenvolvimento de Negócios',
    'Especialista em vendas consultivas de serviços contábeis. Identifica oportunidades, treina equipe, propõe estratégias de retenção e crescimento. Quando há rombo, não só alerta - apresenta soluções práticas.',
    ARRAY['Técnicas de Vendas', 'Retenção de Clientes', 'Prospecção', 'Indicações', 'Negociação'],
    'TrendingUp',
    'emerald'
) ON CONFLICT (agent_id) DO NOTHING;

-- Adicionar página de vendas ao mapeamento
INSERT INTO ai_page_agents (page_path, page_name, primary_agent_id, secondary_agents, agent_role, auto_actions, requires_approval, approval_threshold)
VALUES (
    '/sales',
    'Desenvolvimento Comercial',
    'vendedor',
    ARRAY['helena', 'milton'],
    'Sr. Vendedor coordena estratégias de crescimento, treinamento e prospecção',
    ARRAY['Identificar oportunidades', 'Gerar leads', 'Treinar equipe', 'Propor soluções'],
    false,
    NULL
) ON CONFLICT (page_path) DO NOTHING;

-- =====================================================
-- 1. SISTEMA DE SOLUÇÕES FINANCEIRAS
-- Quando há rombo, a IA propõe alternativas
-- =====================================================

CREATE TABLE IF NOT EXISTS financial_gap_solutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_type TEXT NOT NULL, -- 'deficit', 'cash_flow', 'receivables', 'cost_overrun'
    gap_amount DECIMAL(15,2),
    gap_description TEXT,
    detected_date DATE NOT NULL,
    target_resolution_date DATE,

    -- Soluções propostas
    solutions JSONB DEFAULT '[]'::jsonb, -- Array de soluções com prioridade
    selected_solution_id TEXT, -- Qual solução foi escolhida
    implementation_status TEXT DEFAULT 'analyzing', -- analyzing, planned, in_progress, resolved

    -- Resultados
    amount_recovered DECIMAL(15,2) DEFAULT 0,
    notes TEXT,

    -- Responsáveis
    assigned_agents TEXT[] DEFAULT ARRAY['vendedor', 'milton', 'helena'],
    assigned_humans TEXT[],

    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- Templates de soluções por tipo de problema
CREATE TABLE IF NOT EXISTS solution_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_type TEXT NOT NULL,
    solution_code TEXT UNIQUE NOT NULL,
    solution_name TEXT NOT NULL,
    description TEXT NOT NULL,
    implementation_steps JSONB, -- Passos para implementar
    expected_impact_percent DECIMAL(5,2), -- % esperado de recuperação
    time_to_implement TEXT, -- Tempo estimado
    complexity TEXT, -- baixa, media, alta
    required_resources TEXT[], -- O que precisa
    scripts JSONB, -- Scripts de venda/abordagem
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir templates de soluções
INSERT INTO solution_templates (gap_type, solution_code, solution_name, description, implementation_steps, expected_impact_percent, time_to_implement, complexity, required_resources, scripts) VALUES

-- SOLUÇÕES PARA DÉFICIT DE RECEITA
('deficit', 'SELL_MORE_SERVICES',
 'Venda de Serviços Adicionais',
 'Identificar clientes que podem contratar mais serviços da Ampla (consultoria, planejamento tributário, BPO)',
 '[
   {"passo": 1, "acao": "Listar clientes por serviços contratados", "responsavel": "vendedor"},
   {"passo": 2, "acao": "Identificar gaps (quem não tem consultoria, quem não tem BPO)", "responsavel": "vendedor"},
   {"passo": 3, "acao": "Criar lista de abordagem prioritária", "responsavel": "vendedor"},
   {"passo": 4, "acao": "Treinar equipe com scripts", "responsavel": "vendedor"},
   {"passo": 5, "acao": "Agendar reuniões de apresentação", "responsavel": "helena"},
   {"passo": 6, "acao": "Acompanhar conversões", "responsavel": "milton"}
 ]'::jsonb,
 15.0,
 '30 dias',
 'media',
 ARRAY['Lista de clientes', 'Portfólio de serviços', 'Scripts de venda'],
 '{
   "abordagem_telefone": "Olá [CLIENTE], aqui é [NOME] da Ampla. Estou entrando em contato porque identificamos uma oportunidade para sua empresa economizar [X%] com [SERVIÇO]. Você teria 15 minutos esta semana para conversarmos?",
   "email_inicial": "Prezado [CLIENTE],\n\nA Ampla está há [X] anos cuidando da contabilidade da [EMPRESA] e identificamos uma oportunidade de otimização.\n\nGostaria de apresentar nosso serviço de [SERVIÇO] que tem ajudado empresas como a sua a [BENEFÍCIO].\n\nPodemos agendar uma conversa?",
   "follow_up": "Olá [CLIENTE], dando continuidade à nossa conversa sobre [SERVIÇO]. Preparei uma proposta personalizada. Quando podemos apresentar?"
 }'::jsonb),

('deficit', 'REFERRAL_PROGRAM',
 'Programa de Indicações',
 'Usar a rede de relacionamentos dos clientes atuais para captar novos clientes com desconto/comissão',
 '[
   {"passo": 1, "acao": "Mapear sócios dos clientes que não são clientes Ampla", "responsavel": "vendedor"},
   {"passo": 2, "acao": "Definir política de indicação (desconto X% ou comissão Y%)", "responsavel": "milton"},
   {"passo": 3, "acao": "Criar material de comunicação", "responsavel": "helena"},
   {"passo": 4, "acao": "Treinar equipe para pedir indicações", "responsavel": "vendedor"},
   {"passo": 5, "acao": "Abordar clientes satisfeitos primeiro", "responsavel": "vendedor"},
   {"passo": 6, "acao": "Registrar e acompanhar indicações", "responsavel": "helena"}
 ]'::jsonb,
 25.0,
 '60 dias',
 'baixa',
 ARRAY['Lista de clientes', 'Política de indicação', 'Material de divulgação'],
 '{
   "pedir_indicacao": "Você está satisfeito com nossos serviços? Conhece algum empresário que poderia se beneficiar? Temos um programa de indicação que oferece [BENEFÍCIO] para você e condições especiais para seu indicado.",
   "abordar_indicado": "Olá [INDICADO], sou [NOME] da Ampla Contabilidade. O [CLIENTE QUE INDICOU] me passou seu contato porque acredita que podemos ajudar sua empresa assim como ajudamos a dele. Podemos conversar?",
   "agradecimento": "Obrigado pela indicação! Assim que [INDICADO] fechar conosco, você receberá [BENEFÍCIO]. Conhece mais alguém?"
 }'::jsonb),

('deficit', 'PROSPECT_CLIENT_PARTNERS',
 'Prospecção via Quadro Societário',
 'Identificar sócios dos clientes que têm outras empresas que não são atendidas pela Ampla',
 '[
   {"passo": 1, "acao": "Consultar quadro societário de todos os clientes (via CNPJA)", "responsavel": "atlas"},
   {"passo": 2, "acao": "Identificar CPFs com participação em outras empresas", "responsavel": "atlas"},
   {"passo": 3, "acao": "Verificar quais dessas empresas não são clientes", "responsavel": "vendedor"},
   {"passo": 4, "acao": "Classificar por potencial (faturamento, setor)", "responsavel": "milton"},
   {"passo": 5, "acao": "Abordar cliente atual sobre a outra empresa", "responsavel": "vendedor"},
   {"passo": 6, "acao": "Oferecer desconto por volume (grupo econômico)", "responsavel": "milton"}
 ]'::jsonb,
 20.0,
 '45 dias',
 'media',
 ARRAY['API CNPJA', 'Lista de clientes', 'Sistema de CRM'],
 '{
   "abordagem": "[CLIENTE], vi que você também é sócio da [OUTRA EMPRESA]. Quem cuida da contabilidade de lá? Sabia que podemos oferecer condições especiais por você já ser nosso cliente?",
   "proposta_grupo": "Para empresas do mesmo grupo econômico, oferecemos [X%] de desconto. Além do preço, você tem a vantagem de centralizar informações e facilitar a gestão."
 }'::jsonb),

('deficit', 'CLIENT_RETENTION',
 'Retenção de Clientes em Risco',
 'Identificar clientes que podem cancelar e agir proativamente para reter',
 '[
   {"passo": 1, "acao": "Identificar clientes inadimplentes ou inativos", "responsavel": "helena"},
   {"passo": 2, "acao": "Classificar por risco de cancelamento", "responsavel": "atlas"},
   {"passo": 3, "acao": "Entender motivo da insatisfação", "responsavel": "vendedor"},
   {"passo": 4, "acao": "Propor solução personalizada", "responsavel": "vendedor"},
   {"passo": 5, "acao": "Negociar condições para manter", "responsavel": "milton"},
   {"passo": 6, "acao": "Monitorar satisfação após ação", "responsavel": "helena"}
 ]'::jsonb,
 10.0,
 '15 dias',
 'baixa',
 ARRAY['Lista de clientes', 'Histórico de atendimento', 'Scripts de retenção'],
 '{
   "abordagem_inicial": "[CLIENTE], percebi que faz tempo que não conversamos. Está tudo bem com os serviços? Tem algo que possamos melhorar?",
   "oferta_retencao": "Entendo sua situação. Que tal [BENEFÍCIO] pelos próximos [X] meses enquanto sua empresa se recupera? Preferimos ajustar do que perder você.",
   "cliente_satisfeito": "Fico feliz que esteja satisfeito! Lembre que estamos aqui para ajudar. Aliás, conhece alguém que também precisaria dos nossos serviços?"
 }'::jsonb),

('deficit', 'INCREASE_FEES',
 'Reajuste de Honorários',
 'Aplicar reajuste em clientes que estão abaixo do valor de mercado',
 '[
   {"passo": 1, "acao": "Analisar honorários x complexidade por cliente", "responsavel": "milton"},
   {"passo": 2, "acao": "Identificar clientes subvalorizados", "responsavel": "milton"},
   {"passo": 3, "acao": "Preparar justificativa do reajuste", "responsavel": "cicero"},
   {"passo": 4, "acao": "Comunicar reajuste com antecedência", "responsavel": "helena"},
   {"passo": 5, "acao": "Negociar caso a caso", "responsavel": "vendedor"},
   {"passo": 6, "acao": "Aplicar reajuste", "responsavel": "milton"}
 ]'::jsonb,
 12.0,
 '60 dias',
 'alta',
 ARRAY['Tabela de preços', 'Histórico de reajustes', 'Análise de mercado'],
 '{
   "comunicacao_reajuste": "Prezado [CLIENTE],\n\nConforme previsto em contrato, comunicamos o reajuste de honorários a partir de [DATA].\n\nO novo valor será R$ [VALOR], considerando [JUSTIFICATIVA].\n\nAgradecemos a parceria e seguimos à disposição.",
   "negociacao": "Entendo sua preocupação. Podemos aplicar o reajuste de forma gradual em [X] meses, chegando ao valor em [DATA]. O que acha?"
 }'::jsonb),

-- SOLUÇÕES PARA FLUXO DE CAIXA
('cash_flow', 'ACCELERATE_RECEIVABLES',
 'Acelerar Recebimentos',
 'Reduzir prazo médio de recebimento e antecipar valores',
 '[
   {"passo": 1, "acao": "Identificar clientes com maior prazo", "responsavel": "milton"},
   {"passo": 2, "acao": "Oferecer desconto para pagamento antecipado", "responsavel": "vendedor"},
   {"passo": 3, "acao": "Migrar para débito automático", "responsavel": "helena"},
   {"passo": 4, "acao": "Renegociar prazos contratuais", "responsavel": "vendedor"},
   {"passo": 5, "acao": "Intensificar cobrança de atrasados", "responsavel": "helena"}
 ]'::jsonb,
 30.0,
 '30 dias',
 'media',
 ARRAY['Relatório de contas a receber', 'Sistema de cobrança'],
 '{
   "desconto_antecipacao": "[CLIENTE], que tal [X%] de desconto se você pagar até o dia [DATA]?",
   "migracao_debito": "Para sua comodidade, podemos migrar para débito automático. Assim você nunca esquece e ainda evita juros."
 }'::jsonb),

('cash_flow', 'NEGOTIATE_PAYABLES',
 'Negociar Prazos com Fornecedores',
 'Estender prazos de pagamento para melhorar fluxo',
 '[
   {"passo": 1, "acao": "Listar fornecedores por valor e prazo", "responsavel": "milton"},
   {"passo": 2, "acao": "Identificar onde é possível negociar", "responsavel": "milton"},
   {"passo": 3, "acao": "Negociar extensão de prazo", "responsavel": "helena"},
   {"passo": 4, "acao": "Ajustar datas de pagamento", "responsavel": "cicero"}
 ]'::jsonb,
 15.0,
 '15 dias',
 'baixa',
 ARRAY['Relatório de contas a pagar', 'Histórico de fornecedores'],
 NULL);

-- =====================================================
-- 2. SISTEMA DE PROSPECÇÃO VIA QUADRO SOCIETÁRIO
-- =====================================================

CREATE TABLE IF NOT EXISTS client_partners_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID, -- Cliente atual da Ampla
    client_name TEXT,
    client_cnpj TEXT,

    -- Sócio em comum
    partner_cpf TEXT NOT NULL,
    partner_name TEXT NOT NULL,

    -- Empresa prospect (não é cliente)
    prospect_cnpj TEXT NOT NULL,
    prospect_name TEXT,
    prospect_trade_name TEXT,
    prospect_status TEXT, -- ativa, inativa
    prospect_size TEXT, -- ME, EPP, etc
    prospect_sector TEXT,
    prospect_city TEXT,
    prospect_state TEXT,

    -- Status de prospecção
    prospecting_status TEXT DEFAULT 'identified', -- identified, contacted, meeting_scheduled, proposal_sent, won, lost
    contact_date DATE,
    meeting_date DATE,
    proposal_date DATE,
    close_date DATE,

    -- Valores
    estimated_monthly_fee DECIMAL(15,2),
    actual_monthly_fee DECIMAL(15,2),

    -- Notas
    notes TEXT,
    last_contact_notes TEXT,

    -- Responsável
    assigned_to TEXT DEFAULT 'vendedor',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Função para identificar oportunidades via quadro societário
CREATE OR REPLACE FUNCTION identify_partner_prospects()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_client RECORD;
    v_partner RECORD;
BEGIN
    -- Para cada cliente ativo
    FOR v_client IN
        SELECT c.id, c.name, c.cnpj
        FROM clients c
        WHERE c.status = 'Ativo'
    LOOP
        -- Aqui deveria consultar API CNPJA para obter sócios
        -- Por enquanto, é um placeholder
        -- A lógica real seria:
        -- 1. Buscar sócios do cliente via API
        -- 2. Para cada CPF, buscar outras empresas
        -- 3. Verificar se já é cliente
        -- 4. Se não for, inserir como prospect
        NULL;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. PROGRAMA DE INDICAÇÕES
-- =====================================================

CREATE TABLE IF NOT EXISTS referral_program (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Quem indicou
    referrer_type TEXT NOT NULL, -- 'client', 'partner', 'employee', 'external'
    referrer_client_id UUID,
    referrer_name TEXT NOT NULL,
    referrer_contact TEXT,

    -- Quem foi indicado
    referred_name TEXT NOT NULL,
    referred_company TEXT,
    referred_cnpj TEXT,
    referred_contact TEXT,
    referred_email TEXT,

    -- Status
    status TEXT DEFAULT 'pending', -- pending, contacted, meeting, proposal, won, lost
    contact_date DATE,
    meeting_date DATE,
    proposal_date DATE,
    close_date DATE,

    -- Valores
    estimated_monthly_fee DECIMAL(15,2),
    actual_monthly_fee DECIMAL(15,2),

    -- Recompensa do indicador
    reward_type TEXT, -- 'discount', 'commission', 'credit', 'gift'
    reward_value DECIMAL(15,2),
    reward_percent DECIMAL(5,2), -- % sobre primeiro honorário
    reward_paid BOOLEAN DEFAULT false,
    reward_paid_date DATE,

    -- Notas
    notes TEXT,

    assigned_to TEXT DEFAULT 'vendedor',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Política padrão de indicação
CREATE TABLE IF NOT EXISTS referral_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL,
    referrer_type TEXT NOT NULL, -- 'client', 'partner', 'employee', 'external'

    -- Benefício para quem indica
    referrer_reward_type TEXT NOT NULL, -- 'discount', 'commission', 'credit'
    referrer_reward_percent DECIMAL(5,2), -- % sobre honorário do novo cliente
    referrer_reward_max DECIMAL(15,2), -- Valor máximo
    referrer_reward_months INTEGER DEFAULT 3, -- Por quantos meses

    -- Benefício para indicado
    referred_discount_percent DECIMAL(5,2), -- % de desconto
    referred_discount_months INTEGER DEFAULT 3, -- Por quantos meses

    is_active BOOLEAN DEFAULT true,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir políticas padrão
INSERT INTO referral_policy (policy_name, referrer_type, referrer_reward_type, referrer_reward_percent, referrer_reward_max, referrer_reward_months, referred_discount_percent, referred_discount_months) VALUES
('Indicação por Cliente', 'client', 'discount', 10.0, 500.00, 3, 10.0, 3),
('Indicação por Funcionário', 'employee', 'commission', 15.0, 1000.00, 1, 10.0, 3),
('Indicação Externa', 'external', 'commission', 5.0, 300.00, 1, 5.0, 1);

-- =====================================================
-- 4. TREINAMENTO DE VENDAS
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code TEXT UNIQUE NOT NULL,
    module_name TEXT NOT NULL,
    description TEXT,
    target_audience TEXT, -- 'all', 'sales', 'support', 'partners'
    duration_minutes INTEGER,

    -- Conteúdo
    content JSONB, -- Slides, vídeos, textos
    scripts JSONB, -- Scripts para praticar
    exercises JSONB, -- Exercícios práticos
    quiz JSONB, -- Perguntas de avaliação

    -- Requisitos
    prerequisites TEXT[], -- Módulos anteriores necessários

    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir módulos de treinamento
INSERT INTO sales_training_modules (module_code, module_name, description, target_audience, duration_minutes, content, scripts) VALUES
('ABORDAGEM_INICIAL',
 'Como Abordar Novos Clientes',
 'Técnicas de primeira abordagem: telefone, email, WhatsApp e presencial',
 'all',
 30,
 '{
   "slides": [
     {"titulo": "Preparação", "conteudo": "Antes de ligar: pesquise a empresa, identifique possíveis dores"},
     {"titulo": "Abertura", "conteudo": "Seja direto, identifique-se, gere interesse em 10 segundos"},
     {"titulo": "Qualificação", "conteudo": "Faça perguntas abertas para entender a necessidade"},
     {"titulo": "Proposta", "conteudo": "Não venda preço, venda valor e resultado"},
     {"titulo": "Fechamento", "conteudo": "Sempre proponha próximo passo concreto"}
   ]
 }'::jsonb,
 '{
   "telefone": "Olá [NOME], aqui é [SEU NOME] da Ampla Contabilidade. Encontrei sua empresa [COMO] e percebi que vocês [OBSERVAÇÃO]. Estou ligando porque ajudamos empresas como a sua a [BENEFÍCIO]. Você teria 2 minutos agora?",
   "whatsapp": "Olá [NOME]! Sou [SEU NOME] da Ampla. Vi que sua empresa [OBSERVAÇÃO] e acredito que podemos ajudar com [BENEFÍCIO]. Posso te enviar mais informações?"
 }'::jsonb),

('PEDIR_INDICACAO',
 'Como Pedir Indicações',
 'Momento certo e forma correta de pedir indicações aos clientes satisfeitos',
 'all',
 20,
 '{
   "slides": [
     {"titulo": "Quando Pedir", "conteudo": "Após resolver um problema, entregar resultado positivo ou receber elogio"},
     {"titulo": "Como Pedir", "conteudo": "Seja específico: \"Você conhece algum empresário que...\""},
     {"titulo": "Facilite", "conteudo": "Ofereça para enviar material, peça apenas nome e WhatsApp"},
     {"titulo": "Agradeça", "conteudo": "Agradeça mesmo que não indique. Reforce que está à disposição"}
   ]
 }'::jsonb,
 '{
   "pedido_basico": "Fico feliz que esteja satisfeito com nosso trabalho! Você conhece algum empresário que também precisa de uma contabilidade que realmente entenda o negócio?",
   "pedido_especifico": "Você mencionou que tem um amigo com restaurante. Será que ele está bem assessorado na contabilidade? Posso ajudá-lo assim como ajudo você.",
   "incentivo": "Sabia que temos um programa de indicação? Se você indicar e a pessoa fechar, você ganha [BENEFÍCIO] e seu amigo ainda tem [DESCONTO]."
 }'::jsonb),

('RETENCAO_CLIENTE',
 'Como Reter Clientes',
 'Identificar sinais de insatisfação e agir antes do cancelamento',
 'all',
 25,
 '{
   "slides": [
     {"titulo": "Sinais de Alerta", "conteudo": "Atraso pagamento, menos contato, reclamações, comparação com concorrentes"},
     {"titulo": "Abordagem Proativa", "conteudo": "Não espere o cliente reclamar. Pergunte regularmente como está"},
     {"titulo": "Escuta Ativa", "conteudo": "Deixe o cliente falar. Entenda o problema real antes de propor solução"},
     {"titulo": "Oferta de Valor", "conteudo": "Não corte preço primeiro. Adicione valor antes de negociar"}
   ]
 }'::jsonb,
 '{
   "checkin_regular": "Oi [CLIENTE], tudo bem? Passando para saber se está tudo ok com nossos serviços. Tem algo que possamos melhorar?",
   "cliente_distante": "[CLIENTE], percebi que faz um tempo que não conversamos. Está tudo bem? Tem algo me preocupando?",
   "proposta_retencao": "Entendo sua situação. Olha, prefiro ajustar algo para manter nossa parceria do que perder você. Que tal [PROPOSTA]?"
 }'::jsonb),

('VENDA_SERVICOS_ADICIONAIS',
 'Como Vender Serviços Adicionais',
 'Identificar oportunidades de upsell e cross-sell com clientes atuais',
 'all',
 30,
 '{
   "slides": [
     {"titulo": "Conheça o Cliente", "conteudo": "Entenda o negócio, desafios e objetivos do cliente"},
     {"titulo": "Mapeie Gaps", "conteudo": "Quais serviços ele precisa mas não contrata conosco?"},
     {"titulo": "Conecte Valor", "conteudo": "Mostre como o serviço adicional resolve um problema específico dele"},
     {"titulo": "Momento Certo", "conteudo": "Venda quando tiver acabado de resolver algo ou após reunião produtiva"}
   ]
 }'::jsonb,
 '{
   "abordagem_consultoria": "Tenho observado que sua empresa está crescendo. Já pensou em fazer um planejamento tributário para otimizar os impostos? Podemos economizar até [X%] ao ano.",
   "abordagem_bpo": "Vi que vocês ainda processam a folha internamente. Sabia que nosso BPO de DP pode reduzir seus custos e riscos trabalhistas?",
   "abordagem_recuperacao": "Analisando seus impostos, identifiquei que vocês podem ter créditos a recuperar. Quer que eu faça uma análise gratuita?"
 }'::jsonb);

-- Registro de treinamentos realizados
CREATE TABLE IF NOT EXISTS sales_training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES sales_training_modules(id),
    trainee_name TEXT NOT NULL,
    trainee_type TEXT, -- 'employee', 'partner'
    training_date DATE DEFAULT CURRENT_DATE,
    score DECIMAL(5,2), -- Nota no quiz
    completed BOOLEAN DEFAULT false,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 5. FUNÇÃO PARA PROPOR SOLUÇÕES AUTOMATICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION propose_gap_solutions(
    p_gap_type TEXT,
    p_gap_amount DECIMAL
) RETURNS JSONB AS $$
DECLARE
    v_solutions JSONB := '[]'::jsonb;
    v_template RECORD;
    v_priority INTEGER := 1;
BEGIN
    -- Buscar templates de solução ordenados por impacto esperado
    FOR v_template IN
        SELECT * FROM solution_templates
        WHERE gap_type = p_gap_type AND is_active
        ORDER BY expected_impact_percent DESC
    LOOP
        v_solutions := v_solutions || jsonb_build_array(
            jsonb_build_object(
                'priority', v_priority,
                'code', v_template.solution_code,
                'name', v_template.solution_name,
                'description', v_template.description,
                'expected_recovery', ROUND(p_gap_amount * v_template.expected_impact_percent / 100, 2),
                'expected_percent', v_template.expected_impact_percent,
                'time_to_implement', v_template.time_to_implement,
                'complexity', v_template.complexity,
                'steps', v_template.implementation_steps,
                'scripts', v_template.scripts,
                'agent_recommendation', CASE
                    WHEN v_template.expected_impact_percent >= 20 THEN
                        'Sr. Vendedor RECOMENDA: Esta estratégia tem alto potencial de retorno!'
                    WHEN v_template.expected_impact_percent >= 10 THEN
                        'Sr. Vendedor sugere: Boa opção complementar.'
                    ELSE
                        'Sr. Vendedor informa: Considerar como última alternativa.'
                END
            )
        );
        v_priority := v_priority + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'gap_type', p_gap_type,
        'gap_amount', p_gap_amount,
        'total_solutions', v_priority - 1,
        'total_potential_recovery', (
            SELECT ROUND(SUM((sol->>'expected_recovery')::decimal), 2)
            FROM jsonb_array_elements(v_solutions) sol
        ),
        'solutions', v_solutions,
        'agent_message', 'Sr. Vendedor analisou o rombo de R$ ' || p_gap_amount ||
            ' e identificou ' || (v_priority - 1) || ' estratégias para recuperação. ' ||
            'Recomendo começar pela primeira opção que tem maior potencial de retorno.'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. VIEW DE OPORTUNIDADES DE CRESCIMENTO
-- =====================================================

CREATE OR REPLACE VIEW vw_growth_opportunities AS
-- Clientes com potencial de upsell (poucos serviços)
SELECT
    'upsell' as opportunity_type,
    c.id as client_id,
    c.name,
    c.monthly_fee as current_fee,
    'Cliente com poucos serviços contratados' as opportunity,
    'Apresentar consultoria ou BPO' as suggested_action,
    'vendedor' as assigned_agent
FROM clients c
WHERE c.status = 'Ativo'
  AND c.monthly_fee < 1000

UNION ALL

-- Clientes inadimplentes (risco de perda)
SELECT
    'retention' as opportunity_type,
    c.id as client_id,
    c.name,
    c.monthly_fee as current_fee,
    'Cliente com pagamentos atrasados' as opportunity,
    'Contatar para entender situação e reter' as suggested_action,
    'vendedor' as assigned_agent
FROM clients c
WHERE c.status = 'Ativo'
-- Aqui deveria cruzar com contas a receber atrasadas

UNION ALL

-- Indicações pendentes de follow-up
SELECT
    'referral' as opportunity_type,
    NULL as client_id,
    referred_name as client_name,
    estimated_monthly_fee as current_fee,
    'Indicação aguardando contato' as opportunity,
    'Entrar em contato e agendar reunião' as suggested_action,
    'vendedor' as assigned_agent
FROM referral_program
WHERE status IN ('pending', 'contacted')

ORDER BY current_fee DESC NULLS LAST;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE financial_gap_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE solution_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_partners_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_training_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_gap_solutions_all" ON financial_gap_solutions FOR ALL TO authenticated USING (true);
CREATE POLICY "solution_templates_read" ON solution_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_partners_prospects_all" ON client_partners_prospects FOR ALL TO authenticated USING (true);
CREATE POLICY "referral_program_all" ON referral_program FOR ALL TO authenticated USING (true);
CREATE POLICY "referral_policy_read" ON referral_policy FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_training_modules_read" ON sales_training_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_training_records_all" ON sales_training_records FOR ALL TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE financial_gap_solutions IS 'Quando há rombo financeiro, a IA propõe soluções práticas';
COMMENT ON TABLE solution_templates IS 'Templates de soluções por tipo de problema';
COMMENT ON TABLE client_partners_prospects IS 'Prospects identificados via quadro societário dos clientes';
COMMENT ON TABLE referral_program IS 'Programa de indicações com recompensas';
COMMENT ON TABLE sales_training_modules IS 'Módulos de treinamento de vendas com scripts';
COMMENT ON FUNCTION propose_gap_solutions IS 'Função que analisa o gap e propõe soluções priorizadas';

-- =====================================================
-- EXEMPLO DE USO
-- =====================================================

-- Quando detectar déficit de R$ 5.000:
-- SELECT propose_gap_solutions('deficit', 5000.00);

-- Resultado será um JSON com:
-- - Lista de soluções priorizadas
-- - Valor esperado de recuperação de cada uma
-- - Scripts de abordagem
-- - Passos de implementação
-- - Recomendação do Sr. Vendedor
