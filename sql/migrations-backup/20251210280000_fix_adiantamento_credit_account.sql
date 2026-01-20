-- ============================================================================
-- CORREÇÃO: Conta de crédito dos Adiantamentos
-- ============================================================================
-- Lançamento correto de adiantamento:
--   D: 1.1.3.04.xx - Adiantamentos a Sócios (ATIVO)
--   C: 1.1.1.02    - Banco Sicredi (ATIVO)
--
-- O crédito anterior estava em Fornecedores (2.1.1.01), que está errado.
-- Adiantamento é saída de banco, não criação de obrigação com fornecedor.
-- ============================================================================

DO $$
DECLARE
  v_bank_id UUID;
  v_fornecedor_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Buscar IDs das contas
  SELECT id INTO v_bank_id
  FROM chart_of_accounts
  WHERE code = '1.1.1.02';

  SELECT id INTO v_fornecedor_id
  FROM chart_of_accounts
  WHERE code = '2.1.1.01';

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Conta bancária 1.1.1.02 não encontrada';
  END IF;

  -- Corrigir linhas de crédito dos adiantamentos
  -- Mudar de Fornecedores (2.1.1.01) para Banco (1.1.1.02)
  UPDATE accounting_entry_lines ael
  SET account_id = v_bank_id
  FROM accounting_entries ae
  WHERE ael.entry_id = ae.id
    AND ae.entry_type = 'adiantamento_socio'
    AND ael.credit > 0
    AND ael.account_id = v_fornecedor_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Corrigidas % linhas de crédito de adiantamentos (Fornecedores -> Banco)', v_count;
END $$;

-- Verificação
DO $$
DECLARE
  v_check INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_check
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE ae.entry_type = 'adiantamento_socio'
    AND ael.credit > 0
    AND coa.code NOT LIKE '1.1.1%';

  IF v_check > 0 THEN
    RAISE WARNING 'Ainda existem % linhas de adiantamento com crédito em conta incorreta', v_check;
  ELSE
    RAISE NOTICE 'Verificação OK: Todos os adiantamentos creditam conta bancária';
  END IF;
END $$;
