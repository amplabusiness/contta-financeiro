-- ============================================================================
-- AUDIT LOG IMUTÁVEL (WORM) - Write Once Read Many
-- Implementação: Blockchain-Style com Hash Encadeado
-- 
-- Autor: Dr. Cícero (Contador Responsável)
-- Data: 2025-02-01
-- Versão: 1.0
--
-- RECOMENDAÇÃO SÊNIOR #1: Trilha de auditoria verdadeiramente imutável
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA AUDIT_LOG_IMMUTABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log_immutable (
    -- Identificador único (UUID v4)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant para multi-tenancy
    tenant_id UUID NOT NULL,
    
    -- Hash da entrada anterior (blockchain-style chain)
    previous_hash TEXT NOT NULL,
    
    -- Hash do registro atual (SHA256 de payload + previous_hash + timestamp)
    record_hash TEXT NOT NULL,
    
    -- Tipo do evento (login, logout, create, update, delete, approve, reject, etc.)
    event_type TEXT NOT NULL,
    
    -- Entidade afetada (accounting_entries, bank_transactions, etc.)
    entity_type TEXT,
    
    -- ID da entidade afetada
    entity_id UUID,
    
    -- Payload completo do evento em JSON
    payload JSONB NOT NULL,
    
    -- Usuário que realizou a ação
    user_id UUID,
    
    -- Email do usuário (snapshot para auditoria)
    user_email TEXT,
    
    -- IP de origem (quando disponível)
    ip_address INET,
    
    -- User agent do navegador
    user_agent TEXT,
    
    -- Sessão identificadora
    session_id TEXT,
    
    -- Contexto adicional (feature, módulo, etc.)
    context JSONB,
    
    -- === CAMPOS IMUTÁVEIS DE CONTROLE ===
    
    -- Timestamp de criação (NUNCA pode ser alterado)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Sequencial para garantir ordem (auto-increment)
    sequence_number BIGSERIAL NOT NULL,
    
    -- Assinatura digital opcional (para integrações externas)
    digital_signature TEXT,
    
    -- Índice do bloco (para agrupamento em "blocos" de auditoria)
    block_index INTEGER NOT NULL DEFAULT 0,
    
    -- Constraints de unicidade
    CONSTRAINT unique_sequence_per_tenant UNIQUE (tenant_id, sequence_number)
);

