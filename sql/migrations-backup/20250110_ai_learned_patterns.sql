-- Tabela para armazenar padrões aprendidos pelo Dr. Cícero
CREATE TABLE IF NOT EXISTS ai_learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description_pattern TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  debit_account TEXT NOT NULL,
  debit_account_name TEXT,
  credit_account TEXT NOT NULL,
  credit_account_name TEXT,
  entry_description TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.9,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(description_pattern)
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_ai_learned_patterns_description ON ai_learned_patterns(description_pattern);
CREATE INDEX IF NOT EXISTS idx_ai_learned_patterns_entry_type ON ai_learned_patterns(entry_type);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ai_learned_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_learned_patterns_updated ON ai_learned_patterns;
CREATE TRIGGER trg_ai_learned_patterns_updated
  BEFORE UPDATE ON ai_learned_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_learned_patterns_updated_at();

-- RLS Policies
ALTER TABLE ai_learned_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read patterns" ON ai_learned_patterns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert patterns" ON ai_learned_patterns
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update patterns" ON ai_learned_patterns
  FOR UPDATE TO authenticated USING (true);

-- Inserir alguns padrões iniciais comuns
INSERT INTO ai_learned_patterns (description_pattern, entry_type, debit_account, debit_account_name, credit_account, credit_account_name, entry_description, confidence)
VALUES
  ('TARIFA', 'despesa_bancaria', '4.1.3.02', 'Tarifas Bancárias', '1.1.1.02', 'Banco Sicredi C/C', 'Tarifa bancária', 0.98),
  ('TED', 'despesa_bancaria', '4.1.3.02', 'Tarifas Bancárias', '1.1.1.02', 'Banco Sicredi C/C', 'Tarifa TED', 0.98),
  ('DOC', 'despesa_bancaria', '4.1.3.02', 'Tarifas Bancárias', '1.1.1.02', 'Banco Sicredi C/C', 'Tarifa DOC', 0.98),
  ('LIQ.COBRANCA', 'recebimento', '1.1.1.02', 'Banco Sicredi C/C', '1.1.2.01', 'Clientes a Receber', 'Recebimento boleto', 0.90),
  ('RECEBIMENTO PIX', 'recebimento', '1.1.1.02', 'Banco Sicredi C/C', '1.1.2.01', 'Clientes a Receber', 'Recebimento PIX', 0.85),
  ('ENERGIA', 'despesa_administrativa', '4.1.2.02', 'Energia Elétrica', '1.1.1.02', 'Banco Sicredi C/C', 'Pagamento energia', 0.95),
  ('CEMIG', 'despesa_administrativa', '4.1.2.02', 'Energia Elétrica', '1.1.1.02', 'Banco Sicredi C/C', 'Pagamento CEMIG', 0.98),
  ('TELEFONE', 'despesa_administrativa', '4.1.2.03', 'Telefone e Internet', '1.1.1.02', 'Banco Sicredi C/C', 'Pagamento telefone', 0.95),
  ('INTERNET', 'despesa_administrativa', '4.1.3.03', 'Telefone e Internet', '1.1.1.02', 'Banco Sicredi C/C', 'Pagamento internet', 0.95),
  ('ALUGUEL', 'despesa_administrativa', '4.1.2.01', 'Aluguel', '1.1.1.02', 'Banco Sicredi C/C', 'Pagamento aluguel', 0.95)
ON CONFLICT (description_pattern) DO NOTHING;

-- Comentário da tabela
COMMENT ON TABLE ai_learned_patterns IS 'Padrões aprendidos pelo Dr. Cícero (Contador IA) para classificação automática de transações';
