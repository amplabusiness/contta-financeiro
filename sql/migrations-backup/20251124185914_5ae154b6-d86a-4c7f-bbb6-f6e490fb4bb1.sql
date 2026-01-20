-- ================================================
-- FIX: Adicionar SET search_path = public em todas as funções
-- para evitar ataques de manipulação de schema
-- ================================================

-- 1. add_barter_credit
CREATE OR REPLACE FUNCTION public.add_barter_credit(
  p_client_id uuid, 
  p_type text, 
  p_amount numeric, 
  p_description text, 
  p_reference_date date, 
  p_competence text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_id UUID;
  v_balance_before DECIMAL(10,2);
  v_balance_after DECIMAL(10,2);
BEGIN
  v_balance_before := get_barter_balance(p_client_id);
  
  IF p_type = 'credit' THEN
    v_balance_after := v_balance_before + p_amount;
  ELSE
    v_balance_after := v_balance_before - p_amount;
  END IF;
  
  INSERT INTO barter_credits (
    client_id, type, amount, description, reference_date,
    competence, balance_before, balance_after, created_by
  ) VALUES (
    p_client_id, p_type, p_amount, p_description, p_reference_date,
    p_competence, v_balance_before, v_balance_after, auth.uid()
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$;

-- 2. get_barter_balance
CREATE OR REPLACE FUNCTION public.get_barter_balance(p_client_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_balance DECIMAL(10,2);
BEGIN
  SELECT COALESCE(
    SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0
  )
  INTO v_balance
  FROM barter_credits
  WHERE client_id = p_client_id;
  
  RETURN v_balance;
END;
$function$;

-- 3. get_cnpj_root
CREATE OR REPLACE FUNCTION public.get_cnpj_root(cnpj_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT substring(regexp_replace(cnpj_value, '[^0-9]', '', 'g'), 1, 8);
$function$;

-- 4. get_cnpj_branch
CREATE OR REPLACE FUNCTION public.get_cnpj_branch(cnpj_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT substring(regexp_replace(cnpj_value, '[^0-9]', '', 'g'), 9, 4);
$function$;

-- 5. get_economic_group_impact
CREATE OR REPLACE FUNCTION public.get_economic_group_impact(p_year integer DEFAULT NULL::integer)
RETURNS TABLE(
  group_key text, 
  partner_names text[], 
  company_count bigint, 
  company_names text[], 
  company_ids uuid[], 
  total_revenue numeric, 
  percentage_of_total numeric, 
  risk_level text
)
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  total_year_revenue NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO total_year_revenue
  FROM invoices
  WHERE status = 'paid'
    AND (p_year IS NULL OR EXTRACT(YEAR FROM payment_date::date) = p_year);
  
  IF total_year_revenue = 0 THEN
    total_year_revenue := 1;
  END IF;
  
  RETURN QUERY
  WITH company_partners AS (
    SELECT
      client_id,
      ARRAY_AGG(DISTINCT COALESCE(cpf, name) ORDER BY COALESCE(cpf, name)) as partners_array
    FROM client_partners
    GROUP BY client_id
  ),
  grouped_companies AS (
    SELECT
      ARRAY_TO_STRING(partners_array, '|') as group_key,
      partners_array,
      ARRAY_AGG(client_id) as company_ids
    FROM company_partners
    GROUP BY ARRAY_TO_STRING(partners_array, '|'), partners_array
    HAVING COUNT(*) > 1
  ),
  company_revenues AS (
    SELECT
      i.client_id,
      COALESCE(SUM(i.amount), 0) as revenue
    FROM invoices i
    WHERE i.status = 'paid'
      AND (p_year IS NULL OR EXTRACT(YEAR FROM i.payment_date::date) = p_year)
    GROUP BY i.client_id
  ),
  group_analysis AS (
    SELECT
      gc.group_key,
      gc.partners_array as partner_names,
      CARDINALITY(gc.company_ids) as company_count,
      ARRAY(
        SELECT c.name FROM clients c WHERE c.id = ANY(gc.company_ids)
      ) as company_names,
      gc.company_ids,
      COALESCE(SUM(cr.revenue), 0) as total_revenue,
      ROUND((COALESCE(SUM(cr.revenue), 0) / NULLIF(total_year_revenue, 0)) * 100, 2) as percentage_of_total
    FROM grouped_companies gc
    LEFT JOIN company_revenues cr ON cr.client_id = ANY(gc.company_ids)
    GROUP BY gc.group_key, gc.partners_array, gc.company_ids
  )
  SELECT
    ga.group_key, ga.partner_names, ga.company_count,
    ga.company_names, ga.company_ids, ga.total_revenue,
    ga.percentage_of_total,
    CASE
      WHEN ga.percentage_of_total >= 20 THEN 'high'
      WHEN ga.percentage_of_total >= 10 THEN 'medium'
      ELSE 'low'
    END as risk_level
  FROM group_analysis ga
  WHERE ga.total_revenue > 0
  ORDER BY ga.total_revenue DESC;
END;
$function$;

-- 6. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 7. update_work_order_status_on_log
CREATE OR REPLACE FUNCTION public.update_work_order_status_on_log()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  UPDATE collection_work_orders
  SET 
    status = CASE 
      WHEN status = 'pending' THEN 'in_progress'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.work_order_id;
  
  RETURN NEW;
END;
$function$;

-- 8. validate_client_document
CREATE OR REPLACE FUNCTION public.validate_client_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  normalized_cnpj TEXT;
  normalized_cpf TEXT;
  existing_id UUID;
  cnpj_root TEXT;
BEGIN
  IF (NEW.cnpj IS NULL OR btrim(NEW.cnpj) = '')
     AND (NEW.cpf IS NULL OR btrim(NEW.cpf) = '') THEN
    RAISE EXCEPTION 'Cliente precisa ter CNPJ ou CPF para ser cadastrado.';
  END IF;
  
  IF NEW.cnpj IS NOT NULL AND btrim(NEW.cnpj) <> '' THEN
    normalized_cnpj := regexp_replace(NEW.cnpj, '[^0-9]', '', 'g');
    
    IF length(normalized_cnpj) = 11 THEN
      NEW.cpf := normalized_cnpj;
      NEW.cnpj := NULL;
      normalized_cnpj := NULL;
    ELSIF length(normalized_cnpj) <> 14 THEN
      RAISE EXCEPTION 'CNPJ inválido (deve conter 14 dígitos). Se for CPF, o campo deve conter 11 dígitos.';
    END IF;
    
    IF normalized_cnpj IS NOT NULL THEN
      SELECT id INTO existing_id
      FROM public.clients
      WHERE status = 'active'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND regexp_replace(cnpj, '[^0-9]', '', 'g') = normalized_cnpj
      LIMIT 1;
      
      IF existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'CNPJ já cadastrado para outro cliente ativo.';
      END IF;
      
      cnpj_root := substring(normalized_cnpj from 1 for 8);
    END IF;
  END IF;
  
  IF NEW.cpf IS NOT NULL AND btrim(NEW.cpf) <> '' THEN
    normalized_cpf := regexp_replace(NEW.cpf, '[^0-9]', '', 'g');
    
    IF length(normalized_cpf) <> 11 THEN
      RAISE EXCEPTION 'CPF inválido (deve conter 11 dígitos).';
    END IF;
    
    SELECT id INTO existing_id
    FROM public.clients
    WHERE status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND regexp_replace(cpf, '[^0-9]', '', 'g') = normalized_cpf
    LIMIT 1;
    
    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'CPF já cadastrado para outro cliente ativo.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 9. validate_client_before_insert
CREATE OR REPLACE FUNCTION public.validate_client_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  normalized_cnpj TEXT;
  normalized_cpf  TEXT;
  existing_id     UUID;
BEGIN
  IF (NEW.cnpj IS NULL OR btrim(NEW.cnpj) = '')
     AND (NEW.cpf IS NULL OR btrim(NEW.cpf) = '') THEN
    RAISE EXCEPTION 'Cliente precisa ter CNPJ ou CPF para ser cadastrado.';
  END IF;
  
  IF NEW.cnpj IS NOT NULL AND btrim(NEW.cnpj) <> '' THEN
    normalized_cnpj := regexp_replace(NEW.cnpj, '[^0-9]', '', 'g');
    
    IF length(normalized_cnpj) <> 14 THEN
      RAISE EXCEPTION 'CNPJ inválido (deve conter 14 dígitos).';
    END IF;
    
    SELECT id INTO existing_id
    FROM public.clients
    WHERE status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND regexp_replace(cnpj, '[^0-9]', '', 'g') = normalized_cnpj
    LIMIT 1;
    
    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe cliente ativo com este CNPJ exato (ID: %). Filiais diferentes da mesma empresa são permitidas.', existing_id;
    END IF;
  END IF;
  
  IF NEW.cpf IS NOT NULL AND btrim(NEW.cpf) <> '' THEN
    normalized_cpf := regexp_replace(NEW.cpf, '[^0-9]', '', 'g');
    
    IF length(normalized_cpf) <> 11 THEN
      RAISE EXCEPTION 'CPF inválido (deve conter 11 dígitos).';
    END IF;
    
    SELECT id INTO existing_id
    FROM public.clients
    WHERE status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND regexp_replace(cpf, '[^0-9]', '', 'g') = normalized_cpf
    LIMIT 1;
    
    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe cliente ativo com este CPF (ID: %).', existing_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 10. create_invoice_provision_entry
CREATE OR REPLACE FUNCTION public.create_invoice_provision_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_account_receivable_id UUID;
  v_revenue_id UUID;
BEGIN
  v_user_id := NEW.created_by;
  
  SELECT id INTO v_account_receivable_id 
  FROM chart_of_accounts 
  WHERE code = '1.1.2.02' AND is_active = true 
  LIMIT 1;
  
  SELECT id INTO v_revenue_id 
  FROM chart_of_accounts 
  WHERE code = '4.1.1' AND is_active = true 
  LIMIT 1;
  
  IF v_account_receivable_id IS NULL OR v_revenue_id IS NULL THEN
    RAISE NOTICE 'Contas contábeis não encontradas para provisionamento de receita';
    RETURN NEW;
  END IF;
  
  INSERT INTO accounting_entries (
    entry_type, description, entry_date, reference_type,
    reference_id, document_number, total_debit, total_credit,
    balanced, created_by
  ) VALUES (
    'provision',
    'Provisionamento de Receita - Invoice ' || NEW.id,
    COALESCE(NEW.competence::date, NEW.due_date),
    'invoice', NEW.id, NEW.id::text,
    NEW.amount, NEW.amount, true, v_user_id
  ) RETURNING id INTO v_entry_id;
  
  INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
  VALUES (v_entry_id, v_account_receivable_id, NEW.amount, 0, 'Honorários a Receber');
  
  INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
  VALUES (v_entry_id, v_revenue_id, 0, NEW.amount, 'Receita de Honorários Contábeis');
  
  RETURN NEW;
END;
$function$;

-- 11. create_invoice_payment_entry
CREATE OR REPLACE FUNCTION public.create_invoice_payment_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_bank_id UUID;
  v_account_receivable_id UUID;
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    v_user_id := NEW.created_by;
    
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
    
    INSERT INTO accounting_entries (
      entry_type, description, entry_date, reference_type,
      reference_id, document_number, total_debit, total_credit,
      balanced, created_by
    ) VALUES (
      'payment',
      'Recebimento de Invoice ' || NEW.id,
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'invoice', NEW.id, NEW.id::text,
      NEW.amount, NEW.amount, true, v_user_id
    ) RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, v_bank_id, NEW.amount, 0, 'Recebimento via Banco');
    
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, v_account_receivable_id, 0, NEW.amount, 'Baixa de Honorários a Receber');
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 12. create_expense_provision_entry
CREATE OR REPLACE FUNCTION public.create_expense_provision_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_expense_account_id UUID;
  v_payable_id UUID;
BEGIN
  v_user_id := NEW.created_by;
  
  SELECT id INTO v_expense_account_id
  FROM chart_of_accounts
  WHERE type = 'expense' 
    AND is_active = true
    AND is_synthetic = false
  ORDER BY 
    CASE 
      WHEN LOWER(name) LIKE '%' || LOWER(NEW.category) || '%' THEN 1
      ELSE 2
    END, code
  LIMIT 1;
  
  SELECT id INTO v_payable_id 
  FROM chart_of_accounts 
  WHERE code = '2.1.1.08' AND is_active = true 
  LIMIT 1;
  
  IF v_expense_account_id IS NULL OR v_payable_id IS NULL THEN
    RAISE NOTICE 'Contas contábeis não encontradas para provisionamento de despesa';
    RETURN NEW;
  END IF;
  
  INSERT INTO accounting_entries (
    entry_type, description, entry_date, reference_type,
    reference_id, document_number, total_debit, total_credit,
    balanced, created_by
  ) VALUES (
    'provision',
    'Provisionamento de Despesa - ' || NEW.description,
    COALESCE(NEW.competence::date, NEW.due_date),
    'expense', NEW.id, NEW.id::text,
    NEW.amount, NEW.amount, true, v_user_id
  ) RETURNING id INTO v_entry_id;
  
  INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
  VALUES (v_entry_id, v_expense_account_id, NEW.amount, 0, NEW.category || ' - ' || NEW.description);
  
  INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
  VALUES (v_entry_id, v_payable_id, 0, NEW.amount, 'Contas a Pagar');
  
  RETURN NEW;
END;
$function$;

-- 13. create_expense_payment_entry
CREATE OR REPLACE FUNCTION public.create_expense_payment_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_bank_id UUID;
  v_payable_id UUID;
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    v_user_id := NEW.created_by;
    
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
    
    INSERT INTO accounting_entries (
      entry_type, description, entry_date, reference_type,
      reference_id, document_number, total_debit, total_credit,
      balanced, created_by
    ) VALUES (
      'payment',
      'Pagamento de Despesa - ' || NEW.description,
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'expense', NEW.id, NEW.id::text,
      NEW.amount, NEW.amount, true, v_user_id
    ) RETURNING id INTO v_entry_id;
    
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, v_payable_id, NEW.amount, 0, 'Baixa de Contas a Pagar');
    
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, v_bank_id, 0, NEW.amount, 'Pagamento via Banco');
  END IF;
  
  RETURN NEW;
END;
$function$;