-- ============================================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_immutable_tenant 
    ON audit_log_immutable(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_immutable_created 
    ON audit_log_immutable(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_immutable_event 
    ON audit_log_immutable(event_type);

CREATE INDEX IF NOT EXISTS idx_audit_immutable_entity 
    ON audit_log_immutable(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_immutable_user 
    ON audit_log_immutable(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_immutable_hash 
    ON audit_log_immutable(record_hash);

CREATE INDEX IF NOT EXISTS idx_audit_immutable_prev_hash 
    ON audit_log_immutable(previous_hash);

-- ============================================================================
-- 3. TRIGGER PARA IMPEDIR UPDATE E DELETE (WORM)
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'WORM_VIOLATION: Registros de auditoria são IMUTÁVEIS. UPDATE não permitido.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'WORM_VIOLATION: Registros de auditoria são IMUTÁVEIS. DELETE não permitido.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_prevent_audit_update ON audit_log_immutable;
DROP TRIGGER IF EXISTS tr_prevent_audit_delete ON audit_log_immutable;

CREATE TRIGGER tr_prevent_audit_update
    BEFORE UPDATE ON audit_log_immutable
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER tr_prevent_audit_delete
    BEFORE DELETE ON audit_log_immutable
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================================
-- 4. FUNÇÃO PARA GERAR HASH (SHA256)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_audit_hash(
    p_payload JSONB,
    p_previous_hash TEXT,
    p_created_at TIMESTAMPTZ,
    p_tenant_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_data_to_hash TEXT;
    v_hash TEXT;
BEGIN
    -- Concatenar dados para hash
    v_data_to_hash := 
        COALESCE(p_tenant_id::TEXT, '') || '|' ||
        COALESCE(p_previous_hash, 'GENESIS') || '|' ||
        COALESCE(p_payload::TEXT, '{}') || '|' ||
        COALESCE(p_created_at::TEXT, NOW()::TEXT);
    
    -- Gerar SHA256
    v_hash := encode(sha256(v_data_to_hash::BYTEA), 'hex');
    
    RETURN v_hash;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 5. FUNÇÃO PARA INSERIR REGISTRO COM HASH ENCADEADO
-- ============================================================================
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}',
    p_user_id UUID DEFAULT NULL,
    p_user_email TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_context JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_previous_hash TEXT;
    v_new_id UUID;
    v_created_at TIMESTAMPTZ;
    v_record_hash TEXT;
    v_block_index INTEGER;
BEGIN
    -- Timestamp de criação (imutável)
    v_created_at := NOW();
    
    -- Buscar hash do último registro deste tenant (ou GENESIS se primeiro)
    SELECT record_hash, block_index INTO v_previous_hash, v_block_index
    FROM audit_log_immutable
    WHERE tenant_id = p_tenant_id
    ORDER BY sequence_number DESC
    LIMIT 1;
    
    IF v_previous_hash IS NULL THEN
        v_previous_hash := 'GENESIS_' || p_tenant_id::TEXT;
        v_block_index := 0;
    END IF;
    
    -- Incrementar bloco a cada 1000 registros
    IF (SELECT COUNT(*) FROM audit_log_immutable 
        WHERE tenant_id = p_tenant_id AND block_index = v_block_index) >= 1000 THEN
        v_block_index := v_block_index + 1;
    END IF;
    
    -- Gerar hash do novo registro
    v_record_hash := generate_audit_hash(p_payload, v_previous_hash, v_created_at, p_tenant_id);
    
    -- Gerar UUID para o novo registro
    v_new_id := gen_random_uuid();
    
    -- Inserir registro
    INSERT INTO audit_log_immutable (
        id,
        tenant_id,
        previous_hash,
        record_hash,
        event_type,
        entity_type,
        entity_id,
        payload,
        user_id,
        user_email,
        ip_address,
        user_agent,
        session_id,
        context,
        created_at,
        block_index
    ) VALUES (
        v_new_id,
        p_tenant_id,
        v_previous_hash,
        v_record_hash,
        p_event_type,
        p_entity_type,
        p_entity_id,
        p_payload,
        p_user_id,
        p_user_email,
        p_ip_address,
        p_user_agent,
        p_session_id,
        p_context,
        v_created_at,
        v_block_index
    );
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNÇÃO PARA VERIFICAR INTEGRIDADE DA CHAIN
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_audit_chain_integrity(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
    is_valid BOOLEAN,
    total_records BIGINT,
    broken_links BIGINT,
    first_broken_at TIMESTAMPTZ,
    verification_time_ms INTEGER
) AS $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_prev_hash TEXT;
    v_expected_hash TEXT;
    v_broken_count BIGINT := 0;
    v_first_broken TIMESTAMPTZ;
    v_total BIGINT := 0;
    r RECORD;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Iterar por todos os registros em ordem
    FOR r IN 
        SELECT 
            a.id,
            a.previous_hash,
            a.record_hash,
            a.payload,
            a.created_at,
            a.tenant_id,
            LAG(a.record_hash) OVER (ORDER BY a.sequence_number) as expected_prev_hash
        FROM audit_log_immutable a
        WHERE a.tenant_id = p_tenant_id
          AND (p_start_date IS NULL OR a.created_at >= p_start_date)
          AND (p_end_date IS NULL OR a.created_at <= p_end_date)
        ORDER BY a.sequence_number
    LOOP
        v_total := v_total + 1;
        
        -- Verificar se previous_hash corresponde ao hash do registro anterior
        IF r.expected_prev_hash IS NOT NULL AND r.previous_hash != r.expected_prev_hash THEN
            v_broken_count := v_broken_count + 1;
            IF v_first_broken IS NULL THEN
                v_first_broken := r.created_at;
            END IF;
        END IF;
        
        -- Verificar se o hash do registro está correto
        v_expected_hash := generate_audit_hash(r.payload, r.previous_hash, r.created_at, r.tenant_id);
        IF v_expected_hash != r.record_hash THEN
            v_broken_count := v_broken_count + 1;
            IF v_first_broken IS NULL THEN
                v_first_broken := r.created_at;
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        (v_broken_count = 0),
        v_total,
        v_broken_count,
        v_first_broken,
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VIEW PARA AUDITORIA RECENTE (ÚLTIMOS 7 DIAS)
-- ============================================================================
CREATE OR REPLACE VIEW v_recent_audit_logs AS
SELECT 
    a.id,
    a.tenant_id,
    a.event_type,
    a.entity_type,
    a.entity_id,
    a.payload,
    a.user_email,
    a.created_at,
    a.record_hash,
    -- Indicador de integridade rápido
    CASE 
        WHEN a.previous_hash = LAG(a.record_hash) OVER (PARTITION BY a.tenant_id ORDER BY a.sequence_number)
             OR a.previous_hash LIKE 'GENESIS_%'
        THEN true
        ELSE false
    END as chain_valid
FROM audit_log_immutable a
WHERE a.created_at >= NOW() - INTERVAL '7 days'
ORDER BY a.created_at DESC;

-- ============================================================================
-- 8. RLS PARA SEGURANÇA
-- ============================================================================
ALTER TABLE audit_log_immutable ENABLE ROW LEVEL SECURITY;

-- Policy de leitura (apenas para o próprio tenant)
DROP POLICY IF EXISTS audit_log_tenant_read ON audit_log_immutable;
CREATE POLICY audit_log_tenant_read ON audit_log_immutable
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policy de inserção (apenas para o próprio tenant, via função)
DROP POLICY IF EXISTS audit_log_tenant_insert ON audit_log_immutable;
CREATE POLICY audit_log_tenant_insert ON audit_log_immutable
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Permitir service_role bypass
DROP POLICY IF EXISTS audit_log_service_role ON audit_log_immutable;
CREATE POLICY audit_log_service_role ON audit_log_immutable
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 9. REGISTRO DO GENESIS (PRIMEIRO BLOCO)
-- ============================================================================
-- Este registro marca o início da cadeia de auditoria para cada tenant
-- INSERT INTO audit_log_immutable via insert_audit_log() para manter integridade

-- ============================================================================
-- 10. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON TABLE audit_log_immutable IS 
    'Tabela WORM (Write Once Read Many) para trilha de auditoria imutável com hash encadeado estilo blockchain';

COMMENT ON COLUMN audit_log_immutable.previous_hash IS 
    'Hash do registro anterior na cadeia - garante sequência inviolável';

COMMENT ON COLUMN audit_log_immutable.record_hash IS 
    'SHA256 do payload + previous_hash + timestamp - garante integridade';

COMMENT ON FUNCTION prevent_audit_modification() IS 
    'Trigger function que impede UPDATE e DELETE na tabela de auditoria (WORM compliance)';

COMMENT ON FUNCTION insert_audit_log IS 
    'Função para inserir registros de auditoria com hash encadeado automático';

COMMENT ON FUNCTION verify_audit_chain_integrity IS 
    'Função para verificar integridade da cadeia de auditoria (detecta adulterações)';

-- ============================================================================
-- FIM DA MIGRATION 001_audit_log_immutable_worm.sql
-- ============================================================================
