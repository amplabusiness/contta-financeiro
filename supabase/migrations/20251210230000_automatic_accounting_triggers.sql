-- ============================================================================
-- SISTEMA CONTÁBIL AUTOMÁTICO - FLUXO COMPLETO
-- ============================================================================
-- Fluxo: Honorários → Livro Diário → Razão Contábil → DRE/Balancete → Balanço
--
-- Este migration cria triggers automáticos para:
-- 1. Ao criar honorário → Lançamento no Diário (D: Cliente / C: Receita)
-- 2. Ao pagar honorário → Lançamento no Diário (D: Banco / C: Cliente)
-- 3. Ao deletar honorário → Remove lançamentos do Diário
-- 4. Ao alterar valor → Atualiza lançamentos no Diário
-- ============================================================================

-- Primeiro, garantir que as contas necessárias existam
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
VALUES
  ('3.1.1.01', 'Honorários Contábeis', 'RECEITA', 'CREDORA', 4, true, true),
  ('1.1.1.02', 'Banco Sicredi C/C', 'ATIVO', 'DEVEDORA', 4, true, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- FUNÇÃO: Obter ou criar conta de cliente no plano de contas
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_client_account(p_client_id UUID, p_client_name TEXT)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
  v_next_code TEXT;
  v_last_num INTEGER;
BEGIN
  -- Buscar conta existente do cliente
  SELECT id INTO v_account_id
  FROM chart_of_accounts
  WHERE name ILIKE '%' || p_client_name || '%'
    AND code LIKE '1.1.2.01.%'
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  -- Criar nova conta para o cliente
  -- Encontrar próximo código disponível
  SELECT COALESCE(MAX(CAST(SPLIT_PART(code, '.', 5) AS INTEGER)), 0) + 1
  INTO v_last_num
  FROM chart_of_accounts
  WHERE code LIKE '1.1.2.01.%';

  v_next_code := '1.1.2.01.' || LPAD(v_last_num::TEXT, 3, '0');

  -- Garantir que a conta pai existe
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
  VALUES ('1.1.2.01', 'Clientes a Receber', 'ATIVO', 'DEVEDORA', 4, false, true)
  ON CONFLICT (code) DO NOTHING;

  -- Criar conta do cliente
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES (
    v_next_code,
    'Cliente: ' || p_client_name,
    'ATIVO',
    'DEVEDORA',
    5,
    true,
    true,
    (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01')
  )
  RETURNING id INTO v_account_id;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: Criar lançamento no Livro Diário (accounting_entries + lines)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_journal_entry(
  p_entry_date DATE,
  p_competence_date DATE,
  p_entry_type TEXT,
  p_description TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_debit_account_id UUID,
  p_credit_account_id UUID,
  p_amount DECIMAL(15,2),
  p_created_by UUID
) RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  -- Criar o lançamento principal (cabeçalho do diário)
  INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    entry_type,
    description,
    reference_type,
    reference_id,
    total_debit,
    total_credit,
    balanced,
    created_by
  ) VALUES (
    p_entry_date,
    p_competence_date,
    p_entry_type,
    p_description,
    p_reference_type,
    p_reference_id,
    p_amount,
    p_amount,
    true,
    p_created_by
  )
  RETURNING id INTO v_entry_id;

  -- Criar linha de débito
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    description,
    debit,
    credit
  ) VALUES (
    v_entry_id,
    p_debit_account_id,
    'D - ' || p_description,
    p_amount,
    0
  );

  -- Criar linha de crédito
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    description,
    debit,
    credit
  ) VALUES (
    v_entry_id,
    p_credit_account_id,
    'C - ' || p_description,
    0,
    p_amount
  );

  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: Deletar lançamentos contábeis por referência
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_journal_entries_by_reference(
  p_reference_type TEXT,
  p_reference_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  -- Deletar linhas primeiro (FK constraint)
  DELETE FROM accounting_entry_lines
  WHERE entry_id IN (
    SELECT id FROM accounting_entries
    WHERE reference_type = p_reference_type
      AND reference_id = p_reference_id
  );

  -- Deletar entradas
  DELETE FROM accounting_entries
  WHERE reference_type = p_reference_type
    AND reference_id = p_reference_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Ao INSERIR honorário (invoice)
-- Cria lançamento: D: Cliente a Receber / C: Receita de Honorários
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_invoice_insert() RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_client_account_id UUID;
  v_revenue_account_id UUID;
  v_competence_date DATE;
BEGIN
  -- Buscar nome do cliente
  SELECT name INTO v_client_name
  FROM clients
  WHERE id = NEW.client_id;

  IF v_client_name IS NULL THEN
    v_client_name := 'Cliente não identificado';
  END IF;

  -- Obter/criar conta do cliente
  v_client_account_id := get_or_create_client_account(NEW.client_id, v_client_name);

  -- Buscar conta de receita de honorários
  SELECT id INTO v_revenue_account_id
  FROM chart_of_accounts
  WHERE code = '3.1.1.01';

  IF v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta de receita 3.1.1.01 não encontrada';
  END IF;

  -- Calcular data de competência baseada no campo competence (MM/YYYY)
  IF NEW.competence IS NOT NULL AND NEW.competence ~ '^\d{2}/\d{4}$' THEN
    v_competence_date := TO_DATE('01/' || NEW.competence, 'DD/MM/YYYY');
    -- Usar último dia do mês
    v_competence_date := (DATE_TRUNC('MONTH', v_competence_date) + INTERVAL '1 MONTH - 1 day')::DATE;
  ELSE
    v_competence_date := COALESCE(NEW.due_date, CURRENT_DATE);
  END IF;

  -- Criar lançamento no diário (competência)
  PERFORM create_journal_entry(
    COALESCE(NEW.due_date, NEW.created_at::DATE, CURRENT_DATE),
    v_competence_date,
    'receita_honorarios',
    'Honorários ' || NEW.competence || ' - ' || v_client_name,
    'invoices',
    NEW.id,
    v_client_account_id,      -- Débito: Cliente a Receber
    v_revenue_account_id,     -- Crédito: Receita de Honorários
    NEW.amount,
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Ao ATUALIZAR honorário (invoice)
-- Se mudou para PAGO: Cria lançamento D: Banco / C: Cliente
-- Se mudou valor: Atualiza lançamentos existentes
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_invoice_update() RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_client_account_id UUID;
  v_revenue_account_id UUID;
  v_bank_account_id UUID;
  v_competence_date DATE;
BEGIN
  -- Buscar nome do cliente
  SELECT name INTO v_client_name
  FROM clients
  WHERE id = NEW.client_id;

  IF v_client_name IS NULL THEN
    v_client_name := 'Cliente não identificado';
  END IF;

  -- Se status mudou para PAGO
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    -- Obter conta do cliente
    v_client_account_id := get_or_create_client_account(NEW.client_id, v_client_name);

    -- Buscar conta bancária SICREDI
    SELECT id INTO v_bank_account_id
    FROM chart_of_accounts
    WHERE code = '1.1.1.02';

    IF v_bank_account_id IS NULL THEN
      -- Criar conta se não existir
      INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
      VALUES ('1.1.1.02', 'Banco Sicredi C/C', 'ATIVO', 'DEVEDORA', 4, true, true)
      RETURNING id INTO v_bank_account_id;
    END IF;

    -- Criar lançamento de recebimento no diário
    PERFORM create_journal_entry(
      COALESCE(NEW.paid_date, CURRENT_DATE),
      COALESCE(NEW.paid_date, CURRENT_DATE),
      'recebimento',
      'Recebimento ' || v_client_name || ' - Honorários ' || NEW.competence,
      'invoices_payment',
      NEW.id,
      v_bank_account_id,        -- Débito: Banco SICREDI
      v_client_account_id,      -- Crédito: Cliente a Receber (baixa)
      NEW.amount,
      NEW.created_by
    );
  END IF;

  -- Se valor mudou, atualizar lançamentos existentes
  IF OLD.amount != NEW.amount THEN
    -- Atualizar valores nos lançamentos de competência
    UPDATE accounting_entries
    SET total_debit = NEW.amount, total_credit = NEW.amount
    WHERE reference_type = 'invoices' AND reference_id = NEW.id;

    UPDATE accounting_entry_lines
    SET debit = CASE WHEN debit > 0 THEN NEW.amount ELSE 0 END,
        credit = CASE WHEN credit > 0 THEN NEW.amount ELSE 0 END
    WHERE entry_id IN (
      SELECT id FROM accounting_entries
      WHERE reference_type = 'invoices' AND reference_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Ao DELETAR honorário (invoice)
-- Remove todos os lançamentos contábeis relacionados
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_invoice_delete() RETURNS TRIGGER AS $$
BEGIN
  -- Deletar lançamentos de competência
  PERFORM delete_journal_entries_by_reference('invoices', OLD.id);

  -- Deletar lançamentos de pagamento
  PERFORM delete_journal_entries_by_reference('invoices_payment', OLD.id);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- REMOVER TRIGGERS ANTIGOS (se existirem)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_invoice_insert ON invoices;
DROP TRIGGER IF EXISTS trg_invoice_update ON invoices;
DROP TRIGGER IF EXISTS trg_invoice_delete ON invoices;

-- ============================================================================
-- CRIAR TRIGGERS
-- ============================================================================
CREATE TRIGGER trg_invoice_insert
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trg_invoice_insert();

CREATE TRIGGER trg_invoice_update
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trg_invoice_update();

CREATE TRIGGER trg_invoice_delete
  BEFORE DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trg_invoice_delete();

-- ============================================================================
-- SINCRONIZAR HONORÁRIOS EXISTENTES QUE NÃO TÊM LANÇAMENTOS
-- ============================================================================
DO $$
DECLARE
  v_invoice RECORD;
  v_client_name TEXT;
  v_client_account_id UUID;
  v_revenue_account_id UUID;
  v_bank_account_id UUID;
  v_competence_date DATE;
  v_count INTEGER := 0;
BEGIN
  -- Buscar conta de receita
  SELECT id INTO v_revenue_account_id
  FROM chart_of_accounts
  WHERE code = '3.1.1.01';

  -- Buscar conta bancária
  SELECT id INTO v_bank_account_id
  FROM chart_of_accounts
  WHERE code = '1.1.1.02';

  -- Processar invoices sem lançamento contábil
  FOR v_invoice IN
    SELECT i.*, c.name as client_name
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    WHERE NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.reference_type = 'invoices'
        AND ae.reference_id = i.id
    )
  LOOP
    v_client_name := COALESCE(v_invoice.client_name, 'Cliente não identificado');

    -- Obter/criar conta do cliente
    v_client_account_id := get_or_create_client_account(v_invoice.client_id, v_client_name);

    -- Calcular data de competência
    IF v_invoice.competence IS NOT NULL AND v_invoice.competence ~ '^\d{2}/\d{4}$' THEN
      v_competence_date := TO_DATE('01/' || v_invoice.competence, 'DD/MM/YYYY');
      v_competence_date := (DATE_TRUNC('MONTH', v_competence_date) + INTERVAL '1 MONTH - 1 day')::DATE;
    ELSE
      v_competence_date := COALESCE(v_invoice.due_date, CURRENT_DATE);
    END IF;

    -- Criar lançamento de competência
    PERFORM create_journal_entry(
      COALESCE(v_invoice.due_date, v_invoice.created_at::DATE, CURRENT_DATE),
      v_competence_date,
      'receita_honorarios',
      'Honorários ' || v_invoice.competence || ' - ' || v_client_name,
      'invoices',
      v_invoice.id,
      v_client_account_id,
      v_revenue_account_id,
      v_invoice.amount,
      v_invoice.created_by
    );

    -- Se já está pago, criar lançamento de recebimento
    IF v_invoice.status = 'paid' AND v_invoice.paid_date IS NOT NULL THEN
      PERFORM create_journal_entry(
        v_invoice.paid_date,
        v_invoice.paid_date,
        'recebimento',
        'Recebimento ' || v_client_name || ' - Honorários ' || v_invoice.competence,
        'invoices_payment',
        v_invoice.id,
        v_bank_account_id,
        v_client_account_id,
        v_invoice.amount,
        v_invoice.created_by
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Sincronizados % honorários para a contabilidade', v_count;
END $$;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON FUNCTION get_or_create_client_account IS 'Obtém ou cria conta contábil para um cliente específico';
COMMENT ON FUNCTION create_journal_entry IS 'Cria lançamento no Livro Diário com débito e crédito';
COMMENT ON FUNCTION delete_journal_entries_by_reference IS 'Remove lançamentos contábeis por referência';
COMMENT ON FUNCTION trg_invoice_insert IS 'Trigger: Cria lançamento contábil ao inserir honorário';
COMMENT ON FUNCTION trg_invoice_update IS 'Trigger: Atualiza contabilidade ao modificar honorário';
COMMENT ON FUNCTION trg_invoice_delete IS 'Trigger: Remove lançamentos ao deletar honorário';
