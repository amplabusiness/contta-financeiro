-- ============================================================================
-- TABELA DE RESULTADOS DE AUDITORIA — DR. CÍCERO
-- ============================================================================
-- 
-- Autor: Sérgio Carneiro Leão (CRC/GO 008074)
-- Data: 30/01/2026
-- 
-- Esta tabela armazena os resultados das auditorias mensais automatizadas
-- executadas pelo Dr. Cícero.
-- ============================================================================

-- Criar tabela de resultados
CREATE TABLE IF NOT EXISTS audit_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    protocolo VARCHAR(50) NOT NULL,
    competencia DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('APPROVED', 'INVALIDATED', 'PENDING')),
    resultado JSONB NOT NULL DEFAULT '{}',
    parecer TEXT,
    hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    
    -- Garantir unicidade por tenant e competência
    CONSTRAINT uq_audit_results_tenant_competencia UNIQUE (tenant_id, competencia, protocolo)
);

-- Comentários
COMMENT ON TABLE audit_results IS 'Resultados das auditorias mensais do Dr. Cícero';
COMMENT ON COLUMN audit_results.protocolo IS 'Identificador único da auditoria (AUD-YYYYMM-XXX)';
COMMENT ON COLUMN audit_results.competencia IS 'Mês/ano da competência auditada (primeiro dia do mês)';
COMMENT ON COLUMN audit_results.status IS 'APPROVED = fechamento liberado, INVALIDATED = bloqueado';
COMMENT ON COLUMN audit_results.resultado IS 'JSON completo com testes, inconsistências e checklist';
COMMENT ON COLUMN audit_results.parecer IS 'Texto do parecer técnico';
COMMENT ON COLUMN audit_results.hash IS 'Hash SHA256 para verificação de integridade';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_results_tenant ON audit_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_competencia ON audit_results(competencia);
CREATE INDEX IF NOT EXISTS idx_audit_results_status ON audit_results(status);
CREATE INDEX IF NOT EXISTS idx_audit_results_protocolo ON audit_results(protocolo);

-- RLS (Row Level Security)
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem auditorias do próprio tenant
CREATE POLICY audit_results_tenant_isolation ON audit_results
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Policy: service role pode tudo
CREATE POLICY audit_results_service_role ON audit_results
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TABELA DE LOG DE EXECUÇÃO
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    competencia DATE NOT NULL,
    prompt_version VARCHAR(20) DEFAULT '1.0',
    prompt_hash VARCHAR(64),
    context_hash VARCHAR(64),
    execution_time_ms INTEGER,
    testes_executados INTEGER DEFAULT 0,
    inconsistencias_encontradas INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE audit_execution_log IS 'Log técnico de execução das auditorias';

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_execution_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_competencia ON audit_execution_log(competencia);

-- RLS
ALTER TABLE audit_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_tenant_isolation ON audit_execution_log
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY audit_log_service_role ON audit_execution_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- FUNÇÃO: Verificar se competência pode ser fechada
-- ============================================================================

CREATE OR REPLACE FUNCTION can_close_month(
    p_tenant_id UUID,
    p_competencia DATE
) RETURNS BOOLEAN AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT status INTO v_status
    FROM audit_results
    WHERE tenant_id = p_tenant_id
      AND competencia = date_trunc('month', p_competencia)::date
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN COALESCE(v_status, 'PENDING') = 'APPROVED';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_close_month IS 'Retorna TRUE se a competência foi aprovada pelo Dr. Cícero';

-- ============================================================================
-- FUNÇÃO: Obter última auditoria da competência
-- ============================================================================

CREATE OR REPLACE FUNCTION get_last_audit(
    p_tenant_id UUID,
    p_competencia DATE
) RETURNS TABLE (
    protocolo VARCHAR(50),
    status VARCHAR(20),
    parecer TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    resultado JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ar.protocolo,
        ar.status,
        ar.parecer,
        ar.created_at,
        ar.resultado
    FROM audit_results ar
    WHERE ar.tenant_id = p_tenant_id
      AND ar.competencia = date_trunc('month', p_competencia)::date
    ORDER BY ar.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Bloquear fechamento se auditoria não aprovada
-- ============================================================================

-- Esta função seria chamada antes de qualquer operação de fechamento
CREATE OR REPLACE FUNCTION check_audit_before_close()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT can_close_month(NEW.tenant_id, NEW.competencia) THEN
        RAISE EXCEPTION 'Fechamento bloqueado: competência não aprovada pelo Dr. Cícero. Execute a auditoria primeiro.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT para funções
-- ============================================================================

GRANT EXECUTE ON FUNCTION can_close_month TO authenticated;
GRANT EXECUTE ON FUNCTION get_last_audit TO authenticated;
