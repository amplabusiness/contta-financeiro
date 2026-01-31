-- ============================================================================
-- MIGRATION: Separação Banco × Contabilidade × Honorários
-- Data: 30/01/2026
-- Autor: Dr. Cícero / Dev Team
-- Descrição: Implementa estrutura para Super-Conciliação com split,
--            reclassificação e aprendizado assistido de IA
-- ============================================================================

-- ============================================================================
-- 1. TABELA: accounting_reclassifications
-- Armazena reclassificações de lançamentos (split contábil)
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting_reclassifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Lançamento original (pai, imutável)
    parent_entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE RESTRICT,
    
    -- Status do workflow
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',      -- Rascunho editável
        'pending',    -- Aguardando aprovação Dr. Cícero
        'approved',   -- Aprovado, pronto para aplicar
        'rejected',   -- Rejeitado, volta para rascunho
        'applied'     -- Aplicado (novos lançamentos criados)
    )),
    
    -- Dados financeiros
    total_amount DECIMAL(15,2) NOT NULL,
    
    -- Auditoria
    justification TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Revisão
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    -- Aplicação
    applied_at TIMESTAMP WITH TIME ZONE,
    
    -- Índices
    CONSTRAINT positive_total_amount CHECK (total_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_reclassifications_tenant ON accounting_reclassifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reclassifications_parent ON accounting_reclassifications(parent_entry_id);
CREATE INDEX IF NOT EXISTS idx_reclassifications_status ON accounting_reclassifications(status);
CREATE INDEX IF NOT EXISTS idx_reclassifications_created ON accounting_reclassifications(created_at DESC);

COMMENT ON TABLE accounting_reclassifications IS 'Reclassificações contábeis (split) com trilha de auditoria';

-- ============================================================================
-- 2. TABELA: accounting_reclassification_lines
-- Linhas individuais de cada reclassificação
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting_reclassification_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    reclassification_id UUID NOT NULL REFERENCES accounting_reclassifications(id) ON DELETE CASCADE,
    
    -- Conta destino
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    
    -- Valor
    amount DECIMAL(15,2) NOT NULL,
    
    -- Descrição específica da linha
    description TEXT,
    
    -- Ordem de exibição
    line_order INTEGER DEFAULT 1,
    
    CONSTRAINT positive_line_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_reclass_lines_reclass ON accounting_reclassification_lines(reclassification_id);
CREATE INDEX IF NOT EXISTS idx_reclass_lines_account ON accounting_reclassification_lines(account_id);

COMMENT ON TABLE accounting_reclassification_lines IS 'Linhas de reclassificação (destinos do split)';

-- ============================================================================
-- 3. TABELA: classification_rules
-- Regras de aprendizado da IA para classificação automática
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Nome da regra (para identificação humana)
    rule_name VARCHAR(100) NOT NULL,
    
    -- ============================================
    -- PADRÕES DE IDENTIFICAÇÃO
    -- ============================================
    
    -- Keywords na descrição (array de termos)
    description_keywords TEXT[],
    
    -- Faixa de valor
    amount_min DECIMAL(15,2),
    amount_max DECIMAL(15,2),
    
    -- Nome do pagador (ILIKE)
    payer_name_like TEXT,
    
    -- CNPJ ou CPF específico
    cnpj_cpf VARCHAR(20),
    
    -- Tipo de transação
    transaction_type VARCHAR(10) CHECK (transaction_type IN ('credit', 'debit', 'both')),
    
    -- ============================================
    -- CLASSIFICAÇÃO SUGERIDA
    -- ============================================
    
    destination_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    
    -- ============================================
    -- ESTATÍSTICAS DE APRENDIZADO
    -- ============================================
    
    times_applied INTEGER DEFAULT 0,
    times_approved INTEGER DEFAULT 0,
    times_rejected INTEGER DEFAULT 0,
    confidence_score DECIMAL(5,2) DEFAULT 50.00 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    last_applied_at TIMESTAMP WITH TIME ZONE,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- ============================================
    -- CONTROLE
    -- ============================================
    
    status VARCHAR(20) DEFAULT 'learning' CHECK (status IN (
        'learning',    -- Ainda aprendendo (< 70% confiança)
        'semi_auto',   -- Semi-automático (70-90% confiança)
        'auto',        -- Totalmente automático (> 90% + validação Dr. Cícero)
        'disabled'     -- Desabilitada
    )),
    
    -- Quem criou (pode ser sistema ou usuário)
    created_by UUID,
    -- Quem validou (obrigatório para status 'auto')
    approved_by UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para validação
    CONSTRAINT valid_amount_range CHECK (
        (amount_min IS NULL AND amount_max IS NULL) OR
        (amount_min IS NULL AND amount_max IS NOT NULL) OR
        (amount_min IS NOT NULL AND amount_max IS NULL) OR
        (amount_min <= amount_max)
    )
);

