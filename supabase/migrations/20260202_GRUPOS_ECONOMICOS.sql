-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | Sistema de Grupos Econômicos
-- Data: 02/02/2026
-- Autor: Dr. Cícero (Sistema Contta)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- Este módulo permite:
-- 1. Cadastrar grupos econômicos
-- 2. Vincular clientes a grupos
-- 3. Baixar honorários de múltiplas empresas com um único PIX
-- 4. Rastrear pagamentos consolidados
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- 1) TABELA DE GRUPOS ECONÔMICOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.economic_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  payer_client_id UUID,  -- Cliente "pagador principal" do grupo (ex: A.I Empreendimentos)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  created_by UUID,
  
  CONSTRAINT uq_economic_group_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_economic_groups_tenant ON public.economic_groups(tenant_id, is_active);

COMMENT ON TABLE public.economic_groups IS 'Grupos econômicos para consolidação de pagamentos';
COMMENT ON COLUMN public.economic_groups.payer_client_id IS 'Cliente que normalmente paga pelos demais do grupo';

-- =============================================================================
-- 2) ADICIONAR COLUNA economic_group_id NA TABELA CLIENTS
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'economic_group_id'
  ) THEN
    ALTER TABLE public.clients 
    ADD COLUMN economic_group_id UUID REFERENCES public.economic_groups(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_economic_group ON public.clients(tenant_id, economic_group_id);

-- =============================================================================
-- 3) TABELA DE LOG DE PAGAMENTOS POR GRUPO
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.group_payment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  economic_group_id UUID NOT NULL REFERENCES public.economic_groups(id),
  bank_transaction_id UUID NOT NULL,
  payer_client_id UUID,
  total_amount NUMERIC(15,2) NOT NULL,
  applied_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  invoices_paid JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array de {invoice_id, client_id, amount}
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'partial', 'excess')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_group_payment_log_tenant ON public.group_payment_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_payment_log_group ON public.group_payment_log(economic_group_id);

COMMENT ON TABLE public.group_payment_log IS 'Histórico de pagamentos consolidados por grupo econômico';

-- =============================================================================
-- 4) RPC: IDENTIFICAR GRUPO ECONÔMICO PELO PAGADOR
-- =============================================================================
CREATE OR REPLACE FUNCTION public.identify_economic_group(
  p_tenant UUID,
  p_description TEXT
)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  payer_client_id UUID,
  payer_name TEXT,
  member_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_desc TEXT := UPPER(COALESCE(p_description, ''));
BEGIN
  RETURN QUERY
  SELECT 
    eg.id AS group_id,
    eg.name AS group_name,
    eg.payer_client_id,
    c.name AS payer_name,
    (SELECT COUNT(*)::INT FROM clients WHERE economic_group_id = eg.id) AS member_count
  FROM economic_groups eg
  LEFT JOIN clients c ON c.id = eg.payer_client_id
  WHERE eg.tenant_id = p_tenant
    AND eg.is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM clients mc
      WHERE mc.economic_group_id = eg.id
        AND v_desc ILIKE '%' || UPPER(mc.name) || '%'
    );
END;
$$;

-- =============================================================================
-- 5) RPC: LISTAR EMPRESAS DE UM GRUPO ECONÔMICO
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_group_members(
  p_tenant UUID,
  p_group_id UUID
)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  document TEXT,
  is_payer BOOLEAN,
  pending_invoices INT,
  pending_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS client_id,
    c.name AS client_name,
    c.document,
    (eg.payer_client_id = c.id) AS is_payer,
    COALESCE((
      SELECT COUNT(*)::INT 
      FROM invoices i 
      WHERE i.client_id = c.id 
        AND i.status IN ('pending', 'overdue')
    ), 0) AS pending_invoices,
    COALESCE((
      SELECT SUM(i.amount)
      FROM invoices i 
      WHERE i.client_id = c.id 
        AND i.status IN ('pending', 'overdue')
    ), 0) AS pending_amount
  FROM clients c
  JOIN economic_groups eg ON eg.id = c.economic_group_id
  WHERE c.tenant_id = p_tenant
    AND c.economic_group_id = p_group_id
  ORDER BY (eg.payer_client_id = c.id) DESC, c.name;
END;
$$;

