-- ============================================================================
-- MIGRATION: Conformidade NBC 31 (Revisão) e NBC TG 51 (IFRS 18)
-- Data: 30/01/2026
-- Autor: Dr. Cícero - Contador Responsável
-- Base Legal: NBC nº 31 (Revisão) – DOU 22/12/2025
--             NBC TG nº 51 (IFRS 18) – DOU 22/12/2025
-- ============================================================================

-- ============================================================================
-- FUNDAMENTAÇÃO LEGAL:
-- 
-- NBC nº 31 (Revisão):
--   - Reforça clareza de classificação
--   - Proíbe contas genéricas na prática
--   - Exige contas analíticas suficientes para compreensão
--
-- NBC TG nº 51 (IFRS 18):
--   - Introduz estrutura padronizada de apresentação
--   - Separa: Resultado Operacional / Financeiro / Não Recorrentes
--   - Exige melhor leitura gerencial
-- ============================================================================

-- Tenant ID da Ampla Contabilidade
DO $$ 
BEGIN
    PERFORM set_config('app.tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421', false);
END $$;

-- ============================================================================
-- ETAPA 1: Adicionar coluna de status se não existir
-- ============================================================================

DO $$
BEGIN
    -- Verificar se a coluna 'status' já existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chart_of_accounts' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE chart_of_accounts 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active';
        
        COMMENT ON COLUMN chart_of_accounts.status IS 
            'Status da conta: active | inactive | obsolete | historical (NBC 31/IFRS 18)';
        
        RAISE NOTICE 'Coluna status adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna status já existe';
    END IF;
END $$;

-- ============================================================================
-- ETAPA 2: Adicionar coluna allow_posting se não existir
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chart_of_accounts' 
        AND column_name = 'allow_posting'
    ) THEN
        ALTER TABLE chart_of_accounts 
        ADD COLUMN allow_posting BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN chart_of_accounts.allow_posting IS 
            'Se TRUE, permite novos lançamentos. Se FALSE, conta bloqueada (NBC 31)';
        
        RAISE NOTICE 'Coluna allow_posting adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna allow_posting já existe';
    END IF;
END $$;

-- ============================================================================
-- ETAPA 3: Adicionar coluna blocked_reason se não existir
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chart_of_accounts' 
        AND column_name = 'blocked_reason'
    ) THEN
        ALTER TABLE chart_of_accounts 
        ADD COLUMN blocked_reason TEXT;
        
        COMMENT ON COLUMN chart_of_accounts.blocked_reason IS 
            'Motivo do bloqueio da conta para novos lançamentos';
        
        RAISE NOTICE 'Coluna blocked_reason adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna blocked_reason já existe';
    END IF;
END $$;

-- ============================================================================
-- ETAPA 4: INATIVAR CONTAS GENÉRICAS (4.9.9.x)
-- Decisão: Marcar como INATIVAS, bloquear novos lançamentos
-- NBC 31: "contas genéricas ferem o espírito da norma"
-- ============================================================================

UPDATE chart_of_accounts
SET 
    status = 'inactive',
    is_active = FALSE,
    allow_posting = FALSE,
    blocked_reason = 'NBC 31 (Revisão) - Conta genérica não permitida. Use contas específicas.',
    updated_at = NOW()
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND code LIKE '4.9.9%';

-- Inativar também outras contas genéricas identificadas
UPDATE chart_of_accounts
SET 
    status = 'inactive',
    is_active = FALSE,
    allow_posting = FALSE,
    blocked_reason = 'NBC 31 (Revisão) - Conta genérica não permitida. Use contas específicas.',
    updated_at = NOW()
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND code LIKE '4%'
  AND (
      name ILIKE '%diversas%'
      OR name ILIKE '%diversos%'
      OR name ILIKE '%a classificar%'
      OR name ILIKE '%eventuais%'
      OR name ILIKE '%não identificad%'
  )
  AND is_analytical = TRUE;

-- ============================================================================
-- ETAPA 5: MARCAR CONTAS OBSOLETAS
-- Decisão: status = 'obsolete', bloquear novos lançamentos
-- ============================================================================

UPDATE chart_of_accounts
SET 
    status = 'obsolete',
    is_active = FALSE,
    allow_posting = FALSE,
    blocked_reason = 'Conta obsoleta - utilize a nova estrutura de contas.',
    updated_at = NOW()
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND code LIKE '4%'
  AND name ILIKE '%OBSOLETO%';

-- ============================================================================
-- ETAPA 6: Garantir que contas ativas permitam lançamentos
-- ============================================================================

