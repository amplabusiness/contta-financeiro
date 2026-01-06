-- Tabela para armazenar regras de aprendizado do Dr. Cicero (Auto-Learn)
CREATE TABLE IF NOT EXISTS intelligence_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL, -- O texto a ser buscado na descrição (ex: "Paula milhomem")
  account_code TEXT NOT NULL, -- O código da conta a ser sugerida (ex: "1.1.2.01.004")
  account_name TEXT, -- Nome da conta para cache/visualização
  rule_type TEXT DEFAULT 'contains', -- 'contains', 'exact', 'regex'
  operation_type TEXT, -- 'debit' (pagamento) ou 'credit' (recebimento)
  created_at TIMESTAMPTZ DEFAULT now(),
  use_count INTEGER DEFAULT 0 -- Para saber quais regras são mais usadas
);

CREATE INDEX IF NOT EXISTS idx_intelligence_pattern ON intelligence_rules(pattern);
