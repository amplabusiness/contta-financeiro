-- ============================================================================
-- ETAPA 2: AUDITORIA MENSAL AUTOMÁTICA
-- ============================================================================
-- Data: 01/02/2026
-- Autor: Dr. Cícero - Contador Responsável
-- NOTA: Executar APÓS 20260201_RPC_RECONCILE_TRANSACTION.sql
-- ============================================================================

-- ============================================================================
-- PARTE 0: VERIFICAR DEPENDÊNCIAS
-- ============================================================================

-- Criar tabela reconciliation_audit_log se não existir (dependência)
CREATE TABLE IF NOT EXISTS reconciliation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  journal_entry_id uuid,
  action text NOT NULL CHECK (action IN ('RECONCILE', 'UNRECONCILE', 'RECLASSIFY')),
  actor text NOT NULL DEFAULT 'system',
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PARTE 1: TABELA document_catalog (Data Lake Index)
-- ============================================================================

DROP TABLE IF EXISTS document_catalog CASCADE;

CREATE TABLE document_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  
  -- Identificação
  document_type text NOT NULL,  -- 'auditoria_mensal', 'parecer', 'divergencia', etc.
  reference_month date NOT NULL, -- Primeiro dia do mês de referência
  version integer NOT NULL DEFAULT 1,
  
  -- Conteúdo
  title text NOT NULL,
  description text,
  file_path text NOT NULL,      -- Path no storage
  file_hash text NOT NULL,      -- SHA-256 do conteúdo
  file_size_bytes bigint,
  mime_type text DEFAULT 'application/pdf',
  
  -- Metadados
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  
  -- Governança
  generated_by text NOT NULL,   -- 'system', 'dr-cicero', 'user-uuid'
  approved_by text,             -- Quem aprovou (se aplicável)
  approved_at timestamptz,
  
  -- Controle
  is_final boolean DEFAULT false,  -- Documento finalizado (imutável)
  superseded_by uuid,              -- Se foi substituído por nova versão
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_doc_tenant ON document_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_type ON document_catalog(document_type);
CREATE INDEX IF NOT EXISTS idx_doc_month ON document_catalog(reference_month);
CREATE INDEX IF NOT EXISTS idx_doc_tags ON document_catalog USING GIN(tags);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_unique_version 
  ON document_catalog(tenant_id, document_type, reference_month, version);

-- RLS
ALTER TABLE document_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation" ON document_catalog;
CREATE POLICY "Tenant isolation" ON document_catalog
  FOR ALL USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE document_catalog IS 
'DR. CÍCERO - Catálogo de documentos do Data Lake. Índice imutável de evidências.';

-- ============================================================================
-- PARTE 2: TABELA learned_rules (Regras Aprendidas)
-- ============================================================================

DROP TABLE IF EXISTS learned_rules CASCADE;

CREATE TABLE learned_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  
  -- Identificação
  rule_id text NOT NULL,        -- Ex: 'STATUS_DERIVADO', 'PIX_SOCIO_BLOQUEIO'
  rule_name text NOT NULL,
  category text NOT NULL,       -- 'reconciliation', 'classification', 'validation'
  
  -- Condição e Ação
  condition_description text NOT NULL,
  condition_sql text,           -- SQL que detecta a condição
  expected_outcome text NOT NULL,
  action_description text NOT NULL,
  
  -- Severidade
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Histórico
  source text NOT NULL,         -- 'institutional', 'user_feedback', 'auto_learned'
  first_occurrence date,
  occurrence_count integer DEFAULT 1,
  last_occurrence date,
  
  -- Exemplos
  example_cases jsonb DEFAULT '[]',  -- Array de casos que geraram a regra
  
  -- Status
  is_active boolean DEFAULT true,
  approved_by text,
  approved_at timestamptz,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, rule_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rules_tenant ON learned_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rules_category ON learned_rules(category);
CREATE INDEX IF NOT EXISTS idx_rules_active ON learned_rules(is_active);

-- RLS
ALTER TABLE learned_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation" ON learned_rules;
CREATE POLICY "Tenant isolation" ON learned_rules
  FOR ALL USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE learned_rules IS 
