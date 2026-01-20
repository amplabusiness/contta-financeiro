-- =====================================================
-- MIGRAR cost_center TEXT → cost_center_id UUID
-- Converter referência de texto para chave estrangeira
-- =====================================================

-- 1. CRIAR COLUNA NOVA cost_center_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'cost_center_id'
  ) THEN
    -- Adicionar coluna nova
    ALTER TABLE expenses 
    ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id);
    
    RAISE NOTICE 'Coluna cost_center_id adicionada a expenses';
  END IF;
END $$;

-- 2. MIGRAR DADOS DA COLUNA ANTIGA PARA A NOVA
DO $$
DECLARE
  v_ampla_id UUID;
  v_sergio_id UUID;
  v_total_updated INTEGER := 0;
BEGIN
  -- Obter IDs dos centros padrão
  SELECT id INTO v_ampla_id FROM cost_centers WHERE code = 'AMPLA' LIMIT 1;
  SELECT id INTO v_sergio_id FROM cost_centers WHERE code = 'SERGIO' LIMIT 1;

  IF v_ampla_id IS NOT NULL THEN
    -- Atualizar expenses com cost_center = null ou vazio para AMPLA
    UPDATE expenses
    SET cost_center_id = v_ampla_id
    WHERE cost_center_id IS NULL
    AND (cost_center IS NULL OR cost_center = '' OR cost_center = 'Administrativo' OR cost_center = 'Operacional');
    
    GET DIAGNOSTICS v_total_updated = ROW_COUNT;
    RAISE NOTICE 'Atualizadas % despesas para AMPLA', v_total_updated;
  END IF;

  -- Se houver cost_center com valor específico, tentar mapear
  IF v_sergio_id IS NOT NULL THEN
    UPDATE expenses
    SET cost_center_id = v_sergio_id
    WHERE cost_center_id IS NULL
    AND cost_center IS NOT NULL 
    AND cost_center != ''
    AND (UPPER(cost_center) LIKE '%SERGIO%' OR UPPER(cost_center) LIKE '%PESSOAL%');
    
    GET DIAGNOSTICS v_total_updated = ROW_COUNT;
    RAISE NOTICE 'Atualizadas % despesas para SERGIO', v_total_updated;
  END IF;

  -- Restantes ficam com AMPLA padrão
  IF v_ampla_id IS NOT NULL THEN
    UPDATE expenses
    SET cost_center_id = v_ampla_id
    WHERE cost_center_id IS NULL;
  END IF;

  RAISE NOTICE 'Migração de dados completa';
END $$;

-- 3. ADICIONAR CONSTRAINT NOT NULL (permitir histórico sem preencher retroativamente)
-- Isto garante que novos registros tenham cost_center_id preenchido
ALTER TABLE expenses
ALTER COLUMN cost_center_id SET NOT NULL;

RAISE NOTICE 'Column cost_center_id agora é obrigatório';

-- 4. FAZER BACKUP DA COLUNA ANTIGA (OPCIONAL)
-- ALTER TABLE expenses RENAME COLUMN cost_center TO cost_center_old;

-- Ou simplesmente deixar cost_center como está para compatibilidade histórica
-- e remover depois em uma migration de limpeza

-- 5. ATUALIZAR account_id TAMBÉM (se vazio)
DO $$
DECLARE
  v_adiantamento_id UUID;
BEGIN
  -- Obter conta de adiantamentos
  SELECT id INTO v_adiantamento_id
  FROM chart_of_accounts
  WHERE code = '1.1.3.04.01' LIMIT 1;

  IF v_adiantamento_id IS NOT NULL THEN
    -- Atualizar expenses do SERGIO sem account_id
    UPDATE expenses e
    SET account_id = v_adiantamento_id
    WHERE e.account_id IS NULL
    AND e.cost_center_id IN (
      SELECT id FROM cost_centers WHERE code LIKE 'SERGIO%'
    );
    
    RAISE NOTICE 'Despesas do Sérgio mapeadas para conta 1.1.3.04.01';
  END IF;
END $$;

-- 6. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_expenses_cost_center_id 
ON expenses(cost_center_id);

-- =====================================================
-- LOG FINAL
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ MIGRAÇÃO COST_CENTER CONCLUÍDA';
  RAISE NOTICE '';
  RAISE NOTICE 'Mudanças aplicadas:';
  RAISE NOTICE '  1. Coluna cost_center_id (UUID FK) criada';
  RAISE NOTICE '  2. Dados migrados: texto → UUID';
  RAISE NOTICE '  3. Constraint NOT NULL adicionado';
  RAISE NOTICE '  4. Despesas do Sérgio apontam para 1.1.3.04.01';
  RAISE NOTICE '  5. Índices criados para performance';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  • Validar que Expenses.tsx está usando cost_center_id';
  RAISE NOTICE '  • Remover coluna cost_center em migration de cleanup (opcional)';
  RAISE NOTICE '  • Testar fluxo de criação de despesas';
  RAISE NOTICE '';
END $$;
