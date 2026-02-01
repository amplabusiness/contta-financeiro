-- =====================================================
-- MIGRAÇÃO: Versionamento de Documentos - Data Lake
-- Data: 31/01/2026
-- Autor: Dr. Cícero (via Contta)
-- 
-- Propósito: Implementar versionamento com hash encadeado
-- para compliance nível Big Four (auditoria completa)
-- =====================================================

-- Adicionar campos de versionamento avançado
ALTER TABLE document_catalog 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS chain_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS version_reason TEXT,
ADD COLUMN IF NOT EXISTS superseded_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT TRUE;

-- Índice para busca de versões
CREATE INDEX IF NOT EXISTS idx_doc_catalog_chain 
    ON document_catalog(tenant_id, document_type, reference_month, version);

CREATE INDEX IF NOT EXISTS idx_doc_catalog_current 
    ON document_catalog(tenant_id, is_current) WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_doc_catalog_hash 
    ON document_catalog(chain_hash);

-- =====================================================
-- RPC: Criar nova versão de documento
-- =====================================================
CREATE OR REPLACE FUNCTION create_document_version(
    p_tenant_id UUID,
    p_document_type VARCHAR(50),
    p_reference_month VARCHAR(7),
    p_file_path TEXT,
    p_file_size INTEGER,
    p_content_summary TEXT,
    p_key_values JSONB,
    p_tags TEXT[],
    p_content_hash VARCHAR(64),
    p_version_reason TEXT DEFAULT 'Nova análise'
)
RETURNS TABLE (
    new_id VARCHAR(100),
    new_version INTEGER,
    chain_hash VARCHAR(64),
    previous_version_id VARCHAR(100)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_previous_id VARCHAR(100);
    v_previous_hash VARCHAR(64);
    v_previous_version INTEGER;
    v_new_id VARCHAR(100);
    v_new_version INTEGER;
    v_chain_hash VARCHAR(64);
    v_timestamp BIGINT;
BEGIN
    -- Buscar versão anterior (se existir)
    SELECT 
        id, 
        chain_hash, 
        version 
    INTO 
        v_previous_id, 
        v_previous_hash, 
        v_previous_version
    FROM document_catalog
    WHERE tenant_id = p_tenant_id
      AND document_type = p_document_type
      AND reference_month = p_reference_month
      AND is_current = TRUE
    ORDER BY version DESC
    LIMIT 1;

    -- Calcular nova versão
    v_new_version := COALESCE(v_previous_version, 0) + 1;
    
    -- Gerar timestamp
    v_timestamp := EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
    
    -- Gerar novo ID
    v_new_id := 'div_' || v_timestamp;
    
    -- Calcular hash da cadeia (hash anterior + hash atual)
    -- Formato: SHA256(previous_chain_hash || content_hash)
    IF v_previous_hash IS NOT NULL THEN
        v_chain_hash := encode(
            sha256((v_previous_hash || p_content_hash)::bytea),
            'hex'
        );
    ELSE
        -- Primeira versão: chain_hash = content_hash
        v_chain_hash := p_content_hash;
    END IF;

    -- Marcar versão anterior como não-atual
    IF v_previous_id IS NOT NULL THEN
        UPDATE document_catalog
        SET 
            is_current = FALSE,
            superseded_by = v_new_id,
            updated_at = NOW()
        WHERE id = v_previous_id;
    END IF;

    -- Inserir nova versão
    INSERT INTO document_catalog (
        id,
        tenant_id,
        document_type,
        reference_month,
        file_path,
        file_size,
        content_summary,
        key_values,
        tags,
        version,
        previous_version_id,
        content_hash,
        previous_hash,
        chain_hash,
        version_reason,
        is_current,
        generated_at
    ) VALUES (
        v_new_id,
        p_tenant_id,
        p_document_type,
        p_reference_month,
        p_file_path,
        p_file_size,
        p_content_summary,
        p_key_values,
        p_tags,
        v_new_version,
        v_previous_id,
        p_content_hash,
        v_previous_hash,
        v_chain_hash,
        p_version_reason,
        TRUE,
        NOW()
    );

    RETURN QUERY SELECT v_new_id, v_new_version, v_chain_hash, v_previous_id;
END;
$$;

-- =====================================================
-- RPC: Obter histórico de versões de um documento
-- =====================================================
CREATE OR REPLACE FUNCTION get_document_versions(
    p_tenant_id UUID,
    p_document_type VARCHAR(50),
    p_reference_month VARCHAR(7)
)
RETURNS TABLE (
    id VARCHAR(100),
    version INTEGER,
    generated_at TIMESTAMP WITH TIME ZONE,
    version_reason TEXT,
    content_hash VARCHAR(64),
    chain_hash VARCHAR(64),
    is_current BOOLEAN,
    key_values JSONB,
    file_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.version,
        d.generated_at,
        d.version_reason,
        d.content_hash,
        d.chain_hash,
        d.is_current,
        d.key_values,
        d.file_path
    FROM document_catalog d
    WHERE d.tenant_id = p_tenant_id
      AND d.document_type = p_document_type
      AND d.reference_month = p_reference_month
    ORDER BY d.version DESC;
END;
$$;

-- =====================================================
-- RPC: Verificar integridade da cadeia de versões
-- =====================================================
CREATE OR REPLACE FUNCTION verify_version_chain(
    p_tenant_id UUID,
    p_document_type VARCHAR(50),
    p_reference_month VARCHAR(7)
)
RETURNS TABLE (
    version INTEGER,
    expected_chain_hash VARCHAR(64),
    actual_chain_hash VARCHAR(64),
    is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_expected_hash VARCHAR(64);
    v_previous_chain VARCHAR(64) := NULL;
BEGIN
    FOR v_record IN 
        SELECT 
            d.version,
            d.content_hash,
            d.chain_hash
        FROM document_catalog d
        WHERE d.tenant_id = p_tenant_id
          AND d.document_type = p_document_type
          AND d.reference_month = p_reference_month
        ORDER BY d.version ASC
    LOOP
        -- Calcular hash esperado
        IF v_previous_chain IS NULL THEN
            v_expected_hash := v_record.content_hash;
        ELSE
            v_expected_hash := encode(
                sha256((v_previous_chain || v_record.content_hash)::bytea),
                'hex'
            );
        END IF;

        version := v_record.version;
        expected_chain_hash := v_expected_hash;
        actual_chain_hash := v_record.chain_hash;
        is_valid := (v_expected_hash = v_record.chain_hash);
        
        RETURN NEXT;

        v_previous_chain := v_record.chain_hash;
    END LOOP;
END;
$$;

-- =====================================================
-- RPC: Timeline de decisões do Dr. Cícero
-- =====================================================
CREATE OR REPLACE FUNCTION get_decision_timeline(
    p_tenant_id UUID,
    p_months_back INTEGER DEFAULT 12
)
RETURNS TABLE (
    reference_month VARCHAR(7),
    version_count INTEGER,
    first_analysis TIMESTAMP WITH TIME ZONE,
    last_analysis TIMESTAMP WITH TIME ZONE,
    final_status VARCHAR(50),
    divergence_amount DECIMAL(15,2),
    decision_summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE;
BEGIN
    v_start_date := CURRENT_DATE - (p_months_back || ' months')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        d.reference_month,
        COUNT(*)::INTEGER as version_count,
        MIN(d.generated_at) as first_analysis,
        MAX(d.generated_at) as last_analysis,
        (
            SELECT CASE 
                WHEN 'resolvido' = ANY(tags) THEN 'resolvido'
                WHEN 'pendente' = ANY(tags) THEN 'pendente'
                ELSE 'sem_divergencia'
            END
            FROM document_catalog 
            WHERE tenant_id = p_tenant_id 
              AND document_type = 'divergence_report'
              AND reference_month = d.reference_month
              AND is_current = TRUE
            LIMIT 1
        ) as final_status,
        (
            SELECT (key_values->>'divergence_amount')::DECIMAL(15,2)
            FROM document_catalog 
            WHERE tenant_id = p_tenant_id 
              AND document_type = 'divergence_report'
              AND reference_month = d.reference_month
              AND is_current = TRUE
            LIMIT 1
        ) as divergence_amount,
        STRING_AGG(
            DISTINCT d.version_reason, 
            ' → ' 
            ORDER BY d.version_reason
        ) as decision_summary
    FROM document_catalog d
    WHERE d.tenant_id = p_tenant_id
      AND d.document_type = 'divergence_report'
      AND (d.reference_month || '-01')::DATE >= v_start_date
    GROUP BY d.reference_month
    ORDER BY d.reference_month DESC;
END;
$$;

-- =====================================================
-- Comentários
-- =====================================================
COMMENT ON COLUMN document_catalog.content_hash IS 
'SHA-256 do conteúdo do documento para verificação de integridade.';

COMMENT ON COLUMN document_catalog.chain_hash IS 
'Hash encadeado: SHA-256(previous_chain_hash + content_hash). Garante imutabilidade da cadeia.';

COMMENT ON COLUMN document_catalog.version_reason IS 
'Motivo da nova versão (ex: "Reavaliação", "Correção", "Encerramento").';

COMMENT ON COLUMN document_catalog.is_current IS 
'TRUE apenas para a versão mais recente. Facilita queries de estado atual.';

COMMENT ON FUNCTION create_document_version IS 
'Cria nova versão com hash encadeado. Mantém cadeia de custódia para compliance.';

COMMENT ON FUNCTION verify_version_chain IS 
'Verifica integridade da cadeia de versões. Detecta alterações não autorizadas.';

COMMENT ON FUNCTION get_decision_timeline IS 
'Timeline de decisões do Dr. Cícero para análise de padrões e compliance.';
