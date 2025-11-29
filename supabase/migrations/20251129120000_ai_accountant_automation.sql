-- =====================================================
-- AI ACCOUNTANT AUTOMATION
-- Contador IA trabalhando automaticamente em background
-- =====================================================

-- 1. Adicionar colunas de validação IA na tabela accounting_entries
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS ai_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_validation_score INTEGER,
ADD COLUMN IF NOT EXISTS ai_validation_status TEXT DEFAULT 'pending' CHECK (ai_validation_status IN ('pending', 'validating', 'approved', 'warning', 'rejected')),
ADD COLUMN IF NOT EXISTS ai_validation_message TEXT,
ADD COLUMN IF NOT EXISTS ai_validated_at TIMESTAMPTZ;

-- 2. Criar tabela para log de atividades do Contador IA
CREATE TABLE IF NOT EXISTS ai_accountant_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES accounting_entries(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('validation', 'correction', 'suggestion', 'approval', 'rejection')),
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
  score INTEGER,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_accounting_entries_ai_status ON accounting_entries(ai_validation_status);
CREATE INDEX IF NOT EXISTS idx_ai_activity_created ON ai_accountant_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_activity_entry ON ai_accountant_activity(entry_id);

-- 4. Habilitar RLS
ALTER TABLE ai_accountant_activity ENABLE ROW LEVEL SECURITY;

-- 5. Política de acesso
CREATE POLICY "Users can view AI activity" ON ai_accountant_activity
  FOR SELECT USING (true);

CREATE POLICY "System can insert AI activity" ON ai_accountant_activity
  FOR INSERT WITH CHECK (true);

-- 6. Função para registrar atividade do Contador IA
CREATE OR REPLACE FUNCTION log_ai_accountant_activity(
  p_entry_id UUID,
  p_action_type TEXT,
  p_status TEXT,
  p_score INTEGER,
  p_message TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO ai_accountant_activity (
    entry_id,
    action_type,
    status,
    score,
    message,
    details
  ) VALUES (
    p_entry_id,
    p_action_type,
    p_status,
    p_score,
    p_message,
    p_details
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para buscar lançamentos pendentes de validação
CREATE OR REPLACE FUNCTION get_pending_ai_validations(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  entry_id UUID,
  entry_date DATE,
  description TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id as entry_id,
    ae.entry_date,
    ae.description,
    COALESCE(SUM(ael.debit_amount), 0) as total_debit,
    COALESCE(SUM(ael.credit_amount), 0) as total_credit,
    ae.created_at
  FROM accounting_entries ae
  LEFT JOIN accounting_entry_lines ael ON ae.id = ael.entry_id
  WHERE ae.ai_validation_status = 'pending'
  GROUP BY ae.id, ae.entry_date, ae.description, ae.created_at
  ORDER BY ae.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Função para atualizar status de validação IA
CREATE OR REPLACE FUNCTION update_ai_validation_status(
  p_entry_id UUID,
  p_status TEXT,
  p_score INTEGER,
  p_message TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE accounting_entries
  SET
    ai_validated = (p_status = 'approved'),
    ai_validation_status = p_status,
    ai_validation_score = p_score,
    ai_validation_message = p_message,
    ai_validated_at = NOW()
  WHERE id = p_entry_id;

  -- Registrar atividade
  PERFORM log_ai_accountant_activity(
    p_entry_id,
    'validation',
    CASE
      WHEN p_status = 'approved' THEN 'success'
      WHEN p_status = 'warning' THEN 'warning'
      ELSE 'error'
    END,
    p_score,
    p_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. View para dashboard do Contador IA
CREATE OR REPLACE VIEW v_ai_accountant_dashboard AS
SELECT
  COUNT(*) FILTER (WHERE ai_validation_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE ai_validation_status = 'validating') as validating_count,
  COUNT(*) FILTER (WHERE ai_validation_status = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE ai_validation_status = 'warning') as warning_count,
  COUNT(*) FILTER (WHERE ai_validation_status = 'rejected') as rejected_count,
  COUNT(*) as total_count,
  ROUND(AVG(ai_validation_score) FILTER (WHERE ai_validation_score IS NOT NULL), 1) as avg_score,
  MAX(ai_validated_at) as last_validation_at
FROM accounting_entries;

-- 10. Marcar lançamentos existentes como pendentes
UPDATE accounting_entries
SET ai_validation_status = 'pending'
WHERE ai_validation_status IS NULL;

COMMENT ON TABLE ai_accountant_activity IS 'Log de atividades do Contador IA - monitora todas as validações automáticas';
COMMENT ON COLUMN accounting_entries.ai_validated IS 'Indica se o lançamento foi validado pelo Contador IA';
COMMENT ON COLUMN accounting_entries.ai_validation_score IS 'Score de validação (0-100) atribuído pelo Contador IA';
