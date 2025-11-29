-- =====================================================
-- SISTEMA CONTÁBIL COMPLETO
-- Livro Diário, Razão, Balancete, ARE e Balanço
-- =====================================================

-- =====================================================
-- 1. LIVRO DIÁRIO (Registro cronológico de lançamentos)
-- =====================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number SERIAL, -- Número sequencial do lançamento
  entry_date DATE NOT NULL,
  competence TEXT NOT NULL, -- YYYY-MM

  -- Histórico/Descrição
  description TEXT NOT NULL,
  document_type TEXT, -- 'invoice', 'expense', 'contract', 'manual', 'adjustment', 'closing'
  document_number TEXT,
  document_id UUID, -- Referência ao documento original

  -- Totais
  total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_balanced BOOLEAN GENERATED ALWAYS AS (total_debit = total_credit) STORED,

  -- Controle
  is_closing_entry BOOLEAN DEFAULT false, -- Lançamento de encerramento
  fiscal_year INTEGER NOT NULL,

  -- Metadados
  ai_generated BOOLEAN DEFAULT false,
  ai_model TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partidas do lançamento (débitos e créditos)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,

  -- Conta contábil
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  account_code TEXT NOT NULL, -- Desnormalizado para performance
  account_name TEXT NOT NULL, -- Desnormalizado para performance

  -- Valores (um dos dois deve ser > 0)
  debit_amount DECIMAL(15,2) DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount DECIMAL(15,2) DEFAULT 0 CHECK (credit_amount >= 0),

  -- Histórico da linha
  description TEXT,

  -- Referência opcional ao cliente
  client_id UUID REFERENCES clients(id),

  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT check_debit_or_credit CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (credit_amount > 0 AND debit_amount = 0) OR
    (debit_amount = 0 AND credit_amount = 0)
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_competence ON journal_entries(competence);
CREATE INDEX IF NOT EXISTS idx_journal_entries_fiscal_year ON journal_entries(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);

-- =====================================================
-- 2. RAZÃO CONTÁBIL (Saldo por conta)
-- =====================================================
-- View materializada para saldo das contas
CREATE MATERIALIZED VIEW IF NOT EXISTS account_ledger AS
SELECT
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  a.nature,
  COALESCE(SUM(jel.debit_amount), 0) AS total_debit,
  COALESCE(SUM(jel.credit_amount), 0) AS total_credit,
  CASE
    WHEN a.nature = 'debit' THEN COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
    ELSE COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
  END AS balance,
  COUNT(DISTINCT jel.journal_entry_id) AS movement_count
FROM chart_of_accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
GROUP BY a.id, a.code, a.name, a.type, a.nature
ORDER BY a.code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_ledger_id ON account_ledger(account_id);

-- Função para atualizar razão
CREATE OR REPLACE FUNCTION refresh_account_ledger()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY account_ledger;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. RAZÃO ANALÍTICO (Movimento detalhado por conta)
-- =====================================================
CREATE OR REPLACE VIEW account_ledger_detail AS
SELECT
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  a.nature,
  je.id AS journal_entry_id,
  je.entry_number,
  je.entry_date,
  je.competence,
  je.description AS entry_description,
  jel.description AS line_description,
  jel.debit_amount,
  jel.credit_amount,
  jel.client_id,
  c.name AS client_name,
  -- Saldo acumulado (calculado em runtime)
  SUM(
    CASE
      WHEN a.nature = 'debit' THEN jel.debit_amount - jel.credit_amount
      ELSE jel.credit_amount - jel.debit_amount
    END
  ) OVER (
    PARTITION BY a.id
    ORDER BY je.entry_date, je.entry_number
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_balance
FROM chart_of_accounts a
JOIN journal_entry_lines jel ON jel.account_id = a.id
JOIN journal_entries je ON je.id = jel.journal_entry_id
LEFT JOIN clients c ON c.id = jel.client_id
ORDER BY a.code, je.entry_date, je.entry_number;

-- =====================================================
-- 4. BALANCETE (Mensal/Trimestral/Anual)
-- =====================================================
CREATE TABLE IF NOT EXISTS trial_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  competence TEXT NOT NULL, -- YYYY-MM ou YYYY-Q1 ou YYYY
  fiscal_year INTEGER NOT NULL,

  -- Totais
  total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_balanced BOOLEAN GENERATED ALWAYS AS (total_debit = total_credit) STORED,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'closed')),

  -- Geração
  ai_generated BOOLEAN DEFAULT false,
  generation_date TIMESTAMPTZ DEFAULT now(),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Linhas do balancete
