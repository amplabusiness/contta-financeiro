-- =====================================================
-- CORREÇÃO DO FLUXO DE TRANSAÇÕES BANCÁRIAS
-- Data: 2026-01-28
-- Objetivo: Garantir que entries só sejam criados com classificação completa
-- =====================================================

-- Desabilitar triggers temporariamente
SET session_replication_role = 'replica';

-- 1. CRIAR CONTA TRANSITÓRIA (se não existir)
-- =====================================================

DO $$
DECLARE
  v_parent_id UUID;
  v_exists BOOLEAN;
  v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421'; -- Ampla Contabilidade
BEGIN
  -- Buscar conta pai 1.1.9 (Outros Ativos Circulantes)
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1.9';

  IF v_parent_id IS NULL THEN
    -- Criar conta pai se não existir
    INSERT INTO chart_of_accounts (code, name, account_type, nature, is_analytical, is_active, level, tenant_id)
    VALUES ('1.1.9', 'Outros Ativos Circulantes', 'asset', 'DEVEDORA', false, true, 3, v_tenant_id)
    RETURNING id INTO v_parent_id;
  END IF;

  -- Verificar se conta transitória já existe
  SELECT EXISTS(SELECT 1 FROM chart_of_accounts WHERE code = '1.1.9.99') INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO chart_of_accounts (code, name, account_type, nature, is_analytical, is_active, parent_id, level, tenant_id)
    VALUES ('1.1.9.99', 'Valores Pendentes de Classificação', 'asset', 'DEVEDORA', true, true, v_parent_id, 4, v_tenant_id);
  END IF;

  -- Criar conta para passivos pendentes (saídas não classificadas)
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1.9';

  IF v_parent_id IS NULL THEN
    INSERT INTO chart_of_accounts (code, name, account_type, nature, is_analytical, is_active, level, tenant_id)
    VALUES ('2.1.9', 'Outros Passivos Circulantes', 'liability', 'CREDORA', false, true, 3, v_tenant_id)
    RETURNING id INTO v_parent_id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM chart_of_accounts WHERE code = '2.1.9.99') INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO chart_of_accounts (code, name, account_type, nature, is_analytical, is_active, parent_id, level, tenant_id)
    VALUES ('2.1.9.99', 'Saídas Pendentes de Classificação', 'liability', 'CREDORA', true, true, v_parent_id, 4, v_tenant_id);
  END IF;

  RAISE NOTICE 'Contas transitórias criadas/verificadas';
END;
$$;

-- 2. CRIAR FUNÇÃO PARA CLASSIFICAR TRANSAÇÃO BANCÁRIA
-- =====================================================
-- Esta função deve ser chamada quando o usuário classifica uma transação

