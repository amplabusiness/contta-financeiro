-- ============================================================================
-- ASSINATURA LÓGICA DAS DECISÕES DO DR. CÍCERO
-- Implementação: Decision Hash + Approval Trail
-- 
-- Autor: Dr. Cícero (Contador Responsável)
-- Data: 2025-02-01
-- Versão: 1.0
--
-- RECOMENDAÇÃO SÊNIOR #2: Decisão com hash de assinatura lógica
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA DE DECISÕES DO DR. CÍCERO
-- ============================================================================
CREATE TABLE IF NOT EXISTS dr_cicero_decisions (
    -- Identificador único
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant
    tenant_id UUID NOT NULL,
    
    -- === CONTEXTO DA DECISÃO ===
    
    -- Tipo de decisão (approve_entry, reject_entry, classify_transaction, etc.)
    decision_type TEXT NOT NULL,
    
    -- Entidade afetada
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Decisão tomada (approved, rejected, classified, corrected, etc.)
    decision TEXT NOT NULL,
    
    -- Justificativa/razão da decisão
    justification TEXT,
    
    -- Dados do contexto no momento da decisão (snapshot)
    context_snapshot JSONB NOT NULL,
    
    -- === HASH DE ASSINATURA LÓGICA ===
    
    -- Hash único da decisão (SHA256)
    -- Fórmula: SHA256(tenant_id + entity_id + decision_type + decision + timestamp + context_hash)
    decision_hash TEXT NOT NULL UNIQUE,
    
    -- Hash do contexto usado na decisão
    context_hash TEXT NOT NULL,
    
    -- Hash da cadeia (referência à decisão anterior, se houver)
    previous_decision_hash TEXT,
    
    -- === METADADOS DO APROVADOR ===
    
    -- Quem tomou a decisão (user_id ou 'dr_cicero_ai')
    approver_id TEXT NOT NULL,
    
    -- Nome/identificação do aprovador
    approver_name TEXT NOT NULL,
    
    -- Nível de autoridade (auto, manual, override)
    authority_level TEXT NOT NULL DEFAULT 'manual',
    
    -- Confiança da decisão (0-100 para IA, 100 para manual)
    confidence_score INTEGER NOT NULL DEFAULT 100,
    
    -- === AUDIT TRAIL ===
    
    -- Timestamp da decisão (imutável)
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- IP de onde foi tomada a decisão
    ip_address INET,
    
    -- User agent
    user_agent TEXT,
    
    -- Sessão
    session_id TEXT,
    
    -- === INTEGRAÇÃO COM AUDIT LOG ===
    
    -- ID do registro no audit_log_immutable (para rastreabilidade completa)
    audit_log_id UUID,
    
    -- === CONSTRAINTS ===
    CONSTRAINT valid_authority_level CHECK (
        authority_level IN ('auto', 'manual', 'override', 'system')
    ),
    CONSTRAINT valid_confidence CHECK (
        confidence_score >= 0 AND confidence_score <= 100
    )
);

