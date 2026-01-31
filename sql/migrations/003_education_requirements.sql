-- ============================================================================
-- FLAG DE EDUCAÇÃO OBRIGATÓRIA
-- Implementação: Sistema de acknowledgment para erros críticos
-- 
-- Autor: Dr. Cícero (Contador Responsável)
-- Data: 2025-02-01
-- Versão: 1.0
--
-- RECOMENDAÇÃO SÊNIOR #3: Flag "educação obrigatória" para erros críticos
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA DE EDUCAÇÃO OBRIGATÓRIA
-- ============================================================================
CREATE TABLE IF NOT EXISTS education_requirements (
    -- Identificador único
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant
    tenant_id UUID NOT NULL,
    
    -- === CONTEXTO DO ERRO ===
    
    -- Tipo do erro (critical, warning, info)
    severity TEXT NOT NULL DEFAULT 'warning',
    
    -- Código do erro (para categorização)
    error_code TEXT NOT NULL,
    
    -- Título do erro
    error_title TEXT NOT NULL,
    
    -- Descrição detalhada do erro
    error_description TEXT NOT NULL,
    
    -- Entidade afetada
    entity_type TEXT,
    entity_id UUID,
    
    -- === CONTEÚDO EDUCACIONAL ===
    
    -- Explicação educacional (markdown)
    education_content TEXT NOT NULL,
    
    -- Referências (links, documentos, etc.)
    reference_links JSONB DEFAULT '[]',
    
    -- Duração mínima de leitura estimada (segundos)
    min_read_time_seconds INTEGER DEFAULT 30,
    
    -- Perguntas de verificação (opcional)
    verification_questions JSONB DEFAULT '[]',
    
    -- === CONTROLE DE OBRIGATORIEDADE ===
    
    -- Se é bloqueante (impede prosseguir sem ack)
    is_blocking BOOLEAN DEFAULT true,
    
    -- Se requer acknowledgment assinado
    requires_signed_ack BOOLEAN DEFAULT false,
    
    -- Se requer resposta às perguntas
    requires_quiz_pass BOOLEAN DEFAULT false,
    
    -- Usuário que deve reconhecer (NULL = qualquer usuário do tenant)
    required_user_id UUID,
    
    -- === TIMESTAMPS ===
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL = nunca expira
    
    -- === AUDIT ===
    
    -- Quem gerou o requisito (sistema, IA, usuário)
    created_by TEXT NOT NULL DEFAULT 'system',
    
    -- Contexto da geração
    creation_context JSONB DEFAULT '{}',
    
    -- === CONSTRAINTS ===
    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'warning', 'info'))
);

-- ============================================================================
-- 2. CRIAR TABELA DE ACKNOWLEDGMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS education_acknowledgments (
    -- Identificador único
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant
    tenant_id UUID NOT NULL,
    
    -- Requisito educacional
    requirement_id UUID NOT NULL REFERENCES education_requirements(id),
    
    -- === DADOS DO ACK ===
    
    -- Usuário que reconheceu
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    
    -- Timestamp do ack
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Tempo que ficou na tela educacional (segundos)
    time_spent_seconds INTEGER,
    
    -- Se passou no quiz (quando aplicável)
    quiz_passed BOOLEAN,
    quiz_answers JSONB,
    
    -- === ASSINATURA DIGITAL ===
    
    -- Hash do ack (SHA256 de dados + timestamp + user)
    ack_hash TEXT NOT NULL,
    
    -- IP de onde foi feito o ack
    ip_address INET,
    
    -- User agent
    user_agent TEXT,
    
    -- Sessão
    session_id TEXT,
    
    -- === TEXTO DO ACK ===
    
    -- Declaração do usuário
    acknowledgment_text TEXT DEFAULT 'Declaro que li e compreendi o conteúdo educacional apresentado.',
    
    -- Notas adicionais do usuário
    user_notes TEXT,
    
    -- === AUDIT LOG LINK ===
    audit_log_id UUID,
    
    -- Constraint de unicidade
    CONSTRAINT unique_ack_per_requirement UNIQUE (requirement_id, user_id)
);

