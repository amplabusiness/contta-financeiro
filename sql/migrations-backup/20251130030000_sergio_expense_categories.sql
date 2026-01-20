-- =====================================================
-- CATEGORIAS DE DESPESAS DO SÓCIO SERGIO CARNEIRO LEÃO
-- Para controle de Adiantamentos a Sócios
-- =====================================================

-- Criar tabela de categorias de despesas por centro de custo
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cost_center_id UUID REFERENCES cost_centers(id),
  chart_account_id UUID REFERENCES chart_of_accounts(id),
  description TEXT,
  is_recurring BOOLEAN DEFAULT false,
  default_amount DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage expense_categories" ON expense_categories;
CREATE POLICY "Users can manage expense_categories" ON expense_categories
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Inserir categorias do sócio Sergio
DO $$
DECLARE
  v_sergio_id UUID;
  v_sergio_imoveis_id UUID;
  v_sergio_veiculos_id UUID;
  v_sergio_pessoal_id UUID;
  v_sergio_telefone_id UUID;
  v_sergio_outros_id UUID;
  v_adiantamento_account_id UUID;
BEGIN
  -- Buscar IDs dos centros de custo
  SELECT id INTO v_sergio_id FROM cost_centers WHERE code = 'SERGIO';
  SELECT id INTO v_sergio_imoveis_id FROM cost_centers WHERE code = 'SERGIO.IMOVEIS';
  SELECT id INTO v_sergio_veiculos_id FROM cost_centers WHERE code = 'SERGIO.VEICULOS';
  SELECT id INTO v_sergio_pessoal_id FROM cost_centers WHERE code = 'SERGIO.PESSOAL';
  SELECT id INTO v_sergio_telefone_id FROM cost_centers WHERE code = 'SERGIO.TELEFONE';
  SELECT id INTO v_sergio_outros_id FROM cost_centers WHERE code = 'SERGIO.OUTROS';

  -- Buscar conta de Adiantamentos a Sócio Sergio
  SELECT id INTO v_adiantamento_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.01';

  -- =====================================================
  -- IMÓVEIS (IPTU, Condomínios, Água, Energia, Gás)
  -- =====================================================
  INSERT INTO expense_categories (code, name, cost_center_id, chart_account_id, description, is_recurring)
  VALUES
    ('SERGIO.AGUA', 'Água', v_sergio_imoveis_id, v_adiantamento_account_id, 'Conta de água dos imóveis do sócio', true),
    ('SERGIO.ENERGIA', 'Energia', v_sergio_imoveis_id, v_adiantamento_account_id, 'Conta de energia elétrica', true),
    ('SERGIO.GAS', 'Gás', v_sergio_imoveis_id, v_adiantamento_account_id, 'Conta de gás', true),
    ('SERGIO.COND.GALERIA', 'Condomínio Galeria Nacional', v_sergio_imoveis_id, v_adiantamento_account_id, 'Condomínio do imóvel Galeria Nacional', true),
    ('SERGIO.COND.LAGO', 'Condomínio Lago', v_sergio_imoveis_id, v_adiantamento_account_id, 'Condomínio do imóvel Lago', true),
    ('SERGIO.COND.MUNDI', 'Condomínio Mundi', v_sergio_imoveis_id, v_adiantamento_account_id, 'Condomínio do imóvel Mundi', true),
    ('SERGIO.IPTU.APTO', 'IPTU - Apartamento', v_sergio_imoveis_id, v_adiantamento_account_id, 'IPTU do apartamento pessoal', false),
    ('SERGIO.IPTU.301', 'IPTU - Sala 301', v_sergio_imoveis_id, v_adiantamento_account_id, 'IPTU da Sala 301', false),
    ('SERGIO.IPTU.302', 'IPTU - Sala 302', v_sergio_imoveis_id, v_adiantamento_account_id, 'IPTU da Sala 302', false),
    ('SERGIO.IPTU.303', 'IPTU - Sala 303', v_sergio_imoveis_id, v_adiantamento_account_id, 'IPTU da Sala 303', false),
    ('SERGIO.IPTU.VILA', 'IPTU - Vila Abajá', v_sergio_imoveis_id, v_adiantamento_account_id, 'IPTU do imóvel Vila Abajá', false),
    ('SERGIO.OBRAS.LAGO', 'Obras Lago', v_sergio_imoveis_id, v_adiantamento_account_id, 'Obras no imóvel do Lago', false)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- VEÍCULOS (IPVA)
  -- =====================================================
  INSERT INTO expense_categories (code, name, cost_center_id, chart_account_id, description, is_recurring)
  VALUES
    ('SERGIO.IPVA.BMW', 'IPVA BMW', v_sergio_veiculos_id, v_adiantamento_account_id, 'IPVA da BMW', false),
    ('SERGIO.IPVA.BIZ', 'IPVA Biz', v_sergio_veiculos_id, v_adiantamento_account_id, 'IPVA da moto Biz', false),
    ('SERGIO.IPVA.CG', 'IPVA CG', v_sergio_veiculos_id, v_adiantamento_account_id, 'IPVA da moto CG', false),
    ('SERGIO.IPVA.CARRETINHA', 'IPVA Carretinha', v_sergio_veiculos_id, v_adiantamento_account_id, 'IPVA da Carretinha', false)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- PESSOAL (Saúde, Personal, Anuidades)
  -- =====================================================
  INSERT INTO expense_categories (code, name, cost_center_id, chart_account_id, description, is_recurring)
  VALUES
    ('SERGIO.SAUDE', 'Plano de Saúde', v_sergio_pessoal_id, v_adiantamento_account_id, 'Plano de saúde do sócio', true),
    ('SERGIO.PERSONAL', 'Antonio Leandro - Personal', v_sergio_pessoal_id, v_adiantamento_account_id, 'Personal trainer Antonio Leandro', true),
    ('SERGIO.CRC.SERGIO', 'Anuidade CRC - Sergio', v_sergio_pessoal_id, v_adiantamento_account_id, 'Anuidade CRC do sócio Sergio', false),
    ('SERGIO.CRC.CARLA', 'Anuidade CRC - Carla', v_sergio_pessoal_id, v_adiantamento_account_id, 'Anuidade CRC da sócia Carla', false),
    ('SERGIO.THARSON', 'Tharson Diego', v_sergio_pessoal_id, v_adiantamento_account_id, 'Despesas com Tharson Diego', false)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- TELEFONE
  -- =====================================================
  INSERT INTO expense_categories (code, name, cost_center_id, chart_account_id, description, is_recurring)
  VALUES
    ('SERGIO.TELEFONE', 'Telefone', v_sergio_telefone_id, v_adiantamento_account_id, 'Linhas telefônicas pessoais', true),
    ('SERGIO.INTERNET', 'Internet', v_sergio_telefone_id, v_adiantamento_account_id, 'Internet pessoal', true)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- OUTROS
  -- =====================================================
  INSERT INTO expense_categories (code, name, cost_center_id, chart_account_id, description, is_recurring)
  VALUES
    ('SERGIO.OUTROS', 'Outros', v_sergio_outros_id, v_adiantamento_account_id, 'Outras despesas do sócio', false)
  ON CONFLICT (code) DO NOTHING;

  RAISE NOTICE 'Categorias de despesas do sócio Sergio cadastradas!';
  RAISE NOTICE '';
  RAISE NOTICE 'IMÓVEIS:';
  RAISE NOTICE '  - Água, Energia, Gás';
  RAISE NOTICE '  - Condomínio Galeria Nacional, Lago, Mundi';
  RAISE NOTICE '  - IPTU Apartamento, Salas 301/302/303, Vila Abajá';
  RAISE NOTICE '  - Obras Lago';
  RAISE NOTICE '';
  RAISE NOTICE 'VEÍCULOS:';
  RAISE NOTICE '  - IPVA BMW, Biz, CG, Carretinha';
  RAISE NOTICE '';
  RAISE NOTICE 'PESSOAL:';
  RAISE NOTICE '  - Plano de Saúde, Personal (Antonio Leandro)';
  RAISE NOTICE '  - Anuidade CRC Sergio/Carla';
  RAISE NOTICE '  - Tharson Diego';
  RAISE NOTICE '';
  RAISE NOTICE 'TELEFONE/INTERNET:';
  RAISE NOTICE '  - Telefone, Internet';
  RAISE NOTICE '';
  RAISE NOTICE 'Todas as despesas serão lançadas como:';
  RAISE NOTICE '  D - 1.1.3.04.01 Adiantamentos - Sergio Carneiro Leão';
  RAISE NOTICE '  C - 1.1.1.02 Banco Sicredi';
