-- ============================================================================
-- LEDGER AUXILIAR POR CLIENTE - FONTE DA VERDADE: CONTABILIDADE
-- Conforme Seção 5 e Seção 11 do reoganizacao_28_01_2026.md
-- ============================================================================
-- Seção 5: "Ledger auxiliar controla granularidade"
-- Seção 11: "Contabilidade = FONTE DA VERDADE"
-- ============================================================================

-- 1. View de Razão por Cliente (derivada da contabilidade)
-- Esta view substitui a consulta direta em invoices
CREATE OR REPLACE VIEW vw_razao_cliente AS
SELECT
    c.id AS client_id,
    c.name AS client_name,
    c.cnpj,
    ae.entry_date AS data_lancamento,
    ae.competence_date AS data_competencia,
    ae.id AS entry_id,
    ae.entry_type,
    ae.description AS descricao_entrada,
    aei.history AS historico,
    ca.code AS conta_codigo,
    ca.name AS conta_nome,
    aei.debit AS debito,
    aei.credit AS credito,
    ae.document_type,
    ae.reference_type,
    ae.reference_id,
    ae.created_at
FROM clients c
INNER JOIN accounting_entry_items aei ON aei.client_id = c.id
INNER JOIN accounting_entries ae ON ae.id = aei.entry_id
INNER JOIN chart_of_accounts ca ON ca.id = aei.account_id
WHERE COALESCE(ae.is_draft, false) = false
ORDER BY ae.entry_date, ae.created_at;

COMMENT ON VIEW vw_razao_cliente IS
'Razão auxiliar por cliente - FONTE DA VERDADE conforme Seção 11.
Deriva diretamente de accounting_entries/accounting_entry_items.
Substitui consultas diretas em invoices para fins de saldo.';

-- 2. View de Saldo por Cliente (soma dos lançamentos contábeis)
CREATE OR REPLACE VIEW vw_saldo_cliente AS
SELECT
    c.id AS client_id,
    c.name AS client_name,
    c.cnpj,
    c.email,
    c.phone,
    c.is_active,
    COALESCE(SUM(aei.debit), 0) AS total_debitos,
    COALESCE(SUM(aei.credit), 0) AS total_creditos,
    COALESCE(SUM(aei.debit), 0) - COALESCE(SUM(aei.credit), 0) AS saldo_atual,
    COUNT(DISTINCT ae.id) AS qtd_lancamentos,
    MIN(ae.entry_date) AS primeiro_lancamento,
    MAX(ae.entry_date) AS ultimo_lancamento
FROM clients c
LEFT JOIN accounting_entry_items aei ON aei.client_id = c.id
LEFT JOIN accounting_entries ae ON ae.id = aei.entry_id AND COALESCE(ae.is_draft, false) = false
LEFT JOIN chart_of_accounts ca ON ca.id = aei.account_id
WHERE ca.code IS NULL OR ca.code LIKE '1.1.2%'  -- Conta de clientes a receber
GROUP BY c.id, c.name, c.cnpj, c.email, c.phone, c.is_active
ORDER BY (COALESCE(SUM(aei.debit), 0) - COALESCE(SUM(aei.credit), 0)) DESC;

COMMENT ON VIEW vw_saldo_cliente IS
'Saldo consolidado por cliente derivado da contabilidade.
Conforme Seção 5: Ledger auxiliar com saldo por cliente.
Conforme Seção 11: Contabilidade é fonte da verdade.';

-- 3. Função para obter saldo contábil de um cliente
CREATE OR REPLACE FUNCTION fn_get_saldo_contabil_cliente(
    p_client_id UUID,
    p_data_ate DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_debitos NUMERIC,
    total_creditos NUMERIC,
    saldo NUMERIC,
    qtd_lancamentos BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(aei.debit), 0)::NUMERIC AS total_debitos,
        COALESCE(SUM(aei.credit), 0)::NUMERIC AS total_creditos,
        (COALESCE(SUM(aei.debit), 0) - COALESCE(SUM(aei.credit), 0))::NUMERIC AS saldo,
        COUNT(DISTINCT ae.id) AS qtd_lancamentos
    FROM accounting_entry_items aei
    INNER JOIN accounting_entries ae ON ae.id = aei.entry_id
    INNER JOIN chart_of_accounts ca ON ca.id = aei.account_id
    WHERE aei.client_id = p_client_id
      AND ae.entry_date <= p_data_ate
      AND COALESCE(ae.is_draft, false) = false
      AND ca.code LIKE '1.1.2%';  -- Conta de clientes a receber
END;
$$;

COMMENT ON FUNCTION fn_get_saldo_contabil_cliente IS
'Retorna saldo contábil de um cliente até uma data específica.
Fonte: accounting_entries/accounting_entry_items.
Conforme Seção 11: Contabilidade = Fonte da Verdade.';

