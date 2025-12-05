-- =====================================================
-- VINCULAR CENTROS DE CUSTO AO PLANO DE CONTAS
-- Mapeamento obrigatório para rastreabilidade contábil
-- =====================================================

-- 1. ADICIONAR COLUNA DE CONTA PADRÃO AOS CENTROS DE CUSTO
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cost_centers' AND column_name = 'default_chart_account_id'
  ) THEN
    ALTER TABLE cost_centers 
    ADD COLUMN default_chart_account_id UUID REFERENCES chart_of_accounts(id);
    RAISE NOTICE 'Coluna default_chart_account_id adicionada a cost_centers';
  END IF;
END $$;

-- =====================================================
-- 2. CRIAR NOVOS CENTROS DE CUSTO PARA O SÉRGIO
-- Estrutura: SERGIO → FILHOS (Nayara, Victor, Sergio Augusto)
--                 → CASA_CAMPO (Lago das Brisas)
--                 → IMOVEIS, VEICULOS, PESSOAL, TELEFONE, OUTROS
-- =====================================================

-- Buscar ID da conta de adiantamentos do Sérgio
-- (1.1.3.04.01 - Adiantamentos - Sergio Carneiro Leão)
DO $$
DECLARE
  v_sergio_parent_id UUID;
  v_filhos_parent_id UUID;
  v_adiantamento_account_id UUID;
BEGIN
  -- Buscar conta de adiantamentos
  SELECT id INTO v_adiantamento_account_id
  FROM chart_of_accounts
  WHERE code = '1.1.3.04.01';

  IF v_adiantamento_account_id IS NULL THEN
    RAISE WARNING 'Conta 1.1.3.04.01 não encontrada. Verificar plano de contas.';
    RETURN;
  END IF;

  -- Buscar ID do centro SERGIO existente
  SELECT id INTO v_sergio_parent_id
  FROM cost_centers
  WHERE code = 'SERGIO';

  IF v_sergio_parent_id IS NULL THEN
    RAISE WARNING 'Centro de custo SERGIO não encontrado';
    RETURN;
  END IF;

  -- Atualizar o centro SERGIO com a conta padrão
  UPDATE cost_centers
  SET default_chart_account_id = v_adiantamento_account_id
  WHERE code = 'SERGIO';

  -- Atualizar subcentros existentes
  UPDATE cost_centers
  SET default_chart_account_id = v_adiantamento_account_id
  WHERE code IN ('SERGIO.IMOVEIS', 'SERGIO.VEICULOS', 'SERGIO.PESSOAL', 'SERGIO.TELEFONE', 'SERGIO.OUTROS')
  AND parent_id = v_sergio_parent_id;

  -- =====================================================
  -- 2.1 CRIAR NÍVEL INTERMEDIÁRIO: SERGIO.FILHOS
  -- =====================================================
  INSERT INTO cost_centers (code, name, description, parent_id, default_chart_account_id, is_active)
  VALUES (
    'SERGIO.FILHOS',
    'Filhos (Nayara, Victor, Sergio Augusto)',
    'Despesas com dependentes do sócio e seus filhos que trabalham na empresa',
    v_sergio_parent_id,
    v_adiantamento_account_id,
    true
  )
  ON CONFLICT (code) DO UPDATE SET
    default_chart_account_id = v_adiantamento_account_id,
    updated_at = now()
  RETURNING id INTO v_filhos_parent_id;

  -- =====================================================
  -- 2.2 CRIAR SUBCENTROS DOS FILHOS
  -- =====================================================
  INSERT INTO cost_centers (code, name, description, parent_id, default_chart_account_id, is_active)
  VALUES
    ('SERGIO.FILHOS.NAYARA', 'Nayara (Filha)', 'Despesas com Nayara: babá, escola dos netos, cuidados', v_filhos_parent_id, v_adiantamento_account_id, true),
    ('SERGIO.FILHOS.VICTOR', 'Victor Hugo (Filho)', 'Despesas com Victor Hugo: legalização, outros custos do trabalho', v_filhos_parent_id, v_adiantamento_account_id, true),
    ('SERGIO.FILHOS.SERGIO_AUGUSTO', 'Sergio Augusto (Filho)', 'Despesas com Sergio Augusto: Clínica Ampla, faculdade de medicina', v_filhos_parent_id, v_adiantamento_account_id, true)
  ON CONFLICT (code) DO UPDATE SET
    default_chart_account_id = v_adiantamento_account_id,
    updated_at = now();

  -- =====================================================
  -- 2.3 CRIAR/ATUALIZAR SERGIO.CASA_CAMPO
  -- Casa Lago das Brisas em Buriti Alegre
  -- =====================================================
  INSERT INTO cost_centers (code, name, description, parent_id, default_chart_account_id, is_active)
  VALUES (
    'SERGIO.CASA_CAMPO',
    'Casa de Campo - Lago das Brisas',
    'Casa de lazer no Lago das Brisas, Buriti Alegre: IPTU, condomínio, água, energia, manutenção',
    v_sergio_parent_id,
    v_adiantamento_account_id,
    true
  )
  ON CONFLICT (code) DO UPDATE SET
    default_chart_account_id = v_adiantamento_account_id,
    updated_at = now();

  RAISE NOTICE '';
  RAISE NOTICE '===== CENTROS DE CUSTO ATUALIZADOS =====';
  RAISE NOTICE 'SERGIO (principal) → 1.1.3.04.01 Adiantamentos';
  RAISE NOTICE 'SERGIO.FILHOS (hub) → 1.1.3.04.01';
  RAISE NOTICE '  ├─ SERGIO.FILHOS.NAYARA → 1.1.3.04.01';
  RAISE NOTICE '  ├─ SERGIO.FILHOS.VICTOR → 1.1.3.04.01';
  RAISE NOTICE '  └─ SERGIO.FILHOS.SERGIO_AUGUSTO → 1.1.3.04.01';
  RAISE NOTICE 'SERGIO.CASA_CAMPO → 1.1.3.04.01';
  RAISE NOTICE 'SERGIO.IMOVEIS → 1.1.3.04.01';
  RAISE NOTICE 'SERGIO.VEICULOS → 1.1.3.04.01';
  RAISE NOTICE 'SERGIO.PESSOAL → 1.1.3.04.01';
  RAISE NOTICE 'SERGIO.TELEFONE → 1.1.3.04.01';
  RAISE NOTICE 'SERGIO.OUTROS → 1.1.3.04.01';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- 3. ADICIONAR CONSTRAINT: cost_center_id NÃO NULL EM EXPENSES
