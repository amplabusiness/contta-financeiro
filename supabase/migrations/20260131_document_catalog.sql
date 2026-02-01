-- =====================================================
-- MIGRAÇÃO: Catálogo de Documentos - Data Lake
-- Data: 31/01/2026
-- Autor: Dr. Cícero (via Contta)
-- 
-- Propósito: Indexar documentos do Data Lake para
-- busca semântica e RAG (Retrieval-Augmented Generation)
-- =====================================================

-- Tabela de catálogo de documentos
CREATE TABLE IF NOT EXISTS document_catalog (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Classificação
    document_type VARCHAR(50) NOT NULL,
    -- Tipos: 'divergence_report', 'balancete', 'dre', 'conciliacao'
    
    reference_month VARCHAR(7) NOT NULL, -- "2025-01"
    
    -- Localização
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    
    -- Conteúdo para RAG
    content_summary TEXT NOT NULL,
    key_values JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Versionamento
    version INTEGER DEFAULT 1,
    previous_version_id VARCHAR(100),
    
    -- Indexação para embeddings
    is_indexed BOOLEAN DEFAULT FALSE,
    indexed_at TIMESTAMP WITH TIME ZONE,
    chunk_count INTEGER DEFAULT 0,
    embedding_model VARCHAR(100),
    
    -- Auditoria
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    generated_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_doc_catalog_tenant 
    ON document_catalog(tenant_id);

CREATE INDEX IF NOT EXISTS idx_doc_catalog_type 
    ON document_catalog(document_type);

CREATE INDEX IF NOT EXISTS idx_doc_catalog_month 
    ON document_catalog(reference_month);

CREATE INDEX IF NOT EXISTS idx_doc_catalog_tenant_type 
    ON document_catalog(tenant_id, document_type);

CREATE INDEX IF NOT EXISTS idx_doc_catalog_tenant_month 
    ON document_catalog(tenant_id, reference_month);

-- Índice GIN para busca em tags
CREATE INDEX IF NOT EXISTS idx_doc_catalog_tags 
    ON document_catalog USING GIN(tags);

-- Índice GIN para busca em key_values
CREATE INDEX IF NOT EXISTS idx_doc_catalog_key_values 
    ON document_catalog USING GIN(key_values);

-- Índice para busca textual no resumo
CREATE INDEX IF NOT EXISTS idx_doc_catalog_summary_search 
    ON document_catalog USING GIN(to_tsvector('portuguese', content_summary));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_doc_catalog_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_doc_catalog_updated ON document_catalog;
CREATE TRIGGER trigger_doc_catalog_updated
    BEFORE UPDATE ON document_catalog
    FOR EACH ROW
    EXECUTE FUNCTION update_doc_catalog_timestamp();

-- RLS Policies
ALTER TABLE document_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant documents"
    ON document_catalog
    FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own tenant documents"
    ON document_catalog
    FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update own tenant documents"
    ON document_catalog
    FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

-- =====================================================
-- RPC: Buscar documentos para RAG
-- =====================================================
CREATE OR REPLACE FUNCTION search_documents_for_rag(
    p_tenant_id UUID,
    p_query TEXT,
    p_document_type VARCHAR(50) DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id VARCHAR(100),
    document_type VARCHAR(50),
    reference_month VARCHAR(7),
    file_path TEXT,
    content_summary TEXT,
    key_values JSONB,
    tags TEXT[],
    relevance FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.document_type,
        d.reference_month,
        d.file_path,
        d.content_summary,
        d.key_values,
        d.tags,
        ts_rank(to_tsvector('portuguese', d.content_summary), plainto_tsquery('portuguese', p_query)) as relevance
    FROM document_catalog d
    WHERE d.tenant_id = p_tenant_id
      AND (p_document_type IS NULL OR d.document_type = p_document_type)
      AND (p_tags IS NULL OR d.tags && p_tags)
      AND (
          p_query IS NULL 
          OR p_query = '' 
          OR to_tsvector('portuguese', d.content_summary) @@ plainto_tsquery('portuguese', p_query)
      )
    ORDER BY relevance DESC, d.generated_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================================
-- RPC: Obter contexto histórico para Dr. Cícero
-- =====================================================
CREATE OR REPLACE FUNCTION get_divergence_context(
    p_tenant_id UUID,
    p_reference_month VARCHAR(7),
    p_months_back INTEGER DEFAULT 6
)
RETURNS TABLE (
    reference_month VARCHAR(7),
    divergence_amount DECIMAL(15,2),
    status VARCHAR(50),
    tags TEXT[],
    content_summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE;
BEGIN
    -- Calcular data inicial (X meses atrás)
    v_start_date := (p_reference_month || '-01')::DATE - (p_months_back || ' months')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        d.reference_month,
        (d.key_values->>'divergence_amount')::DECIMAL(15,2) as divergence_amount,
        CASE 
            WHEN 'resolvido' = ANY(d.tags) THEN 'resolvido'
            WHEN 'pendente' = ANY(d.tags) THEN 'pendente'
            ELSE 'sem_divergencia'
        END as status,
        d.tags,
        d.content_summary
    FROM document_catalog d
    WHERE d.tenant_id = p_tenant_id
      AND d.document_type = 'divergence_report'
      AND (d.reference_month || '-01')::DATE >= v_start_date
      AND d.reference_month <= p_reference_month
    ORDER BY d.reference_month DESC;
END;
$$;

-- =====================================================
-- Comentários para documentação
-- =====================================================
COMMENT ON TABLE document_catalog IS 
'Catálogo de documentos do Data Lake para indexação e busca semântica (RAG). 
Armazena metadados estruturados para uso pelo Dr. Cícero.';

COMMENT ON COLUMN document_catalog.content_summary IS 
'Resumo textual do documento para busca full-text e geração de contexto RAG.';

COMMENT ON COLUMN document_catalog.key_values IS 
'Valores numéricos e categóricos extraídos do documento para consultas estruturadas.';

COMMENT ON COLUMN document_catalog.tags IS 
'Tags de classificação para filtragem rápida e clustering de documentos similares.';

COMMENT ON FUNCTION search_documents_for_rag IS 
'Busca documentos relevantes para contexto RAG do Dr. Cícero. Usa busca full-text em português.';

COMMENT ON FUNCTION get_divergence_context IS 
'Retorna histórico de divergências para análise de padrões pelo Dr. Cícero.';
