-- =====================================================
-- AMPLA CONTABILIDADE - Marketing e Incentivos a Funcionários
-- Migration: 20251130100000
-- Descrição: Sistema completo de incentivos para funcionários
--            vendendo serviços da Ampla em qualquer oportunidade
--            Agente de Marketing coordena campanhas e vídeos
-- =====================================================

-- =====================================================
-- NOVO AGENTE: MARKETING IA
-- =====================================================

INSERT INTO ai_agents (agent_id, name, role, specialty, description, knowledge_sources, icon, color)
VALUES (
    'marketing',
    'Sra. Marketing',
    'Gerente de Marketing IA',
    'Marketing e Comunicação',
    'Especialista em marketing de serviços contábeis. Cria campanhas de indicação, produz conteúdo de treinamento, gerencia vídeos para TVs e coordena toda comunicação de vendas.',
    ARRAY['Marketing Digital', 'Campanhas', 'Treinamento', 'Vídeos', 'Comunicação Interna'],
    'Megaphone',
    'pink'
) ON CONFLICT (agent_id) DO NOTHING;

-- Adicionar página de marketing
INSERT INTO ai_page_agents (page_path, page_name, primary_agent_id, secondary_agents, agent_role, auto_actions, requires_approval, approval_threshold)
VALUES (
    '/marketing',
    'Marketing e Incentivos',
    'marketing',
    ARRAY['vendedor', 'helena'],
    'Sra. Marketing coordena campanhas, cria vídeos de treinamento e gerencia incentivos',
    ARRAY['Criar campanhas', 'Produzir vídeos', 'Calcular comissões', 'Exibir conteúdo TVs'],
    true,
    1000.00
) ON CONFLICT (page_path) DO NOTHING;

-- =====================================================
-- 1. SISTEMA DE INCENTIVOS PARA FUNCIONÁRIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS employee_incentive_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL,
    policy_type TEXT NOT NULL, -- 'referral', 'direct_sale', 'upsell', 'retention'
    description TEXT,

    -- Para quem vale
    applies_to TEXT[] DEFAULT ARRAY['all'], -- 'all', 'financial', 'accounting', 'admin'

    -- Benefício para o funcionário
    employee_reward_type TEXT NOT NULL, -- 'commission', 'bonus', 'credit', 'prize'
    employee_reward_percent DECIMAL(5,2), -- % sobre honorário
    employee_reward_fixed DECIMAL(15,2), -- Valor fixo
    employee_reward_min DECIMAL(15,2), -- Mínimo garantido
    employee_reward_max DECIMAL(15,2), -- Teto

    -- Benefício para o cliente que indica
    client_discount_percent DECIMAL(5,2), -- % de desconto
    client_discount_months INTEGER, -- Por quantos meses
    client_discount_max DECIMAL(15,2), -- Valor máximo

    -- Regras
    min_contract_value DECIMAL(15,2), -- Valor mínimo do contrato
    payment_after_months INTEGER DEFAULT 1, -- Paga após X meses de cliente ativo

    -- Status
    is_active BOOLEAN DEFAULT true,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir políticas de incentivo
INSERT INTO employee_incentive_policies (
    policy_name, policy_type, description, applies_to,
    employee_reward_type, employee_reward_percent, employee_reward_min, employee_reward_max,
    client_discount_percent, client_discount_months, payment_after_months
) VALUES
-- Indicação Padrão
('Indicação Padrão', 'referral',
 'Qualquer funcionário pode indicar clientes. Funciona em qualquer situação: conversa com cliente, padaria, academia, WhatsApp...',
 ARRAY['all'],
 'commission', 10.0, 50.00, 500.00,
 10.0, 5, 1),

-- Venda Direta - Financial
('Venda pelo Financeiro', 'direct_sale',
 'Setor financeiro oferece serviços durante cobrança ou atendimento. Pergunta: "Conhece alguém que precisa de contabilidade?"',
 ARRAY['financial'],
 'commission', 5.0, 30.00, 300.00,
 10.0, 5, 1),

-- Venda Direta - Qualquer
('Venda Direta', 'direct_sale',
 'Funcionário fecha negócio diretamente (padaria, academia, conversa informal)',
 ARRAY['all'],
 'commission', 10.0, 50.00, 500.00,
 10.0, 3, 1),

-- Upsell
('Upsell de Serviços', 'upsell',
 'Funcionário convence cliente atual a contratar mais serviços',
 ARRAY['all'],
 'commission', 5.0, 25.00, 200.00,
 NULL, NULL, 1),

