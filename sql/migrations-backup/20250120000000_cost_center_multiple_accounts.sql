-- =====================================================
-- PERMITIR MÚLTIPLAS CONTAS PAI POR CENTRO DE CUSTO
-- Criar tabela de relacionamento muitos-para-muitos
-- =====================================================

-- 1. Criar tabela de relacionamento
CREATE TABLE IF NOT EXISTS cost_center_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
  chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(cost_center_id, chart_account_id)
);

-- 2. Habilitar RLS
ALTER TABLE cost_center_accounts ENABLE ROW LEVEL SECURITY;

-- 3. Política para usuários autenticados
DROP POLICY IF EXISTS "Users can manage cost_center_accounts" ON cost_center_accounts;
CREATE POLICY "Users can manage cost_center_accounts" ON cost_center_accounts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Migrar dados existentes de default_chart_account_id
DO $$
DECLARE
  v_cost_center RECORD;
BEGIN
  FOR v_cost_center IN 
    SELECT id, default_chart_account_id 
    FROM cost_centers 
    WHERE default_chart_account_id IS NOT NULL
  LOOP
    INSERT INTO cost_center_accounts (cost_center_id, chart_account_id)
    VALUES (v_cost_center.id, v_cost_center.default_chart_account_id)
    ON CONFLICT (cost_center_id, chart_account_id) DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Dados migrados para cost_center_accounts';
END $$;

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_cost_center_accounts_cost_center 
ON cost_center_accounts(cost_center_id);

CREATE INDEX IF NOT EXISTS idx_cost_center_accounts_chart_account 
ON cost_center_accounts(chart_account_id);

-- 6. Criar view para facilitar consultas
CREATE OR REPLACE VIEW vw_cost_center_with_accounts AS
SELECT 
  cc.id AS cost_center_id,
  cc.code AS cost_center_code,
  cc.name AS cost_center_name,
  cc.description AS cost_center_description,
  ARRAY_AGG(coa.id) FILTER (WHERE coa.id IS NOT NULL) AS account_ids,
  ARRAY_AGG(coa.code) FILTER (WHERE coa.code IS NOT NULL) AS account_codes,
  ARRAY_AGG(coa.name) FILTER (WHERE coa.name IS NOT NULL) AS account_names
FROM cost_centers cc
LEFT JOIN cost_center_accounts cca ON cc.id = cca.cost_center_id
LEFT JOIN chart_of_accounts coa ON cca.chart_account_id = coa.id
WHERE cc.is_active = true
GROUP BY cc.id, cc.code, cc.name, cc.description
ORDER BY cc.code;

COMMENT ON VIEW vw_cost_center_with_accounts IS 'Centros de custo com todas as contas pai vinculadas';

-- LOG FINAL
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ MÚLTIPLAS CONTAS PAI POR CENTRO DE CUSTO';
  RAISE NOTICE '';
  RAISE NOTICE 'Mudanças implementadas:';
  RAISE NOTICE '  1. Tabela cost_center_accounts criada (N:N)';
  RAISE NOTICE '  2. Dados migrados de default_chart_account_id';
  RAISE NOTICE '  3. View vw_cost_center_with_accounts criada';
  RAISE NOTICE '  4. Índices de performance adicionados';
  RAISE NOTICE '';
  RAISE NOTICE 'Agora cada centro de custo pode ter múltiplas contas pai!';
  RAISE NOTICE '';
END $$;
