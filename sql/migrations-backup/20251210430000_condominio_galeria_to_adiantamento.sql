-- ============================================================================
-- CORREÇÃO: Condomínio Galeria Nacional é Adiantamento (não despesa)
-- ============================================================================
-- Sergio Carneiro Leão tem 3 salas na Galeria Nacional como investimento pessoal
-- O condomínio dessas salas é pago pela Ampla, mas é adiantamento ao sócio
-- A Ampla Business NÃO paga condomínio (o proprietário é o próprio Sergio)
-- ============================================================================

DO $$
DECLARE
  v_entry RECORD;
  v_old_account_id UUID;
  v_adiant_account_id UUID;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
BEGIN
  -- Buscar conta atual (Condomínio Sede - 4.1.2.10)
  SELECT id INTO v_old_account_id FROM chart_of_accounts WHERE code = '4.1.2.10';

  -- Buscar conta de adiantamento Sergio
  SELECT id INTO v_adiant_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.01';

  -- Se não existir conta específica do Sergio, usar a genérica
  IF v_adiant_account_id IS NULL THEN
    SELECT id INTO v_adiant_account_id FROM chart_of_accounts WHERE code = '1.1.3.04';
  END IF;

  IF v_old_account_id IS NULL OR v_adiant_account_id IS NULL THEN
    RAISE NOTICE 'Conta não encontrada!';
    RETURN;
  END IF;

  RAISE NOTICE '=== RECLASSIFICANDO CONDOMÍNIO GALERIA NACIONAL ===';
  RAISE NOTICE 'De: Condomínio Sede (4.1.2.10) -> Para: Adiantamento Sócio';

  -- Mover lançamentos de Condomínio Galeria para Adiantamento
  FOR v_entry IN
    SELECT ael.id, ae.description, ael.debit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_old_account_id AND ael.debit > 0
      AND ae.description ILIKE '%Condomínio Galeria%'
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_adiant_account_id WHERE id = v_entry.id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Movido: % | R$ %', LEFT(v_entry.description, 50), v_entry.debit;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== RESULTADO ===';
  RAISE NOTICE 'Lançamentos movidos: %', v_count;
  RAISE NOTICE 'Valor removido do DRE: R$ %', v_total;
END $$;

-- Também verificar se há outros condomínios que deveriam ser adiantamento
-- (Condomínio que NÃO seja da sede)
DO $$
DECLARE
  v_entry RECORD;
  v_despesa_account_id UUID;
  v_adiant_account_id UUID;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
BEGIN
  -- Buscar conta genérica de despesas
  SELECT id INTO v_despesa_account_id FROM chart_of_accounts WHERE code = '4.1.2.99';
  SELECT id INTO v_adiant_account_id FROM chart_of_accounts WHERE code = '1.1.3.04.01';

  IF v_adiant_account_id IS NULL THEN
    SELECT id INTO v_adiant_account_id FROM chart_of_accounts WHERE code = '1.1.3.04';
  END IF;

  IF v_despesa_account_id IS NULL OR v_adiant_account_id IS NULL THEN
    RETURN;
  END IF;

  -- Buscar outros condomínios em despesas genéricas
  FOR v_entry IN
    SELECT ael.id, ae.description, ael.debit
    FROM accounting_entry_lines ael
    JOIN accounting_entries ae ON ae.id = ael.entry_id
    WHERE ael.account_id = v_despesa_account_id AND ael.debit > 0
      AND ae.description ILIKE '%Condomínio%'
      AND ae.description NOT ILIKE '%sede%'
  LOOP
    UPDATE accounting_entry_lines SET account_id = v_adiant_account_id WHERE id = v_entry.id;
    v_count := v_count + 1;
    v_total := v_total + v_entry.debit;
    RAISE NOTICE 'Outros condomínios -> Adiantamento: % | R$ %', LEFT(v_entry.description, 50), v_entry.debit;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE 'Outros condomínios movidos: %, Total: R$ %', v_count, v_total;
  END IF;
END $$;

-- Renomear/desativar conta Condomínio Sede já que Ampla não paga condomínio
UPDATE chart_of_accounts
SET name = 'Condomínio Sede (não usado)', is_active = false
WHERE code = '4.1.2.10';

-- Verificar DRE atualizado
DO $$
DECLARE
  v_rec RECORD;
  v_total NUMERIC := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DRE ATUALIZADO ===';

  FOR v_rec IN
    SELECT coa.code, coa.name, COALESCE(SUM(ael.debit), 0) as total
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id AND ael.debit > 0
    WHERE coa.code LIKE '4.%'
      AND coa.is_analytical = true
      AND coa.is_active = true
    GROUP BY coa.code, coa.name
    HAVING COALESCE(SUM(ael.debit), 0) > 0
    ORDER BY coa.code
  LOOP
    RAISE NOTICE '% | % | R$ %', v_rec.code, RPAD(v_rec.name, 30), v_rec.total;
    v_total := v_total + v_rec.total;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== TOTAL DESPESAS: R$ % ===', v_total;
END $$;

-- Verificar total de adiantamentos
DO $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(ael.debit), 0) INTO v_total
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '1.1.3.04%';

  RAISE NOTICE '';
  RAISE NOTICE '=== TOTAL ADIANTAMENTOS A SÓCIOS: R$ % ===', v_total;
END $$;
