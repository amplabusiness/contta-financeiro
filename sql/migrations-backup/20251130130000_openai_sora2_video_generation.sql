-- =====================================================
-- AMPLA CONTABILIDADE - Integração OpenAI Sora 2
-- Migration: 20251130130000
-- Descrição: Atualização do sistema de geração de vídeo
--            com Sora 2 e novos modelos OpenAI
-- =====================================================

-- =====================================================
-- 1. ATUALIZAR PROVEDORES COM NOVOS MODELOS OPENAI
-- =====================================================

-- Atualizar OpenAI com todos os modelos disponíveis
UPDATE ai_providers
SET
    model_default = 'gpt-4.1',
    models_available = ARRAY[
        -- Modelos de Texto
        'gpt-5.1',           -- O5 Pro flagship (mais inteligente, raciocínio profundo)
        'gpt-5.1-mini',      -- O5 Mini (rápido e econômico)
        'gpt-4.1',           -- GPT 4.1 flagship (inteligente, rápido)
        'gpt-4.1-mini',      -- GPT 4.1 mini
        'gpt-4.1-nano',      -- GPT 4.1 nano (mais rápido)
        -- Modelos de Imagem
        'gpt-image-1',       -- Geração de imagens
        -- Modelos de Áudio/TTS
        'gpt-4o-mini-tts',   -- Text-to-speech
        'gpt-4o-mini-transcribe', -- Transcrição
        -- Embeddings
        'text-embedding-3-large',
        'text-embedding-3-small'
    ],
    can_generate_images = true,
    can_generate_audio = true,
    description = 'OpenAI GPT-5.1, GPT-4.1, Sora 2 para vídeos, TTS para áudio'
WHERE provider_code = 'openai';

-- Inserir Sora 2 como provedor de vídeo separado (mesmo sendo OpenAI)
INSERT INTO ai_providers (
    provider_code,
    provider_name,
    description,
    api_key_secret_name,
    model_default,
    models_available,
    can_generate_text,
    can_generate_video,
    can_generate_audio,
    cost_per_minute_video,
    is_active
) VALUES (
    'openai_sora',
    'OpenAI Sora 2',
    'Geração de vídeos de alta qualidade com áudio sincronizado. Flagship video generation.',
    'OPENAI_API_KEY',
    'sora-2',
    ARRAY['sora-2', 'sora-2-pro'],
    false,
    true,
    true,
    2.00, -- Custo estimado por minuto
    true
) ON CONFLICT (provider_code) DO UPDATE SET
    description = EXCLUDED.description,
    models_available = EXCLUDED.models_available,
    can_generate_video = true,
    can_generate_audio = true,
    is_active = true;

-- Atualizar Claude/Anthropic com modelos atuais
UPDATE ai_providers
SET
    model_default = 'claude-sonnet-4-5',
    models_available = ARRAY[
        'claude-opus-4-5',        -- Mais inteligente
        'claude-sonnet-4-5',      -- Equilíbrio qualidade/custo
        'claude-3-5-sonnet',
        'claude-3-5-haiku'
    ],
    description = 'Claude Opus 4.5/Sonnet 4.5 - excelente para análise e textos longos'
WHERE provider_code = 'anthropic';

-- Atualizar Gemini
UPDATE ai_providers
SET
    model_default = 'gemini-2.5-pro',
    models_available = ARRAY[
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-pro'
    ],
    can_generate_images = true,
    description = 'Google Gemini 2.5 Pro/Flash - multimodal, bom para análises'
WHERE provider_code = 'google';

-- =====================================================
-- 2. TABELA DE PROJETOS DE VÍDEO SORA
-- =====================================================

