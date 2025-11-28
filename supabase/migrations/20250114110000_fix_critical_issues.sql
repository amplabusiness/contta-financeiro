-- =====================================================
-- CORREÇÕES CRÍTICAS DE INTEGRIDADE E PERFORMANCE
-- =====================================================

-- =====================================================
-- 1. CONSTRAINTS PARA PREVENIR DUPLICATAS
-- =====================================================

-- Garantir coluna status na tabela clients (necessária para índices filtrados)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
-- Garantir coluna client_id na tabela expenses para índices únicos
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- 1.1. Constraint UNIQUE para invoices (prevenir duplicatas)
-- Garante que não pode haver duas faturas do mesmo cliente na mesma competência
ALTER TABLE invoices
ADD CONSTRAINT unique_invoice_per_client_competence
UNIQUE(client_id, competence);

-- 1.2. Constraint UNIQUE para CNPJ normalizado (prevenir clientes duplicados)
-- Cria índice único baseado em CNPJ sem formatação
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cnpj_normalized
ON clients ((regexp_replace(cnpj, '[^0-9]', '', 'g')))
WHERE cnpj IS NOT NULL AND status = 'active';

-- 1.3. Constraint UNIQUE para expenses (prevenir despesas duplicadas)
-- Baseado em descrição, valor e data
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_unique
ON expenses (description, amount, due_date, client_id)
WHERE status != 'cancelled';

-- =====================================================
-- 2. ÍNDICES DE PERFORMANCE CRÍTICOS
-- =====================================================