END $$;

-- =====================================================
-- VIEW PARA RESUMO DE ADIANTAMENTOS POR SÓCIO
-- =====================================================

CREATE OR REPLACE VIEW vw_partner_advances_summary AS
SELECT
  cc.name AS partner_name,
  ec.name AS category_name,
  COUNT(e.id) AS total_expenses,
  SUM(e.amount) AS total_amount,
  MAX(e.due_date) AS last_expense_date
FROM expense_categories ec
LEFT JOIN expenses e ON e.category = ec.code
LEFT JOIN cost_centers cc ON ec.cost_center_id = cc.id
WHERE cc.code LIKE 'SERGIO%'
GROUP BY cc.name, ec.name
ORDER BY cc.name, SUM(e.amount) DESC NULLS LAST;

COMMENT ON VIEW vw_partner_advances_summary IS 'Resumo de adiantamentos por sócio e categoria';

-- =====================================================
-- FUNÇÃO PARA CALCULAR SALDO DE ADIANTAMENTOS
-- =====================================================

CREATE OR REPLACE FUNCTION get_partner_advance_balance(partner_code TEXT)
RETURNS DECIMAL AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN ael.debit_credit = 'D' THEN ael.amount
      ELSE -ael.amount
    END
  ), 0)
  INTO v_balance
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON ael.account_id = coa.id
  WHERE coa.code = CASE
    WHEN partner_code = 'SERGIO' THEN '1.1.3.04.01'
    ELSE '1.1.3.04.02'
  END;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_partner_advance_balance IS 'Retorna saldo de adiantamentos do sócio';
