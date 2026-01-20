-- ============================================================================
-- TRIGGERS AUTOMÁTICOS PARA DESPESAS
-- ============================================================================
-- Fluxo: Despesas → Livro Diário → Razão Contábil → DRE
--
-- 1. Ao criar despesa → D: Conta de Despesa / C: Fornecedores a Pagar
-- 2. Ao pagar despesa → D: Fornecedores a Pagar / C: Banco
-- 3. Ao deletar despesa → Remove lançamentos do Diário
-- ============================================================================

-- Garantir contas necessárias
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
VALUES
  ('2.1.1.01', 'Fornecedores a Pagar', 'PASSIVO', 'CREDORA', 4, true, true),
  ('4.1.2.99', 'Outras Despesas Administrativas', 'DESPESA', 'DEVEDORA', 4, true, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- FUNÇÃO: Mapear categoria de despesa para conta contábil
-- ============================================================================
CREATE OR REPLACE FUNCTION get_expense_account_id(p_category TEXT)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_code TEXT;
BEGIN
  -- Mapear categoria para código de conta
  v_code := CASE LOWER(COALESCE(p_category, 'default'))
    WHEN 'salarios' THEN '4.1.1.01'
    WHEN 'encargos' THEN '4.1.1.02'
    WHEN 'aluguel' THEN '4.1.2.01'
    WHEN 'energia' THEN '4.1.2.02'
    WHEN 'telefone' THEN '4.1.2.03'
    WHEN 'internet' THEN '4.1.2.03'
    WHEN 'material' THEN '4.1.2.04'
    WHEN 'servicos' THEN '4.1.2.05'
    WHEN 'juros' THEN '4.1.3.01'
    WHEN 'tarifas' THEN '4.1.3.02'
    ELSE '4.1.2.99'
  END;

  -- Buscar conta
  SELECT id INTO v_account_id
  FROM chart_of_accounts
  WHERE code = v_code;

  -- Se não encontrar, usar conta padrão
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id
    FROM chart_of_accounts
    WHERE code = '4.1.2.99';
  END IF;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Ao INSERIR despesa
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_expense_insert() RETURNS TRIGGER AS $$
DECLARE
  v_expense_account_id UUID;
  v_payable_account_id UUID;
  v_competence_date DATE;
BEGIN
  -- Obter conta de despesa baseada na categoria
  v_expense_account_id := get_expense_account_id(NEW.category);

  -- Buscar conta de fornecedores a pagar
  SELECT id INTO v_payable_account_id
  FROM chart_of_accounts
  WHERE code = '2.1.1.01';

  IF v_payable_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta de fornecedores 2.1.1.01 não encontrada';
  END IF;

  -- Data de competência
  v_competence_date := COALESCE(NEW.expense_date, NEW.due_date, CURRENT_DATE);

  -- Criar lançamento no diário (provisionamento)
  PERFORM create_journal_entry(
    COALESCE(NEW.expense_date, NEW.created_at::DATE, CURRENT_DATE),
    v_competence_date,
    'despesa',
    'Despesa: ' || NEW.description,
    'expenses',
    NEW.id,
    v_expense_account_id,     -- Débito: Conta de Despesa
    v_payable_account_id,     -- Crédito: Fornecedores a Pagar
    NEW.amount,
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Ao ATUALIZAR despesa
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_expense_update() RETURNS TRIGGER AS $$
DECLARE
  v_payable_account_id UUID;
  v_bank_account_id UUID;
BEGIN
  -- Se status mudou para PAGO
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    -- Buscar conta de fornecedores
    SELECT id INTO v_payable_account_id
    FROM chart_of_accounts
    WHERE code = '2.1.1.01';

    -- Buscar conta bancária
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE code = '1.1.1.02';

    IF v_bank_account_id IS NULL THEN
      -- Usar caixa geral como fallback
      SELECT id INTO v_bank_account_id
      FROM chart_of_accounts
      WHERE code = '1.1.1.01';
    END IF;

    -- Criar lançamento de pagamento
    PERFORM create_journal_entry(
      COALESCE(NEW.payment_date, CURRENT_DATE),
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'pagamento_despesa',
      'Pagamento: ' || NEW.description,
      'expenses_payment',
      NEW.id,
      v_payable_account_id,     -- Débito: Fornecedores (baixa)
      v_bank_account_id,        -- Crédito: Banco/Caixa
      NEW.amount,
      NEW.created_by
    );
  END IF;

  -- Se valor mudou, atualizar lançamentos
  IF OLD.amount != NEW.amount THEN
    UPDATE accounting_entries
    SET total_debit = NEW.amount, total_credit = NEW.amount
    WHERE reference_type = 'expenses' AND reference_id = NEW.id;

    UPDATE accounting_entry_lines
    SET debit = CASE WHEN debit > 0 THEN NEW.amount ELSE 0 END,
        credit = CASE WHEN credit > 0 THEN NEW.amount ELSE 0 END
    WHERE entry_id IN (
      SELECT id FROM accounting_entries
      WHERE reference_type = 'expenses' AND reference_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Ao DELETAR despesa
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_expense_delete() RETURNS TRIGGER AS $$
BEGIN
  -- Deletar lançamentos de provisionamento
  PERFORM delete_journal_entries_by_reference('expenses', OLD.id);

  -- Deletar lançamentos de pagamento
  PERFORM delete_journal_entries_by_reference('expenses_payment', OLD.id);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- REMOVER TRIGGERS ANTIGOS
-- ============================================================================
DROP TRIGGER IF EXISTS trg_expense_insert ON expenses;
DROP TRIGGER IF EXISTS trg_expense_update ON expenses;
DROP TRIGGER IF EXISTS trg_expense_delete ON expenses;

-- ============================================================================
-- CRIAR TRIGGERS
-- ============================================================================
CREATE TRIGGER trg_expense_insert
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION trg_expense_insert();

CREATE TRIGGER trg_expense_update
  AFTER UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION trg_expense_update();

CREATE TRIGGER trg_expense_delete
  BEFORE DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION trg_expense_delete();

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON FUNCTION get_expense_account_id IS 'Mapeia categoria de despesa para conta contábil';
COMMENT ON FUNCTION trg_expense_insert IS 'Trigger: Cria lançamento contábil ao inserir despesa';
COMMENT ON FUNCTION trg_expense_update IS 'Trigger: Atualiza contabilidade ao modificar despesa';
COMMENT ON FUNCTION trg_expense_delete IS 'Trigger: Remove lançamentos ao deletar despesa';
