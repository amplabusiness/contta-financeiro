-- Criar funções para lançamentos contábeis automáticos

-- Função para criar lançamento de provisionamento de receita (invoice criada)
CREATE OR REPLACE FUNCTION create_invoice_provision_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_account_receivable_id UUID;
  v_revenue_id UUID;
BEGIN
  -- Pegar o usuário que criou
  v_user_id := NEW.created_by;
  
  -- Buscar contas contábeis
  SELECT id INTO v_account_receivable_id 
  FROM chart_of_accounts 
  WHERE code = '1.1.2.02' AND is_active = true 
  LIMIT 1;
  
  SELECT id INTO v_revenue_id 
  FROM chart_of_accounts 
  WHERE code = '4.1.1' AND is_active = true 
  LIMIT 1;
  
  -- Verificar se as contas existem
  IF v_account_receivable_id IS NULL OR v_revenue_id IS NULL THEN
    RAISE NOTICE 'Contas contábeis não encontradas para provisionamento de receita';
    RETURN NEW;
  END IF;
  
  -- Criar lançamento contábil de provisionamento
  INSERT INTO accounting_entries (
    entry_type,
    description,
    entry_date,
    reference_type,
    reference_id,
    document_number,
    total_debit,
    total_credit,
    balanced,
    created_by
  ) VALUES (
    'provision',
    'Provisionamento de Receita - Invoice ' || NEW.id,
    COALESCE(NEW.competence::date, NEW.due_date),
    'invoice',
    NEW.id,
    NEW.id::text,
    NEW.amount,
    NEW.amount,
    true,
    v_user_id
  ) RETURNING id INTO v_entry_id;
  
  -- Criar linhas do lançamento
  -- Débito: Honorários a Receber
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_entry_id,
    v_account_receivable_id,
    NEW.amount,
    0,
    'Honorários a Receber'
  );
  
  -- Crédito: Receita de Honorários
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_entry_id,
    v_revenue_id,
    0,
    NEW.amount,
    'Receita de Honorários Contábeis'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para criar lançamento de baixa de receita (invoice paga)
CREATE OR REPLACE FUNCTION create_invoice_payment_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_bank_id UUID;
  v_account_receivable_id UUID;
BEGIN
  -- Só criar se mudou para pago
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    v_user_id := NEW.created_by;
    
    -- Buscar contas contábeis
    SELECT id INTO v_bank_id 
    FROM chart_of_accounts 
    WHERE code = '1.1.1.02' AND is_active = true 
    LIMIT 1;
    
    SELECT id INTO v_account_receivable_id 
    FROM chart_of_accounts 
    WHERE code = '1.1.2.02' AND is_active = true 
    LIMIT 1;
    
    IF v_bank_id IS NULL OR v_account_receivable_id IS NULL THEN
      RAISE NOTICE 'Contas contábeis não encontradas para baixa de receita';
      RETURN NEW;
    END IF;
    
    -- Criar lançamento de baixa
    INSERT INTO accounting_entries (
      entry_type,
      description,
      entry_date,
      reference_type,
      reference_id,
      document_number,
      total_debit,
      total_credit,
      balanced,
      created_by
    ) VALUES (
      'payment',
      'Recebimento de Invoice ' || NEW.id,
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'invoice',
      NEW.id,
      NEW.id::text,
      NEW.amount,
      NEW.amount,
      true,
      v_user_id
    ) RETURNING id INTO v_entry_id;
    
    -- Débito: Bancos
    INSERT INTO accounting_entry_lines (
      entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_entry_id,
      v_bank_id,
      NEW.amount,
      0,
      'Recebimento via Banco'
    );
    
    -- Crédito: Honorários a Receber (baixa)
    INSERT INTO accounting_entry_lines (
      entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_entry_id,
      v_account_receivable_id,
      0,
      NEW.amount,
      'Baixa de Honorários a Receber'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para criar lançamento de provisionamento de despesa (expense criada)
CREATE OR REPLACE FUNCTION create_expense_provision_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_expense_account_id UUID;
  v_payable_id UUID;
BEGIN
  v_user_id := NEW.created_by;
  
  -- Buscar conta de despesa baseada na categoria
  SELECT id INTO v_expense_account_id
  FROM chart_of_accounts
  WHERE type = 'expense' 
    AND is_active = true
    AND is_synthetic = false
  ORDER BY 
    CASE 
      WHEN LOWER(name) LIKE '%' || LOWER(NEW.category) || '%' THEN 1
      ELSE 2
    END,
    code
  LIMIT 1;
  
  -- Conta padrão de contas a pagar
  SELECT id INTO v_payable_id 
  FROM chart_of_accounts 
  WHERE code = '2.1.1.08' AND is_active = true 
  LIMIT 1;
  
  IF v_expense_account_id IS NULL OR v_payable_id IS NULL THEN
    RAISE NOTICE 'Contas contábeis não encontradas para provisionamento de despesa';
    RETURN NEW;
  END IF;
  
  -- Criar lançamento de provisionamento
  INSERT INTO accounting_entries (
    entry_type,
    description,
    entry_date,
    reference_type,
    reference_id,
    document_number,
    total_debit,
    total_credit,
    balanced,
    created_by
  ) VALUES (
    'provision',
    'Provisionamento de Despesa - ' || NEW.description,
    COALESCE(NEW.competence::date, NEW.due_date),
    'expense',
    NEW.id,
    NEW.id::text,
    NEW.amount,
    NEW.amount,
    true,
    v_user_id
  ) RETURNING id INTO v_entry_id;
  
  -- Débito: Despesa
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_entry_id,
    v_expense_account_id,
    NEW.amount,
    0,
    NEW.category || ' - ' || NEW.description
  );
  
  -- Crédito: Contas a Pagar
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_entry_id,
    v_payable_id,
    0,
    NEW.amount,
    'Contas a Pagar'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para criar lançamento de pagamento de despesa (expense paga)
