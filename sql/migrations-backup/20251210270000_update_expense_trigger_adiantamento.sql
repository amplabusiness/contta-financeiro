-- ============================================================================
-- ATUALIZAÇÃO: Trigger de Despesas para tratar Adiantamentos corretamente
-- ============================================================================
-- Adiantamentos a sócios NÃO são despesas - são movimentações de ativo
-- Lançamento correto: D: Adiantamento a Sócio / C: Banco
-- ============================================================================

-- Função para verificar se é adiantamento
CREATE OR REPLACE FUNCTION is_adiantamento_socio(p_category TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_category ILIKE '%adiantamento%';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Atualizar função de mapeamento para incluir adiantamentos
CREATE OR REPLACE FUNCTION get_expense_or_adiantamento_account(p_category TEXT)
RETURNS TABLE(account_id UUID, is_adiantamento BOOLEAN, entry_type TEXT) AS $$
DECLARE
  v_account_id UUID;
  v_is_adiantamento BOOLEAN := FALSE;
  v_entry_type TEXT := 'despesa';
  v_code TEXT;
BEGIN
  -- Verificar se é adiantamento
  IF p_category ILIKE '%adiantamento%' THEN
    v_is_adiantamento := TRUE;
    v_entry_type := 'adiantamento_socio';

    -- Mapear para conta de adiantamento específica do sócio
    v_code := CASE
      WHEN p_category ILIKE '%sergio%' AND p_category NOT ILIKE '%augusto%' THEN '1.1.3.04.01'
      WHEN p_category ILIKE '%sergio augusto%' THEN '1.1.3.04.05'
      WHEN p_category ILIKE '%victor%' THEN '1.1.3.04.03'
      WHEN p_category ILIKE '%nayara%' THEN '1.1.3.04.04'
      ELSE '1.1.3.04.02'
    END;

    SELECT id INTO v_account_id
    FROM chart_of_accounts
    WHERE code = v_code;

    -- Fallback para conta genérica
    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id
      FROM chart_of_accounts
      WHERE code = '1.1.3.04';
    END IF;
  ELSE
    -- Mapear categoria para conta de DESPESA
    v_code := CASE LOWER(COALESCE(p_category, 'default'))
      WHEN 'salarios' THEN '4.1.1.01'
      WHEN 'folha de pagamento' THEN '4.1.1.01'
      WHEN 'encargos' THEN '4.1.1.02'
      WHEN 'encargos de salários' THEN '4.1.1.02'
      WHEN 'aluguel' THEN '4.1.2.01'
      WHEN 'energia' THEN '4.1.2.02'
      WHEN 'telefone' THEN '4.1.2.03'
      WHEN 'plano telefone' THEN '4.1.2.03'
      WHEN 'pano telefone' THEN '4.1.2.03'
      WHEN 'internet' THEN '4.1.2.03'
      WHEN 'material' THEN '4.1.2.04'
      WHEN 'materiais de papelaria' THEN '4.1.2.04'
      WHEN 'servicos' THEN '4.1.2.05'
      WHEN 'servicos terceiros' THEN '4.1.2.05'
      WHEN 'software/sistemas' THEN '4.1.2.06'
      WHEN 'juros' THEN '4.1.3.01'
      WHEN 'tarifas' THEN '4.1.3.02'
      WHEN 'taxa/manutencao boleto' THEN '4.1.3.02'
      WHEN 'manutencao de conta' THEN '4.1.3.02'
      WHEN 'impostos' THEN '4.1.4.01'
      WHEN 'simples nacional' THEN '4.1.4.01'
      WHEN 'imposto iss' THEN '4.1.4.01'
      WHEN 'iptu' THEN '4.1.4.01'
      WHEN 'ipva' THEN '4.1.4.01'
      WHEN 'taxas e licenças profissionais' THEN '4.1.4.02'
      WHEN 'condominio' THEN '4.1.2.01'
      WHEN 'agua funcionarios' THEN '4.1.2.09'
      WHEN 'vale alimentacao' THEN '4.1.1.03'
      WHEN 'plano de saude' THEN '4.1.1.04'
      WHEN 'gas' THEN '4.1.2.02'
      WHEN 'obras/reforma' THEN '4.1.2.10'
      WHEN 'materiais de limpeza/higiene' THEN '4.1.2.04'
      WHEN 'suprimentos para copa/cozinha' THEN '4.1.2.04'
      ELSE '4.1.2.99'
    END;

    SELECT id INTO v_account_id
    FROM chart_of_accounts
    WHERE code = v_code;

    -- Fallback
    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id
      FROM chart_of_accounts
      WHERE code = '4.1.2.99';
    END IF;
  END IF;

  RETURN QUERY SELECT v_account_id, v_is_adiantamento, v_entry_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER ATUALIZADO: Ao INSERIR despesa
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_expense_insert() RETURNS TRIGGER AS $$
DECLARE
  v_account_info RECORD;
  v_payable_account_id UUID;
  v_bank_account_id UUID;
  v_competence_date DATE;
BEGIN
  -- Obter conta baseada na categoria (pode ser despesa ou adiantamento)
  SELECT * INTO v_account_info
  FROM get_expense_or_adiantamento_account(NEW.category);

  -- Data de competência
  v_competence_date := COALESCE(NEW.expense_date, NEW.due_date, CURRENT_DATE);

  IF v_account_info.is_adiantamento THEN
    -- ADIANTAMENTO: D: Adiantamento a Sócio / C: Banco
    -- Só registra quando PAGO (não provisiona)
    IF NEW.status = 'paid' THEN
      SELECT id INTO v_bank_account_id
      FROM chart_of_accounts
      WHERE code = '1.1.1.02';

      IF v_bank_account_id IS NULL THEN
        SELECT id INTO v_bank_account_id
        FROM chart_of_accounts
        WHERE code = '1.1.1.01';
      END IF;

      PERFORM create_journal_entry(
        COALESCE(NEW.payment_date, NEW.expense_date, CURRENT_DATE),
        v_competence_date,
        'adiantamento_socio',
        'Adiantamento: ' || NEW.description,
        'expenses',
        NEW.id,
        v_account_info.account_id,  -- Débito: Adiantamento a Sócio
        v_bank_account_id,          -- Crédito: Banco
        NEW.amount,
        NEW.created_by
      );
    END IF;
  ELSE
    -- DESPESA: D: Conta de Despesa / C: Fornecedores a Pagar
    SELECT id INTO v_payable_account_id
    FROM chart_of_accounts
    WHERE code = '2.1.1.01';

    IF v_payable_account_id IS NULL THEN
      RAISE EXCEPTION 'Conta de fornecedores 2.1.1.01 não encontrada';
    END IF;

    -- Criar lançamento de provisionamento
    PERFORM create_journal_entry(
      COALESCE(NEW.expense_date, NEW.created_at::DATE, CURRENT_DATE),
      v_competence_date,
      'despesa',
      'Despesa: ' || NEW.description,
      'expenses',
      NEW.id,
      v_account_info.account_id,  -- Débito: Conta de Despesa
      v_payable_account_id,       -- Crédito: Fornecedores a Pagar
      NEW.amount,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER ATUALIZADO: Ao ATUALIZAR despesa
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_expense_update() RETURNS TRIGGER AS $$
DECLARE
  v_account_info RECORD;
  v_payable_account_id UUID;
  v_bank_account_id UUID;
BEGIN
  -- Obter informações da conta
  SELECT * INTO v_account_info
  FROM get_expense_or_adiantamento_account(NEW.category);

  -- Se status mudou para PAGO
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    IF v_account_info.is_adiantamento THEN
      -- ADIANTAMENTO: Criar lançamento apenas agora (quando pago)
      -- Verificar se já não existe
      IF NOT EXISTS (
        SELECT 1 FROM accounting_entries
        WHERE reference_type = 'expenses'
          AND reference_id = NEW.id
          AND entry_type = 'adiantamento_socio'
      ) THEN
        SELECT id INTO v_bank_account_id
        FROM chart_of_accounts
        WHERE code = '1.1.1.02';

        IF v_bank_account_id IS NULL THEN
          SELECT id INTO v_bank_account_id
          FROM chart_of_accounts
          WHERE code = '1.1.1.01';
        END IF;

        PERFORM create_journal_entry(
          COALESCE(NEW.payment_date, CURRENT_DATE),
          COALESCE(NEW.payment_date, CURRENT_DATE),
          'adiantamento_socio',
          'Adiantamento: ' || NEW.description,
          'expenses',
          NEW.id,
          v_account_info.account_id,
          v_bank_account_id,
          NEW.amount,
          NEW.created_by
        );
      END IF;
    ELSE
      -- DESPESA: Criar lançamento de pagamento (baixa de fornecedor)
      SELECT id INTO v_payable_account_id
      FROM chart_of_accounts
      WHERE code = '2.1.1.01';

      SELECT id INTO v_bank_account_id
      FROM chart_of_accounts
      WHERE code = '1.1.1.02';

      IF v_bank_account_id IS NULL THEN
        SELECT id INTO v_bank_account_id
        FROM chart_of_accounts
        WHERE code = '1.1.1.01';
      END IF;

      PERFORM create_journal_entry(
        COALESCE(NEW.payment_date, CURRENT_DATE),
        COALESCE(NEW.payment_date, CURRENT_DATE),
        'pagamento_despesa',
        'Pagamento: ' || NEW.description,
        'expenses_payment',
        NEW.id,
        v_payable_account_id,   -- Débito: Fornecedores (baixa)
        v_bank_account_id,      -- Crédito: Banco
        NEW.amount,
        NEW.created_by
      );
    END IF;
  END IF;

  -- Se valor mudou e NÃO é adiantamento, atualizar lançamentos
  IF OLD.amount != NEW.amount AND NOT v_account_info.is_adiantamento THEN
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
-- Garantir contas de despesa adicionais que estão faltando
-- ============================================================================
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
VALUES
  ('4.1.1.03', 'Vale Alimentação/Transporte', 'DESPESA', 'DEVEDORA', 4, true, true),
  ('4.1.1.04', 'Plano de Saúde', 'DESPESA', 'DEVEDORA', 4, true, true),
  ('4.1.2.09', 'Água', 'DESPESA', 'DEVEDORA', 4, true, true),
  ('4.1.2.10', 'Obras e Reformas', 'DESPESA', 'DEVEDORA', 4, true, true),
  ('4.1.4.02', 'Taxas e Licenças', 'DESPESA', 'DEVEDORA', 4, true, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON FUNCTION is_adiantamento_socio IS 'Verifica se categoria é adiantamento a sócio';
COMMENT ON FUNCTION get_expense_or_adiantamento_account IS 'Retorna conta e tipo baseado na categoria (despesa ou adiantamento)';
COMMENT ON FUNCTION trg_expense_insert IS 'Trigger: Cria lançamento contábil ao inserir despesa (trata adiantamentos diferente)';
COMMENT ON FUNCTION trg_expense_update IS 'Trigger: Atualiza contabilidade ao modificar despesa (trata adiantamentos diferente)';