-- Retenção
('Retenção de Cliente', 'retention',
 'Funcionário evita cancelamento de cliente',
 ARRAY['all'],
 'bonus', NULL, 50.00, 150.00,
 NULL, NULL, 3);

-- =====================================================
-- 2. REGISTRO DE VENDAS E INDICAÇÕES DOS FUNCIONÁRIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS employee_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Quem vendeu/indicou
    employee_id UUID REFERENCES employees(id),
    employee_name TEXT NOT NULL,
    employee_area TEXT, -- financial, accounting, admin

    -- Tipo de venda
    sale_type TEXT NOT NULL, -- 'referral', 'direct_sale', 'upsell', 'retention'
    policy_id UUID REFERENCES employee_incentive_policies(id),

    -- Cliente prospect/indicado
    prospect_name TEXT NOT NULL,
    prospect_company TEXT,
    prospect_cnpj TEXT,
    prospect_contact TEXT,
    prospect_source TEXT, -- 'conversation', 'bakery', 'gym', 'whatsapp', 'client_meeting'

    -- Se veio de cliente existente
    referring_client_id UUID,
    referring_client_name TEXT,

    -- Status do funil
    status TEXT DEFAULT 'lead', -- lead, contacted, meeting, proposal, negotiation, won, lost
    contact_date DATE,
    meeting_date DATE,
    proposal_date DATE,
    close_date DATE,
    lost_reason TEXT,

    -- Valores
    monthly_fee DECIMAL(15,2), -- Honorário mensal fechado
    contract_months INTEGER DEFAULT 12,

    -- Comissão do funcionário
    commission_percent DECIMAL(5,2),
    commission_value DECIMAL(15,2),
    commission_paid BOOLEAN DEFAULT false,
    commission_paid_date DATE,

    -- Desconto dado ao cliente
    client_discount_percent DECIMAL(5,2),
    client_discount_months INTEGER,
    client_discount_value DECIMAL(15,2),

    -- Notas
    notes TEXT,
    how_it_happened TEXT, -- Como aconteceu a venda

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 3. SISTEMA DE VÍDEOS E CONTEÚDO PARA TVS
-- =====================================================

CREATE TABLE IF NOT EXISTS marketing_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_type TEXT NOT NULL, -- 'training', 'campaign', 'motivation', 'results', 'tips'
    target_audience TEXT[], -- ['all', 'financial', 'accounting', 'admin']

    -- Conteúdo
    video_url TEXT, -- URL do vídeo (YouTube, Vimeo, local)
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    script TEXT, -- Roteiro do vídeo

    -- Slides (se for apresentação)
    slides JSONB,

    -- Agendamento de exibição
    show_on_tvs BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5, -- 1-10, maior = mais importante
    start_date DATE,
    end_date DATE,
    show_times JSONB, -- Horários de exibição

    -- Tags para busca
    tags TEXT[],

    -- Status
    status TEXT DEFAULT 'draft', -- draft, approved, active, archived
    approved_by TEXT,
    created_by TEXT DEFAULT 'marketing',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir vídeos de treinamento
INSERT INTO marketing_videos (title, description, video_type, target_audience, script, slides, tags, status, priority) VALUES
-- Vídeo 1: Por que vender?
('Por que VOCÊ deve vender a Ampla?',
 'Motivação para funcionários entenderem a importância de indicar clientes',
 'motivation',
 ARRAY['all'],
 'Você sabia que pode ganhar até R$ 500 a cada cliente que indicar? ' ||
 'A Ampla valoriza quem ajuda a empresa crescer. ' ||
 'Cada novo cliente significa mais segurança para todos nós. ' ||
 'E o melhor: você não precisa ser vendedor! Basta uma conversa...',
 '[
   {"titulo": "Você pode ganhar R$ 500", "conteudo": "A cada cliente indicado que fechar"},
   {"titulo": "Não precisa ser vendedor", "conteudo": "Uma conversa informal já resolve"},
   {"titulo": "Onde vender?", "conteudo": "Padaria, academia, WhatsApp, família..."},
   {"titulo": "O que falar?", "conteudo": "\"Você está satisfeito com sua contabilidade?\""}
 ]'::jsonb,
 ARRAY['motivação', 'vendas', 'incentivo'],
 'active',
 10),