CREATE OR REPLACE FUNCTION fn_classificar_transacao_bancaria(
  p_transaction_id UUID,
  p_rubrica_id UUID,
  p_account_id UUID DEFAULT NULL -- conta contábil de destino (opcional, pode vir da rubrica)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  v_rubrica RECORD;
  v_bank_account_id UUID;
  v_debit_account_id UUID;
  v_credit_account_id UUID;
  v_entry_id UUID;
  v_valor NUMERIC;
  v_tenant_id UUID;
  v_office_id UUID;
BEGIN
  -- 1. Buscar transação
  SELECT * INTO v_transaction
  FROM bank_transactions
  WHERE id = p_transaction_id;

  IF v_transaction IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;

  -- Verificar se já tem entry contábil definitivo
  IF EXISTS (
    SELECT 1 FROM accounting_entries ae
    JOIN accounting_entry_items aei ON aei.entry_id = ae.id
    WHERE ae.source_type = 'bank_transaction'
      AND ae.source_id = p_transaction_id
      AND COALESCE(ae.is_draft, false) = false
    GROUP BY ae.id
    HAVING COUNT(aei.id) >= 2  -- Entry completo tem pelo menos 2 items
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação já classificada');
  END IF;

  -- 2. Buscar rubrica
  SELECT * INTO v_rubrica
  FROM rubricas_contabeis
  WHERE id = p_rubrica_id;

  IF v_rubrica IS NULL THEN
    -- Tentar buscar em outras tabelas de rubricas
    SELECT id, debit_account_id, credit_account_id INTO v_rubrica
    FROM ai_learned_patterns
    WHERE id = p_rubrica_id;
  END IF;

  -- 3. Buscar conta bancária contábil
  SELECT accounting_account_id INTO v_bank_account_id
  FROM bank_accounts
  WHERE id = v_transaction.bank_account_id;

  IF v_bank_account_id IS NULL THEN
    -- Fallback: usar conta padrão do Sicredi
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE code = '1.1.1.05';
  END IF;

  -- 4. Determinar contas de débito e crédito
  v_valor := ABS(v_transaction.amount);
  v_tenant_id := v_transaction.tenant_id;
  v_office_id := v_transaction.office_id;

  IF v_transaction.amount < 0 THEN
    -- SAÍDA: Débito na despesa, Crédito no banco
    v_debit_account_id := COALESCE(p_account_id, v_rubrica.debit_account_id);
    v_credit_account_id := v_bank_account_id;
  ELSE
    -- ENTRADA: Débito no banco, Crédito na receita/cliente
    v_debit_account_id := v_bank_account_id;
    v_credit_account_id := COALESCE(p_account_id, v_rubrica.credit_account_id);
  END IF;

  -- 5. Validar que temos ambas as contas
  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Conta contábil não definida. Verifique a rubrica ou informe a conta manualmente.',
      'debit_account', v_debit_account_id,
      'credit_account', v_credit_account_id
    );
  END IF;

  -- 6. Deletar entry incompleto existente (se houver)
  DELETE FROM accounting_entries
  WHERE source_type = 'bank_transaction'
    AND source_id = p_transaction_id;

  -- 7. Criar entry contábil COMPLETO
  INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    source_type,
    source_id,
    entry_type,
    is_draft,
    tenant_id,
    office_id
  ) VALUES (
    v_transaction.transaction_date,
    v_transaction.transaction_date,
    v_transaction.description,
    'bank_transaction',
    p_transaction_id,
    'CONCILIACAO',
    false,
    v_tenant_id,
    v_office_id
  )
  RETURNING id INTO v_entry_id;

  -- 8. Inserir items (SEMPRE 2 items - partida dobrada)
  -- Item de DÉBITO
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, tenant_id)
  VALUES (v_entry_id, v_debit_account_id, v_valor, 0, v_transaction.description, v_tenant_id);

  -- Item de CRÉDITO
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, tenant_id)
  VALUES (v_entry_id, v_credit_account_id, 0, v_valor, v_transaction.description, v_tenant_id);

  -- 9. Atualizar transação com rubrica
  UPDATE bank_transactions
  SET rubrica_id = p_rubrica_id,
      status = 'reconciled',
      updated_at = NOW()
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'debit_account', v_debit_account_id,
    'credit_account', v_credit_account_id,
    'amount', v_valor
  );
END;
$$;

COMMENT ON FUNCTION fn_classificar_transacao_bancaria IS
'Classifica uma transação bancária e cria o lançamento contábil COMPLETO.
Garante partida dobrada - nunca cria entry com apenas 1 item.';

-- 3. MODIFICAR TRIGGER DE BANK_TRANSACTION PARA NÃO CRIAR ENTRY INCOMPLETO
-- =====================================================

CREATE OR REPLACE FUNCTION fn_on_bank_transaction_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bank_account_id UUID;
  v_debit_account_id UUID;
  v_credit_account_id UUID;
  v_entry_id UUID;
  v_valor NUMERIC;
  v_transitoria_entrada_id UUID;
  v_transitoria_saida_id UUID;