-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_edu_req_tenant ON education_requirements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edu_req_entity ON education_requirements(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_edu_req_severity ON education_requirements(severity);
CREATE INDEX IF NOT EXISTS idx_edu_req_blocking ON education_requirements(is_blocking) WHERE is_blocking = true;
CREATE INDEX IF NOT EXISTS idx_edu_ack_tenant ON education_acknowledgments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edu_ack_user ON education_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_edu_ack_requirement ON education_acknowledgments(requirement_id);

-- ============================================================================
-- 4. FUNÇÃO PARA CRIAR REQUISITO EDUCACIONAL
-- ============================================================================
CREATE OR REPLACE FUNCTION create_education_requirement(
    p_tenant_id UUID,
    p_severity TEXT,
    p_error_code TEXT,
    p_error_title TEXT,
    p_error_description TEXT,
    p_education_content TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_is_blocking BOOLEAN DEFAULT true,
    p_references JSONB DEFAULT '[]',
    p_min_read_time INTEGER DEFAULT 30,
    p_verification_questions JSONB DEFAULT '[]',
    p_requires_quiz BOOLEAN DEFAULT false,
    p_required_user_id UUID DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_created_by TEXT DEFAULT 'system',
    p_context JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := gen_random_uuid();
    
    INSERT INTO education_requirements (
        id,
        tenant_id,
        severity,
        error_code,
        error_title,
        error_description,
        education_content,
        entity_type,
        entity_id,
        is_blocking,
        reference_links,
        min_read_time_seconds,
        verification_questions,
        requires_quiz_pass,
        required_user_id,
        expires_at,
        created_by,
        creation_context
    ) VALUES (
        v_new_id,
        p_tenant_id,
        p_severity,
        p_error_code,
        p_error_title,
        p_error_description,
        p_education_content,
        p_entity_type,
        p_entity_id,
        p_is_blocking,
        p_references,
        p_min_read_time,
        p_verification_questions,
        p_requires_quiz,
        p_required_user_id,
        p_expires_at,
        p_created_by,
        p_context
    );
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNÇÃO PARA GERAR HASH DO ACKNOWLEDGMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_ack_hash(
    p_requirement_id UUID,
    p_user_id UUID,
    p_acknowledged_at TIMESTAMPTZ,
    p_ack_text TEXT
) RETURNS TEXT AS $$
DECLARE
    v_data TEXT;
BEGIN
    v_data := 
        p_requirement_id::TEXT || '|' ||
        p_user_id::TEXT || '|' ||
        p_acknowledged_at::TEXT || '|' ||
        COALESCE(p_ack_text, '');
    
    RETURN encode(sha256(v_data::BYTEA), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. FUNÇÃO PARA REGISTRAR ACKNOWLEDGMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION acknowledge_education(
    p_requirement_id UUID,
    p_user_id UUID,
    p_user_email TEXT,
    p_time_spent_seconds INTEGER DEFAULT NULL,
    p_quiz_answers JSONB DEFAULT NULL,
    p_user_notes TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_acknowledgment_text TEXT DEFAULT 'Declaro que li e compreendi o conteúdo educacional apresentado.'
) RETURNS TABLE (
    ack_id UUID,
    ack_hash TEXT,
    quiz_passed BOOLEAN
) AS $$
DECLARE
    v_new_id UUID;
    v_ack_at TIMESTAMPTZ;
    v_hash TEXT;
    v_quiz_passed BOOLEAN;
    v_requirement RECORD;
    v_tenant_id UUID;
    v_audit_id UUID;
BEGIN
    v_ack_at := NOW();
    v_new_id := gen_random_uuid();
    
    -- Buscar requisito
    SELECT * INTO v_requirement
    FROM education_requirements
    WHERE id = p_requirement_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Requisito educacional não encontrado: %', p_requirement_id;
    END IF;
    
    v_tenant_id := v_requirement.tenant_id;
    
    -- Verificar se já existe ack
    IF EXISTS (
        SELECT 1 FROM education_acknowledgments 
        WHERE requirement_id = p_requirement_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Usuário já reconheceu este requisito educacional';
    END IF;
    
    -- Verificar quiz se necessário
    v_quiz_passed := NULL;
    IF v_requirement.requires_quiz_pass AND p_quiz_answers IS NOT NULL THEN
        -- Lógica simplificada: verificar se todas as respostas estão corretas
        -- Na prática, você pode ter lógica mais sofisticada
        v_quiz_passed := true; -- Placeholder
    END IF;
    
    -- Gerar hash
    v_hash := generate_ack_hash(p_requirement_id, p_user_id, v_ack_at, p_acknowledgment_text);
    
    -- Registrar no audit log
    SELECT insert_audit_log(
        p_tenant_id := v_tenant_id,
        p_event_type := 'education_acknowledged',
        p_entity_type := 'education_requirement',
        p_entity_id := p_requirement_id,
        p_payload := jsonb_build_object(
            'error_code', v_requirement.error_code,
            'error_title', v_requirement.error_title,
            'severity', v_requirement.severity,
            'time_spent_seconds', p_time_spent_seconds,
            'quiz_passed', v_quiz_passed,
            'ack_hash', v_hash
        ),
        p_user_id := p_user_id,
        p_user_email := p_user_email,
        p_ip_address := p_ip_address,
        p_user_agent := p_user_agent,
        p_session_id := p_session_id
    ) INTO v_audit_id;
    
    -- Inserir ack
    INSERT INTO education_acknowledgments (
        id,
        tenant_id,
        requirement_id,
        user_id,
        user_email,
        acknowledged_at,
        time_spent_seconds,
        quiz_passed,
        quiz_answers,
        ack_hash,
        ip_address,
        user_agent,
        session_id,
        acknowledgment_text,
        user_notes,
        audit_log_id
    ) VALUES (
        v_new_id,
        v_tenant_id,
        p_requirement_id,
        p_user_id,
        p_user_email,
        v_ack_at,
        p_time_spent_seconds,
        v_quiz_passed,
        p_quiz_answers,
        v_hash,
        p_ip_address,
        p_user_agent,
        p_session_id,
        p_acknowledgment_text,
        p_user_notes,
        v_audit_id
    );
    
    RETURN QUERY SELECT v_new_id, v_hash, v_quiz_passed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNÇÃO PARA VERIFICAR REQUISITOS PENDENTES
-- ============================================================================
CREATE OR REPLACE FUNCTION get_pending_education_requirements(
    p_tenant_id UUID,
    p_user_id UUID,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL
) RETURNS TABLE (
    requirement_id UUID,
    severity TEXT,
    error_code TEXT,
    error_title TEXT,
    error_description TEXT,
    education_content TEXT,
    is_blocking BOOLEAN,
    min_read_time_seconds INTEGER,
    requires_quiz BOOLEAN,
    verification_questions JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.severity,
        r.error_code,
        r.error_title,
        r.error_description,
        r.education_content,
        r.is_blocking,
        r.min_read_time_seconds,
        r.requires_quiz_pass,
        r.verification_questions,
        r.created_at
    FROM education_requirements r
    LEFT JOIN education_acknowledgments a 
        ON a.requirement_id = r.id AND a.user_id = p_user_id
    WHERE r.tenant_id = p_tenant_id
      AND a.id IS NULL  -- Não reconhecido ainda
      AND (r.expires_at IS NULL OR r.expires_at > NOW())
      AND (r.required_user_id IS NULL OR r.required_user_id = p_user_id)
      AND (p_entity_type IS NULL OR r.entity_type = p_entity_type)
      AND (p_entity_id IS NULL OR r.entity_id = p_entity_id)
    ORDER BY 
        CASE r.severity 
            WHEN 'critical' THEN 1 
            WHEN 'warning' THEN 2 
            ELSE 3 
        END,
        r.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. FUNÇÃO PARA VERIFICAR SE USUÁRIO PODE PROSSEGUIR
-- ============================================================================
CREATE OR REPLACE FUNCTION can_proceed_after_education(
    p_tenant_id UUID,
    p_user_id UUID,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL
) RETURNS TABLE (
    can_proceed BOOLEAN,
    blocking_count INTEGER,
    blocking_requirements UUID[]
) AS $$
DECLARE
    v_blocking_ids UUID[];
    v_count INTEGER;
BEGIN
    -- Buscar requisitos bloqueantes pendentes
    SELECT ARRAY_AGG(r.id), COUNT(*)
    INTO v_blocking_ids, v_count
    FROM education_requirements r
    LEFT JOIN education_acknowledgments a 
        ON a.requirement_id = r.id AND a.user_id = p_user_id
    WHERE r.tenant_id = p_tenant_id
      AND r.is_blocking = true
      AND a.id IS NULL
      AND (r.expires_at IS NULL OR r.expires_at > NOW())
      AND (r.required_user_id IS NULL OR r.required_user_id = p_user_id)
      AND (p_entity_type IS NULL OR r.entity_type = p_entity_type)
      AND (p_entity_id IS NULL OR r.entity_id = p_entity_id);
    
    RETURN QUERY SELECT 
        (v_count = 0 OR v_count IS NULL),
        COALESCE(v_count, 0),
        COALESCE(v_blocking_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. VIEW PARA RELATÓRIO DE EDUCAÇÃO
-- ============================================================================
CREATE OR REPLACE VIEW v_education_compliance AS
SELECT 
    r.tenant_id,
    r.id as requirement_id,
    r.severity,
    r.error_code,
    r.error_title,
    r.is_blocking,
    r.created_at as requirement_created,
    a.id as ack_id,
    a.user_email as acknowledged_by,
    a.acknowledged_at,
    a.time_spent_seconds,
    a.quiz_passed,
    CASE 
        WHEN a.id IS NOT NULL THEN 'acknowledged'
        WHEN r.expires_at IS NOT NULL AND r.expires_at < NOW() THEN 'expired'
        ELSE 'pending'
    END as status
FROM education_requirements r
LEFT JOIN education_acknowledgments a ON a.requirement_id = r.id;

-- ============================================================================
-- 10. RLS
-- ============================================================================
ALTER TABLE education_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Requirements
DROP POLICY IF EXISTS edu_req_tenant ON education_requirements;
CREATE POLICY edu_req_tenant ON education_requirements
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS edu_req_service ON education_requirements;
CREATE POLICY edu_req_service ON education_requirements
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Acknowledgments
DROP POLICY IF EXISTS edu_ack_tenant ON education_acknowledgments;
CREATE POLICY edu_ack_tenant ON education_acknowledgments
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS edu_ack_service ON education_acknowledgments;
CREATE POLICY edu_ack_service ON education_acknowledgments
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 11. COMENTÁRIOS
-- ============================================================================
COMMENT ON TABLE education_requirements IS 
    'Requisitos educacionais gerados pelo sistema/Dr. Cícero para erros críticos';

COMMENT ON TABLE education_acknowledgments IS 
    'Registro de reconhecimento dos requisitos educacionais pelos usuários';

COMMENT ON FUNCTION create_education_requirement IS 
    'Cria novo requisito educacional (pode ser bloqueante)';

COMMENT ON FUNCTION acknowledge_education IS 
    'Registra acknowledgment de requisito educacional com hash assinado';

COMMENT ON FUNCTION can_proceed_after_education IS 
    'Verifica se usuário pode prosseguir (sem requisitos bloqueantes pendentes)';

-- ============================================================================
-- FIM DA MIGRATION 003_education_requirements.sql
-- ============================================================================