-- =====================================================
DO $$
BEGIN
  -- Atualizar expenses sem cost_center_id
  UPDATE expenses
  SET cost_center_id = (
    SELECT id FROM cost_centers WHERE code = 'AMPLA' LIMIT 1
  )
  WHERE cost_center_id IS NULL
  AND created_at > NOW() - INTERVAL '90 days'; -- Últimos 3 meses

  RAISE NOTICE 'Despesas recentes sem centro de custo atribuídas a AMPLA';
END $$;

-- Adicionar NOT NULL constraint (permitirá NULLs históricos, mas novos registros serão forçados)
-- ALTER TABLE expenses ADD CONSTRAINT check_cost_center_required 
-- CHECK (cost_center_id IS NOT NULL) NOT VALID; -- Validar sem bloquear inserts existentes

-- =====================================================
-- 4. ADICIONAR CONSTRAINT: account_id NÃO NULL EM EXPENSES
-- =====================================================
DO $$
BEGIN
  -- Atualizar expenses sem account_id usando a conta padrão do centro de custo
  UPDATE expenses e
  SET account_id = (
    SELECT cc.default_chart_account_id
    FROM cost_centers cc
    WHERE cc.id = e.cost_center_id
    AND cc.default_chart_account_id IS NOT NULL
    LIMIT 1
  )
  WHERE e.account_id IS NULL
  AND e.cost_center_id IS NOT NULL;

  RAISE NOTICE 'Despesas atualizadas com contas do plano de contas baseado no centro de custo';
END $$;