'DR. CÍCERO - Regras aprendidas pelo sistema. Base de conhecimento institucional.';

-- ============================================================================
-- PARTE 3: TABELA monthly_closings (Controle de Fechamento)
-- ============================================================================

DROP TABLE IF EXISTS monthly_closings CASCADE;

CREATE TABLE monthly_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  reference_month date NOT NULL,  -- Primeiro dia do mês
  
  -- Status
  status text NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'pending_review', 'closed', 'reopened')),
  
  -- Métricas do fechamento
  total_transactions integer,
  reconciled_transactions integer,
  pending_transactions integer,
  
  transit_debit_balance numeric(15,2),   -- Saldo 1.1.9.01
  transit_credit_balance numeric(15,2),  -- Saldo 2.1.9.01
  
  -- Documentação
  audit_document_id uuid,
  
  -- Responsáveis
  closed_by text,
  closed_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  
  -- Reabertura (se houver)
  reopened_by text,
  reopened_at timestamptz,
  reopen_reason text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, reference_month)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_closing_tenant ON monthly_closings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_closing_month ON monthly_closings(reference_month);
CREATE INDEX IF NOT EXISTS idx_closing_status ON monthly_closings(status);

-- RLS
ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation" ON monthly_closings;
CREATE POLICY "Tenant isolation" ON monthly_closings
  FOR ALL USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE monthly_closings IS 
'DR. CÍCERO - Controle de fechamento mensal. Mês só fecha com PDF gerado.';

-- ============================================================================
-- PARTE 4: RPC generate_monthly_audit_data()
-- ============================================================================

-- Dropar versões anteriores para evitar conflito
DROP FUNCTION IF EXISTS generate_monthly_audit_data(uuid, integer, integer);