CREATE TABLE IF NOT EXISTS sora_video_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação
    project_name TEXT NOT NULL,
    project_type TEXT NOT NULL, -- 'training', 'motivation', 'marketing', 'presentation'

    -- Prompt para Sora
    prompt TEXT NOT NULL,
    negative_prompt TEXT, -- O que evitar no vídeo

    -- Configurações de geração
    duration_seconds INTEGER DEFAULT 10, -- 5, 10, 15, 20 segundos
    aspect_ratio TEXT DEFAULT '16:9', -- '16:9', '9:16', '1:1'
    resolution TEXT DEFAULT '1080p', -- '720p', '1080p', '4k'
    style TEXT DEFAULT 'professional', -- 'cinematic', 'professional', 'animated', 'realistic'

    -- Áudio
    include_audio BOOLEAN DEFAULT true,
    audio_type TEXT DEFAULT 'music', -- 'music', 'narration', 'both', 'none'
    narration_text TEXT, -- Texto para narração TTS
    music_style TEXT, -- 'corporate', 'upbeat', 'inspiring', 'calm'

    -- Branding Ampla
    include_logo BOOLEAN DEFAULT true,
    include_intro BOOLEAN DEFAULT true,
    include_outro BOOLEAN DEFAULT true,
    brand_colors JSONB DEFAULT '{"primary": "#1e3a5f", "secondary": "#4a90d9", "accent": "#f5a623"}',

    -- Status do projeto
    status TEXT DEFAULT 'draft', -- draft, generating, processing, ready, published, failed
    generation_started_at TIMESTAMPTZ,
    generation_completed_at TIMESTAMPTZ,

    -- Resultado
    video_url TEXT,
    video_duration_actual INTEGER,
    thumbnail_url TEXT,

    -- Metadados Sora
    sora_job_id TEXT,
    sora_model_used TEXT,
    generation_cost DECIMAL(10,4),

    -- Aprovação
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Publicação
    published_to TEXT[], -- 'tv_recepcao', 'tv_dp', 'youtube', 'instagram'
    publish_schedule TIMESTAMPTZ,

    created_by TEXT DEFAULT 'marketing',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 3. TEMPLATES DE VÍDEO PARA AMPLA
-- =====================================================

CREATE TABLE IF NOT EXISTS sora_video_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT UNIQUE NOT NULL,
    template_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'treinamento', 'motivacao', 'institucional', 'marketing'

    -- Prompt base
    base_prompt TEXT NOT NULL,
    variables TEXT[], -- Variáveis para substituir

    -- Configurações padrão
    default_duration INTEGER DEFAULT 30,
    default_aspect_ratio TEXT DEFAULT '16:9',
    default_style TEXT DEFAULT 'professional',

    -- Estrutura do vídeo
    video_structure JSONB, -- Cenas, transições, etc

    -- Exemplos
    example_variables JSONB,
    example_output TEXT,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir templates de vídeo
INSERT INTO sora_video_templates (template_code, template_name, category, base_prompt, variables, default_duration, video_structure) VALUES

-- Vídeo de Indicação
('VIDEO_INDICACAO',
 'Vídeo Motivacional de Indicações',
 'motivacao',
 'Create a professional corporate video for a Brazilian accounting firm called Ampla. ' ||
 'The video should motivate employees to refer new clients. ' ||
 'Style: Modern, professional, inspiring. ' ||
 'Include: {{FUNCIONARIO_DESTAQUE}} as the employee of the month who earned R$ {{VALOR_GANHO}} in referral bonuses. ' ||
 'Message: "Indique e ganhe! Cada cliente novo significa mais dinheiro no seu bolso." ' ||
 'End with: "Programa de Indicações Ampla - Todos ganham!"',
 ARRAY['FUNCIONARIO_DESTAQUE', 'VALOR_GANHO', 'META_MES'],
 30,
 '{"scenes": [
    {"type": "intro", "duration": 3, "content": "Logo Ampla animado"},
    {"type": "hook", "duration": 5, "content": "Quanto você ganhou este mês?"},
    {"type": "destaque", "duration": 10, "content": "Funcionário do mês"},
    {"type": "programa", "duration": 8, "content": "Como funciona"},
    {"type": "cta", "duration": 4, "content": "Indique agora!"}
 ]}'
),