CREATE TABLE IF NOT EXISTS trial_balance_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_balance_id UUID NOT NULL REFERENCES trial_balances(id) ON DELETE CASCADE,

  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_nature TEXT NOT NULL,

  -- Saldos
  previous_balance DECIMAL(15,2) DEFAULT 0, -- Saldo anterior
  debit_movement DECIMAL(15,2) DEFAULT 0, -- Movimento a débito
  credit_movement DECIMAL(15,2) DEFAULT 0, -- Movimento a crédito
  current_balance DECIMAL(15,2) DEFAULT 0, -- Saldo atual

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_trial_balances_period ON trial_balances(period_type, competence);
CREATE INDEX IF NOT EXISTS idx_trial_balance_lines_balance ON trial_balance_lines(trial_balance_id);

-- =====================================================
-- 5. APURAÇÃO DE RESULTADO DO EXERCÍCIO (ARE)
-- =====================================================
CREATE TABLE IF NOT EXISTS fiscal_year_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INTEGER NOT NULL UNIQUE,
  closing_date DATE NOT NULL, -- Geralmente 31/12

  -- Resultado
  total_revenue DECIMAL(15,2) DEFAULT 0, -- Total de receitas (contas 3.x)
  total_expenses DECIMAL(15,2) DEFAULT 0, -- Total de despesas (contas 4.x)
  net_result DECIMAL(15,2) GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
  result_type TEXT GENERATED ALWAYS AS (
    CASE
      WHEN total_revenue - total_expenses > 0 THEN 'profit'
      WHEN total_revenue - total_expenses < 0 THEN 'loss'
      ELSE 'break_even'
    END
  ) STORED,

  -- Conta destino do resultado
  result_account_id UUID REFERENCES chart_of_accounts(id),

  -- Lançamentos gerados
  closing_journal_entry_id UUID REFERENCES journal_entries(id),
  result_transfer_entry_id UUID REFERENCES journal_entries(id),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'reverted')),

  -- Geração
  ai_generated BOOLEAN DEFAULT false,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ
);

-- =====================================================
-- 6. BALANÇO PATRIMONIAL
-- =====================================================
CREATE TABLE IF NOT EXISTS balance_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_date DATE NOT NULL, -- Data de referência (geralmente 31/12)
  fiscal_year INTEGER NOT NULL,

  -- ATIVO
  total_current_assets DECIMAL(15,2) DEFAULT 0, -- Ativo Circulante
  total_non_current_assets DECIMAL(15,2) DEFAULT 0, -- Ativo Não Circulante
  total_assets DECIMAL(15,2) GENERATED ALWAYS AS (total_current_assets + total_non_current_assets) STORED,

  -- PASSIVO
  total_current_liabilities DECIMAL(15,2) DEFAULT 0, -- Passivo Circulante
  total_non_current_liabilities DECIMAL(15,2) DEFAULT 0, -- Passivo Não Circulante
  total_liabilities DECIMAL(15,2) GENERATED ALWAYS AS (total_current_liabilities + total_non_current_liabilities) STORED,

  -- PATRIMÔNIO LÍQUIDO
  share_capital DECIMAL(15,2) DEFAULT 0, -- Capital Social
  capital_reserves DECIMAL(15,2) DEFAULT 0, -- Reservas de Capital
  profit_reserves DECIMAL(15,2) DEFAULT 0, -- Reservas de Lucros
  accumulated_profits DECIMAL(15,2) DEFAULT 0, -- Lucros Acumulados
  accumulated_losses DECIMAL(15,2) DEFAULT 0, -- Prejuízos Acumulados
  current_year_result DECIMAL(15,2) DEFAULT 0, -- Resultado do Exercício
  total_equity DECIMAL(15,2) GENERATED ALWAYS AS (
    share_capital + capital_reserves + profit_reserves + accumulated_profits - accumulated_losses + current_year_result
  ) STORED,

  -- Verificação (Ativo = Passivo + PL)
  is_balanced BOOLEAN GENERATED ALWAYS AS (
    ABS((total_current_assets + total_non_current_assets) -
        (total_current_liabilities + total_non_current_liabilities +
         share_capital + capital_reserves + profit_reserves + accumulated_profits - accumulated_losses + current_year_result)) < 0.01
  ) STORED,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'published')),

  -- Geração
  ai_generated BOOLEAN DEFAULT false,
  fiscal_year_closing_id UUID REFERENCES fiscal_year_closings(id),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Detalhamento do balanço
