-- ============================================================================
-- CORREÇÃO: Garantir que conta de receita está configurada corretamente
-- ============================================================================

-- Verificar e corrigir a conta de receita de honorários
DO $$
DECLARE
  v_tenant_id UUID;
  v_revenue_account_id UUID;
  v_parent_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  -- Buscar conta de receita existente
  SELECT id INTO v_revenue_account_id
  FROM chart_of_accounts
  WHERE tenant_id = v_tenant_id
    AND code LIKE '3.%'
    AND (name ILIKE '%honorário%' OR code = '3.1.01')
    AND is_active = true
  ORDER BY code
  LIMIT 1;

  IF v_revenue_account_id IS NOT NULL THEN
    -- Atualizar para garantir que é analítica
    UPDATE chart_of_accounts
    SET
      is_analytical = true,
      account_type = 'analitica',
      nature = 'credora'
    WHERE id = v_revenue_account_id;

    RAISE NOTICE 'Conta de receita atualizada: %', v_revenue_account_id;
  ELSE
    -- Buscar conta pai de receitas
    SELECT id INTO v_parent_id
    FROM chart_of_accounts
    WHERE tenant_id = v_tenant_id
      AND (code = '3.1' OR code = '3.1.1' OR code LIKE '3.1%')
      AND is_active = true
    ORDER BY LENGTH(code) DESC
    LIMIT 1;

    IF v_parent_id IS NOT NULL THEN
      -- Criar conta de receita de honorários
      INSERT INTO chart_of_accounts (
        tenant_id, code, name, type,
        account_type, nature, level,
        parent_id, is_active, is_analytical
      ) VALUES (
        v_tenant_id, '3.1.01', 'Receita de Honorários Contábeis', 'R',
        'analitica', 'credora', 3,
        v_parent_id, true, true
      )
      RETURNING id INTO v_revenue_account_id;

      RAISE NOTICE 'Conta de receita criada: %', v_revenue_account_id;
    ELSE
      RAISE WARNING 'Não foi possível encontrar conta pai de receitas!';
    END IF;
  END IF;
END $$;

-- Verificar todas as contas de receita e garantir que estão analíticas
UPDATE chart_of_accounts
SET is_analytical = true
WHERE code LIKE '3.%'
  AND account_type = 'analitica'
  AND is_analytical IS DISTINCT FROM true;

-- Também corrigir as contas de clientes (A Receber)
UPDATE chart_of_accounts
SET is_analytical = true
WHERE code LIKE '1.1.2.01.%'
  AND account_type = 'analitica'
  AND is_analytical IS DISTINCT FROM true;

-- Diagnóstico final
DO $$
DECLARE
  v_receitas_count INTEGER;
  v_clientes_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_receitas_count
  FROM chart_of_accounts
  WHERE code LIKE '3.%' AND is_analytical = true;

  SELECT COUNT(*) INTO v_clientes_count
  FROM chart_of_accounts
  WHERE code LIKE '1.1.2.01.%' AND is_analytical = true;

  RAISE NOTICE 'Contas de receita analíticas: %', v_receitas_count;
  RAISE NOTICE 'Contas de clientes analíticas: %', v_clientes_count;
END $$;
