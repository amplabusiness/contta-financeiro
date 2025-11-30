-- =====================================================
-- CONTAS PARA DESPESAS DE SÓCIOS E AFAC
-- Tratamento contábil conforme NBC/CFC
-- =====================================================
--
-- QUANDO A EMPRESA PAGA DESPESAS DO SÓCIO:
-- D - 1.1.3.04 Adiantamentos a Sócios (Ativo - a receber do sócio)
-- C - 1.1.1.02 Banco (diminui saldo)
--
-- QUANDO O SÓCIO COLOCA DINHEIRO NA EMPRESA:
-- D - 1.1.1.02 Banco (aumenta saldo)
-- C - 2.1.4.01 AFAC (Passivo - dever ao sócio)
-- =====================================================

DO $$
DECLARE
  v_parent_id UUID;
BEGIN
  -- =====================================================
  -- 1. ADIANTAMENTOS A SÓCIOS (ATIVO CIRCULANTE)
  -- Empresa paga despesas pessoais do sócio = crédito a receber
  -- =====================================================

  -- Buscar pai: 1.1.3 - OUTROS CRÉDITOS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1.3';

  -- 1.1.3.04 - Adiantamentos a Sócios (sintética)
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('1.1.3.04', 'Adiantamentos a Sócios', 'ATIVO', 'DEVEDORA', 4, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- Contas analíticas por sócio
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1.3.04';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('1.1.3.04.01', 'Adiantamentos - Sergio Carneiro Leão', 'ATIVO', 'DEVEDORA', 5, true, true, v_parent_id),
    ('1.1.3.04.02', 'Adiantamentos - Outros Sócios', 'ATIVO', 'DEVEDORA', 5, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- 2. OBRIGAÇÕES COM SÓCIOS (PASSIVO CIRCULANTE)
  -- AFAC = Adiantamento para Futuro Aumento de Capital
  -- Sócio coloca dinheiro na empresa = obrigação com sócio
  -- =====================================================

  -- Buscar pai: 2.1 - PASSIVO CIRCULANTE
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1';

  -- 2.1.4 - OBRIGAÇÕES COM SÓCIOS (sintética)
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('2.1.4', 'OBRIGAÇÕES COM SÓCIOS', 'PASSIVO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- Contas analíticas por sócio
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1.4';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('2.1.4.01', 'AFAC - Sergio Carneiro Leão', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.4.02', 'AFAC - Outros Sócios', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.4.03', 'Empréstimos de Sócios', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.4.04', 'Lucros a Distribuir', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  RAISE NOTICE 'Contas de Sócios criadas com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'ATIVO (empresa tem a receber do sócio):';
  RAISE NOTICE '  1.1.3.04.01 - Adiantamentos - Sergio Carneiro Leão';
  RAISE NOTICE '';
  RAISE NOTICE 'PASSIVO (empresa deve ao sócio - AFAC):';
  RAISE NOTICE '  2.1.4.01 - AFAC - Sergio Carneiro Leão';
END $$;

-- =====================================================
-- 3. TABELA DE CENTROS DE CUSTO
-- Para separar despesas por responsável/departamento
-- =====================================================

-- Criar tabela de centros de custo se não existir
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES cost_centers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados
DROP POLICY IF EXISTS "Users can manage cost_centers" ON cost_centers;
CREATE POLICY "Users can manage cost_centers" ON cost_centers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Inserir centros de custo
INSERT INTO cost_centers (code, name, description) VALUES
  ('AMPLA', 'Ampla Contabilidade', 'Despesas operacionais do escritório'),
  ('SERGIO', 'Sergio Carneiro Leão', 'Despesas pessoais do sócio Sergio')
ON CONFLICT (code) DO NOTHING;

-- Subcategorias do sócio Sergio
INSERT INTO cost_centers (code, name, description, parent_id)
SELECT
  sub.code,
  sub.name,
  sub.description,
  cc.id
FROM (VALUES
  ('SERGIO.IMOVEIS', 'Imóveis', 'IPTU, condomínios, água, energia'),
  ('SERGIO.VEICULOS', 'Veículos', 'IPVA, combustível, manutenção'),
  ('SERGIO.PESSOAL', 'Despesas Pessoais', 'Saúde, personal, anuidades'),
  ('SERGIO.TELEFONE', 'Telefone', 'Linhas telefônicas pessoais'),
  ('SERGIO.OUTROS', 'Outros', 'Outras despesas')
) AS sub(code, name, description)
CROSS JOIN cost_centers cc
WHERE cc.code = 'SERGIO'
ON CONFLICT (code) DO NOTHING;

-- Adicionar coluna de centro de custo na tabela de despesas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'cost_center_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id);
    RAISE NOTICE 'Coluna cost_center_id adicionada à tabela expenses';
  END IF;
END $$;

-- Adicionar coluna de centro de custo na tabela de transações bancárias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'cost_center_id'
  ) THEN
    ALTER TABLE bank_transactions ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id);
    RAISE NOTICE 'Coluna cost_center_id adicionada à tabela bank_transactions';
  END IF;
END $$;

-- =====================================================
-- 4. VIEW PARA RELATÓRIO DE DESPESAS POR CENTRO DE CUSTO
-- =====================================================

CREATE OR REPLACE VIEW vw_expenses_by_cost_center AS
SELECT
  e.id,
  cc.code AS cost_center_code,
  cc.name AS cost_center_name,
  COALESCE(pcc.name, cc.name) AS parent_name,
  e.description,
  e.amount,
  e.due_date,
  e.payment_date,
  e.category,
  e.status
FROM expenses e
LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
LEFT JOIN cost_centers pcc ON cc.parent_id = pcc.id
ORDER BY cc.code, e.due_date DESC;

COMMENT ON VIEW vw_expenses_by_cost_center IS 'Despesas agrupadas por centro de custo';

-- Log final
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Centros de Custo criados:';
  RAISE NOTICE '  AMPLA - Despesas do escritório';
  RAISE NOTICE '  SERGIO - Despesas pessoais do sócio';
  RAISE NOTICE '    SERGIO.IMOVEIS - IPTU, condomínios';
  RAISE NOTICE '    SERGIO.VEICULOS - IPVA, veículos';
  RAISE NOTICE '    SERGIO.PESSOAL - Saúde, personal';
  RAISE NOTICE '    SERGIO.TELEFONE - Telefone';
  RAISE NOTICE '    SERGIO.OUTROS - Outros';
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'RESUMO DO TRATAMENTO CONTÁBIL';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Quando a AMPLA paga uma despesa pessoal do SERGIO:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Cria um lançamento contábil:';
  RAISE NOTICE '   D - 1.1.3.04.01 Adiantamentos - Sergio';
  RAISE NOTICE '   C - 1.1.1.02 Banco Sicredi';
  RAISE NOTICE '';
  RAISE NOTICE '2. Marca a despesa com centro de custo SERGIO';
  RAISE NOTICE '';
  RAISE NOTICE 'Quando o SERGIO quer zerar o saldo (devolver o dinheiro):';
  RAISE NOTICE '   D - 1.1.1.02 Banco (recebe o dinheiro)';
  RAISE NOTICE '   C - 1.1.3.04.01 Adiantamentos - Sergio (baixa o crédito)';
  RAISE NOTICE '';
  RAISE NOTICE 'Se preferir transformar em AFAC (aumento de capital):';
  RAISE NOTICE '   D - 1.1.3.04.01 Adiantamentos - Sergio (baixa)';
  RAISE NOTICE '   C - 5.1.03 Capital Social Integralizado';
  RAISE NOTICE '=====================================================';
END $$;
