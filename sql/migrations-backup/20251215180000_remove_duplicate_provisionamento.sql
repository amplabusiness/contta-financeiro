-- ============================================================================
-- CORREÇÃO: REMOVER LANÇAMENTOS DUPLICADOS (DESPESA + PROVISIONAMENTO)
-- ============================================================================
-- PROBLEMA: Cada despesa tem dois lançamentos contábeis:
--   1. "Despesa: ..." (data do pagamento)
--   2. "Provisionamento Despesa: ..." (data 30/01)
-- Isso duplica o valor na DRE
-- SOLUÇÃO: Remover os lançamentos de "Provisionamento" duplicados
-- ============================================================================

-- 1. Primeiro, vamos identificar os provisionamentos duplicados
-- Um provisionamento é duplicado se existe uma despesa com o mesmo fornecedor/valor

-- 2. Remover lançamentos de provisionamento duplicados
DO $$
DECLARE
  v_software_account_id UUID;
  v_count INTEGER := 0;
  v_total DECIMAL := 0;
  v_entry RECORD;
BEGIN
  -- Obter ID da conta de Software
  SELECT id INTO v_software_account_id FROM chart_of_accounts WHERE code = '4.1.2.12';

  IF v_software_account_id IS NULL THEN
    RAISE NOTICE 'Conta 4.1.2.12 não encontrada. Abortando.';
    RETURN;
  END IF;

  -- Encontrar e remover lançamentos de PROVISIONAMENTO que têm duplicata de DESPESA
  FOR v_entry IN
    SELECT 
      ael.id as line_id,
      ae.id as entry_id,
      ae.description,
      ael.debit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_software_account_id
      AND ae.description ILIKE 'Provisionamento Despesa:%'
      -- Verificar se existe uma despesa correspondente (não provisionamento)
      AND EXISTS (
        SELECT 1 
        FROM accounting_entries ae2
        JOIN accounting_entry_lines ael2 ON ae2.id = ael2.entry_id
        WHERE ael2.account_id = v_software_account_id
          AND ae2.description NOT ILIKE 'Provisionamento%'
          AND ae2.description ILIKE '%' || REPLACE(REPLACE(ae.description, 'Provisionamento Despesa: ', ''), 'Provisionamento Despesa:', '') || '%'
          AND ael2.debit = ael.debit
      )
  LOOP
    -- Deletar a linha do lançamento
    DELETE FROM accounting_entry_lines WHERE id = v_entry.line_id;
    
    -- Deletar o lançamento se não tiver mais linhas
    DELETE FROM accounting_entries 
    WHERE id = v_entry.entry_id 
      AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines WHERE entry_id = v_entry.entry_id);

    v_count := v_count + 1;
    v_total := v_total + COALESCE(v_entry.debit, 0);
    
    RAISE NOTICE 'Removido provisionamento duplicado: % | R$ %', 
      LEFT(v_entry.description, 60), v_entry.debit;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total de provisionamentos removidos: %', v_count;
  RAISE NOTICE 'Valor total removido: R$ %', v_total;
  RAISE NOTICE '============================================';
END $$;

-- 3. Verificar resultado
SELECT 
  ae.description,
  ael.debit,
  ae.entry_date
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ae.id = ael.entry_id
WHERE ael.account_id = (SELECT id FROM chart_of_accounts WHERE code = '4.1.2.12')
ORDER BY ae.entry_date, ae.description;