-- =============================================================================
-- 6) RPC: RECONCILIAR PAGAMENTO POR GRUPO ECONÔMICO
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reconcile_group_payment(
  p_tenant UUID,
  p_bank_transaction_id UUID,
  p_created_by TEXT DEFAULT 'dr-cicero'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx RECORD;
  v_group RECORD;
  v_remaining NUMERIC;
  v_applied NUMERIC := 0;
  v_invoice RECORD;
  v_invoices_paid JSONB := '[]'::jsonb;
  v_entry_id UUID;
  v_log_id UUID;
  
  -- Contas contábeis
  v_banco_sicredi UUID := '10d5892d-a843-4034-8d62-9fec95b8fd56';
  v_clientes_receber UUID := '12cb93f6-daef-4e2d-bfa9-db9850fdc781';
  v_trans_creditos UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1';
BEGIN
  -- 1) Buscar transação bancária
  SELECT * INTO v_tx
  FROM bank_transactions
  WHERE id = p_bank_transaction_id
    AND tenant_id = p_tenant;
    
  IF v_tx IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'TRANSACTION_NOT_FOUND');
  END IF;
  
  IF v_tx.amount <= 0 THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'NOT_A_CREDIT_TRANSACTION');
  END IF;
  
  -- 2) Identificar grupo econômico pela descrição
  SELECT eg.* INTO v_group
  FROM economic_groups eg
  WHERE eg.tenant_id = p_tenant
    AND eg.is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.economic_group_id = eg.id
        AND UPPER(v_tx.description) ILIKE '%' || UPPER(c.name) || '%'
    )
  LIMIT 1;
  
  IF v_group IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'NO_GROUP_FOUND', 'description', v_tx.description);
  END IF;
  
  v_remaining := v_tx.amount;
  
  -- 3) Buscar e baixar faturas do grupo (ordem: vencimento mais antigo primeiro)
  FOR v_invoice IN
    SELECT i.*, c.name as client_name
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    WHERE c.tenant_id = p_tenant
      AND c.economic_group_id = v_group.id
      AND i.status IN ('pending', 'overdue')
    ORDER BY i.due_date ASC, i.created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    
    IF v_remaining >= v_invoice.amount THEN
      -- Baixa total
      UPDATE invoices
      SET status = 'paid', 
          paid_at = NOW(),
          paid_amount = amount,
          payment_method = 'pix_grupo',
          notes = COALESCE(notes, '') || ' | Baixa via PIX grupo ' || v_group.name || ' em ' || NOW()::DATE
      WHERE id = v_invoice.id;
      
      v_invoices_paid := v_invoices_paid || jsonb_build_object(
        'invoice_id', v_invoice.id,
        'client_id', v_invoice.client_id,
        'client_name', v_invoice.client_name,
        'amount', v_invoice.amount,
        'type', 'full'
      );
      
      v_applied := v_applied + v_invoice.amount;
      v_remaining := v_remaining - v_invoice.amount;
    ELSE
      -- Baixa parcial
      UPDATE invoices
      SET paid_amount = COALESCE(paid_amount, 0) + v_remaining,
          notes = COALESCE(notes, '') || ' | Baixa PARCIAL R$ ' || v_remaining || ' via PIX grupo em ' || NOW()::DATE
      WHERE id = v_invoice.id;
      
      v_invoices_paid := v_invoices_paid || jsonb_build_object(
        'invoice_id', v_invoice.id,
        'client_id', v_invoice.client_id,
        'client_name', v_invoice.client_name,
        'amount', v_remaining,
        'type', 'partial',
        'remaining', v_invoice.amount - v_remaining
      );
      
      v_applied := v_applied + v_remaining;
      v_remaining := 0;
    END IF;
  END LOOP;
  
  -- 4) Criar lançamento contábil de classificação
  v_entry_id := gen_random_uuid();
  
  INSERT INTO accounting_entries (
    id, tenant_id, entry_date, competence_date,
    description, internal_code, source_type, entry_type,
    reference_type, reference_id, created_by
  ) VALUES (
    v_entry_id, p_tenant, v_tx.transaction_date, v_tx.transaction_date,
    'Classificação: Recebimento PIX Grupo ' || v_group.name || ' | ' || LEFT(v_tx.description, 80),
    'CLASS_GRUPO_' || TO_CHAR(v_tx.transaction_date, 'YYYYMMDD') || '_' || SUBSTR(v_tx.id::TEXT, 1, 8),
    'classification', 'NORMAL',
    'bank_transaction', p_bank_transaction_id,
    p_created_by
  );
  
  -- Linhas: D Transitória Créditos / C Clientes a Receber
  INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
  VALUES
    (gen_random_uuid(), p_tenant, v_entry_id, v_trans_creditos, v_applied, 0, 
     'Baixa transitória - PIX grupo ' || v_group.name),
    (gen_random_uuid(), p_tenant, v_entry_id, v_clientes_receber, 0, v_applied,
     'Baixa clientes grupo ' || v_group.name || ' (' || jsonb_array_length(v_invoices_paid) || ' faturas)');
  
  -- Se sobrou valor, criar crédito em adiantamento
  IF v_remaining > 0 THEN
    -- TODO: Implementar conta de adiantamentos de clientes
    -- Por enquanto, registrar no log
    NULL;
  END IF;
  
  -- 5) Registrar no log de pagamentos por grupo
  v_log_id := gen_random_uuid();
  
  INSERT INTO group_payment_log (
    id, tenant_id, economic_group_id, bank_transaction_id,
    payer_client_id, total_amount, applied_amount, remaining_amount,
    invoices_paid, status, notes, created_by
  ) VALUES (
    v_log_id, p_tenant, v_group.id, p_bank_transaction_id,
    v_group.payer_client_id, v_tx.amount, v_applied, v_remaining,
    v_invoices_paid,
    CASE 
      WHEN v_remaining > 0 THEN 'excess'
      WHEN v_applied < v_tx.amount THEN 'partial'
      ELSE 'processed'
    END,
    'Processado automaticamente pelo Dr. Cícero',
    p_created_by
  );
  
  -- 6) Marcar transação como reconciliada
  UPDATE bank_transactions
  SET status = 'reconciled',
      is_reconciled = TRUE,
      reconciled_at = NOW(),
      journal_entry_id = COALESCE(journal_entry_id, v_entry_id)
  WHERE id = p_bank_transaction_id;
  
  RETURN jsonb_build_object(
    'ok', TRUE,
    'group_id', v_group.id,
    'group_name', v_group.name,
    'total_amount', v_tx.amount,
    'applied_amount', v_applied,
    'remaining_credit', v_remaining,
    'invoices_paid', jsonb_array_length(v_invoices_paid),
    'entry_id', v_entry_id,
    'log_id', v_log_id,
    'details', v_invoices_paid
  );
