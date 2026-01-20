-- Tabela para lançamentos de caixa (movimentações em dinheiro/espécie)
CREATE TABLE IF NOT EXISTS cash_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('entrada', 'saida')),
  category TEXT,
  cost_center_id UUID REFERENCES cost_centers(id),
  account_id UUID REFERENCES chart_of_accounts(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cash_entries_entry_date ON cash_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_cash_entries_entry_type ON cash_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_cash_entries_created_by ON cash_entries(created_by);

-- RLS
ALTER TABLE cash_entries ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados
CREATE POLICY "Users can view all cash entries" ON cash_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert cash entries" ON cash_entries
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update cash entries" ON cash_entries
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete cash entries" ON cash_entries
  FOR DELETE TO authenticated USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_cash_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cash_entries_updated_at
  BEFORE UPDATE ON cash_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_entries_updated_at();

-- Comentário na tabela
COMMENT ON TABLE cash_entries IS 'Lançamentos de caixa - movimentações em dinheiro/espécie';
