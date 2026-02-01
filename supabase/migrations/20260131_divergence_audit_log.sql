-- =====================================================
-- MIGRAÇÃO: Sistema de Auditoria de Divergências
-- Data: 31/01/2026
-- Autor: Dr. Cícero (via Contta)
-- 
-- Propósito: Registrar histórico de divergências entre
-- visão operacional (faturas) e contábil (1.1.2.01)
-- para fins de auditoria e governança.
-- =====================================================

-- Tabela de registro de divergências
CREATE TABLE IF NOT EXISTS divergence_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Período da análise
    reference_month VARCHAR(7) NOT NULL, -- formato: "2025-01"
    
    -- Valores no momento da análise
    operational_total DECIMAL(15,2) NOT NULL, -- soma faturas pendentes/atrasadas + saldo abertura
    accounting_total DECIMAL(15,2) NOT NULL,  -- saldo conta 1.1.2.01
    divergence_amount DECIMAL(15,2) NOT NULL, -- diferença absoluta
    
    -- Detalhamento
    pending_invoices_count INTEGER DEFAULT 0,
    overdue_invoices_count INTEGER DEFAULT 0,
    opening_balance_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Status do tratamento
    status VARCHAR(50) NOT NULL DEFAULT 'em_analise',
    -- Valores possíveis: 'em_analise', 'justificado', 'em_correcao', 'resolvido'
    
    -- Justificativa/Notas
    notes TEXT,
    resolution_notes TEXT,
    
    -- Auditoria
    analyzed_by UUID REFERENCES auth.users(id),
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('em_analise', 'justificado', 'em_correcao', 'resolvido')),
    CONSTRAINT positive_amounts CHECK (
        operational_total >= 0 AND 
        accounting_total >= 0 AND 
        divergence_amount >= 0
    )
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_divergence_audit_tenant 
    ON divergence_audit_log(tenant_id);
    
CREATE INDEX IF NOT EXISTS idx_divergence_audit_month 
    ON divergence_audit_log(reference_month);
    
CREATE INDEX IF NOT EXISTS idx_divergence_audit_status 
    ON divergence_audit_log(status);

CREATE INDEX IF NOT EXISTS idx_divergence_audit_tenant_month 
    ON divergence_audit_log(tenant_id, reference_month);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_divergence_audit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_divergence_audit_updated ON divergence_audit_log;
CREATE TRIGGER trigger_divergence_audit_updated
    BEFORE UPDATE ON divergence_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION update_divergence_audit_timestamp();

-- RLS Policies
ALTER TABLE divergence_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver registros do seu tenant
CREATE POLICY "Users can view own tenant divergences"
    ON divergence_audit_log
    FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

-- Policy: Usuários podem inserir registros no seu tenant
CREATE POLICY "Users can insert own tenant divergences"
    ON divergence_audit_log
    FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

-- Policy: Usuários podem atualizar registros do seu tenant
CREATE POLICY "Users can update own tenant divergences"
    ON divergence_audit_log
    FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

-- =====================================================
-- RPC: Registrar análise de divergência
-- =====================================================
CREATE OR REPLACE FUNCTION register_divergence_analysis(
    p_tenant_id UUID,
    p_reference_month VARCHAR(7),
    p_operational_total DECIMAL(15,2),
    p_accounting_total DECIMAL(15,2),
    p_pending_count INTEGER DEFAULT 0,
    p_overdue_count INTEGER DEFAULT 0,
    p_opening_balance DECIMAL(15,2) DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_divergence DECIMAL(15,2);
    v_id UUID;
BEGIN
    -- Calcular divergência
    v_divergence := ABS(p_operational_total - p_accounting_total);
    
    -- Inserir registro
    INSERT INTO divergence_audit_log (
        tenant_id,
        reference_month,
        operational_total,
        accounting_total,
        divergence_amount,
        pending_invoices_count,
        overdue_invoices_count,
        opening_balance_amount,
        notes,
        analyzed_by,
        status
    ) VALUES (
        p_tenant_id,
        p_reference_month,
        p_operational_total,
        p_accounting_total,
        v_divergence,
        p_pending_count,
        p_overdue_count,
        p_opening_balance,
        p_notes,
        auth.uid(),
        'em_analise'
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- =====================================================
-- RPC: Atualizar status da divergência
-- =====================================================
CREATE OR REPLACE FUNCTION update_divergence_status(
    p_divergence_id UUID,
    p_status VARCHAR(50),
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE divergence_audit_log
    SET 
        status = p_status,
        resolution_notes = COALESCE(p_notes, resolution_notes),
        resolved_by = CASE WHEN p_status = 'resolvido' THEN auth.uid() ELSE resolved_by END,
        resolved_at = CASE WHEN p_status = 'resolvido' THEN NOW() ELSE resolved_at END
    WHERE id = p_divergence_id;
    
    RETURN FOUND;
END;
$$;

-- =====================================================
-- RPC: Buscar histórico de divergências
-- =====================================================
CREATE OR REPLACE FUNCTION get_divergence_history(
    p_tenant_id UUID,
    p_reference_month VARCHAR(7) DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    reference_month VARCHAR(7),
    operational_total DECIMAL(15,2),
    accounting_total DECIMAL(15,2),
    divergence_amount DECIMAL(15,2),
    status VARCHAR(50),
    notes TEXT,
    resolution_notes TEXT,
    analyzed_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.reference_month,
        d.operational_total,
        d.accounting_total,
        d.divergence_amount,
        d.status,
        d.notes,
        d.resolution_notes,
        d.analyzed_at,
        d.resolved_at
    FROM divergence_audit_log d
    WHERE d.tenant_id = p_tenant_id
      AND (p_reference_month IS NULL OR d.reference_month = p_reference_month)
    ORDER BY d.analyzed_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================================
-- Comentários para documentação
-- =====================================================
COMMENT ON TABLE divergence_audit_log IS 
'Registro de auditoria de divergências entre visão operacional (faturas) e contábil (conta 1.1.2.01). 
Parte da governança de dados do Contta conforme BRAND_BOOK seção 11.';

COMMENT ON COLUMN divergence_audit_log.status IS 
'Status do tratamento: em_analise (inicial), justificado (divergência explicada), em_correcao (ajuste em andamento), resolvido (divergência zerada ou aceita)';

COMMENT ON FUNCTION register_divergence_analysis IS 
'Registra uma análise de divergência quando o usuário abre o painel de reconciliação. Cria trilha de auditoria.';

COMMENT ON FUNCTION update_divergence_status IS 
'Permite atualizar o status de uma divergência registrada. Usado pelo contador para documentar tratamento.';