-- Vídeo de Treinamento
('VIDEO_TREINAMENTO_VENDAS',
 'Treinamento: Como Pedir Indicações',
 'treinamento',
 'Create an educational training video for accounting firm employees on how to ask clients for referrals. ' ||
 'Topic: {{TOPICO_TREINAMENTO}}. ' ||
 'Include: Step-by-step demonstration, common mistakes to avoid, and successful scripts. ' ||
 'Style: Professional presenter with animated graphics and text overlays. ' ||
 'Tone: Friendly, educational, practical.',
 ARRAY['TOPICO_TREINAMENTO', 'EXEMPLOS', 'SCRIPTS'],
 120,
 '{"scenes": [
    {"type": "intro", "duration": 5, "content": "Título do treinamento"},
    {"type": "problema", "duration": 15, "content": "Por que muitos têm medo de pedir"},
    {"type": "solucao", "duration": 30, "content": "O momento certo"},
    {"type": "script1", "duration": 20, "content": "Script 1 - Após elogio"},
    {"type": "script2", "duration": 20, "content": "Script 2 - Após resolver problema"},
    {"type": "erros", "duration": 15, "content": "Erros comuns"},
    {"type": "resumo", "duration": 10, "content": "Recapitulando"},
    {"type": "cta", "duration": 5, "content": "Pratique hoje!"}
 ]}'
),

-- Vídeo Institucional
('VIDEO_INSTITUCIONAL',
 'Vídeo Institucional Ampla',
 'institucional',
 'Create a corporate institutional video for Ampla Contabilidade, a Brazilian accounting firm with over 30 years of experience. ' ||
 'Highlight: {{DIFERENCIAL}}. ' ||
 'Services: Accounting, Tax Planning, Payroll, Legal Advisory, Consulting. ' ||
 'Message: "Mais de 30 anos transformando números em resultados para sua empresa." ' ||
 'Style: Premium, trustworthy, modern. ' ||
 'End with contact information and call to action.',
 ARRAY['DIFERENCIAL', 'DEPOIMENTO', 'SERVICO_DESTAQUE'],
 60,
 '{"scenes": [
    {"type": "intro", "duration": 5, "content": "Logo cinematográfico"},
    {"type": "historia", "duration": 10, "content": "30 anos de história"},
    {"type": "servicos", "duration": 15, "content": "Nossos serviços"},
    {"type": "diferencial", "duration": 15, "content": "Por que a Ampla"},
    {"type": "depoimento", "duration": 10, "content": "Cliente satisfeito"},
    {"type": "contato", "duration": 5, "content": "Entre em contato"}
 ]}'
),

-- Vídeo de Dica Rápida
('VIDEO_DICA_RAPIDA',
 'Dica Rápida para Empresários',
 'marketing',
 'Create a quick tip video for small business owners in Brazil. ' ||
 'Topic: {{DICA_TEMA}}. ' ||
 'Format: Vertical video (9:16) for Instagram Reels and TikTok. ' ||
 'Style: Fast-paced, engaging, with text overlays. ' ||
 'Include practical tip that viewers can apply immediately. ' ||
 'End with Ampla branding and "Siga para mais dicas!"',
 ARRAY['DICA_TEMA', 'EXEMPLO_PRATICO', 'ECONOMIA_POTENCIAL'],
 15,
 '{"scenes": [
    {"type": "hook", "duration": 2, "content": "Pergunta provocativa"},
    {"type": "dica", "duration": 8, "content": "Explicação da dica"},
    {"type": "exemplo", "duration": 3, "content": "Exemplo prático"},
    {"type": "cta", "duration": 2, "content": "Siga para mais!"}
 ]}'
),

