-- =====================================================
-- CONTROLE DE PERÍODOS CONTÁBEIS
-- Gerencia fechamento/reabertura de meses
-- =====================================================

BEGIN;

-- Tabela de períodos contábeis
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

-- Tabela de solicitações de reabertura
CREATE TABLE IF NOT EXISTS period_reopen_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES accounting_periods(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  requested_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de histórico de fechamentos
CREATE TABLE IF NOT EXISTS period_close_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES accounting_periods(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('closed', 'reopened', 'locked')),
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  balances JSONB, -- Snapshot dos saldos no momento do fechamento
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de conhecimento do Dr. Cícero
CREATE TABLE IF NOT EXISTS dr_cicero_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  knowledge TEXT NOT NULL,
  sources TEXT[],
  category TEXT,
  learned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir período de Janeiro/2025 como fechado
INSERT INTO accounting_periods (year, month, status, closed_at, notes)
VALUES (2025, 1, 'closed', NOW(), 'Janeiro/2025 fechado e auditado. Saldo banco R$ 18.553,54, Clientes a Receber R$ 136.821,59')
ON CONFLICT (year, month) DO NOTHING;

-- Inserir período de Fevereiro/2025 como aberto
INSERT INTO accounting_periods (year, month, status, notes)
VALUES (2025, 2, 'open', 'Fevereiro/2025 - competência atual')
ON CONFLICT (year, month) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_accounting_periods_year_month ON accounting_periods(year, month);
CREATE INDEX IF NOT EXISTS idx_period_reopen_requests_status ON period_reopen_requests(status);
CREATE INDEX IF NOT EXISTS idx_dr_cicero_knowledge_topic ON dr_cicero_knowledge(topic);

-- RLS
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_reopen_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_close_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dr_cicero_knowledge ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública
CREATE POLICY "accounting_periods_public_read" ON accounting_periods FOR SELECT USING (true);
CREATE POLICY "period_reopen_requests_public_read" ON period_reopen_requests FOR SELECT USING (true);
CREATE POLICY "period_close_history_public_read" ON period_close_history FOR SELECT USING (true);
CREATE POLICY "dr_cicero_knowledge_public_read" ON dr_cicero_knowledge FOR SELECT USING (true);

-- Políticas de escrita (service role)
CREATE POLICY "accounting_periods_service_write" ON accounting_periods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "period_reopen_requests_service_write" ON period_reopen_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "period_close_history_service_write" ON period_close_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dr_cicero_knowledge_service_write" ON dr_cicero_knowledge FOR ALL USING (true) WITH CHECK (true);

-- Função para verificar se período está aberto
CREATE OR REPLACE FUNCTION is_period_open(p_year INTEGER, p_month INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM accounting_periods
  WHERE year = p_year AND month = p_month;

  -- Se não existe, está aberto por padrão
  IF v_status IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN v_status = 'open';
END;
$$ LANGUAGE plpgsql;

-- Trigger para impedir alterações em períodos fechados
CREATE OR REPLACE FUNCTION check_period_before_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM NEW.entry_date);
  v_month := EXTRACT(MONTH FROM NEW.entry_date);

  IF NOT is_period_open(v_year, v_month) THEN
    RAISE EXCEPTION 'Período %/% está fechado. Solicite reabertura para fazer alterações.', v_month, v_year;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em accounting_entries
DROP TRIGGER IF EXISTS check_period_before_entry_trigger ON accounting_entries;
CREATE TRIGGER check_period_before_entry_trigger
  BEFORE INSERT OR UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION check_period_before_entry();

COMMIT;
