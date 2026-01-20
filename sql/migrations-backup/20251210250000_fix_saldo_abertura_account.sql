-- ============================================================================
-- CORREÇÃO: Lançamentos de Saldo de Abertura com conta incorreta
-- ============================================================================
-- Problema: Alguns lançamentos de saldo_abertura estão creditando a conta
-- 3.1.1.01 (Receita de Honorários) ao invés de 5.2.1.02 (Saldos de Abertura)
--
-- Isso está errado porque saldo de abertura NÃO É RECEITA - é apenas uma
-- transferência de saldo do período anterior para o Patrimônio Líquido.
-- ============================================================================

-- Passo 1: Identificar e buscar os IDs das contas envolvidas
DO $$
DECLARE
  v_receita_id UUID;
  v_saldo_abertura_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Buscar conta de receita (ERRADA para saldo de abertura)
  SELECT id INTO v_receita_id
  FROM chart_of_accounts
  WHERE code = '3.1.1.01';

  -- Buscar conta de saldos de abertura (CORRETA)
  SELECT id INTO v_saldo_abertura_id
  FROM chart_of_accounts
  WHERE code = '5.2.1.02';

  IF v_saldo_abertura_id IS NULL THEN
    -- Criar a conta se não existir
    INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
    VALUES ('5.2.1.02', 'Saldos de Abertura', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true)
    RETURNING id INTO v_saldo_abertura_id;

    RAISE NOTICE 'Conta 5.2.1.02 criada com ID %', v_saldo_abertura_id;
  END IF;

  IF v_receita_id IS NULL THEN
    RAISE NOTICE 'Conta de receita 3.1.1.01 não encontrada. Nenhuma correção necessária.';
    RETURN;
  END IF;

  -- Passo 2: Corrigir linhas de lançamentos de saldo_abertura
  -- que estão creditando a conta de receita (3.1.1.01)
  UPDATE accounting_entry_lines ael
  SET account_id = v_saldo_abertura_id
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
    AND ae.entry_type = 'saldo_abertura'
    AND ael.account_id = v_receita_id
    AND ael.credit > 0;  -- Apenas os créditos (a contrapartida)

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Corrigidos % lançamentos de saldo de abertura (conta de crédito alterada de 3.1.1.01 para 5.2.1.02)', v_count;
END $$;

-- ============================================================================
-- VERIFICAÇÃO: Garantir que não há mais saldo_abertura creditando receita
-- ============================================================================
DO $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE ae.entry_type = 'saldo_abertura'
    AND coa.code = '3.1.1.01'
    AND ael.credit > 0;

  IF v_remaining > 0 THEN
    RAISE WARNING 'Ainda existem % lançamentos de saldo_abertura creditando a conta de receita!', v_remaining;
  ELSE
    RAISE NOTICE 'Verificação OK: Nenhum saldo_abertura creditando conta de receita.';
  END IF;
END $$;

-- ============================================================================
-- COMENTÁRIO
-- ============================================================================
COMMENT ON TABLE accounting_entry_lines IS 'Linhas de lançamentos contábeis - Corrigido: saldo_abertura agora credita 5.2.1.02';