CREATE OR REPLACE FUNCTION create_expense_payment_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_bank_id UUID;
  v_payable_id UUID;
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    v_user_id := NEW.created_by;
    
    -- Buscar contas
    SELECT id INTO v_bank_id 
    FROM chart_of_accounts 
    WHERE code = '1.1.1.02' AND is_active = true 
    LIMIT 1;
    
    SELECT id INTO v_payable_id 
    FROM chart_of_accounts 
    WHERE code = '2.1.1.08' AND is_active = true 
    LIMIT 1;
    
    IF v_bank_id IS NULL OR v_payable_id IS NULL THEN
      RAISE NOTICE 'Contas contábeis não encontradas para pagamento de despesa';
      RETURN NEW;
    END IF;
    
    -- Criar lançamento de pagamento
    INSERT INTO accounting_entries (
      entry_type,
      description,
      entry_date,
      reference_type,
      reference_id,
      document_number,
      total_debit,
      total_credit,
      balanced,
      created_by
    ) VALUES (
      'payment',
      'Pagamento de Despesa - ' || NEW.description,
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'expense',
      NEW.id,
      NEW.id::text,
      NEW.amount,
      NEW.amount,
      true,
      v_user_id
    ) RETURNING id INTO v_entry_id;
    
    -- Débito: Contas a Pagar (baixa)
    INSERT INTO accounting_entry_lines (
      entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_entry_id,
      v_payable_id,
      NEW.amount,
      0,
      'Baixa de Contas a Pagar'
    );
    
    -- Crédito: Bancos
    INSERT INTO accounting_entry_lines (
      entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_entry_id,
      v_bank_id,
      0,
      NEW.amount,
      'Pagamento via Banco'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers

-- Invoice: provisionamento ao criar
DROP TRIGGER IF EXISTS trg_invoice_provision ON invoices;
CREATE TRIGGER trg_invoice_provision
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_provision_entry();

-- Invoice: baixa ao pagar
DROP TRIGGER IF EXISTS trg_invoice_payment ON invoices;
CREATE TRIGGER trg_invoice_payment
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_payment_entry();

-- Expense: provisionamento ao criar
DROP TRIGGER IF EXISTS trg_expense_provision ON expenses;
CREATE TRIGGER trg_expense_provision
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION create_expense_provision_entry();

-- Expense: baixa ao pagar
DROP TRIGGER IF EXISTS trg_expense_payment ON expenses;
CREATE TRIGGER trg_expense_payment
  AFTER UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION create_expense_payment_entry();