CREATE TABLE IF NOT EXISTS balance_sheet_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_sheet_id UUID NOT NULL REFERENCES balance_sheets(id) ON DELETE CASCADE,

  account_id UUID REFERENCES chart_of_accounts(id),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,

  -- Grupo no balanço
  group_type TEXT NOT NULL CHECK (group_type IN (
    'current_asset', 'non_current_asset',
    'current_liability', 'non_current_liability',
    'equity'
  )),

  balance DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Ordem de exibição
  display_order INTEGER,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_balance_sheets_year ON balance_sheets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_balance_sheet_lines_sheet ON balance_sheet_lines(balance_sheet_id);

-- =====================================================
-- 7. PROVISÕES AUTOMÁTICAS
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_type TEXT NOT NULL CHECK (provision_type IN (
    'monthly_fee', 'thirteenth_fee', 'vacation', 'tax', 'other'
  )),
  client_id UUID REFERENCES clients(id),

  competence TEXT NOT NULL, -- YYYY-MM
  amount DECIMAL(15,2) NOT NULL,

  -- Lançamento gerado
  journal_entry_id UUID REFERENCES journal_entries(id),

  -- Status
  status TEXT DEFAULT 'provisioned' CHECK (status IN ('provisioned', 'realized', 'reversed')),
  realization_date DATE,
  realization_entry_id UUID REFERENCES journal_entries(id),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_provisions_competence ON accounting_provisions(competence);
CREATE INDEX IF NOT EXISTS idx_provisions_client ON accounting_provisions(client_id);

-- =====================================================
-- 8. CONFIGURAÇÃO DO PLANO DE CONTAS (Complemento)
-- =====================================================

-- Adicionar campos se não existirem
DO $$
BEGIN
  -- Natureza da conta (devedora/credora)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chart_of_accounts' AND column_name = 'nature') THEN
    ALTER TABLE chart_of_accounts ADD COLUMN nature TEXT DEFAULT 'debit'
      CHECK (nature IN ('debit', 'credit'));
  END IF;

  -- Aceita lançamentos (contas sintéticas vs analíticas)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chart_of_accounts' AND column_name = 'accepts_entries') THEN
    ALTER TABLE chart_of_accounts ADD COLUMN accepts_entries BOOLEAN DEFAULT true;
  END IF;

  -- Conta de resultado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chart_of_accounts' AND column_name = 'is_result_account') THEN
    ALTER TABLE chart_of_accounts ADD COLUMN is_result_account BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Atualizar natureza das contas existentes
UPDATE chart_of_accounts SET
  nature = CASE
    WHEN code LIKE '1.%' THEN 'debit'  -- Ativo = Devedora
    WHEN code LIKE '2.%' THEN 'credit' -- Passivo = Credora
    WHEN code LIKE '3.%' THEN 'credit' -- Receita = Credora
    WHEN code LIKE '4.%' THEN 'debit'  -- Despesa = Devedora
    WHEN code LIKE '5.%' THEN 'credit' -- PL = Credora
    ELSE 'debit'
  END,
  is_result_account = CASE
    WHEN code LIKE '3.%' OR code LIKE '4.%' THEN true
    ELSE false
  END