CREATE INDEX IF NOT EXISTS idx_rules_tenant ON classification_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rules_status ON classification_rules(status);
CREATE INDEX IF NOT EXISTS idx_rules_destination ON classification_rules(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_rules_confidence ON classification_rules(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_rules_keywords ON classification_rules USING GIN(description_keywords);

COMMENT ON TABLE classification_rules IS 'Regras de aprendizado assistido para classificação automática';

-- ============================================================================
-- 4. TABELA: classification_rule_applications
-- Histórico de aplicação de regras (para auditoria e aprendizado)
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_rule_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    rule_id UUID NOT NULL REFERENCES classification_rules(id) ON DELETE CASCADE,
    bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    
    -- Resultado (NULL = pendente, TRUE = aprovado, FALSE = rejeitado)
    was_approved BOOLEAN,
    
    -- Lançamento criado (se aplicado)
    entry_id UUID REFERENCES accounting_entries(id),
    
    -- Revisão
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicatas
    CONSTRAINT unique_rule_transaction UNIQUE (rule_id, bank_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_rule ON classification_rule_applications(rule_id);
CREATE INDEX IF NOT EXISTS idx_applications_transaction ON classification_rule_applications(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_applications_pending ON classification_rule_applications(was_approved) WHERE was_approved IS NULL;

COMMENT ON TABLE classification_rule_applications IS 'Histórico de aplicação de regras de classificação';

-- ============================================================================
-- 5. VIEW: vw_classification_rules_with_account
-- Regras com dados da conta destino
-- ============================================================================

CREATE OR REPLACE VIEW vw_classification_rules_with_account AS
SELECT 
    r.*,
    c.code AS destination_account_code,
    c.name AS destination_account_name,
    c.type AS destination_account_type
FROM classification_rules r
JOIN chart_of_accounts c ON c.id = r.destination_account_id;

-- ============================================================================
-- 6. VIEW: vw_pending_reclassifications
-- Reclassificações pendentes de aprovação
-- ============================================================================

CREATE OR REPLACE VIEW vw_pending_reclassifications AS
SELECT 
    r.*,
    ae.description AS parent_description,
    ae.entry_date AS parent_date,
    ae.internal_code AS parent_internal_code,
    COUNT(rl.id) AS lines_count
FROM accounting_reclassifications r
JOIN accounting_entries ae ON ae.id = r.parent_entry_id
LEFT JOIN accounting_reclassification_lines rl ON rl.reclassification_id = r.id
WHERE r.status = 'pending'
GROUP BY r.id, ae.id;

-- ============================================================================
-- 7. FUNÇÃO: rpc_create_reclassification
-- Cria uma reclassificação com validação de totais
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_create_reclassification(
    p_tenant_id UUID,
    p_parent_entry_id UUID,
    p_lines JSONB,
    p_justification TEXT,
    p_created_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reclassification_id UUID;
    v_total DECIMAL(15,2);
    v_parent_amount DECIMAL(15,2);
    v_line JSONB;
    v_line_order INTEGER := 1;
BEGIN
    -- Verificar total do lançamento pai
    SELECT GREATEST(COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)) INTO v_parent_amount
    FROM accounting_entry_lines
    WHERE entry_id = p_parent_entry_id
      AND tenant_id = p_tenant_id;
    
    IF v_parent_amount IS NULL OR v_parent_amount = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Lançamento pai não encontrado ou sem valor'
        );
    END IF;
    
    -- Calcular total das linhas
    SELECT COALESCE(SUM((line->>'amount')::DECIMAL), 0) INTO v_total
    FROM jsonb_array_elements(p_lines) AS line;
    
    -- Validar que soma é igual ao original
    IF ABS(v_total - v_parent_amount) > 0.01 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Total das linhas (%s) difere do lançamento original (%s)', 
                           v_total::TEXT, v_parent_amount::TEXT)
        );
    END IF;
    
    -- Criar reclassificação
    INSERT INTO accounting_reclassifications (
        tenant_id, parent_entry_id, total_amount, justification, created_by, status
    )
    VALUES (p_tenant_id, p_parent_entry_id, v_total, p_justification, p_created_by, 'draft')
    RETURNING id INTO v_reclassification_id;
    
    -- Criar linhas
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO accounting_reclassification_lines (
            tenant_id, reclassification_id, account_id, amount, description, line_order
        )
        VALUES (
            p_tenant_id,
            v_reclassification_id,
            (v_line->>'account_id')::UUID,
            (v_line->>'amount')::DECIMAL,
            COALESCE(v_line->>'description', ''),
            v_line_order
        );
        v_line_order := v_line_order + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'reclassification_id', v_reclassification_id,
        'lines_count', v_line_order - 1,
        'total_amount', v_total
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- 8. FUNÇÃO: rpc_approve_reclassification
-- Aprova uma reclassificação (Dr. Cícero)
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_approve_reclassification(
    p_reclassification_id UUID,
    p_reviewed_by UUID,
    p_review_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reclass RECORD;
BEGIN
    -- Buscar reclassificação
    SELECT * INTO v_reclass 
    FROM accounting_reclassifications 
    WHERE id = p_reclassification_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reclassificação não encontrada');
    END IF;
    
    IF v_reclass.status NOT IN ('draft', 'pending') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reclassificação não pode ser aprovada neste status');
    END IF;
    
    -- Aprovar
    UPDATE accounting_reclassifications
    SET 
        status = 'approved',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = COALESCE(p_review_notes, '')
    WHERE id = p_reclassification_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Reclassificação aprovada. Use rpc_apply_reclassification para aplicar.'
    );
END;
$$;

-- ============================================================================
-- 9. FUNÇÃO: rpc_reject_reclassification
-- Rejeita uma reclassificação
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_reject_reclassification(
    p_reclassification_id UUID,
    p_reviewed_by UUID,
    p_review_notes TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_review_notes IS NULL OR p_review_notes = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Motivo da rejeição é obrigatório');
    END IF;
    
    UPDATE accounting_reclassifications
    SET 
        status = 'rejected',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_review_notes
    WHERE id = p_reclassification_id
      AND status IN ('draft', 'pending');
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reclassificação não encontrada ou já processada');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Reclassificação rejeitada');
END;
$$;

-- ============================================================================
-- 10. FUNÇÃO: rpc_find_matching_rule
-- Encontra regra de classificação que corresponde a uma transação
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_find_matching_rule(
    p_tenant_id UUID,
    p_amount DECIMAL,
    p_description TEXT,
    p_transaction_type VARCHAR(10)
) RETURNS TABLE (
    rule_id UUID,
    rule_name VARCHAR(100),
    destination_account_id UUID,
    destination_account_code VARCHAR(20),
    destination_account_name VARCHAR(200),
    confidence_score DECIMAL(5,2),
    status VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id AS rule_id,
        r.rule_name,
        r.destination_account_id,
        c.code AS destination_account_code,
        c.name AS destination_account_name,
        r.confidence_score,
        r.status
    FROM classification_rules r
    JOIN chart_of_accounts c ON c.id = r.destination_account_id
    WHERE r.tenant_id = p_tenant_id
      AND r.status IN ('learning', 'semi_auto', 'auto')
      -- Filtro por tipo de transação
      AND (r.transaction_type IS NULL OR r.transaction_type = 'both' OR r.transaction_type = p_transaction_type)
      -- Filtro por faixa de valor
      AND (r.amount_min IS NULL OR ABS(p_amount) >= r.amount_min)
      AND (r.amount_max IS NULL OR ABS(p_amount) <= r.amount_max)
      -- Filtro por keywords na descrição
      AND (
          r.description_keywords IS NULL 
          OR r.description_keywords = '{}' 
          OR EXISTS (
              SELECT 1 FROM unnest(r.description_keywords) kw 
              WHERE LOWER(p_description) LIKE '%' || LOWER(kw) || '%'
          )
      )
    ORDER BY r.confidence_score DESC, r.times_approved DESC
    LIMIT 3;
END;
$$;

-- ============================================================================
-- 11. FUNÇÃO: rpc_apply_classification_rule
-- Registra aplicação de uma regra e atualiza estatísticas
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_apply_classification_rule(
    p_tenant_id UUID,
    p_rule_id UUID,
    p_bank_transaction_id UUID,
    p_entry_id UUID DEFAULT NULL,
    p_approved BOOLEAN DEFAULT NULL,
    p_reviewed_by UUID DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rule RECORD;
    v_new_confidence DECIMAL(5,2);
    v_new_status VARCHAR(20);
BEGIN
    -- Buscar regra
    SELECT * INTO v_rule FROM classification_rules WHERE id = p_rule_id AND tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Regra não encontrada');
    END IF;
    
    -- Registrar aplicação
    INSERT INTO classification_rule_applications (
        tenant_id, rule_id, bank_transaction_id, entry_id, was_approved, 
        reviewed_by, reviewed_at, rejection_reason
    )
    VALUES (
        p_tenant_id, p_rule_id, p_bank_transaction_id, p_entry_id, p_approved,
        p_reviewed_by, CASE WHEN p_reviewed_by IS NOT NULL THEN NOW() ELSE NULL END,
        p_rejection_reason
    )
    ON CONFLICT (rule_id, bank_transaction_id) 
    DO UPDATE SET 
        was_approved = EXCLUDED.was_approved,
        reviewed_by = EXCLUDED.reviewed_by,
        reviewed_at = EXCLUDED.reviewed_at,
        rejection_reason = EXCLUDED.rejection_reason;
    
    -- Atualizar estatísticas da regra
    UPDATE classification_rules
    SET 
        times_applied = times_applied + 1,
        times_approved = times_approved + CASE WHEN p_approved = true THEN 1 ELSE 0 END,
        times_rejected = times_rejected + CASE WHEN p_approved = false THEN 1 ELSE 0 END,
        last_applied_at = NOW(),
        last_reviewed_at = CASE WHEN p_reviewed_by IS NOT NULL THEN NOW() ELSE last_reviewed_at END,
        updated_at = NOW()
    WHERE id = p_rule_id;
    
    -- Recalcular confiança
    SELECT 
        CASE 
            WHEN times_applied > 0 THEN 
                LEAST(100, (times_approved::DECIMAL / GREATEST(times_applied, 1) * 100))
            ELSE 50 
        END
    INTO v_new_confidence
    FROM classification_rules WHERE id = p_rule_id;
    
    -- Determinar novo status
    v_new_status := CASE
        WHEN v_new_confidence >= 90 AND (SELECT times_approved FROM classification_rules WHERE id = p_rule_id) >= 5 THEN 'auto'
        WHEN v_new_confidence >= 70 AND (SELECT times_approved FROM classification_rules WHERE id = p_rule_id) >= 3 THEN 'semi_auto'
        ELSE 'learning'
    END;
    
    -- Atualizar confiança e status
    UPDATE classification_rules
    SET 
        confidence_score = v_new_confidence,
        status = v_new_status
    WHERE id = p_rule_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'new_confidence', v_new_confidence,
        'new_status', v_new_status
    );
END;
$$;

-- ============================================================================
-- 12. FUNÇÃO: rpc_create_classification_rule
-- Cria nova regra de aprendizado a partir de uma classificação manual
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_create_classification_rule(
    p_tenant_id UUID,
    p_rule_name VARCHAR(100),
    p_destination_account_id UUID,
    p_created_by UUID,
    p_description_keywords TEXT[] DEFAULT NULL,
    p_amount_min DECIMAL DEFAULT NULL,
    p_amount_max DECIMAL DEFAULT NULL,
    p_payer_name_like TEXT DEFAULT NULL,
    p_cnpj_cpf VARCHAR(20) DEFAULT NULL,
    p_transaction_type VARCHAR(10) DEFAULT 'both'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rule_id UUID;
BEGIN
    -- Validar que existe pelo menos um critério
    IF (p_description_keywords IS NULL OR p_description_keywords = '{}')
       AND p_amount_min IS NULL 
       AND p_amount_max IS NULL
       AND p_payer_name_like IS NULL
       AND p_cnpj_cpf IS NULL
    THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Regra deve ter pelo menos um critério de identificação'
        );
    END IF;
    
    INSERT INTO classification_rules (
        tenant_id, rule_name, description_keywords, amount_min, amount_max,
        payer_name_like, cnpj_cpf, transaction_type, destination_account_id,
        created_by, status
    )
    VALUES (
        p_tenant_id, p_rule_name, p_description_keywords, p_amount_min, p_amount_max,
        p_payer_name_like, p_cnpj_cpf, p_transaction_type, p_destination_account_id,
        p_created_by, 'learning'
    )
    RETURNING id INTO v_rule_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'rule_id', v_rule_id,
        'message', 'Regra criada em modo aprendizado'
    );
END;
$$;

-- ============================================================================
-- 13. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON accounting_reclassifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON accounting_reclassification_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON classification_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON classification_rule_applications TO authenticated;

GRANT SELECT ON vw_classification_rules_with_account TO authenticated;
GRANT SELECT ON vw_pending_reclassifications TO authenticated;

GRANT EXECUTE ON FUNCTION rpc_create_reclassification TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_approve_reclassification TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_reject_reclassification TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_find_matching_rule TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_apply_classification_rule TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_create_classification_rule TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================

COMMENT ON SCHEMA public IS 'Migration: Separação Banco/Contabilidade/Honorários - 30/01/2026';
