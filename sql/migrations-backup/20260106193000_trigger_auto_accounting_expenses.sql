-- FASE 2.5: GATILHO DE DESPESAS (PROVISIONING)
-- Autor: Dr. Cicero

CREATE OR REPLACE FUNCTION fn_auto_accounting_expense_provision()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_account_id UUID; -- Despesa (Natureza)
  v_credit_account_id UUID; -- Fornecedor (Passivo)
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- Verificar duplicidade
  PERFORM 1 FROM accounting_entries 
  WHERE document_number = NEW.id::TEXT AND entry_type = 'PROVISAO_DESPESA';
  IF FOUND THEN RETURN NEW; END IF;

  -- 1. Identificar Conta de Débito (Natureza da Despesa)
  v_debit_account_id := NEW.chart_account_id;
  
  -- Se não informada, tentar mapear pela categoria (Texto) - Legado
  IF v_debit_account_id IS NULL THEN
     -- Exemplo simples de mapeamento, ideal é o frontend passar o ID
     CASE NEW.category
       WHEN 'Aluguel' THEN SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.01';
       WHEN 'Energia' THEN SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.03';
       ELSE 
         -- Fallback para "Outras Despesas Administrativas"
         SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.12';
     END CASE;
  END IF;

  -- 2. Identificar Conta de Crédito (Fornecedor)
  IF NEW.supplier_id IS NOT NULL THEN
     SELECT account_id INTO v_credit_account_id FROM suppliers WHERE id = NEW.supplier_id;
  END IF;

  -- Se não tem fornecedor específico, usa "Fornecedores Diversos" (criar se não existir ou usar genérica se permitido)
  -- Como a ordem é "evitar genéricas", vamos forçar o uso de fornecedor. Mas precisamos de um fallback para não quebrar.
  IF v_credit_account_id IS NULL THEN
     -- Fallback: Fornecedores Nacionais (Grupo) -> Isso vai falhar no trigger de segurança!
     -- Precisamos de uma conta "Fornecedor Não Identificado" analítica para transição se necessário
     -- Ou buscar pela descrição.
     -- Por segurança Fase 2.5, vamos logar aviso e usar conta transitória ou genérica ANALITICA
     -- Criando conta genérica analítica '2.1.1.01.9999 - Fornecedores Diversos' se não existir
     PERFORM 1; -- Placeholder
  END IF;

  -- Se ainda nulo, aborta contabilização automática (melhor não lançar do que lançar errado genérico)
  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
     RETURN NEW; 
  END IF;

  v_history := 'Provisão Despesa - ' || NEW.description;

  INSERT INTO accounting_entries (
    entry_date, competence_date, description, history, entry_type, document_type, document_number, total_debit, total_credit, created_by
  ) VALUES (
    NEW.created_at::DATE, NEW.due_date, 
    'Provisão de Despesa', v_history, 'PROVISAO_DESPESA', 'FATURA_FORNECEDOR', NEW.id::TEXT, NEW.amount, NEW.amount, NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- DÉBITO: Despesa (Natureza)
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history) 
  VALUES (v_entry_id, v_debit_account_id, NEW.amount, 0, v_history);

  -- CRÉDITO: Fornecedor (Passivo)
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history) 
  VALUES (v_entry_id, v_credit_account_id, 0, NEW.amount, v_history);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_accounting_expense_insert ON expenses;
CREATE TRIGGER trg_auto_accounting_expense_insert
AFTER INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION fn_auto_accounting_expense_provision();
