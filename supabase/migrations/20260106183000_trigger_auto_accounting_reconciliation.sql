-- FASE 2: GATILHO DE PAGAMENTO (BAIXA) - VIA CONCILIAÇÃO
-- Autor: Dr. Cicero
-- Objetivo: Gerar lançamento de RECEBIMENTO (Baixa de Cliente) quando houver conciliação bancária

CREATE OR REPLACE FUNCTION fn_auto_accounting_reconciliation()
RETURNS TRIGGER AS $$
DECLARE
  v_bank_account_id UUID;
  v_bank_chart_account_id UUID; -- Conta Contábil do Banco
  v_client_account_id UUID;     -- Conta Contábil Clientes (1.1.2.01)
  v_amount DECIMAL;
  v_date DATE;
  v_history TEXT;
  v_entry_id UUID;
  v_client_id UUID;
  v_invoice_id UUID;
BEGIN
  -- Busca dados da transação bancária
  SELECT bank_account_id, amount, transaction_date, description 
  INTO v_bank_account_id, v_amount, v_date, v_history
  FROM bank_transactions WHERE id = NEW.transaction_id;

  -- Se invoice_id estiver presente, busca dados do cliente
  IF NEW.invoice_id IS NOT NULL THEN
     SELECT client_id INTO v_client_id FROM invoices WHERE id = NEW.invoice_id;
     v_invoice_id := NEW.invoice_id;
  END IF;

  -- 1. Identificar Conta Contábil do Banco (Mapeamento Simples por enquanto)
  -- Na prática, precisaria de um campo 'chart_account_id' na tabela 'bank_accounts'.
  -- VAMOS ASSUMIR BRADESCO/SICREDI PELA LÓGICA DE NOME (Fase 2 Simplificada)
  -- TODO: Adicionar coluna chart_account_id em bank_accounts na Fase 3
  
  -- Fallback para "Banco Sicredi" (1.1.1.05) se não souber qual é
  SELECT id INTO v_bank_chart_account_id FROM chart_of_accounts WHERE code = '1.1.1.05'; 

  -- 2. Identificar Conta Clientes (1.1.2.01)
  SELECT id INTO v_client_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';

  -- 3. Gerar Lançamento de Recebimento
  -- D: Banco
  -- C: Clientes
  
  v_history := 'Recebimento Fatura - ' || v_history;

  INSERT INTO accounting_entries (
    entry_date, 
    competence_date, 
    description, 
    history, 
    entry_type, 
    document_type, 
    transaction_id,
    invoice_id,
    total_debit, 
    total_credit
  ) VALUES (
    v_date,
    v_date, -- Regime de Caixa para o recebimento
    'Recebimento de Cliente',
    v_history,
    'RECEBIMENTO',
    'EXTRATO',
    NEW.transaction_id,
    v_invoice_id,
    v_amount,
    v_amount
  ) RETURNING id INTO v_entry_id;

  -- Partida DÉBITO (Banco)
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_bank_chart_account_id, v_amount, 0, v_history, v_client_id
  );

  -- Partida CRÉDITO (Cliente)
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_client_account_id, 0, v_amount, v_history, v_client_id
  );

  -- Atualiza o ID do lançamento na tabela de conciliação
  UPDATE bank_reconciliation SET accounting_entry_id = v_entry_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_auto_accounting_reconciliation ON bank_reconciliation;
CREATE TRIGGER trg_auto_accounting_reconciliation
AFTER INSERT ON bank_reconciliation
FOR EACH ROW
EXECUTE FUNCTION fn_auto_accounting_reconciliation();