UPDATE chart_of_accounts
SET 
    status = COALESCE(status, 'active'),
    allow_posting = CASE WHEN is_analytical THEN TRUE ELSE FALSE END
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND code LIKE '4%'
  AND is_active = TRUE
  AND status IS NULL;

-- ============================================================================
-- ETAPA 7: Criar índice para performance
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_chart_of_accounts_status'
    ) THEN
        CREATE INDEX idx_chart_of_accounts_status 
        ON chart_of_accounts(tenant_id, status, is_active, allow_posting);
        
        RAISE NOTICE 'Índice idx_chart_of_accounts_status criado';
    END IF;
END $$;

-- ============================================================================
-- ETAPA 8: Criar VIEW para contas disponíveis para lançamento (IFRS 18)
-- ============================================================================

CREATE OR REPLACE VIEW v_accounts_available_for_posting AS
SELECT 
    id,
    tenant_id,
    code,
    name,
    account_type,
    nature,
    parent_id,
    level,
    is_analytical,
    status
FROM chart_of_accounts
WHERE is_active = TRUE
  AND allow_posting = TRUE
  AND is_analytical = TRUE
  AND (status IS NULL OR status = 'active');

COMMENT ON VIEW v_accounts_available_for_posting IS 
    'Contas disponíveis para lançamento - Conformidade NBC 31/IFRS 18';

-- ============================================================================
-- ETAPA 9: Criar VIEW para estrutura DRE IFRS 18
-- ============================================================================

CREATE OR REPLACE VIEW v_dre_structure_ifrs18 AS
WITH expense_groups AS (
    SELECT 
        CASE 
            -- Resultado Operacional
            WHEN code LIKE '4.1%' THEN '1_OPERACIONAL'
            WHEN code LIKE '4.2%' THEN '1_OPERACIONAL'
            -- Resultado Financeiro
            WHEN code LIKE '4.3%' THEN '2_FINANCEIRO'
            -- Tributário (Operacional)
            WHEN code LIKE '4.4%' THEN '1_OPERACIONAL'
            -- Veículos (Operacional)
            WHEN code LIKE '4.5%' THEN '1_OPERACIONAL'
            -- Viagens (Operacional)
            WHEN code LIKE '4.6%' THEN '1_OPERACIONAL'
            -- Marketing (Operacional)
            WHEN code LIKE '4.7%' THEN '1_OPERACIONAL'
            -- Depreciação (Operacional)
            WHEN code LIKE '4.8%' THEN '1_OPERACIONAL'
            -- Perdas e Provisões (Não Recorrente)
            WHEN code LIKE '4.9%' THEN '3_NAO_RECORRENTE'
            ELSE '1_OPERACIONAL'
        END as dre_group,
        CASE 
            WHEN code LIKE '4.1%' THEN 'Despesas Operacionais'
            WHEN code LIKE '4.2%' THEN 'Despesas com Pessoal'
            WHEN code LIKE '4.3%' THEN 'Despesas Financeiras'
            WHEN code LIKE '4.4%' THEN 'Despesas Tributárias'
            WHEN code LIKE '4.5%' THEN 'Despesas com Veículos'
            WHEN code LIKE '4.6%' THEN 'Despesas com Viagens'
            WHEN code LIKE '4.7%' THEN 'Despesas com Marketing'
            WHEN code LIKE '4.8%' THEN 'Depreciação e Amortização'
            WHEN code LIKE '4.9%' THEN 'Perdas e Provisões'
            ELSE 'Outras Despesas'
        END as dre_category,
        *
    FROM chart_of_accounts
    WHERE code LIKE '4%'
      AND is_active = TRUE
)
SELECT 
    dre_group,
    dre_category,
    id,
    tenant_id,
    code,
    name,
    is_analytical,
    status
FROM expense_groups
ORDER BY dre_group, code;

COMMENT ON VIEW v_dre_structure_ifrs18 IS 
    'Estrutura de despesas para DRE conforme IFRS 18 - Separação Operacional/Financeiro/Não Recorrente';

-- ============================================================================
-- ETAPA 10: Criar tabela de regras da IA (se não existir)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_classification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'BLOCKED_ACCOUNT', 'PREFERRED_ACCOUNT', 'PATTERN_MATCH'
    rule_name VARCHAR(200) NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id),
    pattern TEXT, -- regex ou texto para match
    reason TEXT,
    confidence_boost DECIMAL(3,2) DEFAULT 0, -- -1 a +1
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    UNIQUE(tenant_id, rule_type, rule_name)
);

COMMENT ON TABLE ai_classification_rules IS 
    'Regras para IA de classificação - NBC 31/IFRS 18 compliance';

