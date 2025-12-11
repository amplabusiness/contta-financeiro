-- =====================================================
-- CUSTO DOS SERVIÇOS VENDIDOS (CSV) - COMISSÃO SOBRE HONORÁRIOS
-- =====================================================
-- A comissão paga ao funcionário sobre honorários variáveis é CUSTO,
-- não DESPESA, pois está diretamente vinculada à prestação do serviço.
--
-- Diferença contábil:
-- - CUSTO: Gasto diretamente ligado à produção/prestação do serviço
-- - DESPESA: Gasto operacional/administrativo não ligado à produção
--
-- A comissão de 1,25% sobre o honorário de 2,87% é um CUSTO porque:
-- 1. Só existe porque houve receita do serviço
-- 2. É diretamente proporcional ao faturamento
-- 3. Está vinculada à prestação específica do serviço
-- =====================================================

DO $$
DECLARE
  v_parent_id UUID;
  v_despesas_id UUID;
BEGIN
  -- Obter ID do grupo de DESPESAS (4)
  SELECT id INTO v_despesas_id FROM chart_of_accounts WHERE code = '4' LIMIT 1;

  -- =====================================================
  -- 4.5 - CUSTO DOS SERVIÇOS VENDIDOS (CSV)
  -- =====================================================
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.5') THEN
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('4.5', 'CUSTO DOS SERVIÇOS VENDIDOS', 'DESPESA', 'DEVEDORA', 2, false, true, v_despesas_id);
    RAISE NOTICE 'Criada conta 4.5 - CUSTO DOS SERVIÇOS VENDIDOS';
  END IF;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.5';

  -- 4.5.1 - CUSTOS DIRETOS COM SERVIÇOS
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.5.1') THEN
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('4.5.1', 'CUSTOS DIRETOS COM SERVIÇOS', 'DESPESA', 'DEVEDORA', 3, false, true, v_parent_id);
    RAISE NOTICE 'Criada conta 4.5.1 - CUSTOS DIRETOS COM SERVIÇOS';
  END IF;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.5.1';

  -- 4.5.1.01 - Comissão sobre Honorários Variáveis
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.5.1.01') THEN
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('4.5.1.01', 'Comissão sobre Honorários Variáveis', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id);
    RAISE NOTICE 'Criada conta 4.5.1.01 - Comissão sobre Honorários Variáveis';
  END IF;

  -- 4.5.1.02 - Custos de Terceirização de Serviços
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.5.1.02') THEN
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('4.5.1.02', 'Custos de Terceirização de Serviços', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id);
    RAISE NOTICE 'Criada conta 4.5.1.02 - Custos de Terceirização de Serviços';
  END IF;

  -- 4.5.1.03 - Outros Custos Diretos
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '4.5.1.03') THEN
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
    VALUES ('4.5.1.03', 'Outros Custos Diretos', 'DESPESA', 'DEVEDORA', 4, true, true, v_parent_id);
    RAISE NOTICE 'Criada conta 4.5.1.03 - Outros Custos Diretos';
  END IF;

  -- =====================================================
  -- CONTA DE PASSIVO - COMISSÕES A PAGAR (se não existir)
  -- =====================================================
  -- Verificar se existe conta de Comissões a Pagar no passivo
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.3.03') THEN
    SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1.3';

    IF v_parent_id IS NOT NULL THEN
      INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
      VALUES ('2.1.3.03', 'Comissões a Pagar', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id);
      RAISE NOTICE 'Criada conta 2.1.3.03 - Comissões a Pagar';
    END IF;
  END IF;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'PLANO DE CONTAS ATUALIZADO COM CSV';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Estrutura para comissão sobre honorários:';
  RAISE NOTICE '';
  RAISE NOTICE 'Quando gerar fatura de honorário variável:';
  RAISE NOTICE '';
  RAISE NOTICE '1) LANÇAMENTO DA RECEITA:';
  RAISE NOTICE '   D - 1.1.2.01 Clientes a Receber';
  RAISE NOTICE '   C - 3.1.1.01 Honorários Contábeis';
  RAISE NOTICE '';
  RAISE NOTICE '2) LANÇAMENTO DO CUSTO DA COMISSÃO:';
  RAISE NOTICE '   D - 4.5.1.01 Comissão sobre Honorários Variáveis (CUSTO)';
  RAISE NOTICE '   C - 2.1.3.03 Comissões a Pagar (PASSIVO)';
  RAISE NOTICE '';
  RAISE NOTICE 'Isso gera DRE correto:';
  RAISE NOTICE '  RECEITA BRUTA.............. R$ X';
  RAISE NOTICE '  (-) CUSTO DOS SERVIÇOS..... R$ Y';
  RAISE NOTICE '  = LUCRO BRUTO.............. R$ Z';
  RAISE NOTICE '  (-) DESPESAS OPERACIONAIS.. R$ W';
  RAISE NOTICE '  = LUCRO LÍQUIDO............ R$ K';
  RAISE NOTICE '==========================================';

END $$;

-- Comentários descritivos
COMMENT ON COLUMN chart_of_accounts.code IS 'Código da conta contábil seguindo estrutura:
1 - ATIVO
2 - PASSIVO
3 - RECEITAS
4 - DESPESAS (inclui 4.5 CSV - Custo dos Serviços Vendidos)
5 - PATRIMÔNIO LÍQUIDO';