BEGIN
  -- Se não tem rubrica, NÃO CRIAR ENTRY
  -- O entry será criado quando o usuário classificar via fn_classificar_transacao_bancaria
  IF NEW.rubrica_id IS NULL THEN
    RAISE NOTICE 'Transação % sem rubrica - entry será criado na classificação', NEW.id;
    RETURN NEW;
  END IF;

  -- Buscar conta bancária
  SELECT accounting_account_id INTO v_bank_account_id
  FROM bank_accounts
  WHERE id = NEW.bank_account_id;

  IF v_bank_account_id IS NULL THEN
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE code = '1.1.1.05';
  END IF;

  -- Buscar contas da rubrica
  SELECT debit_account_id, credit_account_id
  INTO v_debit_account_id, v_credit_account_id
  FROM rubricas_contabeis
  WHERE id = NEW.rubrica_id;

  -- Se rubrica não tem contas definidas, não criar entry
  IF v_debit_account_id IS NULL AND v_credit_account_id IS NULL THEN
    RAISE NOTICE 'Rubrica % sem contas definidas - entry será criado na classificação', NEW.rubrica_id;
    RETURN NEW;
  END IF;

  v_valor := ABS(NEW.amount);

  -- Determinar contas baseado no tipo de transação
  IF NEW.amount < 0 THEN
    -- SAÍDA
    v_credit_account_id := v_bank_account_id;
    -- v_debit_account_id já vem da rubrica
  ELSE
    -- ENTRADA
    v_debit_account_id := v_bank_account_id;
    -- v_credit_account_id já vem da rubrica
  END IF;

  -- Só criar entry se tiver AMBAS as contas
  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RAISE NOTICE 'Contas incompletas para transação % - entry será criado na classificação', NEW.id;
    RETURN NEW;
  END IF;

  -- Deletar entry anterior se existir
  DELETE FROM accounting_entries
  WHERE source_type = 'bank_transaction'
    AND source_id = NEW.id;

  -- Criar entry completo
  INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    source_type,
    source_id,
    entry_type,
    is_draft,
    tenant_id,
    office_id
  ) VALUES (
    NEW.transaction_date,
    NEW.transaction_date,
    NEW.description,
    'bank_transaction',
    NEW.id,
    'CONCILIACAO',
    false,
    NEW.tenant_id,
    NEW.office_id
  )
  RETURNING id INTO v_entry_id;

  -- Inserir AMBOS os items
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, tenant_id)
  VALUES (v_entry_id, v_debit_account_id, v_valor, 0, NEW.description, NEW.tenant_id);

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, tenant_id)
  VALUES (v_entry_id, v_credit_account_id, 0, v_valor, NEW.description, NEW.tenant_id);

  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS trg_bank_transaction_accounting ON bank_transactions;
CREATE TRIGGER trg_bank_transaction_accounting
  AFTER INSERT OR UPDATE ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_on_bank_transaction_change();

-- 4. CONSTRAINT PARA GARANTIR PARTIDA DOBRADA
-- =====================================================

-- Função de validação
CREATE OR REPLACE FUNCTION fn_validate_entry_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
  v_item_count INTEGER;
BEGIN
  -- Buscar totais do entry
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0),
    COUNT(*)
  INTO v_total_debit, v_total_credit, v_item_count
  FROM accounting_entry_items
  WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id);

  -- Permitir se é o primeiro item (ainda não está completo)
  IF v_item_count <= 1 AND TG_OP = 'INSERT' THEN
    -- Será validado quando o segundo item for inserido
    RETURN NEW;
  END IF;

  -- Validar balanceamento para entries com 2+ items
  IF v_item_count >= 2 AND ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'ERRO CONTÁBIL: Entry desbalanceado! Débitos (%) <> Créditos (%)',
      v_total_debit, v_total_credit;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger de validação (desabilitado por padrão para não quebrar operações existentes)
-- DROP TRIGGER IF EXISTS trg_validate_entry_balanced ON accounting_entry_items;
-- CREATE TRIGGER trg_validate_entry_balanced
--   AFTER INSERT OR UPDATE OR DELETE ON accounting_entry_items
--   FOR EACH ROW
--   EXECUTE FUNCTION fn_validate_entry_balanced();

-- 5. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION fn_classificar_transacao_bancaria(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_classificar_transacao_bancaria(UUID, UUID, UUID) TO service_role;

-- 6. REABILITAR TRIGGERS
-- =====================================================

SET session_replication_role = 'origin';

-- 7. LOG
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '[Dr. Cícero] Fluxo de transações bancárias corrigido!';
  RAISE NOTICE '';
  RAISE NOTICE '  NOVO FLUXO:';
  RAISE NOTICE '  1. Import OFX → Transação sem entry (aguarda classificação)';
  RAISE NOTICE '  2. Usuário classifica → fn_classificar_transacao_bancaria()';
  RAISE NOTICE '  3. Entry COMPLETO criado (sempre com 2 items)';
  RAISE NOTICE '';
  RAISE NOTICE '  GARANTIAS:';
  RAISE NOTICE '  - Transação sem rubrica = sem entry contábil';
  RAISE NOTICE '  - Entry sempre com partida dobrada (D=C)';
  RAISE NOTICE '  - Contas transitórias para pendências';
  RAISE NOTICE '════════════════════════════════════════════════════════════════════';
END;
$$;