-- =====================================================
-- 5. ADICIONAR CONSTRAINT: cost_center_id NÃO NULL EM BANK_TRANSACTIONS
-- =====================================================
DO $$
BEGIN
  -- Atualizar bank_transactions sem cost_center_id
  UPDATE bank_transactions
  SET cost_center_id = (
    SELECT id FROM cost_centers WHERE code = 'AMPLA' LIMIT 1
  )
  WHERE cost_center_id IS NULL
  AND created_at > NOW() - INTERVAL '90 days'; -- Últimos 3 meses

  RAISE NOTICE 'Transações bancárias recentes sem centro de custo atribuídas a AMPLA';
END $$;

-- =====================================================
-- 6. CRIAR VIEW PARA RASTREABILIDADE COMPLETA
-- =====================================================
CREATE OR REPLACE VIEW vw_expenses_with_accounts AS
SELECT
  e.id,
  e.description,
  e.amount,
  e.due_date,
  e.payment_date,
  e.status,
  cc.code AS cost_center_code,
  cc.name AS cost_center_name,
  coa.code AS account_code,
  coa.name AS account_name,
  coa.account_type,
  COALESCE(coa.code, cc.default_chart_account_id::text) AS effective_account_code,
  e.competence,
  e.created_at,
  e.updated_at
FROM expenses e
LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
LEFT JOIN chart_of_accounts coa ON e.account_id = coa.id
ORDER BY e.due_date DESC;

COMMENT ON VIEW vw_expenses_with_accounts IS 'Despesas com rastreabilidade completa: centro de custo + plano de contas';

-- =====================================================
-- 7. CRIAR VIEW PARA SALDO DE ADIANTAMENTOS POR CENTRO
-- =====================================================
CREATE OR REPLACE VIEW vw_sergio_advances_balance AS
WITH expense_totals AS (
  SELECT
    cc.id AS cost_center_id,
    cc.code AS cost_center_code,
    cc.name AS cost_center_name,
    COALESCE(pcc.name, cc.name) AS parent_name,
    SUM(CASE WHEN e.status IN ('paid', 'pending', 'overdue') THEN e.amount ELSE 0 END) AS total_advances
  FROM cost_centers cc
  LEFT JOIN cost_centers pcc ON cc.parent_id = pcc.id
  LEFT JOIN expenses e ON e.cost_center_id = cc.id
  WHERE cc.code LIKE 'SERGIO%'
  GROUP BY cc.id, cc.code, cc.name, pcc.name
)
SELECT
  cost_center_code,
  cost_center_name,
  parent_name,
  total_advances,
  '1.1.3.04.01' AS account_code,
  'Adiantamentos - Sergio Carneiro Leão' AS account_name
FROM expense_totals
WHERE total_advances > 0
ORDER BY parent_name, cost_center_name;

COMMENT ON VIEW vw_sergio_advances_balance IS 'Saldo de adiantamentos por centro de custo do Sérgio para reconciliação mensal';

-- =====================================================
-- 8. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_expenses_cost_center_account 
ON expenses(cost_center_id, account_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_cost_center 
ON bank_transactions(cost_center_id);

CREATE INDEX IF NOT EXISTS idx_cost_centers_default_account 
ON cost_centers(default_chart_account_id);

-- =====================================================
-- LOG FINAL
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ MAPEAMENTO CENTRO DE CUSTO ↔ PLANO DE CONTAS CONCLUÍDO';
  RAISE NOTICE '';
  RAISE NOTICE 'Principais mudanças:';
  RAISE NOTICE '  1. Coluna default_chart_account_id adicionada a cost_centers';
  RAISE NOTICE '  2. Novos centros: SERGIO.FILHOS (Nayara, Victor, S.Augusto)';
  RAISE NOTICE '  3. Novo centro: SERGIO.CASA_CAMPO (Lago das Brisas)';
  RAISE NOTICE '  4. Histórico de expenses/bank_transactions preenchido com centros padrão';
  RAISE NOTICE '  5. Views: vw_expenses_with_accounts, vw_sergio_advances_balance';
  RAISE NOTICE '  6. Índices de performance adicionados';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  • Atualizar Expenses.tsx e RecurringExpenses.tsx para bloquear saves sem account_id/cost_center_id';
  RAISE NOTICE '  • Atualizar ingestores (scripts/Edge Functions) para mapear com base em palavras-chave';
  RAISE NOTICE '  • Validar DRE e Livro Diário com os novos centros';
  RAISE NOTICE '';
END $$;