-- Vídeo de PLR
('VIDEO_PLR',
 'Vídeo Explicativo PLR',
 'motivacao',
 'Create a video explaining the Profit Sharing Program (PLR) for employees. ' ||
 'Company: Ampla Contabilidade. ' ||
 'Period: {{PERIODO}}. ' ||
 'Total to distribute: R$ {{VALOR_TOTAL}}. ' ||
 'Criteria: {{CRITERIOS}}. ' ||
 'Style: Exciting, motivating, with numbers and graphics. ' ||
 'Show how each employee can maximize their share.',
 ARRAY['PERIODO', 'VALOR_TOTAL', 'CRITERIOS', 'EXEMPLO_CALCULO'],
 45,
 '{"scenes": [
    {"type": "intro", "duration": 3, "content": "É hora de comemorar!"},
    {"type": "anuncio", "duration": 7, "content": "Valor total a distribuir"},
    {"type": "criterios", "duration": 15, "content": "Como é calculado"},
    {"type": "exemplo", "duration": 12, "content": "Exemplo de cálculo"},
    {"type": "dicas", "duration": 5, "content": "Como ganhar mais"},
    {"type": "encerramento", "duration": 3, "content": "Parabéns equipe!"}
 ]}'
);

-- =====================================================
-- 4. FILA DE GERAÇÃO DE VÍDEO SORA
-- =====================================================

CREATE TABLE IF NOT EXISTS sora_generation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES sora_video_projects(id),

    -- Prioridade
    priority INTEGER DEFAULT 5, -- 1=urgent, 5=normal, 10=low

    -- Status
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- API Request
    api_request JSONB,
    api_response JSONB,

    -- Resultados
    video_url TEXT,
    processing_time_seconds INTEGER,

    -- Erros
    error_message TEXT,
    last_error_at TIMESTAMPTZ,

    queued_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- =====================================================
-- 5. FUNÇÃO PARA GERAR VÍDEO COM SORA
-- =====================================================

