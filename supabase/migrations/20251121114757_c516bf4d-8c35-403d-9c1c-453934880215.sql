-- =====================================================
-- Corrigir duplicação de políticas RLS em Storage
-- =====================================================

-- Remover políticas permissivas duplicadas que permitem
-- qualquer usuário autenticado acessar TODOS os arquivos
DROP POLICY IF EXISTS "Authenticated users can view bank statements" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view boleto reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload bank statements" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload boleto reports" ON storage.objects;

-- As políticas restritivas corretas já existem:
-- - "Users can view own bank statements" (owner OU admin)
-- - "Users can view own boleto reports" (owner OU admin)
-- - "Users can upload bank statements" (com verificação de bucket)
-- - "Users can upload boleto reports" (com verificação de bucket)

-- =====================================================
-- Adicionar search_path às funções SECURITY DEFINER
-- =====================================================

-- Função: check_entry_balance
CREATE OR REPLACE FUNCTION public.check_entry_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_total_debit NUMERIC;
  entry_total_credit NUMERIC;
  lines_total_debit NUMERIC;
  lines_total_credit NUMERIC;
BEGIN
  -- Calcular totais das linhas
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO lines_total_debit, lines_total_credit
  FROM accounting_entry_lines
  WHERE entry_id = NEW.id;

  -- Comparar com os totais do cabeçalho
  IF ABS(NEW.total_debit - lines_total_debit) > 0.01 OR 
     ABS(NEW.total_credit - lines_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Entry totals do not match line totals';
  END IF;

  -- Verificar se está balanceado
  IF ABS(lines_total_debit - lines_total_credit) > 0.01 THEN
    NEW.balanced := false;
  ELSE
    NEW.balanced := true;
  END IF;

  RETURN NEW;
END;
$$;

-- Função: generate_recurring_expenses (já existe, apenas adicionar search_path)
CREATE OR REPLACE FUNCTION public.generate_recurring_expenses()
RETURNS TABLE(
  generated_count INTEGER,
  expenses_created UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_expense RECORD;
  new_expense_id UUID;
  current_month DATE;
  expenses_array UUID[] := ARRAY[]::UUID[];
  count_generated INTEGER := 0;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE);
  
  FOR parent_expense IN
    SELECT *
    FROM accounts_payable
    WHERE is_recurring = true
      AND is_suspended = false
      AND recurrence_frequency IS NOT NULL
      AND recurrence_day IS NOT NULL
  LOOP
    -- Calcular a data de vencimento do novo gasto
    DECLARE
      next_due_date DATE;
    BEGIN
      next_due_date := (current_month + INTERVAL '1 month' * 
        CASE parent_expense.recurrence_frequency
          WHEN 'monthly' THEN 1
          WHEN 'quarterly' THEN 3
          WHEN 'semiannual' THEN 6
          WHEN 'annual' THEN 12
          ELSE 1
        END
      )::DATE + (parent_expense.recurrence_day - 1);

      -- Verificar se já existe um gasto para este mês
      IF NOT EXISTS (
        SELECT 1 FROM accounts_payable
        WHERE parent_expense_id = parent_expense.id
          AND due_date = next_due_date
      ) THEN
        -- Criar novo gasto recorrente
        INSERT INTO accounts_payable (
          supplier_name,
          supplier_document,
          amount,
          due_date,
          category,
          description,
          status,
          parent_expense_id,
          is_recurring,
          recurrence_frequency,
          recurrence_day,
          created_by,
          cost_center,
          payment_method,
          bank_account
        )
        VALUES (
          parent_expense.supplier_name,
          parent_expense.supplier_document,
          parent_expense.amount,
          next_due_date,
          parent_expense.category,
          parent_expense.description || ' (Recorrente - ' || TO_CHAR(next_due_date, 'MM/YYYY') || ')',
          'pending',
          parent_expense.id,
          false,
          parent_expense.recurrence_frequency,
          parent_expense.recurrence_day,
          parent_expense.created_by,
          parent_expense.cost_center,
          parent_expense.payment_method,
          parent_expense.bank_account
        )
        RETURNING id INTO new_expense_id;

        expenses_array := array_append(expenses_array, new_expense_id);
        count_generated := count_generated + 1;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT count_generated, expenses_array;
END;
$$;