-- ============================================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_dr_cicero_tenant 
    ON dr_cicero_decisions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_dr_cicero_entity 
    ON dr_cicero_decisions(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_dr_cicero_decision_hash 
    ON dr_cicero_decisions(decision_hash);

CREATE INDEX IF NOT EXISTS idx_dr_cicero_decided_at 
    ON dr_cicero_decisions(decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_dr_cicero_type 
    ON dr_cicero_decisions(decision_type);

CREATE INDEX IF NOT EXISTS idx_dr_cicero_approver 
    ON dr_cicero_decisions(approver_id);

-- ============================================================================
-- 3. FUNÇÃO PARA GERAR DECISION HASH
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_decision_hash(
    p_tenant_id UUID,
    p_entity_id UUID,
    p_decision_type TEXT,
    p_decision TEXT,
    p_timestamp TIMESTAMPTZ,
    p_context_hash TEXT
) RETURNS TEXT AS $$
DECLARE
    v_data_to_hash TEXT;
    v_hash TEXT;
BEGIN
    -- Concatenar dados para hash
    v_data_to_hash := 
        p_tenant_id::TEXT || '|' ||
        p_entity_id::TEXT || '|' ||
        p_decision_type || '|' ||
        p_decision || '|' ||
        p_timestamp::TEXT || '|' ||
        p_context_hash;
    
    -- Gerar SHA256
    v_hash := encode(sha256(v_data_to_hash::BYTEA), 'hex');
    
    RETURN v_hash;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 4. FUNÇÃO PARA GERAR CONTEXT HASH
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_context_hash(p_context JSONB)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(sha256(p_context::TEXT::BYTEA), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 5. FUNÇÃO PARA REGISTRAR DECISÃO DO DR. CÍCERO
-- ============================================================================
CREATE OR REPLACE FUNCTION register_dr_cicero_decision(
    p_tenant_id UUID,
    p_decision_type TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_decision TEXT,
    p_justification TEXT DEFAULT NULL,
    p_context JSONB DEFAULT '{}',
    p_approver_id TEXT DEFAULT 'dr_cicero_ai',
    p_approver_name TEXT DEFAULT 'Dr. Cícero (IA)',
    p_authority_level TEXT DEFAULT 'auto',
    p_confidence_score INTEGER DEFAULT 95,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL
) RETURNS TABLE (
    decision_id UUID,
    decision_hash TEXT,
    audit_log_id UUID
) AS $$
DECLARE
    v_new_id UUID;
    v_context_hash TEXT;
    v_decision_hash TEXT;
    v_previous_hash TEXT;
    v_decided_at TIMESTAMPTZ;
    v_audit_id UUID;
    v_context_with_meta JSONB;
BEGIN
    -- Timestamp imutável
    v_decided_at := NOW();
    
    -- Enriquecer contexto com metadados
    v_context_with_meta := p_context || jsonb_build_object(
        '_decision_metadata', jsonb_build_object(
            'decision_type', p_decision_type,
            'entity_type', p_entity_type,
            'entity_id', p_entity_id,
            'timestamp', v_decided_at
        )
    );
    
    -- Gerar hash do contexto
    v_context_hash := generate_context_hash(v_context_with_meta);
    
    -- Buscar hash da última decisão deste tenant (para cadeia)
    SELECT decision_hash INTO v_previous_hash
    FROM dr_cicero_decisions
    WHERE tenant_id = p_tenant_id
    ORDER BY decided_at DESC
    LIMIT 1;
    
    IF v_previous_hash IS NULL THEN
        v_previous_hash := 'GENESIS_DECISION_' || p_tenant_id::TEXT;
    END IF;
    
    -- Gerar hash da decisão
    v_decision_hash := generate_decision_hash(
        p_tenant_id,
        p_entity_id,
        p_decision_type,
        p_decision,
        v_decided_at,
        v_context_hash
    );
    
    -- Gerar UUID
    v_new_id := gen_random_uuid();
    
    -- Registrar no audit log imutável primeiro
    SELECT insert_audit_log(
        p_tenant_id := p_tenant_id,
        p_event_type := 'dr_cicero_decision',
        p_entity_type := p_entity_type,
        p_entity_id := p_entity_id,
        p_payload := jsonb_build_object(
            'decision_type', p_decision_type,
            'decision', p_decision,
            'justification', p_justification,
            'decision_hash', v_decision_hash,
            'approver', p_approver_name,
            'authority_level', p_authority_level,
            'confidence_score', p_confidence_score
        ),
        p_user_id := CASE WHEN p_approver_id != 'dr_cicero_ai' THEN p_approver_id::UUID ELSE NULL END,
        p_user_email := p_approver_name,
        p_ip_address := p_ip_address,
        p_user_agent := p_user_agent,
        p_session_id := p_session_id,
        p_context := v_context_with_meta
    ) INTO v_audit_id;
    
    -- Inserir decisão
    INSERT INTO dr_cicero_decisions (
        id,
        tenant_id,
        decision_type,
        entity_type,
        entity_id,
        decision,
        justification,
        context_snapshot,
        decision_hash,
        context_hash,
        previous_decision_hash,
        approver_id,
        approver_name,
        authority_level,
        confidence_score,
        decided_at,
        ip_address,
        user_agent,
        session_id,
        audit_log_id
    ) VALUES (
        v_new_id,
        p_tenant_id,
        p_decision_type,
        p_entity_type,
        p_entity_id,
        p_decision,
        p_justification,
        v_context_with_meta,
        v_decision_hash,
        v_context_hash,
        v_previous_hash,
        p_approver_id,
        p_approver_name,
        p_authority_level,
        p_confidence_score,
        v_decided_at,
        p_ip_address,
        p_user_agent,
        p_session_id,
        v_audit_id
    );
    
    RETURN QUERY SELECT v_new_id, v_decision_hash, v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNÇÃO PARA VERIFICAR ASSINATURA DE DECISÃO
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_decision_signature(
    p_decision_id UUID
) RETURNS TABLE (
    is_valid BOOLEAN,
    stored_hash TEXT,
    computed_hash TEXT,
    discrepancy_reason TEXT
) AS $$
DECLARE
    v_decision RECORD;
    v_computed_hash TEXT;
    v_reason TEXT;
BEGIN
    -- Buscar decisão
    SELECT * INTO v_decision
    FROM dr_cicero_decisions
    WHERE id = p_decision_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            false,
            NULL::TEXT,
            NULL::TEXT,
            'Decisão não encontrada'::TEXT;
        RETURN;
    END IF;
    
    -- Recalcular hash
    v_computed_hash := generate_decision_hash(
        v_decision.tenant_id,
        v_decision.entity_id,
        v_decision.decision_type,
        v_decision.decision,
        v_decision.decided_at,
        v_decision.context_hash
    );
    
    -- Verificar
    IF v_computed_hash = v_decision.decision_hash THEN
        v_reason := NULL;
    ELSE
        v_reason := 'Hash não corresponde - possível adulteração';
    END IF;
    
    RETURN QUERY SELECT 
        (v_computed_hash = v_decision.decision_hash),
        v_decision.decision_hash,
        v_computed_hash,
        v_reason;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. TRIGGER PARA IMPEDIR MODIFICAÇÃO DE DECISÕES
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_decision_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'DECISION_IMMUTABLE: Decisões do Dr. Cícero são IMUTÁVEIS. Para corrigir, registre nova decisão.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'DECISION_IMMUTABLE: Decisões do Dr. Cícero são IMUTÁVEIS. DELETE não permitido.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_prevent_decision_update ON dr_cicero_decisions;
DROP TRIGGER IF EXISTS tr_prevent_decision_delete ON dr_cicero_decisions;

CREATE TRIGGER tr_prevent_decision_update
    BEFORE UPDATE ON dr_cicero_decisions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_decision_modification();

CREATE TRIGGER tr_prevent_decision_delete
    BEFORE DELETE ON dr_cicero_decisions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_decision_modification();

-- ============================================================================
-- 8. VIEW PARA DECISÕES COM STATUS DE VERIFICAÇÃO
-- ============================================================================
CREATE OR REPLACE VIEW v_dr_cicero_decisions_verified AS
SELECT 
    d.*,
    generate_decision_hash(
        d.tenant_id,
        d.entity_id,
        d.decision_type,
        d.decision,
        d.decided_at,
        d.context_hash
    ) = d.decision_hash AS signature_valid
FROM dr_cicero_decisions d;

-- ============================================================================
-- 9. RLS PARA SEGURANÇA
-- ============================================================================
ALTER TABLE dr_cicero_decisions ENABLE ROW LEVEL SECURITY;

-- Policy de leitura
DROP POLICY IF EXISTS decisions_tenant_read ON dr_cicero_decisions;
CREATE POLICY decisions_tenant_read ON dr_cicero_decisions
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policy de inserção
DROP POLICY IF EXISTS decisions_tenant_insert ON dr_cicero_decisions;
CREATE POLICY decisions_tenant_insert ON dr_cicero_decisions
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Service role bypass
DROP POLICY IF EXISTS decisions_service_role ON dr_cicero_decisions;
CREATE POLICY decisions_service_role ON dr_cicero_decisions
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 10. TIPOS DE DECISÃO PADRÃO (ENUM VIRTUAL)
-- ============================================================================
COMMENT ON TABLE dr_cicero_decisions IS 
    'Registro imutável de todas as decisões do Dr. Cícero com assinatura hash';

-- Tipos de decisão comuns:
-- approve_entry       - Aprovação de lançamento contábil
-- reject_entry        - Rejeição de lançamento
-- classify_transaction - Classificação de transação bancária
-- correct_entry       - Correção/estorno de lançamento
-- reclassify          - Reclassificação contábil
-- approve_reconciliation - Aprovação de conciliação
-- close_period        - Fechamento de período
-- open_period         - Abertura de período
-- override_validation - Override de validação automática

-- ============================================================================
-- FIM DA MIGRATION 002_dr_cicero_decisions.sql
-- ============================================================================