-- Vídeo 2: Como abordar
('Como abordar um potencial cliente',
 'Técnicas simples de abordagem para não-vendedores',
 'training',
 ARRAY['all'],
 'Não precisa ser complicado! Veja exemplos práticos: ' ||
 'Na padaria: "O João, vi que você tem uma empresa de X. Está satisfeito com a contabilidade? ' ||
 'Trabalho na Ampla e a gente cuida super bem dos clientes. Posso te passar um contato?" ' ||
 'No WhatsApp: "Oi fulano, tudo bem? Lembrei de você porque minha empresa está precisando de clientes ' ||
 'e você tem aquela empresa, né? Está bem assessorado?"',
 '[
   {"titulo": "Não venda - Pergunte!", "conteudo": "\"Você está satisfeito com sua contabilidade?\""},
   {"titulo": "Na padaria", "conteudo": "\"Trabalho numa contabilidade muito boa. Posso passar o contato?\""},
   {"titulo": "No WhatsApp", "conteudo": "\"Lembrei de você porque vocês têm empresa, né?\""},
   {"titulo": "Com cliente da Ampla", "conteudo": "\"Você conhece alguém que precisa? Tem desconto pra você!\""},
   {"titulo": "Pegue o contato!", "conteudo": "Nome + WhatsApp. O Sr. Vendedor faz o resto!"}
 ]'::jsonb,
 ARRAY['abordagem', 'técnicas', 'scripts'],
 'active',
 9),

-- Vídeo 3: Setor Financeiro
('Financeiro: Você conversa com cliente TODO DIA!',
 'Orientação específica para setor financeiro',
 'training',
 ARRAY['financial'],
 'Você é quem mais conversa com clientes! ' ||
 'Aproveite o momento da cobrança ou do pagamento para perguntar: ' ||
 '"Você conhece algum empresário que precisa de contabilidade? ' ||
 'Se indicar, você ganha 10% de desconto por 5 meses e seu amigo também!" ' ||
 'Simples assim. Uma pergunta. Você pode ganhar R$ 300 por indicação!',
 '[
   {"titulo": "Você fala com clientes todo dia", "conteudo": "Aproveite essa oportunidade!"},
   {"titulo": "No momento da cobrança", "conteudo": "\"Conhece alguém que precisa de contabilidade?\""},
   {"titulo": "Desconto para o cliente", "conteudo": "10% por 5 meses se indicar"},
   {"titulo": "Seu ganho", "conteudo": "5% de comissão - até R$ 300!"},
   {"titulo": "Uma pergunta por ligação", "conteudo": "Só isso. Uma pergunta."}
 ]'::jsonb,
 ARRAY['financeiro', 'cobrança', 'indicação'],
 'active',
 9),

-- Vídeo 4: Resultados do mês
('Resultados: Quem mais vendeu este mês',
 'Ranking e celebração dos vendedores',
 'results',
 ARRAY['all'],
 'Parabéns aos campeões de indicação deste mês! ' ||
 'Confira quem mais contribuiu para o crescimento da Ampla:',
 '[
   {"titulo": "Top Vendedores do Mês", "conteudo": "Ranking atualizado"},
   {"titulo": "🥇 1º Lugar", "conteudo": "[NOME] - [X] indicações - R$ [COMISSÃO]"},
   {"titulo": "🥈 2º Lugar", "conteudo": "[NOME] - [X] indicações - R$ [COMISSÃO]"},
   {"titulo": "🥉 3º Lugar", "conteudo": "[NOME] - [X] indicações - R$ [COMISSÃO]"},
   {"titulo": "Total do mês", "conteudo": "[X] novos clientes pela equipe!"},
   {"titulo": "Você pode ser o próximo!", "conteudo": "Indique e ganhe!"}
 ]'::jsonb,
 ARRAY['resultados', 'ranking', 'premiação'],
 'active',
 8),

-- Vídeo 5: Dica do dia
('Dica do dia: Oportunidades estão em todo lugar',
 'Dicas rápidas diárias de vendas',
 'tips',
 ARRAY['all'],
 'DICA DO DIA: Olhe ao seu redor! ' ||
 'O dono do restaurante onde você almoça... ' ||
 'O personal da academia... ' ||
 'O vizinho que tem uma loja... ' ||
 'Todos precisam de contabilidade! ' ||
 'Uma simples pergunta pode virar R$ 500 no seu bolso.',
 '[
   {"titulo": "💡 Dica do Dia", "conteudo": "Oportunidades estão em TODO lugar!"},
   {"titulo": "No restaurante", "conteudo": "O dono precisa de contabilidade"},
   {"titulo": "Na academia", "conteudo": "Personal trainers são MEIs"},
   {"titulo": "No condomínio", "conteudo": "Vizinhos com empresas"},
   {"titulo": "Uma pergunta = R$ 500", "conteudo": "\"Você está satisfeito com sua contabilidade?\""}
 ]'::jsonb,
 ARRAY['dica', 'oportunidade', 'motivação'],
 'active',
 7);

