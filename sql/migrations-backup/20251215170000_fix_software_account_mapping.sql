-- ============================================================================
-- CORREÇÃO: MAPEAMENTO DE SOFTWARE/SISTEMAS
-- ============================================================================
-- PROBLEMA: A categoria 'software/sistemas' estava mapeada para 4.1.2.06 (Gás)
-- SOLUÇÃO: Mapear corretamente para 4.1.2.12 (Software e Sistemas)
-- ============================================================================

-- 1. Garantir que a conta 4.1.2.12 existe
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  ('4.1.2.12', 'Software e Sistemas', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2'))
ON CONFLICT (code) DO UPDATE SET 
  name = 'Software e Sistemas',
  is_active = true;

-- 2. Atualizar a função de mapeamento de categorias
CREATE OR REPLACE FUNCTION get_expense_or_adiantamento_account(p_category TEXT)
RETURNS TABLE (
  account_id UUID,
  is_adiantamento BOOLEAN,
  entry_type TEXT
) AS $$
DECLARE
  v_account_id UUID;
  v_is_adiantamento BOOLEAN := FALSE;
  v_entry_type TEXT := 'despesa';
  v_code TEXT;
BEGIN
  -- Verificar se é adiantamento a sócios
  IF LOWER(COALESCE(p_category, '')) IN (
    'adiantamento a sócios',
    'adiantamento a socios',
    'adiantamento sergio',
    'adiantamento carla',
    'adiantamento victor',
    'adiantamento nayara',
    'adiantamento augusto',
    'despesas particulares',
    'gastos pessoais',
    'familia'
  ) THEN
    v_is_adiantamento := TRUE;
    v_entry_type := 'adiantamento';

    SELECT id INTO v_account_id
    FROM chart_of_accounts
    WHERE code = '1.2.3.01';  -- Adiantamento a Sócios

  ELSE
    -- Mapear categoria para conta de DESPESA (CORRIGIDO!)
    v_code := CASE LOWER(COALESCE(p_category, 'default'))
      WHEN 'salarios' THEN '4.1.1.01'
      WHEN 'folha de pagamento' THEN '4.1.1.01'
      WHEN 'encargos' THEN '4.1.1.02'
      WHEN 'encargos de salários' THEN '4.1.1.02'
      WHEN 'aluguel' THEN '4.1.2.01'
      WHEN 'energia' THEN '4.1.2.02'
      WHEN 'telefone' THEN '4.1.2.03'
      WHEN 'plano telefone' THEN '4.1.2.03'
      WHEN 'pano telefone' THEN '4.1.2.03'
      WHEN 'internet' THEN '4.1.2.03'
      WHEN 'material' THEN '4.1.2.04'
      WHEN 'materiais de papelaria' THEN '4.1.2.04'
      WHEN 'servicos' THEN '4.1.2.05'
      WHEN 'servicos terceiros' THEN '4.1.2.05'
      -- *** CORREÇÃO AQUI: software/sistemas vai para 4.1.2.12, NÃO 4.1.2.06 ***
      WHEN 'software/sistemas' THEN '4.1.2.12'
      WHEN 'software' THEN '4.1.2.12'
      WHEN 'sistemas' THEN '4.1.2.12'
      WHEN 'assinatura software' THEN '4.1.2.12'
      WHEN 'licencas software' THEN '4.1.2.12'
      -- Gás vai para 4.1.2.06
      WHEN 'gas' THEN '4.1.2.06'
      WHEN 'gás' THEN '4.1.2.06'
      WHEN 'botijao' THEN '4.1.2.06'
      WHEN 'botijão' THEN '4.1.2.06'
      -- Outras categorias
      WHEN 'juros' THEN '4.1.3.01'
      WHEN 'tarifas' THEN '4.1.3.02'
      WHEN 'taxa/manutencao boleto' THEN '4.1.3.02'
      WHEN 'manutencao de conta' THEN '4.1.3.02'
      WHEN 'impostos' THEN '4.1.4.01'
      WHEN 'simples nacional' THEN '4.1.4.01'
      WHEN 'imposto iss' THEN '4.1.4.01'
      WHEN 'iptu' THEN '4.1.4.03'
      WHEN 'ipva' THEN '4.1.4.01'
      WHEN 'taxas e licenças profissionais' THEN '4.1.4.02'
      WHEN 'condominio' THEN '4.1.2.10'
      WHEN 'agua funcionarios' THEN '4.1.2.09'
      WHEN 'vale alimentacao' THEN '4.1.1.03'
      WHEN 'plano de saude' THEN '4.1.1.04'
      WHEN 'obras/reforma' THEN '4.1.2.11'
      WHEN 'materiais de limpeza/higiene' THEN '4.1.2.08'
      WHEN 'suprimentos para copa/cozinha' THEN '4.1.2.09'
      ELSE '4.1.2.99'
    END;

    SELECT id INTO v_account_id
    FROM chart_of_accounts
    WHERE code = v_code;

    -- Fallback
    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id
      FROM chart_of_accounts
      WHERE code = '4.1.2.99';
    END IF;
  END IF;

  RETURN QUERY SELECT v_account_id, v_is_adiantamento, v_entry_type;
END;
$$ LANGUAGE plpgsql;

-- 3. Reclassificar lançamentos de software que estão na conta errada (Gás)
DO $$
DECLARE
  v_gas_account_id UUID;
  v_software_account_id UUID;
  v_count INTEGER := 0;
  v_entry RECORD;
BEGIN
  -- Obter IDs das contas
  SELECT id INTO v_gas_account_id FROM chart_of_accounts WHERE code = '4.1.2.06';
  SELECT id INTO v_software_account_id FROM chart_of_accounts WHERE code = '4.1.2.12';

  IF v_gas_account_id IS NULL OR v_software_account_id IS NULL THEN
    RAISE NOTICE 'Contas não encontradas. Abortando reclassificação.';
    RETURN;
  END IF;

  -- Encontrar e reclassificar lançamentos de software na conta de Gás
  FOR v_entry IN
    SELECT ael.id, ae.description, ael.debit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_gas_account_id
    AND (
      -- Palavras-chave de sistemas/software
      ae.description ILIKE '%sistema%'
      OR ae.description ILIKE '%software%'
      OR ae.description ILIKE '%dominio%'
      OR ae.description ILIKE '%dataunique%'
      OR ae.description ILIKE '%sittax%'
      OR ae.description ILIKE '%contus%'
      OR ae.description ILIKE '%cr sistema%'
      OR ae.description ILIKE '%acessorias%'
      OR ae.description ILIKE '%objetiva%'
      OR ae.description ILIKE '%veri soluções%'
      OR ae.description ILIKE '%nb technology%'
      OR ae.description ILIKE '%autmais%'
      OR ae.description ILIKE '%catho%'
      OR ae.description ILIKE '%oneflow%'
      OR ae.description ILIKE '%clicksign%'
      OR ae.description ILIKE '%technology%'
      OR ae.description ILIKE '%tecnologia%'
      OR ae.description ILIKE '%assinatura%'
      OR ae.description ILIKE '%licen%'
    )
  LOOP
    UPDATE accounting_entry_lines
    SET account_id = v_software_account_id
    WHERE id = v_entry.id;

    v_count := v_count + 1;
    RAISE NOTICE 'Reclassificado: % | R$ % -> Software e Sistemas (4.1.2.12)', 
      LEFT(v_entry.description, 50), v_entry.debit;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total de lançamentos reclassificados: %', v_count;
  RAISE NOTICE 'De: 4.1.2.06 (Gás) Para: 4.1.2.12 (Software e Sistemas)';
  RAISE NOTICE '============================================';
END $$;

-- 4. Também atualizar as despesas na tabela expenses
UPDATE expenses
SET account_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.12')
WHERE category = 'software/sistemas'
  AND account_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.06');

-- Comentário final
COMMENT ON FUNCTION get_expense_or_adiantamento_account(TEXT) IS 
  'Retorna a conta contábil correta para uma categoria de despesa. 
   CORRIGIDO em 15/12/2025: software/sistemas agora vai para 4.1.2.12 (Software e Sistemas), não 4.1.2.06 (Gás)';
