-- Script de Backfill para Conciliações Bancárias (Jan/2025+) - VERSÃO SEGURA
-- Gera lançamentos contábeis para pagamentos/recebimentos já conciliados mas sem contabilização

CREATE OR REPLACE FUNCTION run_backfill_jan2025_safe() RETURNS void AS $$
DECLARE
  r_rec RECORD;
  v_bank_chart_account_id UUID;
  v_client_account_id UUID;
  v_entry_id UUID;
  v_history TEXT;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Iniciando Backfill de Conciliações Bancárias...';

  -- 1. Identificar Conta Clientes (1.1.2.01 - Contas a Receber)
  SELECT id INTO v_client_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  
  -- 2. Identificar Conta Banco Padrão (1.1.1.05 - Sicredi)
  SELECT id INTO v_bank_chart_account_id FROM chart_of_accounts WHERE code = '1.1.1.05';

  IF v_client_account_id IS NULL OR v_bank_chart_account_id IS NULL THEN
    RAISE EXCEPTION 'Contas contábeis padrão (1.1.2.01 ou 1.1.1.05) não encontradas.';
  END IF;

  -- 3. Loop em Conciliações sem Contabilidade
  FOR r_rec IN 
    SELECT 
        br.id as reconciliation_id,
        br.invoice_id, 
        bt.id as transaction_id, 
        bt.amount, 
        bt.transaction_date, 
        bt.description, 
        iv.client_id,
        c.name as client_name
    FROM bank_reconciliation br
    JOIN bank_transactions bt ON bt.id = br.transaction_id
    LEFT JOIN invoices iv ON iv.id = br.invoice_id
    LEFT JOIN clients c ON c.id = iv.client_id
    WHERE bt.transaction_date >= '2025-01-01'
    AND br.accounting_entry_id IS NULL
    AND br.invoice_id IS NOT NULL
  LOOP
     
     v_history := 'Recebimento Fatura (Backfill) - ' || COALESCE(r_rec.client_name, 'Cliente Desconhecido') || ' - ' || r_rec.description;

     -- Criar Cabeçalho do Lançamento
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
        total_credit,
        balanced
     ) VALUES (
        r_rec.transaction_date,
        r_rec.transaction_date, -- Regime de Caixa
        'Recebimento de Cliente',
        v_history,
        'RECEBIMENTO',
        'EXTRATO',
        r_rec.transaction_id,
        r_rec.invoice_id,
        ABS(r_rec.amount),
        ABS(r_rec.amount),
        true
     ) RETURNING id INTO v_entry_id;

     -- DÉBITO: Banco (Entrou dinheiro)
     INSERT INTO accounting_entry_lines (
        entry_id, account_id, debit, credit, description, client_id
     ) VALUES (
        v_entry_id, v_bank_chart_account_id, ABS(r_rec.amount), 0, v_history, r_rec.client_id
     );

     -- CRÉDITO: Clientes (Baixou dívida)
     INSERT INTO accounting_entry_lines (
        entry_id, account_id, debit, credit, description, client_id
     ) VALUES (
        v_entry_id, v_client_account_id, 0, ABS(r_rec.amount), v_history, r_rec.client_id
     );

     -- Atualizar Conciliação
     UPDATE bank_reconciliation 
     SET accounting_entry_id = v_entry_id 
     WHERE id = r_rec.reconciliation_id;
     
     v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Backfill Concluído. % lançamentos de conciliação gerados.', v_count;
END;
$$ LANGUAGE plpgsql;

-- Executa a função
SELECT run_backfill_jan2025_safe();

-- Remove a função após uso
DROP FUNCTION run_backfill_jan2025_safe();