-- ============================================================================
-- ETAPA 11: Inserir regras de bloqueio para IA
-- ============================================================================

-- Regra 1: IA NUNCA sugere contas genéricas
INSERT INTO ai_classification_rules (tenant_id, rule_type, rule_name, pattern, reason, confidence_boost, is_active)
SELECT 
    'a53a4957-fe97-4856-b3ca-70045157b421',
    'BLOCKED_PATTERN',
    'BLOCK_GENERIC_ACCOUNTS',
    '(divers|classific|eventual|não identificad|generic)',
    'NBC 31 (Revisão): Contas genéricas são proibidas para novos lançamentos',
    -1.0,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM ai_classification_rules 
    WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND rule_name = 'BLOCK_GENERIC_ACCOUNTS'
);

-- Regra 2: IA NUNCA sugere contas obsoletas
INSERT INTO ai_classification_rules (tenant_id, rule_type, rule_name, pattern, reason, confidence_boost, is_active)
SELECT 
    'a53a4957-fe97-4856-b3ca-70045157b421',
    'BLOCKED_PATTERN',
    'BLOCK_OBSOLETE_ACCOUNTS',
    'OBSOLETO',
    'Conta obsoleta - deve usar nova estrutura de contas',
    -1.0,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM ai_classification_rules 
    WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND rule_name = 'BLOCK_OBSOLETE_ACCOUNTS'
);

-- Regra 3: Receita só de Honorários/Contratos (IFRS 18)
INSERT INTO ai_classification_rules (tenant_id, rule_type, rule_name, pattern, reason, confidence_boost, is_active)
SELECT 
    'a53a4957-fe97-4856-b3ca-70045157b421',
    'REVENUE_RULE',
    'REVENUE_ONLY_FROM_CONTRACTS',
    '^3\.',
    'IFRS 18: Receita só nasce de Honorários/Contratos/Faturamento formal, nunca de banco',
    0,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM ai_classification_rules 
    WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND rule_name = 'REVENUE_ONLY_FROM_CONTRACTS'
);

-- ============================================================================
-- RELATÓRIO FINAL
-- ============================================================================

DO $$
DECLARE
    v_genericas_inativadas INTEGER;
    v_obsoletas_marcadas INTEGER;
    v_contas_ativas INTEGER;
    v_regras_ia INTEGER;
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421'::UUID;
BEGIN
    -- Contar genéricas inativadas
    SELECT COUNT(*) INTO v_genericas_inativadas
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND code LIKE '4%'
      AND status = 'inactive';
    
    -- Contar obsoletas
    SELECT COUNT(*) INTO v_obsoletas_marcadas
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND code LIKE '4%'
      AND status = 'obsolete';
    
    -- Contar ativas disponíveis
    SELECT COUNT(*) INTO v_contas_ativas
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND code LIKE '4%'
      AND is_active = TRUE
      AND (status IS NULL OR status = 'active');
    
    -- Contar regras IA
    SELECT COUNT(*) INTO v_regras_ia
    FROM ai_classification_rules
    WHERE tenant_id = v_tenant_id
      AND is_active = TRUE;
    
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  CONFORMIDADE NBC 31 (Revisão) e NBC TG 51 (IFRS 18)          ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  ✅ Contas genéricas INATIVADAS: %                            ║', LPAD(v_genericas_inativadas::TEXT, 3, ' ');
    RAISE NOTICE '║  ✅ Contas obsoletas MARCADAS: %                              ║', LPAD(v_obsoletas_marcadas::TEXT, 3, ' ');
    RAISE NOTICE '║  ✅ Contas ativas disponíveis: %                              ║', LPAD(v_contas_ativas::TEXT, 3, ' ');
    RAISE NOTICE '║  ✅ Regras IA configuradas: %                                 ║', LPAD(v_regras_ia::TEXT, 3, ' ');
    RAISE NOTICE '╠════════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  📋 Views criadas:                                             ║';
    RAISE NOTICE '║     - v_accounts_available_for_posting                        ║';
    RAISE NOTICE '║     - v_dre_structure_ifrs18                                  ║';
    RAISE NOTICE '╠════════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  🔒 Bloqueios aplicados:                                       ║';
    RAISE NOTICE '║     - allow_posting = FALSE em contas genéricas/obsoletas     ║';
    RAISE NOTICE '║     - IA não sugere contas bloqueadas                         ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
END $$;

-- ============================================================================
-- FIM DA MIGRATION
-- Autorizado por: Dr. Cícero - Contador Responsável
-- Data: 30/01/2026
-- ============================================================================
