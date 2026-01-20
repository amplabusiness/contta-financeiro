-- =====================================================
-- ADICIONAR REFERÊNCIAS AO DIÁRIO EM TABELAS EXISTENTES
-- =====================================================

-- Adicionar coluna journal_entry_id em invoices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'journal_entry_id') THEN
    ALTER TABLE invoices ADD COLUMN journal_entry_id UUID REFERENCES journal_entries(id);
  END IF;
END $$;

-- Adicionar coluna journal_entry_id em expenses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'journal_entry_id') THEN
    ALTER TABLE expenses ADD COLUMN journal_entry_id UUID REFERENCES journal_entries(id);
  END IF;
END $$;

-- Adicionar coluna journal_entry_id em bank_transactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'journal_entry_id') THEN
    ALTER TABLE bank_transactions ADD COLUMN journal_entry_id UUID REFERENCES journal_entries(id);
  END IF;
END $$;

-- Adicionar coluna journal_entry_id em client_opening_balance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_opening_balance' AND column_name = 'journal_entry_id') THEN
    ALTER TABLE client_opening_balance ADD COLUMN journal_entry_id UUID REFERENCES journal_entries(id);
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_invoices_journal ON invoices(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_expenses_journal ON expenses(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_journal ON bank_transactions(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_opening_balance_journal ON client_opening_balance(journal_entry_id);

-- =====================================================
-- TABELA DE CONTROLE DE CARGA INICIAL
-- =====================================================
CREATE TABLE IF NOT EXISTS initial_load_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_type TEXT NOT NULL, -- 'full', 'opening_balances', 'invoices', 'bank_statement', 'reports'
  fiscal_year INTEGER NOT NULL,
  competence TEXT NOT NULL, -- YYYY-MM

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),

  -- Resultados
  records_processed INTEGER DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,

  -- Logs
  logs JSONB,
  error_message TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_initial_load_status ON initial_load_control(status);
CREATE INDEX IF NOT EXISTS idx_initial_load_year ON initial_load_control(fiscal_year, competence);

-- RLS
ALTER TABLE initial_load_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON initial_load_control FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON initial_load_control FOR ALL TO service_role USING (true) WITH CHECK (true);