WHERE nature IS NULL OR is_result_account IS NULL;

-- Inserir contas especiais se não existirem
INSERT INTO chart_of_accounts (code, name, account_type, nature, accepts_entries, is_result_account, level, is_analytical) VALUES
  -- Conta ARE (Apuração do Resultado)
  ('5.1', 'Apuração do Resultado do Exercício', 'PATRIMONIO_LIQUIDO', 'credit', true, false, 2, true),
  -- Lucros Acumulados
  ('5.2', 'Lucros Acumulados', 'PATRIMONIO_LIQUIDO', 'credit', true, false, 2, true),
  -- Prejuízos Acumulados
  ('5.3', 'Prejuízos Acumulados', 'PATRIMONIO_LIQUIDO', 'debit', true, false, 2, true),
  -- Capital Social
  ('5.4', 'Capital Social', 'PATRIMONIO_LIQUIDO', 'credit', true, false, 2, true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 9. TRIGGERS PARA LANÇAMENTOS AUTOMÁTICOS
-- =====================================================

-- Trigger: Atualiza razão após lançamento
CREATE OR REPLACE FUNCTION trigger_update_ledger_after_journal()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar view materializada de forma assíncrona
  PERFORM pg_notify('refresh_ledger', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_ledger ON journal_entry_lines;
CREATE TRIGGER trg_update_ledger
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_update_ledger_after_journal();

-- Trigger: Recalcula totais do lançamento
CREATE OR REPLACE FUNCTION trigger_recalc_journal_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE journal_entries
  SET
    total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM journal_entry_lines WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)),
    total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM journal_entry_lines WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_journal ON journal_entry_lines;
CREATE TRIGGER trg_recalc_journal
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_journal_totals();

-- =====================================================
-- 10. FUNÇÕES AUXILIARES
-- =====================================================

-- Função: Gerar número de lançamento
CREATE OR REPLACE FUNCTION generate_journal_entry_number(p_fiscal_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_next_number
  FROM journal_entries
  WHERE fiscal_year = p_fiscal_year;

  RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- Função: Obter saldo de conta em determinada data
CREATE OR REPLACE FUNCTION get_account_balance(
  p_account_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
) RETURNS DECIMAL AS $$
DECLARE
  v_balance DECIMAL;
  v_nature TEXT;
BEGIN
  SELECT nature INTO v_nature FROM chart_of_accounts WHERE id = p_account_id;

  SELECT
    CASE
      WHEN v_nature = 'debit' THEN COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
      ELSE COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
    END
  INTO v_balance
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id
    AND je.entry_date <= p_as_of_date;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Função: Obter movimento de conta em período
CREATE OR REPLACE FUNCTION get_account_movement(
  p_account_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  debit_total DECIMAL,
  credit_total DECIMAL,
  net_movement DECIMAL
) AS $$
DECLARE
  v_nature TEXT;
BEGIN
  SELECT nature INTO v_nature FROM chart_of_accounts WHERE id = p_account_id;

  RETURN QUERY
  SELECT
    COALESCE(SUM(jel.debit_amount), 0) AS debit_total,
    COALESCE(SUM(jel.credit_amount), 0) AS credit_total,
    CASE
      WHEN v_nature = 'debit' THEN COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
      ELSE COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
    END AS net_movement
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id
    AND je.entry_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. RLS POLICIES
-- =====================================================
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_balance_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_year_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_sheet_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_provisions ENABLE ROW LEVEL SECURITY;

-- Policies permissivas
CREATE POLICY "Allow all for authenticated" ON journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON journal_entry_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON trial_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON trial_balance_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON fiscal_year_closings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON balance_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON balance_sheet_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON accounting_provisions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role
CREATE POLICY "Service role full access" ON journal_entries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON journal_entry_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON trial_balances FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON trial_balance_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON fiscal_year_closings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON balance_sheets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON balance_sheet_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON accounting_provisions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