END;
$$;

-- =============================================================================
-- 7) RPC: LISTAR TRANSAÇÕES CANDIDATAS A PAGAMENTO POR GRUPO
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_group_payment_candidates(
  p_tenant UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE (
  transaction_id UUID,
  transaction_date DATE,
  amount NUMERIC,
  description TEXT,
  group_id UUID,
  group_name TEXT,
  member_count INT,
  pending_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id AS transaction_id,
    bt.transaction_date,
    bt.amount,
    bt.description,
    eg.id AS group_id,
    eg.name AS group_name,
    (SELECT COUNT(*)::INT FROM clients WHERE economic_group_id = eg.id) AS member_count,
    COALESCE((
      SELECT SUM(i.amount)
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      WHERE c.economic_group_id = eg.id
        AND i.status IN ('pending', 'overdue')
    ), 0) AS pending_total
  FROM bank_transactions bt
  CROSS JOIN LATERAL (
    SELECT eg2.*
    FROM economic_groups eg2
    WHERE eg2.tenant_id = p_tenant
      AND eg2.is_active = TRUE
      AND EXISTS (
        SELECT 1 FROM clients c
        WHERE c.economic_group_id = eg2.id
          AND UPPER(bt.description) ILIKE '%' || UPPER(c.name) || '%'
      )
    LIMIT 1
  ) eg
  WHERE bt.tenant_id = p_tenant
    AND bt.transaction_date BETWEEN p_start AND p_end
    AND bt.amount > 0  -- Apenas créditos
    AND bt.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.reference_id = bt.id
        AND ae.source_type = 'classification'
    );
END;
$$;

-- =============================================================================
-- 8) ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_client_status ON public.invoices(client_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date) WHERE status IN ('pending', 'overdue');

-- =============================================================================
-- VERIFICAÇÃO FINAL
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '═════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Sistema de Grupos Econômicos criado com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  • economic_groups - Cadastro de grupos';
  RAISE NOTICE '  • group_payment_log - Histórico de pagamentos';
  RAISE NOTICE '  • clients.economic_group_id - Vínculo empresa→grupo';
  RAISE NOTICE '';
  RAISE NOTICE 'RPCs disponíveis:';
  RAISE NOTICE '  • identify_economic_group(tenant, description)';
  RAISE NOTICE '  • list_group_members(tenant, group_id)';
  RAISE NOTICE '  • reconcile_group_payment(tenant, transaction_id)';
  RAISE NOTICE '  • list_group_payment_candidates(tenant, start, end)';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximo passo: Execute o INSERT dos grupos econômicos';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════════';
END $$;