-- 4. Função para obter extrato contábil de um cliente (razão analítico)
CREATE OR REPLACE FUNCTION fn_get_extrato_contabil_cliente(
    p_client_id UUID,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    data_lancamento DATE,
    data_competencia DATE,
    entry_id UUID,
    entry_type TEXT,
    descricao TEXT,
    historico TEXT,
    conta_codigo TEXT,
    conta_nome TEXT,
    debito NUMERIC,
    credito NUMERIC,
    saldo_acumulado NUMERIC,
    document_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH lancamentos AS (
        SELECT
            ae.entry_date AS data_lancamento,
            ae.competence_date AS data_competencia,
            ae.id AS entry_id,
            ae.entry_type::TEXT,
            COALESCE(aei.history, ae.description) AS descricao,
            aei.history AS historico,
            ca.code AS conta_codigo,
            ca.name AS conta_nome,
            COALESCE(aei.debit, 0) AS debito,
            COALESCE(aei.credit, 0) AS credito,
            ae.document_type::TEXT,
            ae.created_at
        FROM accounting_entry_items aei
        INNER JOIN accounting_entries ae ON ae.id = aei.entry_id
        INNER JOIN chart_of_accounts ca ON ca.id = aei.account_id
        WHERE aei.client_id = p_client_id
          AND ae.entry_date <= p_data_fim
          AND (p_data_inicio IS NULL OR ae.entry_date >= p_data_inicio)
          AND COALESCE(ae.is_draft, false) = false
          AND ca.code LIKE '1.1.2%'
        ORDER BY ae.entry_date, ae.created_at
    )
    SELECT
        l.data_lancamento,
        l.data_competencia,
        l.entry_id,
        l.entry_type,
        l.descricao,
        l.historico,
        l.conta_codigo,
        l.conta_nome,
        l.debito,
        l.credito,
        SUM(l.debito - l.credito) OVER (ORDER BY l.data_lancamento, l.created_at) AS saldo_acumulado,
        l.document_type
    FROM lancamentos l;
END;
$$;

COMMENT ON FUNCTION fn_get_extrato_contabil_cliente IS
'Retorna extrato contábil completo de um cliente com saldo acumulado.
Este é o RAZÃO ANALÍTICO do cliente derivado da contabilidade.
Conforme Seção 5: Ledger auxiliar por cliente.
Conforme Seção 11: Contabilidade = Fonte da Verdade.';

-- 5. View de reconciliação: compara saldo contábil com saldo financeiro
CREATE OR REPLACE VIEW vw_reconciliacao_cliente AS
WITH saldo_contabil AS (
    SELECT
        aei.client_id,
        COALESCE(SUM(aei.debit), 0) - COALESCE(SUM(aei.credit), 0) AS saldo_contabil
    FROM accounting_entry_items aei
    INNER JOIN accounting_entries ae ON ae.id = aei.entry_id
    INNER JOIN chart_of_accounts ca ON ca.id = aei.account_id
    WHERE COALESCE(ae.is_draft, false) = false
      AND ca.code LIKE '1.1.2%'
    GROUP BY aei.client_id
),
saldo_financeiro AS (
    -- Saldo de abertura pendente
    SELECT
        cob.client_id,
        SUM(cob.amount - COALESCE(cob.paid_amount, 0)) AS saldo
    FROM client_opening_balance cob
    WHERE cob.status IN ('pending', 'partial')
    GROUP BY cob.client_id
    UNION ALL
    -- Invoices pendentes
    SELECT
        i.client_id,
        SUM(i.amount) AS saldo
    FROM invoices i
    WHERE i.status IN ('pending', 'overdue')
    GROUP BY i.client_id
),
saldo_financeiro_total AS (
    SELECT client_id, SUM(saldo) AS saldo_financeiro
    FROM saldo_financeiro
    GROUP BY client_id
)
SELECT
    c.id AS client_id,
    c.name AS client_name,
    c.cnpj,
    COALESCE(sc.saldo_contabil, 0) AS saldo_contabil,
    COALESCE(sf.saldo_financeiro, 0) AS saldo_financeiro,
    COALESCE(sc.saldo_contabil, 0) - COALESCE(sf.saldo_financeiro, 0) AS diferenca,
    CASE
        WHEN ABS(COALESCE(sc.saldo_contabil, 0) - COALESCE(sf.saldo_financeiro, 0)) < 0.01 THEN 'CONCILIADO'
        ELSE 'DIVERGENTE'
    END AS status_reconciliacao
FROM clients c
LEFT JOIN saldo_contabil sc ON sc.client_id = c.id
LEFT JOIN saldo_financeiro_total sf ON sf.client_id = c.id
WHERE COALESCE(sc.saldo_contabil, 0) != 0 OR COALESCE(sf.saldo_financeiro, 0) != 0
ORDER BY ABS(COALESCE(sc.saldo_contabil, 0) - COALESCE(sf.saldo_financeiro, 0)) DESC;

COMMENT ON VIEW vw_reconciliacao_cliente IS
'Reconciliação entre saldo contábil e saldo financeiro por cliente.
Identifica divergências entre contabilidade e financeiro.
Contabilidade deve ser a fonte da verdade (Seção 11).';

-- 6. Adicionar office_id na tabela client_ledger (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_ledger') THEN
        ALTER TABLE client_ledger ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES accounting_office(id);
        CREATE INDEX IF NOT EXISTS idx_client_ledger_office ON client_ledger(office_id);
    END IF;
END $$;

-- 7. Log de execução
DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '[Dr. Cícero] LEDGER AUXILIAR POR CLIENTE IMPLEMENTADO';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Views criadas:';
    RAISE NOTICE '  - vw_razao_cliente: Razão analítico por cliente';
    RAISE NOTICE '  - vw_saldo_cliente: Saldo consolidado por cliente';
    RAISE NOTICE '  - vw_reconciliacao_cliente: Reconciliação contábil x financeiro';
    RAISE NOTICE 'Funções criadas:';
    RAISE NOTICE '  - fn_get_saldo_contabil_cliente: Saldo até uma data';
    RAISE NOTICE '  - fn_get_extrato_contabil_cliente: Extrato completo';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'IMPORTANTE: Contabilidade é a FONTE DA VERDADE (Seção 11)';
    RAISE NOTICE '============================================================================';
END $$;