-- =====================================================
-- 4. PROGRAMAÇÃO DAS TVS
-- =====================================================

CREATE TABLE IF NOT EXISTS tv_playlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tv_location TEXT NOT NULL, -- 'reception', 'meeting_room', 'break_room', 'accounting', 'financial'
    tv_name TEXT,

    -- Playlist
    videos JSONB DEFAULT '[]'::jsonb, -- Array de video_ids ordenados
    shuffle BOOLEAN DEFAULT false,
    loop BOOLEAN DEFAULT true,

    -- Horários
    active_start_time TIME DEFAULT '08:00',
    active_end_time TIME DEFAULT '18:00',
    active_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 1=seg, 7=dom

    -- Configuração
    volume INTEGER DEFAULT 50, -- 0-100
    show_clock BOOLEAN DEFAULT true,
    show_weather BOOLEAN DEFAULT false,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configuração das TVs
INSERT INTO tv_playlist (tv_location, tv_name, active_start_time, active_end_time) VALUES
('reception', 'TV Recepção', '08:00', '18:00'),
('meeting_room', 'TV Sala de Reunião', '08:00', '20:00'),
('break_room', 'TV Copa', '08:00', '18:00'),
('accounting', 'TV Contabilidade', '08:00', '18:00'),
('financial', 'TV Financeiro', '08:00', '18:00');

