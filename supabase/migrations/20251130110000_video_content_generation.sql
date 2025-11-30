-- =====================================================
-- AMPLA CONTABILIDADE - Geração de Conteúdo de Vídeo
-- Migration: 20251130110000
-- Descrição: Sistema de geração de conteúdo usando IA
--            para criar vídeos, posts WhatsApp e Instagram
-- =====================================================

-- =====================================================
-- 1. PROVEDORES DE IA DISPONÍVEIS
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_code TEXT UNIQUE NOT NULL,
    provider_name TEXT NOT NULL,
    description TEXT,

    -- Configuração
    api_endpoint TEXT,
    api_key_secret_name TEXT, -- Nome do secret no Supabase
    model_default TEXT,
    models_available TEXT[],

    -- Capacidades
    can_generate_text BOOLEAN DEFAULT true,
    can_generate_images BOOLEAN DEFAULT false,
    can_generate_video BOOLEAN DEFAULT false,
    can_generate_audio BOOLEAN DEFAULT false,

    -- Custos aproximados
    cost_per_1k_tokens DECIMAL(10,4),
    cost_per_image DECIMAL(10,4),
    cost_per_minute_video DECIMAL(10,4),

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir provedores disponíveis
INSERT INTO ai_providers (provider_code, provider_name, description, api_key_secret_name, model_default, models_available, can_generate_text, can_generate_images) VALUES
('openai', 'OpenAI (ChatGPT)', 'GPT-4, DALL-E para imagens', 'OPENAI_API_KEY', 'gpt-4-turbo', ARRAY['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'dall-e-3'], true, true),
('anthropic', 'Anthropic (Claude)', 'Claude 3 Opus/Sonnet para textos', 'CLAUDE_API_KEY', 'claude-3-opus', ARRAY['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'], true, false),
('google', 'Google (Gemini)', 'Gemini Pro, Imagen para imagens', 'GEMINI_API_KEY', 'gemini-1.5-pro', ARRAY['gemini-1.5-pro', 'gemini-1.0-pro'], true, true);

-- Provedores de vídeo (para integração futura)
INSERT INTO ai_providers (provider_code, provider_name, description, model_default, can_generate_text, can_generate_video, cost_per_minute_video, is_active) VALUES
('synthesia', 'Synthesia', 'Avatares falantes para vídeos de treinamento', 'avatar-default', false, true, 3.00, false),
('heygen', 'HeyGen', 'Vídeos com avatar IA', 'avatar-default', false, true, 2.50, false),
('runway', 'Runway ML', 'Texto para vídeo generativo', 'gen-2', false, true, 3.00, false),
('elevenlabs', 'ElevenLabs', 'Síntese de voz de alta qualidade', 'eleven_multilingual_v2', false, false, 0.30, false);

-- =====================================================
-- 2. TEMPLATES DE CONTEÚDO
-- =====================================================

CREATE TABLE IF NOT EXISTS content_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT UNIQUE NOT NULL,
    template_name TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'video_script', 'whatsapp', 'instagram', 'email', 'slide'
    target_platform TEXT, -- 'tv', 'whatsapp', 'instagram', 'youtube', 'email'

    -- Prompt para a IA
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL, -- Com placeholders {{VARIAVEL}}
    variables TEXT[], -- Lista de variáveis esperadas

    -- Configuração
    max_tokens INTEGER DEFAULT 1000,
    preferred_provider TEXT DEFAULT 'gemini',
    tone TEXT DEFAULT 'professional', -- professional, friendly, motivational, urgent

    -- Exemplo
    example_output TEXT,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir templates de conteúdo
INSERT INTO content_templates (template_code, template_name, content_type, target_platform, system_prompt, user_prompt_template, variables, tone, example_output) VALUES

-- Script de vídeo motivacional
('VIDEO_MOTIVACAO',
 'Vídeo Motivacional de Vendas',
 'video_script',
 'tv',
 'Você é roteirista de vídeos corporativos curtos (30-60 segundos) para exibição em TVs de escritório. ' ||
 'O público são funcionários de um escritório de contabilidade. ' ||
 'O objetivo é motivar todos a indicarem novos clientes para a empresa. ' ||
 'Use linguagem simples, direta e motivadora. Inclua números quando possível.',
 'Crie um roteiro de vídeo motivacional sobre {{TEMA}}. ' ||
 'Dados para incluir: {{DADOS}}. ' ||
 'Tom: {{TOM}}. ' ||
 'Duração: {{DURACAO}} segundos.',
 ARRAY['TEMA', 'DADOS', 'TOM', 'DURACAO'],
 'motivational',
 E'[CENA 1 - 5s]\n' ||
 E'TEXTO: "Você sabia que pode ganhar R$ 500?"\n' ||
 E'VISUAL: Número grande na tela\n\n' ||
 E'[CENA 2 - 10s]\n' ||
 E'TEXTO: "A cada cliente que você indicar e fechar conosco..."\n' ||
 E'VISUAL: Pessoa sorrindo ao telefone'),

-- Post WhatsApp
('WHATSAPP_INDICACAO',
 'Mensagem WhatsApp para Pedir Indicação',
 'whatsapp',
 'whatsapp',
 'Você cria mensagens curtas e informais para WhatsApp. ' ||
 'O objetivo é pedir indicações de clientes de forma natural e não invasiva. ' ||
 'Use emojis com moderação. Máximo 3 parágrafos.',
 'Crie uma mensagem de WhatsApp para {{SITUACAO}}. ' ||
 'Nome do cliente: {{CLIENTE}}. ' ||
 'Serviço oferecido: {{SERVICO}}. ' ||
 'Benefício para quem indica: {{BENEFICIO}}.',
 ARRAY['SITUACAO', 'CLIENTE', 'SERVICO', 'BENEFICIO'],
 'friendly',
 E'Oi João! 👋\n\n' ||
 E'Tudo bem? Passando pra agradecer pela parceria de sempre. ' ||
 E'Aliás, você conhece algum empresário que precisa de contabilidade? ' ||
 E'Se indicar e fechar, você ganha 10% de desconto por 5 meses! 🎁\n\n' ||
 E'Pode me passar o contato que eu entro em contato com todo carinho. 😊'),

-- Post Instagram
('INSTAGRAM_DICA',
 'Post Instagram com Dica',
 'instagram',
 'instagram',
 'Você cria posts para Instagram de um escritório de contabilidade. ' ||
 'Use linguagem acessível, evite jargões. ' ||
 'Inclua hashtags relevantes. ' ||
 'O post deve ter gancho, desenvolvimento e CTA.',
 'Crie um post de Instagram sobre {{TEMA}}. ' ||
 'Público-alvo: {{PUBLICO}}. ' ||
 'Objetivo: {{OBJETIVO}}. ' ||
 'Inclua CTA: {{CTA}}.',
 ARRAY['TEMA', 'PUBLICO', 'OBJETIVO', 'CTA'],
 'friendly',
 E'💡 Você sabia que pode pagar MENOS imposto de forma LEGAL?\n\n' ||
 E'Muitos empresários não conhecem os benefícios do Simples Nacional...\n\n' ||
 E'[Continua no carrossel]\n\n' ||
 E'#contabilidade #impostos #mei #empresa #dicas'),

-- Script de treinamento
('VIDEO_TREINAMENTO',
 'Vídeo de Treinamento de Vendas',
 'video_script',
 'tv',
 'Você cria roteiros de vídeos de treinamento para funcionários. ' ||
 'O conteúdo deve ser prático, com exemplos reais e scripts de abordagem. ' ||
 'Formato: apresentador falando com slides/imagens de apoio. ' ||
 'Duração: 2-5 minutos.',
 'Crie um roteiro de treinamento sobre {{TEMA}}. ' ||
 'Inclua: {{TOPICOS}}. ' ||
 'Exemplos práticos: {{EXEMPLOS}}. ' ||
 'Nível: {{NIVEL}}.',
 ARRAY['TEMA', 'TOPICOS', 'EXEMPLOS', 'NIVEL'],
 'professional',
 E'[INTRO - 15s]\n' ||
 E'Apresentador: "Hoje vamos aprender como pedir indicações de forma natural..."\n\n' ||
 E'[SLIDE 1]\n' ||
 E'Título: "O momento certo"\n' ||
 E'Bullets: - Após resolver problema - Quando cliente elogiar - No fechamento de serviço'),

-- Carousel Instagram
('INSTAGRAM_CAROUSEL',
 'Carrossel Instagram Educativo',
 'instagram',
 'instagram',
 'Você cria conteúdo para carrosséis de Instagram (5-10 slides). ' ||
 'Cada slide deve ter pouco texto e ser visualmente atraente. ' ||
 'Comece com gancho forte. Termine com CTA.',
 'Crie um carrossel sobre {{TEMA}} com {{NUM_SLIDES}} slides. ' ||
 'Para o público: {{PUBLICO}}. ' ||
 'Objetivo final: {{OBJETIVO}}.',
 ARRAY['TEMA', 'NUM_SLIDES', 'PUBLICO', 'OBJETIVO'],
 'friendly',
 E'SLIDE 1 (CAPA): "5 erros que fazem você pagar mais imposto"\n' ||
 E'SLIDE 2: "Erro 1: Não separar contas PF e PJ"\n' ||
 E'SLIDE 3: "Erro 2: Não guardar notas fiscais"\n' ||
 E'...\n' ||
 E'SLIDE FINAL: "Quer ajuda? Fale conosco! Link na bio"');

-- =====================================================
-- 3. CONTEÚDOS GERADOS
-- =====================================================

CREATE TABLE IF NOT EXISTS generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES content_templates(id),
    template_code TEXT,

    -- Request
    variables_used JSONB, -- Variáveis passadas
    provider_used TEXT,
    model_used TEXT,

    -- Resultado
    content_generated TEXT NOT NULL,
    content_formatted JSONB, -- Se for estruturado (slides, etc)

    -- Status
    status TEXT DEFAULT 'draft', -- draft, approved, published, archived
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    publish_platforms TEXT[], -- Onde foi publicado

    -- Métricas
    views_count INTEGER DEFAULT 0,
    engagement_count INTEGER DEFAULT 0,

    -- Metadados
    generation_time_ms INTEGER,
    tokens_used INTEGER,
    cost_estimated DECIMAL(10,4),

    created_by TEXT DEFAULT 'marketing',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. FILA DE PUBLICAÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS content_publish_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES generated_content(id),
    platform TEXT NOT NULL, -- 'tv', 'whatsapp', 'instagram', 'youtube'

    -- Agendamento
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,

    -- Status
    status TEXT DEFAULT 'pending', -- pending, scheduled, publishing, published, failed
    error_message TEXT,

    -- Para WhatsApp
    whatsapp_recipients JSONB, -- Lista de números/grupos
    whatsapp_sent_count INTEGER DEFAULT 0,

    -- Para Instagram
    instagram_account TEXT,
    instagram_post_id TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 5. FUNÇÃO PARA GERAR CONTEÚDO
-- =====================================================

-- Esta função prepara o prompt, mas a chamada real à API
-- deve ser feita via Edge Function
CREATE OR REPLACE FUNCTION prepare_content_generation(
    p_template_code TEXT,
    p_variables JSONB
) RETURNS JSONB AS $$
DECLARE
    v_template RECORD;
    v_prompt TEXT;
    v_var TEXT;
    v_value TEXT;
BEGIN
    -- Buscar template
    SELECT * INTO v_template
    FROM content_templates
    WHERE template_code = p_template_code AND is_active;

    IF v_template IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Template não encontrado');
    END IF;

    -- Substituir variáveis no prompt
    v_prompt := v_template.user_prompt_template;

    FOR v_var IN SELECT unnest(v_template.variables)
    LOOP
        v_value := p_variables->>v_var;
        IF v_value IS NOT NULL THEN
            v_prompt := REPLACE(v_prompt, '{{' || v_var || '}}', v_value);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'template_id', v_template.id,
        'provider', v_template.preferred_provider,
        'system_prompt', v_template.system_prompt,
        'user_prompt', v_prompt,
        'max_tokens', v_template.max_tokens,
        'content_type', v_template.content_type,
        'target_platform', v_template.target_platform
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. FUNÇÃO PARA SALVAR CONTEÚDO GERADO
-- =====================================================

CREATE OR REPLACE FUNCTION save_generated_content(
    p_template_code TEXT,
    p_variables JSONB,
    p_content TEXT,
    p_provider TEXT,
    p_model TEXT,
    p_tokens INTEGER DEFAULT NULL,
    p_time_ms INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_template_id UUID;
    v_content_id UUID;
BEGIN
    -- Buscar template
    SELECT id INTO v_template_id
    FROM content_templates
    WHERE template_code = p_template_code;

    -- Inserir conteúdo
    INSERT INTO generated_content (
        template_id, template_code, variables_used,
        provider_used, model_used, content_generated,
        tokens_used, generation_time_ms
    ) VALUES (
        v_template_id, p_template_code, p_variables,
        p_provider, p_model, p_content,
        p_tokens, p_time_ms
    )
    RETURNING id INTO v_content_id;

    RETURN v_content_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. VIEW: CONTEÚDOS PARA PUBLICAR
-- =====================================================

CREATE OR REPLACE VIEW vw_content_to_publish AS
SELECT
    gc.id,
    gc.template_code,
    ct.template_name,
    ct.target_platform,
    gc.content_generated,
    gc.status,
    gc.created_at,
    cpq.scheduled_at,
    cpq.status as queue_status
FROM generated_content gc
JOIN content_templates ct ON ct.id = gc.template_id
LEFT JOIN content_publish_queue cpq ON cpq.content_id = gc.id
WHERE gc.status = 'approved'
ORDER BY cpq.scheduled_at NULLS LAST;

-- =====================================================
-- 8. VIEW: MÉTRICAS DE CONTEÚDO
-- =====================================================

CREATE OR REPLACE VIEW vw_content_metrics AS
SELECT
    ct.target_platform,
    ct.content_type,
    COUNT(*) as total_gerados,
    COUNT(*) FILTER (WHERE gc.status = 'published') as publicados,
    SUM(gc.views_count) as total_views,
    SUM(gc.engagement_count) as total_engagement,
    AVG(gc.tokens_used) as media_tokens,
    SUM(gc.cost_estimated) as custo_total
FROM generated_content gc
JOIN content_templates ct ON ct.id = gc.template_id
GROUP BY ct.target_platform, ct.content_type;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_publish_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_providers_read" ON ai_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "content_templates_read" ON content_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "generated_content_all" ON generated_content FOR ALL TO authenticated USING (true);
CREATE POLICY "content_publish_queue_all" ON content_publish_queue FOR ALL TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE ai_providers IS 'Provedores de IA disponíveis (OpenAI, Claude, Gemini, etc)';
COMMENT ON TABLE content_templates IS 'Templates de conteúdo com prompts para cada tipo';
COMMENT ON TABLE generated_content IS 'Conteúdos gerados pela IA';
COMMENT ON TABLE content_publish_queue IS 'Fila de publicação para diferentes plataformas';

-- =====================================================
-- EXEMPLO DE USO
-- =====================================================

/*
-- 1. Preparar geração de vídeo motivacional:
SELECT prepare_content_generation(
    'VIDEO_MOTIVACAO',
    jsonb_build_object(
        'TEMA', 'programa de indicações',
        'DADOS', 'Rose ganhou R$ 300 este mês com indicações',
        'TOM', 'motivacional',
        'DURACAO', '45'
    )
);

-- 2. Após chamar a API, salvar o resultado:
SELECT save_generated_content(
    'VIDEO_MOTIVACAO',
    jsonb_build_object('TEMA', 'programa de indicações', ...),
    'Roteiro gerado pela IA...',
    'gemini',
    'gemini-1.5-pro',
    500,
    1200
);

-- 3. Ver conteúdos prontos para publicar:
SELECT * FROM vw_content_to_publish;
*/
