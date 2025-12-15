# 🔧 CORREÇÃO URGENTE: Lançamentos de Software na conta de Gás

## Problema Identificado

Os lançamentos de **Software e Sistemas** estão sendo classificados incorretamente na conta **4.1.2.06 - Gás**.

**Lançamentos afetados (exemplo):**
- Dominio Sistemas - R$ 2.278,80
- DATAUNIQUE - R$ 1.410,00
- SISTEMA SITTAX - R$ 865,86
- CONTUS TECNOLOGIA - R$ 777,75
- CR SISTEMA - R$ 733,96
- Acessorias sistemas - R$ 469,90
- OBJETIVA EDICOES - R$ 423,60
- SISTEMA VERI SOLUÇÕES - R$ 418,00
- NB TECHNOLOGY - R$ 314,55
- SISTEMA AUTMAIS - R$ 222,00
- SISTEMA CATHO - R$ 178,00
- SISTEMA ONEFLOW - R$ 138,22
- CLICKSIGN - R$ 69,00

**Total incorreto:** R$ 8.299,64

## Causa do Erro

Na migration `20251210270000_update_expense_trigger_adiantamento.sql`, a categoria `'software/sistemas'` estava mapeada para `4.1.2.06` (que é Gás), quando deveria ir para `4.1.2.12` (Software e Sistemas).

## Solução

Execute o SQL abaixo no **Supabase SQL Editor**:
**URL:** https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new

---

## 📋 SQL para Executar

```sql
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
    WHERE code = '1.2.3.01';

  ELSE
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
      -- *** CORREÇÃO: software/sistemas vai para 4.1.2.12 ***
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
  SELECT id INTO v_gas_account_id FROM chart_of_accounts WHERE code = '4.1.2.06';
  SELECT id INTO v_software_account_id FROM chart_of_accounts WHERE code = '4.1.2.12';

  IF v_gas_account_id IS NULL OR v_software_account_id IS NULL THEN
    RAISE NOTICE 'Contas não encontradas. Abortando reclassificação.';
    RETURN;
  END IF;

  FOR v_entry IN
    SELECT ael.id, ae.description, ael.debit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_gas_account_id
    AND (
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

-- 5. Verificar resultado final
SELECT 
  coa.code,
  coa.name,
  COUNT(*) as qtd_lancamentos,
  SUM(ael.debit) as total_debito
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON coa.id = ael.account_id
WHERE coa.code IN ('4.1.2.06', '4.1.2.12')
GROUP BY coa.code, coa.name
ORDER BY coa.code;
```

---

## ✅ Resultado Esperado

Após executar:

| Código | Nome | Qtd Lançamentos | Total |
|--------|------|-----------------|-------|
| 4.1.2.06 | Gás | 0 ou poucos (somente gás real) | R$ baixo |
| 4.1.2.12 | Software e Sistemas | 13+ | R$ 8.299,64+ |

---

## 🔄 Após executar

1. Recarregue a página do DRE
2. Verifique se a conta **4.1.2.06 - Gás** agora mostra apenas lançamentos de gás
3. Verifique se a conta **4.1.2.12 - Software e Sistemas** mostra os lançamentos corretos

Data: 15/12/2025