CREATE OR REPLACE FUNCTION generate_monthly_audit_data(
  p_tenant_id uuid,
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
  v_result jsonb;
  v_transactions jsonb;
  v_transitoria_debitos jsonb;
  v_transitoria_creditos jsonb;
  v_divergencias jsonb;
  v_reconciliation_log jsonb;
BEGIN
  -- Calcular período
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + interval '1 month - 1 day')::date;

  -- 1. Métricas de transações
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'reconciliadas', COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL),
    'pendentes', COUNT(*) FILTER (WHERE journal_entry_id IS NULL),
    'percentual_reconciliado', 
      ROUND(100.0 * COUNT(*) FILTER (WHERE journal_entry_id IS NOT NULL) / NULLIF(COUNT(*), 0), 2)
  ) INTO v_transactions
  FROM bank_transactions
  WHERE tenant_id = p_tenant_id
    AND transaction_date BETWEEN v_start_date AND v_end_date;

  -- 2. Saldo Transitória Débitos (1.1.9.01)
  SELECT jsonb_build_object(
    'conta', '1.1.9.01',
    'nome', 'Transitória Débitos Pendentes',
    'debitos', COALESCE(SUM(l.debit), 0),
    'creditos', COALESCE(SUM(l.credit), 0),
    'saldo', COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0),
    'status', CASE 
      WHEN ABS(COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)) < 0.01 THEN 'OK'
      ELSE 'PENDENTE'
    END
  ) INTO v_transitoria_debitos
  FROM accounting_entry_lines l
  JOIN accounting_entries e ON e.id = l.entry_id
  WHERE l.tenant_id = p_tenant_id
    AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND e.entry_date BETWEEN v_start_date AND v_end_date;

  -- 3. Saldo Transitória Créditos (2.1.9.01)
  SELECT jsonb_build_object(
    'conta', '2.1.9.01',
    'nome', 'Transitória Créditos Pendentes',
    'debitos', COALESCE(SUM(l.debit), 0),
    'creditos', COALESCE(SUM(l.credit), 0),
    'saldo', COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0),
    'status', CASE 
      WHEN ABS(COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)) < 0.01 THEN 'OK'
      ELSE 'PENDENTE'
    END
  ) INTO v_transitoria_creditos
  FROM accounting_entry_lines l
  JOIN accounting_entries e ON e.id = l.entry_id
  WHERE l.tenant_id = p_tenant_id
    AND l.account_id = '28085461-9e5a-4fb4-847d-c9fc047fe0a1'
    AND e.entry_date BETWEEN v_start_date AND v_end_date;

  -- 4. Log de reconciliações do período
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'action', action,
    'actor', actor,
    'count', cnt
  )), '[]'::jsonb) INTO v_reconciliation_log
  FROM (
    SELECT action, actor, COUNT(*) as cnt
    FROM reconciliation_audit_log
    WHERE tenant_id = p_tenant_id
      AND created_at BETWEEN v_start_date AND v_end_date + interval '1 day'
    GROUP BY action, actor
  ) sub;

  -- 5. Montar resultado
  v_result := jsonb_build_object(
    'periodo', jsonb_build_object(
      'ano', p_year,
      'mes', p_month,
      'inicio', v_start_date,
      'fim', v_end_date
    ),
    'transacoes', v_transactions,
    'transitorias', jsonb_build_object(
      'debitos', v_transitoria_debitos,
      'creditos', v_transitoria_creditos
    ),
    'reconciliation_log', v_reconciliation_log,
    'situacao_geral', CASE
      WHEN (v_transactions->>'pendentes')::integer = 0 
        AND (v_transitoria_debitos->>'status') = 'OK'
        AND (v_transitoria_creditos->>'status') = 'OK'
      THEN 'OK'
      ELSE 'ATENCAO'
    END,
    'gerado_em', now(),
    'gerado_por', 'generate_monthly_audit_data'
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_monthly_audit_data(uuid, integer, integer) TO authenticated;

COMMENT ON FUNCTION generate_monthly_audit_data IS 
'DR. CÍCERO - Gera dados para relatório de auditoria mensal';

-- ============================================================================
-- PARTE 5: RPC close_month()
-- ============================================================================

-- Dropar TODAS as versões anteriores dinamicamente (resolve conflito de assinaturas)
DO $drop_close_month$ 
DECLARE 
  func_oid oid;
BEGIN
  FOR func_oid IN 
    SELECT p.oid 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE p.proname = 'close_month' 
    AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_oid::regprocedure || ' CASCADE';
  END LOOP;
END $drop_close_month$;

CREATE OR REPLACE FUNCTION close_month(
  p_tenant_id uuid,
  p_year integer,
  p_month integer,
  p_audit_document_id uuid,
  p_closed_by text DEFAULT 'system'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reference_month date;
  v_audit_data jsonb;
  v_closing_id uuid;
BEGIN
  v_reference_month := make_date(p_year, p_month, 1);

  -- Verificar se documento existe
  IF NOT EXISTS (SELECT 1 FROM document_catalog WHERE id = p_audit_document_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Documento de auditoria não encontrado. Mês não pode ser fechado sem PDF.'
    );
  END IF;

  -- Gerar dados de auditoria
  v_audit_data := generate_monthly_audit_data(p_tenant_id, p_year, p_month);

  -- Verificar se pode fechar (transitórias zeradas)
  IF (v_audit_data->'transitorias'->'debitos'->>'status') != 'OK' 
     OR (v_audit_data->'transitorias'->'creditos'->>'status') != 'OK' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transitórias não estão zeradas. Classifique todas as transações antes de fechar.',
      'transitorias', v_audit_data->'transitorias'
    );
  END IF;

  -- Inserir ou atualizar fechamento
  INSERT INTO monthly_closings (
    tenant_id,
    reference_month,
    status,
    total_transactions,
    reconciled_transactions,
    pending_transactions,
    transit_debit_balance,
    transit_credit_balance,
    audit_document_id,
    closed_by,
    closed_at
  ) VALUES (
    p_tenant_id,
    v_reference_month,
    'closed',
    (v_audit_data->'transacoes'->>'total')::integer,
    (v_audit_data->'transacoes'->>'reconciliadas')::integer,
    (v_audit_data->'transacoes'->>'pendentes')::integer,
    (v_audit_data->'transitorias'->'debitos'->>'saldo')::numeric,
    (v_audit_data->'transitorias'->'creditos'->>'saldo')::numeric,
    p_audit_document_id,
    p_closed_by,
    now()
  )
  ON CONFLICT (tenant_id, reference_month) 
  DO UPDATE SET
    status = 'closed',
    total_transactions = EXCLUDED.total_transactions,
    reconciled_transactions = EXCLUDED.reconciled_transactions,
    pending_transactions = EXCLUDED.pending_transactions,
    transit_debit_balance = EXCLUDED.transit_debit_balance,
    transit_credit_balance = EXCLUDED.transit_credit_balance,
    audit_document_id = EXCLUDED.audit_document_id,
    closed_by = EXCLUDED.closed_by,
    closed_at = now(),
    updated_at = now()
  RETURNING id INTO v_closing_id;

  RETURN jsonb_build_object(
    'success', true,
    'closing_id', v_closing_id,
    'reference_month', v_reference_month,
    'audit_data', v_audit_data
  );
END;
$$;

GRANT EXECUTE ON FUNCTION close_month(uuid, integer, integer, uuid, text) TO authenticated;

COMMENT ON FUNCTION close_month IS 
'DR. CÍCERO - Fecha o mês. REQUER documento de auditoria e transitórias zeradas.';

-- ============================================================================
-- PARTE 6: INSERIR REGRAS APRENDIDAS INICIAIS
-- ============================================================================

INSERT INTO learned_rules (
  tenant_id,
  rule_id,
  rule_name,
  category,
  condition_description,
  condition_sql,
  expected_outcome,
  action_description,
  severity,
  source,
  first_occurrence,
  occurrence_count,
  is_active,
  approved_by,
  approved_at
) VALUES 
-- Regra 1: Status Derivado
(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  'STATUS_DERIVADO',
  'Status é derivado de journal_entry_id',
  'reconciliation',
  'Se journal_entry_id IS NOT NULL e transitórias zeradas, então status DEVE ser reconciled',
  'SELECT id FROM bank_transactions WHERE journal_entry_id IS NOT NULL AND status != ''reconciled''',
  'status = reconciled',
  'Corrigir via trigger ou RPC reconcile_transaction()',
  'critical',
  'institutional',
  '2026-02-01',
  1,
  true,
  'dr-cicero',
  now()
),
-- Regra 2: PIX de Sócio
(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  'PIX_SOCIO_BLOQUEIO',
  'PIX de sócio nunca é receita',
  'classification',
  'Transação PIX com nome de sócio no memo não pode ser classificada como Receita',
  NULL,
  'Classificar como Empréstimo de Sócio ou Capital Social',
  'Bloquear classificação automática. Exigir revisão do Dr. Cícero.',
  'critical',
  'institutional',
  '2026-01-15',
  3,
  true,
  'dr-cicero',
  now()
),
-- Regra 3: Transitórias devem zerar
(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  'TRANSITORIA_ZERO',
  'Transitórias devem zerar ao fim do período',
  'validation',
  'Saldo das contas 1.1.9.01 e 2.1.9.01 deve ser zero no fechamento',
  'SELECT code FROM chart_of_accounts WHERE code IN (''1.1.9.01'', ''2.1.9.01'') AND current_balance != 0',
  'Saldo = 0',
  'Classificar todas as transações pendentes antes do fechamento',
  'high',
  'institutional',
  '2026-01-01',
  5,
  true,
  'dr-cicero',
  now()
),
-- Regra 4: Reconciliação via RPC
(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  'RECONCILIACAO_VIA_RPC',
  'Reconciliação apenas via RPC oficial',
  'reconciliation',
  'Toda reconciliação deve usar reconcile_transaction() para garantir auditoria',
  NULL,
  'Usar RPC reconcile_transaction()',
  'Nunca fazer UPDATE direto em bank_transactions.journal_entry_id',
  'high',
  'institutional',
  '2026-02-01',
  1,
  true,
  'dr-cicero',
  now()
)
ON CONFLICT (tenant_id, rule_id) DO NOTHING;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================
SELECT 'Tabelas criadas:' as info;
SELECT tablename FROM pg_tables WHERE tablename IN ('document_catalog', 'learned_rules', 'monthly_closings');

SELECT 'Funções criadas:' as info;
SELECT proname FROM pg_proc WHERE proname IN ('generate_monthly_audit_data', 'close_month');

SELECT 'Regras aprendidas:' as info;
SELECT rule_id, rule_name, severity FROM learned_rules WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';