-- 2.1. Índices para queries do Dashboard (performance crítica)
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_status ON invoices(client_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_competence ON invoices(competence);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_client_status ON expenses(client_id, status);

-- 2.2. Índices para queries de relatórios
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_updated_at ON invoices(updated_at DESC);

-- 2.3. Índice para busca por CNPJ (sem considerar formatação)
CREATE INDEX IF NOT EXISTS idx_clients_cnpj_search
ON clients USING gin (to_tsvector('portuguese', regexp_replace(cnpj, '[^0-9]', '', 'g')));

-- =====================================================
-- 3. FUNÇÃO PARA ATUALIZAR STATUS AUTOMATICAMENTE
-- =====================================================

-- 3.1. Função para marcar invoices vencidas como overdue
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS void AS $$
BEGIN
  -- Atualizar invoices pendentes que já venceram
  UPDATE invoices
  SET
    status = 'overdue',
    updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;

  -- Log da atualização
  RAISE NOTICE 'Updated % invoices to overdue status',
    (SELECT count(*) FROM invoices WHERE status = 'overdue' AND updated_at::date = CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 3.2. Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em tabelas principais
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. VALIDAÇÕES ADICIONAIS
-- =====================================================

-- 4.1. Garantir que amount seja sempre positivo
ALTER TABLE invoices
ADD CONSTRAINT check_invoice_amount_positive
CHECK (amount > 0);

ALTER TABLE expenses
ADD CONSTRAINT check_expense_amount_positive
CHECK (amount > 0);

-- 4.2. Garantir que due_date não seja no passado ao criar
-- (apenas para novas inserções, não afeta dados existentes)
CREATE OR REPLACE FUNCTION validate_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.due_date < CURRENT_DATE THEN
    -- Avisar mas permitir (pode ser importação de dados históricos)
    RAISE WARNING 'Due date % is in the past for %', NEW.due_date, NEW.description;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_invoice_due_date ON invoices;
CREATE TRIGGER validate_invoice_due_date
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_due_date();

-- =====================================================
-- 5. CAMPOS ADICIONAIS DA API BRASIL
-- =====================================================

-- 5.1. Adicionar campos importantes que faltavam na tabela clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS opcao_pelo_simples BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_opcao_simples DATE,
ADD COLUMN IF NOT EXISTS opcao_pelo_mei BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS motivo_situacao_cadastral TEXT,
ADD COLUMN IF NOT EXISTS data_situacao_cadastral DATE,
ADD COLUMN IF NOT EXISTS telefone_secundario VARCHAR(20),
ADD COLUMN IF NOT EXISTS fax VARCHAR(20);

-- 5.2. Comentários explicativos
COMMENT ON COLUMN clients.opcao_pelo_simples IS 'Se a empresa é optante do Simples Nacional';
COMMENT ON COLUMN clients.opcao_pelo_mei IS 'Se a empresa é MEI (Microempreendedor Individual)';
COMMENT ON COLUMN clients.motivo_situacao_cadastral IS 'Motivo da situação cadastral atual';
COMMENT ON COLUMN clients.data_situacao_cadastral IS 'Data da última alteração na situação cadastral';

-- =====================================================
-- 6. TABELA DE AUDITORIA PARA MUDANÇAS CRÍTICAS
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_reason TEXT,
  automatic BOOLEAN DEFAULT false
);

CREATE INDEX idx_invoice_audit_invoice ON invoice_status_audit(invoice_id);
CREATE INDEX idx_invoice_audit_date ON invoice_status_audit(changed_at DESC);

-- 6.1. Trigger para registrar mudanças de status
CREATE OR REPLACE FUNCTION audit_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO invoice_status_audit (
      invoice_id,
      old_status,
      new_status,
      changed_by,
      change_reason,
      automatic
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.updated_by,
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      (NEW.updated_by IS NULL) -- Se não tem updated_by, foi automático
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_invoice_status ON invoices;
CREATE TRIGGER audit_invoice_status
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION audit_invoice_status_change();

-- =====================================================
-- 7. VIEWS AUXILIARES PARA PERFORMANCE
-- =====================================================

-- 7.1. View materializada para Dashboard (cache de KPIs)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM clients WHERE status = 'active') as total_clients,
  (SELECT COUNT(*) FROM invoices WHERE status = 'pending') as pending_invoices_count,
  (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'pending') as total_pending,
  (SELECT COUNT(*) FROM invoices WHERE status = 'overdue') as overdue_invoices_count,
  (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'overdue') as total_overdue,
  (SELECT COUNT(*) FROM expenses WHERE status = 'pending') as pending_expenses_count,
  (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE status = 'pending') as total_expenses,
  now() as last_updated;

CREATE UNIQUE INDEX idx_mv_dashboard_kpis_refresh ON mv_dashboard_kpis(last_updated);

-- 7.2. Função para refresh da view materializada
CREATE OR REPLACE FUNCTION refresh_dashboard_kpis()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpis;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. RLS POLICIES PARA NOVAS TABELAS
-- =====================================================

ALTER TABLE invoice_status_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver auditorias"
  ON invoice_status_audit FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 9. EXECUTAR CORREÇÕES INICIAIS
-- =====================================================

-- 9.1. Atualizar invoices vencidas para overdue
SELECT update_overdue_invoices();

-- 9.2. Refresh inicial da view materializada
SELECT refresh_dashboard_kpis();

-- =====================================================
-- 10. COMENTÁRIOS FINAIS
-- =====================================================

COMMENT ON TABLE invoice_status_audit IS 'Auditoria de mudanças de status de invoices para rastreabilidade';
COMMENT ON FUNCTION update_overdue_invoices IS 'Atualiza automaticamente invoices pendentes que já venceram para status overdue';
COMMENT ON FUNCTION refresh_dashboard_kpis IS 'Atualiza cache de KPIs do dashboard para melhor performance';
COMMENT ON MATERIALIZED VIEW mv_dashboard_kpis IS 'Cache de KPIs principais do dashboard - refresh a cada 5 minutos recomendado';

-- =====================================================
-- INSTRUÇÕES DE USO:
-- =====================================================
--
-- 1. Para atualizar invoices vencidas manualmente:
--    SELECT update_overdue_invoices();
--
-- 2. Para atualizar cache do dashboard:
--    SELECT refresh_dashboard_kpis();
--
-- 3. Agendar refresh automático (via Edge Function ou pg_cron):
--    SELECT cron.schedule('refresh-dashboard', '*/5 * * * *', 'SELECT refresh_dashboard_kpis()');
--    SELECT cron.schedule('update-overdue', '0 1 * * *', 'SELECT update_overdue_invoices()');
--
-- =====================================================