-- =====================================================
-- 5. FUNÇÕES DE CÁLCULO DE COMISSÕES
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_employee_commission(p_sale_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_sale RECORD;
    v_policy RECORD;
    v_commission DECIMAL;
BEGIN
    -- Buscar venda
    SELECT * INTO v_sale FROM employee_sales WHERE id = p_sale_id;

    IF v_sale IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;

    -- Buscar política
    SELECT * INTO v_policy FROM employee_incentive_policies WHERE id = v_sale.policy_id;

    IF v_policy IS NULL THEN
        -- Usar política padrão
        SELECT * INTO v_policy
        FROM employee_incentive_policies
        WHERE policy_type = v_sale.sale_type AND is_active
        LIMIT 1;
    END IF;

    -- Calcular comissão
    IF v_policy.employee_reward_percent IS NOT NULL THEN
        v_commission := v_sale.monthly_fee * v_policy.employee_reward_percent / 100;
    ELSE
        v_commission := v_policy.employee_reward_fixed;
    END IF;

    -- Aplicar mínimo e máximo
    IF v_policy.employee_reward_min IS NOT NULL THEN
        v_commission := GREATEST(v_commission, v_policy.employee_reward_min);
    END IF;
    IF v_policy.employee_reward_max IS NOT NULL THEN
        v_commission := LEAST(v_commission, v_policy.employee_reward_max);
    END IF;

    -- Atualizar venda
    UPDATE employee_sales SET
        commission_percent = v_policy.employee_reward_percent,
        commission_value = v_commission,
        client_discount_percent = v_policy.client_discount_percent,
        client_discount_months = v_policy.client_discount_months
    WHERE id = p_sale_id;

    RETURN jsonb_build_object(
        'success', true,
        'employee', v_sale.employee_name,
        'commission', v_commission,
        'policy', v_policy.policy_name,
        'message', 'Sra. Marketing calculou: ' || v_sale.employee_name ||
                   ' ganha R$ ' || v_commission || ' pela indicação!'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. VIEW: RANKING DE VENDEDORES
-- =====================================================

CREATE OR REPLACE VIEW vw_employee_sales_ranking AS
SELECT
    employee_name,
    employee_area,
    COUNT(*) FILTER (WHERE status = 'won') as vendas_fechadas,
    COUNT(*) FILTER (WHERE status IN ('lead', 'contacted', 'meeting', 'proposal', 'negotiation')) as em_andamento,
    COUNT(*) FILTER (WHERE status = 'lost') as perdidas,
    SUM(commission_value) FILTER (WHERE status = 'won') as total_comissoes,
    SUM(commission_value) FILTER (WHERE status = 'won' AND commission_paid = false) as comissoes_pendentes,
    SUM(monthly_fee) FILTER (WHERE status = 'won') as receita_gerada,
    MAX(close_date) as ultima_venda
FROM employee_sales
GROUP BY employee_name, employee_area
ORDER BY vendas_fechadas DESC, total_comissoes DESC;

-- =====================================================
-- 7. VIEW: COMISSÕES PENDENTES DE PAGAMENTO
-- =====================================================

CREATE OR REPLACE VIEW vw_pending_commissions AS
SELECT
    es.id,
    es.employee_name,
    es.prospect_name,
    es.monthly_fee,
    es.commission_value,
    es.close_date,
    eip.payment_after_months,
    es.close_date + (eip.payment_after_months || ' months')::interval as payment_due_date,
    CASE
        WHEN CURRENT_DATE >= es.close_date + (eip.payment_after_months || ' months')::interval
        THEN 'PAGAR AGORA'
        ELSE 'Aguardando ' || eip.payment_after_months || ' mês(es)'
    END as status
FROM employee_sales es
JOIN employee_incentive_policies eip ON eip.id = es.policy_id
WHERE es.status = 'won'
  AND es.commission_paid = false
ORDER BY payment_due_date;

-- =====================================================
-- 8. VIEW: VÍDEOS PARA EXIBIR AGORA
-- =====================================================

CREATE OR REPLACE VIEW vw_videos_to_show AS
SELECT
    mv.*,
    tv.tv_location,
    tv.tv_name
FROM marketing_videos mv
CROSS JOIN tv_playlist tv
WHERE mv.status = 'active'
  AND mv.show_on_tvs = true
  AND (mv.start_date IS NULL OR mv.start_date <= CURRENT_DATE)
  AND (mv.end_date IS NULL OR mv.end_date >= CURRENT_DATE)
  AND tv.is_active = true
  AND CURRENT_TIME BETWEEN tv.active_start_time AND tv.active_end_time
  AND EXTRACT(DOW FROM CURRENT_DATE) = ANY(tv.active_days)
ORDER BY mv.priority DESC, mv.created_at;

-- =====================================================
-- 9. FUNÇÃO: GERAR VÍDEO DE RESULTADOS
-- =====================================================

CREATE OR REPLACE FUNCTION generate_monthly_results_video()
RETURNS UUID AS $$
DECLARE
    v_video_id UUID;
    v_slides JSONB := '[]'::jsonb;
    v_ranking RECORD;
    v_position INTEGER := 1;
    v_total_sales INTEGER;
    v_total_revenue DECIMAL;
BEGIN
    -- Calcular totais do mês
    SELECT
        COUNT(*) FILTER (WHERE status = 'won'),
        COALESCE(SUM(monthly_fee) FILTER (WHERE status = 'won'), 0)
    INTO v_total_sales, v_total_revenue
    FROM employee_sales
    WHERE DATE_TRUNC('month', close_date) = DATE_TRUNC('month', CURRENT_DATE);

    -- Slide inicial
    v_slides := v_slides || jsonb_build_array(
        jsonb_build_object(
            'titulo', '🏆 Resultados de ' || TO_CHAR(CURRENT_DATE, 'Month/YYYY'),
            'conteudo', 'Parabéns à equipe!'
        )
    );

    -- Top 3 vendedores
    FOR v_ranking IN
        SELECT employee_name, vendas_fechadas, total_comissoes
        FROM vw_employee_sales_ranking
        WHERE vendas_fechadas > 0
        ORDER BY vendas_fechadas DESC, total_comissoes DESC
        LIMIT 3
    LOOP
        v_slides := v_slides || jsonb_build_array(
            jsonb_build_object(
                'titulo', CASE v_position
                    WHEN 1 THEN '🥇 1º Lugar'
                    WHEN 2 THEN '🥈 2º Lugar'
                    WHEN 3 THEN '🥉 3º Lugar'
                END,
                'conteudo', v_ranking.employee_name || ' - ' ||
                           v_ranking.vendas_fechadas || ' vendas - R$ ' ||
                           v_ranking.total_comissoes
            )
        );
        v_position := v_position + 1;
    END LOOP;

    -- Totais
    v_slides := v_slides || jsonb_build_array(
        jsonb_build_object(
            'titulo', '📊 Total do Mês',
            'conteudo', v_total_sales || ' novos clientes = R$ ' || v_total_revenue || '/mês'
        ),
        jsonb_build_object(
            'titulo', '🚀 Você pode ser o próximo!',
            'conteudo', 'Indique e ganhe até R$ 500!'
        )
    );

    -- Criar vídeo
    INSERT INTO marketing_videos (
        title, description, video_type, target_audience,
        slides, tags, status, priority, created_by,
        start_date, end_date
    ) VALUES (
        'Resultados ' || TO_CHAR(CURRENT_DATE, 'MM/YYYY'),
        'Ranking de vendedores do mês',
        'results',
        ARRAY['all'],
        v_slides,
        ARRAY['resultados', 'ranking', 'mês'],
        'active',
        10,
        'marketing',
        DATE_TRUNC('month', CURRENT_DATE),
        (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
    )
    RETURNING id INTO v_video_id;

    RETURN v_video_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE employee_incentive_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_playlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_incentive_policies_read" ON employee_incentive_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "employee_sales_all" ON employee_sales FOR ALL TO authenticated USING (true);
CREATE POLICY "marketing_videos_all" ON marketing_videos FOR ALL TO authenticated USING (true);
CREATE POLICY "tv_playlist_all" ON tv_playlist FOR ALL TO authenticated USING (true);

-- =====================================================
-- 10. SISTEMA DE PARTICIPAÇÃO NOS LUCROS (PLR)
-- =====================================================

CREATE TABLE IF NOT EXISTS plr_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_name TEXT NOT NULL,
    reference_year INTEGER NOT NULL,
    description TEXT,

    -- Período de apuração
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Metas da empresa
    revenue_target DECIMAL(15,2), -- Meta de faturamento
    profit_target DECIMAL(15,2), -- Meta de lucro
    client_target INTEGER, -- Meta de novos clientes
    retention_target DECIMAL(5,2), -- Meta de retenção %

    -- Valores realizados
    revenue_actual DECIMAL(15,2),
    profit_actual DECIMAL(15,2),
    client_actual INTEGER,
    retention_actual DECIMAL(5,2),

    -- Pool de distribuição
    plr_pool_percent DECIMAL(5,2) DEFAULT 10.0, -- % do lucro para PLR
    plr_pool_value DECIMAL(15,2), -- Valor total a distribuir
    plr_pool_fixed DECIMAL(15,2), -- Valor fixo (se não for %)

    -- Status
    status TEXT DEFAULT 'active', -- active, calculating, approved, paid
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Critérios de elegibilidade e pesos
CREATE TABLE IF NOT EXISTS plr_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES plr_programs(id) ON DELETE CASCADE,
    criteria_name TEXT NOT NULL,
    criteria_type TEXT NOT NULL, -- 'company_goal', 'individual_goal', 'sales', 'attendance', 'time_in_company'
    description TEXT,

    -- Peso deste critério no cálculo
    weight_percent DECIMAL(5,2) NOT NULL, -- % do pool

    -- Regras específicas
    min_value DECIMAL(15,2), -- Valor mínimo para pontuar
    max_value DECIMAL(15,2), -- Valor máximo para pontuar
    scale_type TEXT DEFAULT 'linear', -- linear, stepped, binary

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir programa PLR atual
INSERT INTO plr_programs (program_name, reference_year, description, start_date, end_date, revenue_target, client_target, plr_pool_percent)
VALUES (
    'PLR 2025',
    2025,
    'Participação nos Lucros e Resultados - Ampla Contabilidade',
    '2025-01-01',
    '2025-12-31',
    1200000.00, -- Meta R$ 1.2M de faturamento anual
    50, -- Meta 50 novos clientes
    10.0 -- 10% do lucro para PLR
);

-- Inserir critérios de PLR
INSERT INTO plr_criteria (program_id, criteria_name, criteria_type, description, weight_percent) VALUES
-- Buscar o ID do programa atual
((SELECT id FROM plr_programs WHERE reference_year = 2025 LIMIT 1),
 'Meta de Faturamento', 'company_goal', 'Atingimento da meta de faturamento da empresa', 30.0),
((SELECT id FROM plr_programs WHERE reference_year = 2025 LIMIT 1),
 'Novos Clientes', 'company_goal', 'Atingimento da meta de novos clientes', 20.0),
((SELECT id FROM plr_programs WHERE reference_year = 2025 LIMIT 1),
 'Vendas Individuais', 'sales', 'Vendas/indicações feitas pelo funcionário', 25.0),
((SELECT id FROM plr_programs WHERE reference_year = 2025 LIMIT 1),
 'Tempo de Casa', 'time_in_company', 'Bonificação por tempo na empresa', 15.0),
((SELECT id FROM plr_programs WHERE reference_year = 2025 LIMIT 1),
 'Assiduidade', 'attendance', 'Presença e pontualidade', 10.0);

-- Participação individual de cada funcionário
CREATE TABLE IF NOT EXISTS plr_employee_share (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES plr_programs(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id),
    employee_name TEXT NOT NULL,

    -- Pontuação por critério
    scores JSONB DEFAULT '{}'::jsonb, -- { "criteria_id": score, ... }

    -- Cálculo
    total_score DECIMAL(10,2),
    share_percent DECIMAL(5,4), -- % do pool que recebe
    base_value DECIMAL(15,2), -- Valor base calculado
    bonus_value DECIMAL(15,2) DEFAULT 0, -- Bônus adicional
    final_value DECIMAL(15,2), -- Valor final a receber

    -- Pagamento
    paid BOOLEAN DEFAULT false,
    paid_date DATE,
    paid_method TEXT, -- 'folha', 'separado'

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Função para calcular PLR individual
CREATE OR REPLACE FUNCTION calculate_employee_plr(
    p_program_id UUID,
    p_employee_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_program RECORD;
    v_employee RECORD;
    v_criteria RECORD;
    v_score DECIMAL;
    v_total_score DECIMAL := 0;
    v_scores JSONB := '{}'::jsonb;
    v_sales_count INTEGER;
    v_sales_value DECIMAL;
    v_months_employed INTEGER;
BEGIN
    -- Buscar programa
    SELECT * INTO v_program FROM plr_programs WHERE id = p_program_id;
    IF v_program IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Programa não encontrado');
    END IF;

    -- Buscar funcionário
    SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;
    IF v_employee IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Funcionário não encontrado');
    END IF;

    -- Buscar vendas do funcionário no período
    SELECT
        COUNT(*) FILTER (WHERE status = 'won'),
        COALESCE(SUM(monthly_fee) FILTER (WHERE status = 'won'), 0)
    INTO v_sales_count, v_sales_value
    FROM employee_sales
    WHERE employee_id = p_employee_id
      AND close_date BETWEEN v_program.start_date AND v_program.end_date;

    -- Calcular tempo de casa em meses
    v_months_employed := EXTRACT(MONTH FROM age(COALESCE(v_program.end_date, CURRENT_DATE), v_employee.hire_date));

    -- Calcular score para cada critério
    FOR v_criteria IN
        SELECT * FROM plr_criteria WHERE program_id = p_program_id AND is_active
    LOOP
        CASE v_criteria.criteria_type
            WHEN 'sales' THEN
                -- Pontuação baseada em vendas (0-100)
                v_score := LEAST(v_sales_count * 10, 100);
            WHEN 'time_in_company' THEN
                -- Pontuação por tempo (até 100 para 5+ anos)
                v_score := LEAST(v_months_employed / 0.6, 100); -- 60 meses = 100%
            WHEN 'attendance' THEN
                -- Por enquanto, assume 100% (integrar com ponto depois)
                v_score := 100;
            WHEN 'company_goal' THEN
                -- Pontuação proporcional ao atingimento da meta
                IF v_criteria.criteria_name LIKE '%Faturamento%' AND v_program.revenue_target > 0 THEN
                    v_score := LEAST((COALESCE(v_program.revenue_actual, 0) / v_program.revenue_target) * 100, 100);
                ELSIF v_criteria.criteria_name LIKE '%Cliente%' AND v_program.client_target > 0 THEN
                    v_score := LEAST((COALESCE(v_program.client_actual, 0)::decimal / v_program.client_target) * 100, 100);
                ELSE
                    v_score := 0;
                END IF;
            ELSE
                v_score := 0;
        END CASE;

        -- Aplicar peso
        v_total_score := v_total_score + (v_score * v_criteria.weight_percent / 100);
        v_scores := v_scores || jsonb_build_object(v_criteria.id::text, v_score);
    END LOOP;

    -- Salvar ou atualizar participação
    INSERT INTO plr_employee_share (program_id, employee_id, employee_name, scores, total_score)
    VALUES (p_program_id, p_employee_id, v_employee.name, v_scores, v_total_score)
    ON CONFLICT (program_id, employee_id)
    WHERE EXISTS (
        SELECT 1 FROM plr_employee_share
        WHERE program_id = p_program_id AND employee_id = p_employee_id
    )
    DO UPDATE SET
        scores = v_scores,
        total_score = v_total_score;

    RETURN jsonb_build_object(
        'success', true,
        'employee', v_employee.name,
        'total_score', v_total_score,
        'scores', v_scores,
        'sales_count', v_sales_count,
        'sales_value', v_sales_value,
        'months_employed', v_months_employed
    );
END;
$$ LANGUAGE plpgsql;

-- Função para distribuir PLR entre todos os funcionários
CREATE OR REPLACE FUNCTION distribute_plr(p_program_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_program RECORD;
    v_employee RECORD;
    v_total_scores DECIMAL;
    v_share_count INTEGER := 0;
BEGIN
    -- Buscar programa
    SELECT * INTO v_program FROM plr_programs WHERE id = p_program_id;

    -- Calcular para cada funcionário elegível
    FOR v_employee IN
        SELECT id FROM employees WHERE is_active AND contract_type = 'clt'
    LOOP
        PERFORM calculate_employee_plr(p_program_id, v_employee.id);
        v_share_count := v_share_count + 1;
    END LOOP;

    -- Calcular soma total dos scores
    SELECT SUM(total_score) INTO v_total_scores
    FROM plr_employee_share WHERE program_id = p_program_id;

    -- Distribuir proporcionalmente
    UPDATE plr_employee_share SET
        share_percent = total_score / NULLIF(v_total_scores, 0),
        base_value = (total_score / NULLIF(v_total_scores, 0)) * COALESCE(v_program.plr_pool_value, 0),
        final_value = (total_score / NULLIF(v_total_scores, 0)) * COALESCE(v_program.plr_pool_value, 0) + COALESCE(bonus_value, 0)
    WHERE program_id = p_program_id;

    -- Atualizar status do programa
    UPDATE plr_programs SET status = 'calculating' WHERE id = p_program_id;

    RETURN jsonb_build_object(
        'success', true,
        'employees_calculated', v_share_count,
        'total_scores', v_total_scores,
        'pool_value', v_program.plr_pool_value,
        'message', 'Sra. Marketing: PLR calculada para ' || v_share_count || ' funcionários!'
    );
END;
$$ LANGUAGE plpgsql;

-- View de resumo PLR
CREATE OR REPLACE VIEW vw_plr_summary AS
SELECT
    p.program_name,
    p.reference_year,
    p.plr_pool_value as pool_total,
    COUNT(pes.id) as funcionarios,
    SUM(pes.final_value) as total_distribuido,
    AVG(pes.final_value) as media_por_funcionario,
    MAX(pes.final_value) as maior_valor,
    MIN(pes.final_value) FILTER (WHERE pes.final_value > 0) as menor_valor
FROM plr_programs p
LEFT JOIN plr_employee_share pes ON pes.program_id = p.id
GROUP BY p.id, p.program_name, p.reference_year, p.plr_pool_value;

-- View detalhada por funcionário
CREATE OR REPLACE VIEW vw_plr_by_employee AS
SELECT
    p.program_name,
    p.reference_year,
    pes.employee_name,
    pes.total_score,
    pes.share_percent * 100 as percentual_pool,
    pes.base_value,
    pes.bonus_value,
    pes.final_value,
    pes.paid,
    pes.paid_date
FROM plr_employee_share pes
JOIN plr_programs p ON p.id = pes.program_id
ORDER BY pes.final_value DESC;

-- Adicionar constraint única
ALTER TABLE plr_employee_share ADD CONSTRAINT unique_plr_employee
    UNIQUE (program_id, employee_id);

-- RLS
ALTER TABLE plr_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plr_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE plr_employee_share ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plr_programs_read" ON plr_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "plr_criteria_read" ON plr_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "plr_employee_share_all" ON plr_employee_share FOR ALL TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE employee_incentive_policies IS 'Políticas de incentivo para funcionários venderem';
COMMENT ON TABLE plr_programs IS 'Programas de Participação nos Lucros e Resultados';
COMMENT ON TABLE plr_criteria IS 'Critérios e pesos para cálculo do PLR';
COMMENT ON TABLE plr_employee_share IS 'Participação individual de cada funcionário no PLR';
COMMENT ON TABLE employee_sales IS 'Registro de vendas/indicações feitas por funcionários';
COMMENT ON TABLE marketing_videos IS 'Vídeos de treinamento e motivação para exibir nas TVs';
COMMENT ON TABLE tv_playlist IS 'Configuração das TVs de cada sala';
COMMENT ON VIEW vw_employee_sales_ranking IS 'Ranking de vendedores';
COMMENT ON VIEW vw_pending_commissions IS 'Comissões pendentes de pagamento';
COMMENT ON VIEW vw_videos_to_show IS 'Vídeos para exibir agora nas TVs';

-- =====================================================
-- EXEMPLO DE USO
-- =====================================================

-- Registrar uma venda:
/*
INSERT INTO employee_sales (
    employee_name, employee_area, sale_type,
    prospect_name, prospect_company, prospect_contact,
    prospect_source, how_it_happened, monthly_fee, status
) VALUES (
    'Rose', 'financial', 'referral',
    'João Silva', 'Padaria do João', '62999999999',
    'conversation', 'Cliente ligou para pagar boleto e Rose perguntou se conhecia alguém',
    500.00, 'lead'
);

-- Quando fechar:
UPDATE employee_sales SET
    status = 'won',
    close_date = CURRENT_DATE,
    monthly_fee = 600.00
WHERE id = 'uuid-da-venda';

-- Calcular comissão:
SELECT calculate_employee_commission('uuid-da-venda');

-- Ver ranking:
SELECT * FROM vw_employee_sales_ranking;

-- Gerar vídeo de resultados:
SELECT generate_monthly_results_video();
*/
