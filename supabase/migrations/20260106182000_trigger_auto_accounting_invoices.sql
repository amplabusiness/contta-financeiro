-- FASE 2: GATILHO DE FATURAMENTO (REVENUE RECOGNITION)
-- Autor: Dr. Cicero
-- Objetivo: Gerar lançamento de PROVISÃO (Receita) automaticamente ao criar Honorário

CREATE OR REPLACE FUNCTION fn_auto_accounting_invoice_provision()
RETURNS TRIGGER AS $$
DECLARE
  v_credit_account_id UUID; -- Receita
  v_debit_account_id UUID;  -- Clientes
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- Apenas processa se status for 'pending' (novo) ou 'paid' (já nasceu pago)
  -- Evita duplicidade: verifica se já existe lançamento de PROVISAO para este invoice
  PERFORM 1 FROM accounting_entries 
  WHERE invoice_id = NEW.id AND entry_type = 'PROVISAO_RECEITA';
  
  IF FOUND THEN
    RETURN NEW; -- Já contabilizado, ignora
  END IF;

  -- 1. Identificar Contas
  -- Receita de Honorários (3.1.1.01)
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '3.1.1.01';
  
  -- Clientes a Receber (1.1.2.01)
  SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';

  IF v_credit_account_id IS NULL OR v_debit_account_id IS NULL THEN
    RAISE WARNING 'Contas contábeis padrão (3.1.1.01 ou 1.1.2.01) não encontradas. Contabilização automática abortada para Invoice %', NEW.id;
    RETURN NEW;
  END IF;

  -- 2. Criar Cabeçalho do Lançamento
  v_history := 'Provisão de Honorários - ' || COALESCE(NEW.description, 'Serviços Contábeis') || ' - Comp: ' || COALESCE(NEW.competence, TO_CHAR(NEW.due_date, 'MM/YYYY'));

  INSERT INTO accounting_entries (
    entry_date, 
    competence_date, 
    description, 
    history, 
    entry_type, 
    document_type, 
    document_number, 
    invoice_id, 
    total_debit, 
    total_credit, 
    created_by
  ) VALUES (
    NEW.created_at::DATE, -- Data do Fato Gerador (Emissão)
    COALESCE(TO_DATE(NEW.competence, 'MM/YYYY'), NEW.due_date), -- Competência
    'Provisão de Receita',
    v_history,
    'PROVISAO_RECEITA',
    'FATURA',
    NULL,
    NEW.id,
    NEW.amount,
    NEW.amount,
    NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- 3. Criar Partidas (Débito e Crédito)
  
  -- DÉBITO: Clientes a Receber
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_debit_account_id, NEW.amount, 0, v_history, NEW.client_id
  );

  -- CRÉDITO: Receita de Serviços
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_credit_account_id, 0, NEW.amount, v_history, NEW.client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_auto_accounting_invoice_insert ON invoices;
CREATE TRIGGER trg_auto_accounting_invoice_insert
AFTER INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION fn_auto_accounting_invoice_provision();