CREATE OR REPLACE FUNCTION generate_sora_video(
    p_template_code TEXT,
    p_variables JSONB,
    p_duration_seconds INTEGER DEFAULT NULL,
    p_aspect_ratio TEXT DEFAULT NULL,
    p_priority INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    v_template RECORD;
    v_prompt TEXT;
    v_project_id UUID;
    v_queue_id UUID;
    v_var TEXT;
    v_value TEXT;
BEGIN
    -- Buscar template
    SELECT * INTO v_template
    FROM sora_video_templates
    WHERE template_code = p_template_code AND is_active;

    IF v_template IS NULL THEN
        RAISE EXCEPTION 'Template % não encontrado', p_template_code;
    END IF;

    -- Substituir variáveis no prompt
    v_prompt := v_template.base_prompt;

    FOR v_var IN SELECT unnest(v_template.variables)
    LOOP
        v_value := p_variables->>v_var;
        IF v_value IS NOT NULL THEN
            v_prompt := REPLACE(v_prompt, '{{' || v_var || '}}', v_value);
        END IF;
    END LOOP;

    -- Criar projeto
    INSERT INTO sora_video_projects (
        project_name,
        project_type,
        prompt,
        duration_seconds,
        aspect_ratio,
        style,
        status
    ) VALUES (
        v_template.template_name || ' - ' || to_char(now(), 'DD/MM HH24:MI'),
        v_template.category,
        v_prompt,
        COALESCE(p_duration_seconds, v_template.default_duration),
        COALESCE(p_aspect_ratio, v_template.default_aspect_ratio),
        v_template.default_style,
        'pending'
    )
    RETURNING id INTO v_project_id;

    -- Adicionar à fila
    INSERT INTO sora_generation_queue (
        project_id,
        priority,
        api_request
    ) VALUES (
        v_project_id,
        p_priority,
        jsonb_build_object(
            'model', 'sora-2',
            'prompt', v_prompt,
            'duration', COALESCE(p_duration_seconds, v_template.default_duration),
            'aspect_ratio', COALESCE(p_aspect_ratio, v_template.default_aspect_ratio),
            'style', v_template.default_style
        )
    )
    RETURNING id INTO v_queue_id;

    RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. FUNÇÃO PARA GERAR NARRAÇÃO TTS
-- =====================================================

CREATE OR REPLACE FUNCTION generate_video_narration(
    p_project_id UUID,
    p_narration_text TEXT,
    p_voice TEXT DEFAULT 'alloy' -- alloy, echo, fable, onyx, nova, shimmer
) RETURNS JSONB AS $$
BEGIN
    -- Atualizar projeto com narração
    UPDATE sora_video_projects
    SET
        narration_text = p_narration_text,
        audio_type = 'narration'
    WHERE id = p_project_id;

    -- Retornar configuração para Edge Function
    RETURN jsonb_build_object(
        'project_id', p_project_id,
        'model', 'gpt-4o-mini-tts',
        'input', p_narration_text,
        'voice', p_voice,
        'response_format', 'mp3'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. PLAYLIST PARA TVs COM VÍDEOS SORA
-- =====================================================

CREATE TABLE IF NOT EXISTS tv_video_playlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tv_location TEXT NOT NULL, -- 'recepcao', 'dp', 'fiscal', 'rh', 'diretoria'

    -- Vídeo
    video_project_id UUID REFERENCES sora_video_projects(id),
    video_url TEXT,
    video_title TEXT,
    video_duration INTEGER,

    -- Agendamento
    display_order INTEGER DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,

    -- Horários
    display_times TEXT[], -- ['08:00-12:00', '13:00-18:00']
    repeat_interval_minutes INTEGER DEFAULT 30,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Métricas
    play_count INTEGER DEFAULT 0,
    last_played_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar playlist inicial para cada TV
INSERT INTO tv_video_playlist (tv_location, video_title, display_order, display_times) VALUES
('recepcao', 'Bem-vindo à Ampla', 1, ARRAY['08:00-18:00']),
('dp', 'Programa de Indicações', 1, ARRAY['08:00-12:00', '14:00-17:00']),
('fiscal', 'Dicas Fiscais', 1, ARRAY['09:00-12:00', '14:00-17:00']),
('rh', 'PLR - Como Funciona', 1, ARRAY['08:00-18:00']),
('diretoria', 'Resultados do Mês', 1, ARRAY['08:00-18:00']);

-- =====================================================
-- 8. VIEW: VÍDEOS PRONTOS PARA PUBLICAR
-- =====================================================

CREATE OR REPLACE VIEW vw_sora_videos_ready AS
SELECT
    svp.id,
    svp.project_name,
    svp.project_type,
    svp.duration_seconds,
    svp.video_url,
    svp.thumbnail_url,
    svp.status,
    svp.created_at,
    svp.approved_at,
    CASE
        WHEN svp.video_url IS NOT NULL AND svp.approved_at IS NOT NULL THEN 'ready_to_publish'
        WHEN svp.video_url IS NOT NULL THEN 'pending_approval'
        ELSE 'generating'
    END as publish_status
FROM sora_video_projects svp
WHERE svp.status IN ('ready', 'published')
ORDER BY svp.created_at DESC;

-- =====================================================
-- 9. VIEW: FILA DE GERAÇÃO
-- =====================================================

CREATE OR REPLACE VIEW vw_sora_queue_status AS
SELECT
    sgq.id as queue_id,
    svp.project_name,
    svp.project_type,
    sgq.status,
    sgq.priority,
    sgq.attempts,
    sgq.queued_at,
    sgq.started_at,
    CASE
        WHEN sgq.status = 'processing' THEN
            EXTRACT(EPOCH FROM (now() - sgq.started_at))::INTEGER
        ELSE NULL
    END as processing_seconds,
    sgq.error_message
FROM sora_generation_queue sgq
JOIN sora_video_projects svp ON svp.id = sgq.project_id
ORDER BY sgq.priority, sgq.queued_at;

-- =====================================================
-- 10. CONFIGURAÇÃO DE BRANDING AMPLA
-- =====================================================

CREATE TABLE IF NOT EXISTS video_branding_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT UNIQUE DEFAULT 'default',

    -- Logo
    logo_url TEXT,
    logo_position TEXT DEFAULT 'bottom-right', -- top-left, top-right, bottom-left, bottom-right
    logo_size TEXT DEFAULT 'small', -- small, medium, large

    -- Cores
    primary_color TEXT DEFAULT '#1e3a5f',
    secondary_color TEXT DEFAULT '#4a90d9',
    accent_color TEXT DEFAULT '#f5a623',
    text_color TEXT DEFAULT '#ffffff',

    -- Intro/Outro
    intro_video_url TEXT,
    intro_duration INTEGER DEFAULT 3,
    outro_video_url TEXT,
    outro_duration INTEGER DEFAULT 3,

    -- Música
    default_music_url TEXT,
    music_volume DECIMAL(3,2) DEFAULT 0.3,

    -- Texto
    font_family TEXT DEFAULT 'Montserrat',
    title_font_size INTEGER DEFAULT 48,
    subtitle_font_size INTEGER DEFAULT 32,

    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configuração padrão Ampla
INSERT INTO video_branding_config (
    config_name,
    primary_color,
    secondary_color,
    accent_color,
    font_family
) VALUES (
    'ampla_default',
    '#1e3a5f',
    '#4a90d9',
    '#f5a623',
    'Montserrat'
);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE sora_video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sora_video_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sora_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_video_playlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_branding_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sora_projects_all" ON sora_video_projects FOR ALL TO authenticated USING (true);
CREATE POLICY "sora_templates_read" ON sora_video_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "sora_queue_all" ON sora_generation_queue FOR ALL TO authenticated USING (true);
CREATE POLICY "tv_playlist_all" ON tv_video_playlist FOR ALL TO authenticated USING (true);
CREATE POLICY "branding_read" ON video_branding_config FOR SELECT TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE sora_video_projects IS 'Projetos de vídeo para geração com OpenAI Sora 2';
COMMENT ON TABLE sora_video_templates IS 'Templates reutilizáveis de vídeo com prompts';
COMMENT ON TABLE sora_generation_queue IS 'Fila de processamento de vídeos Sora';
COMMENT ON TABLE tv_video_playlist IS 'Playlist de vídeos para cada TV do escritório';
COMMENT ON TABLE video_branding_config IS 'Configuração de branding para vídeos';

-- =====================================================
-- EXEMPLO DE USO
-- =====================================================

/*
-- 1. Gerar vídeo de indicação com Sora 2:
SELECT generate_sora_video(
    'VIDEO_INDICACAO',
    jsonb_build_object(
        'FUNCIONARIO_DESTAQUE', 'Rose Silva',
        'VALOR_GANHO', '800',
        'META_MES', '5 indicações'
    ),
    30,  -- 30 segundos
    '16:9',
    1    -- Prioridade alta
);

-- 2. Gerar vídeo de PLR:
SELECT generate_sora_video(
    'VIDEO_PLR',
    jsonb_build_object(
        'PERIODO', '2024',
        'VALOR_TOTAL', '50.000',
        'CRITERIOS', 'Tempo de casa, metas atingidas, indicações',
        'EXEMPLO_CALCULO', 'João: 3 anos + 100% metas = R$ 3.200'
    )
);

-- 3. Ver fila de geração:
SELECT * FROM vw_sora_queue_status;

-- 4. Ver vídeos prontos:
SELECT * FROM vw_sora_videos_ready;

-- 5. Gerar narração para um vídeo:
SELECT generate_video_narration(
    'project-uuid-here',
    'Olá equipe Ampla! Você sabia que pode ganhar até R$ 500 por cada cliente que indicar?',
    'nova'
);
*/
