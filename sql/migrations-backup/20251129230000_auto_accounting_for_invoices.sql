-- =====================================================
-- CONTABILIDADE AUTOMÁTICA PARA FATURAS
-- Filosofia: Contabilidade-First - tudo nasce na contabilidade
-- =====================================================

-- Função para criar lançamento contábil a partir de uma fatura
CREATE OR REPLACE FUNCTION create_accounting_entry_for_invoice(p_invoice_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_client_name TEXT;
  v_client_account_id UUID;
  v_revenue_account_id UUID;
  v_entry_id UUID;
  v_competence TEXT;
BEGIN
  -- Buscar dados da fatura
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fatura não encontrada: %', p_invoice_id;
  END IF;

  -- Ignorar saldos de abertura (já foram migrados para PL)
  IF v_invoice.source = 'opening_balance' THEN
    RETURN NULL;
  END IF;

  -- Verificar se já existe lançamento para esta fatura
  SELECT id INTO v_entry_id
  FROM accounting_entries
  WHERE reference_type = 'invoice'
    AND reference_id = p_invoice_id
    AND entry_type = 'receita_honorarios';

  IF v_entry_id IS NOT NULL THEN
    RETURN v_entry_id; -- Já existe, retornar ID existente
  END IF;

  -- Buscar nome do cliente
  SELECT name INTO v_client_name FROM clients WHERE id = v_invoice.client_id;
  v_client_name := COALESCE(v_client_name, 'Cliente não identificado');

  -- Buscar ou criar conta do cliente (1.1.2.01.XXX)
  SELECT id INTO v_client_account_id
  FROM chart_of_accounts
  WHERE code LIKE '1.1.2.01.%'
    AND name ILIKE '%' || v_client_name || '%'
  LIMIT 1;

  IF v_client_account_id IS NULL THEN
    -- Criar conta do cliente
    INSERT INTO chart_of_accounts (
      code,
      name,
      account_type,
      nature,
      level,
      is_synthetic,
      is_analytical,
      accepts_entries,
      is_active
    )
    SELECT
      '1.1.2.01.' || LPAD((COALESCE(MAX(NULLIF(SPLIT_PART(code, '.', 5), '')::INT), 0) + 1)::TEXT, 3, '0'),
      'Cliente: ' || v_client_name,
      'ATIVO',
      'DEVEDORA',
      5,
      false,
      true,
      true,
      true
    FROM chart_of_accounts
    WHERE code LIKE '1.1.2.01.%'
    RETURNING id INTO v_client_account_id;
  END IF;

  -- Buscar conta de receita (3.1.1.01 - Honorários Contábeis)
  SELECT id INTO v_revenue_account_id
  FROM chart_of_accounts
  WHERE code = '3.1.1.01';

  IF v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta de receita 3.1.1.01 não encontrada no plano de contas';
  END IF;

  -- Determinar competência (MM/YYYY)
  v_competence := TO_CHAR(COALESCE(v_invoice.competence_date, v_invoice.issue_date, v_invoice.created_at), 'MM/YYYY');

  -- Criar lançamento contábil
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
    COALESCE(v_invoice.issue_date, CURRENT_DATE),
    v_competence,
    'receita_honorarios',
    'Provisão de honorários - ' || v_client_name || ' - ' || v_competence,
    'invoice',
    p_invoice_id,
    v_invoice.amount,
    v_invoice.amount,
    true,
    v_invoice.created_by
  )
  RETURNING id INTO v_entry_id;

  -- Criar linhas do lançamento (partidas dobradas)
  -- Débito: Cliente a Receber
  INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
  VALUES (v_entry_id, v_client_account_id, 'D - ' || v_client_name, v_invoice.amount, 0);

  -- Crédito: Receita de Honorários
  INSERT INTO accounting_entry_lines (entry_id, account_id, description, debit, credit)
  VALUES (v_entry_id, v_revenue_account_id, 'C - Honorários Contábeis', 0, v_invoice.amount);

  RETURN v_entry_id;
END;
$$;

-- Função para processar faturas sem contabilidade em lote
CREATE OR REPLACE FUNCTION process_invoices_without_accounting(p_limit INT DEFAULT 500)
RETURNS TABLE(
  processed_count INT,
  error_count INT,
  errors TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_processed INT := 0;
  v_errors INT := 0;
  v_error_messages TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_invoice IN
    SELECT i.id, i.client_id
    FROM invoices i
    LEFT JOIN accounting_entries ae ON ae.reference_type = 'invoice'
      AND ae.reference_id = i.id
      AND ae.entry_type = 'receita_honorarios'
    WHERE ae.id IS NULL
      AND i.source IS DISTINCT FROM 'opening_balance'
    LIMIT p_limit
  LOOP
    BEGIN
      PERFORM create_accounting_entry_for_invoice(v_invoice.id);
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_messages := array_append(v_error_messages,
        'Fatura ' || v_invoice.id::TEXT || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_errors, v_error_messages;
END;
$$;

-- Trigger para criar contabilidade automaticamente ao inserir fatura
CREATE OR REPLACE FUNCTION trigger_create_accounting_on_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ignorar saldos de abertura
  IF NEW.source = 'opening_balance' THEN
    RETURN NEW;
  END IF;

  -- Criar lançamento contábil de forma assíncrona (não bloqueia o insert)
  BEGIN
    PERFORM create_accounting_entry_for_invoice(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Log do erro mas não falha a transação
    RAISE WARNING 'Erro ao criar contabilidade para fatura %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Criar trigger (apenas para novas faturas)
DROP TRIGGER IF EXISTS trg_auto_accounting_invoice ON invoices;
CREATE TRIGGER trg_auto_accounting_invoice
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_accounting_on_invoice();

-- Comentários
COMMENT ON FUNCTION create_accounting_entry_for_invoice IS 'Cria lançamento contábil para uma fatura específica';
COMMENT ON FUNCTION process_invoices_without_accounting IS 'Processa faturas existentes sem contabilidade em lote';
COMMENT ON TRIGGER trg_auto_accounting_invoice ON invoices IS 'Cria contabilidade automaticamente ao inserir fatura';
