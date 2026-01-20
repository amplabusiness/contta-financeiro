-- =====================================================
-- SISTEMA DE REAJUSTE DE HONORÁRIOS POR SALÁRIO MÍNIMO
-- E MULTAS/JUROS EM BOLETOS
-- =====================================================

-- 1. TABELA DE HISTÓRICO DO SALÁRIO MÍNIMO
-- =====================================================
CREATE TABLE IF NOT EXISTS minimum_wage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date DATE NOT NULL UNIQUE,
  value NUMERIC(10,2) NOT NULL,
  decree_number TEXT, -- Número do decreto/lei
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE minimum_wage_history IS 'Histórico de valores do salário mínimo brasileiro';
COMMENT ON COLUMN minimum_wage_history.effective_date IS 'Data de início de vigência do valor';
COMMENT ON COLUMN minimum_wage_history.value IS 'Valor do salário mínimo em reais';

-- Inserir histórico recente do salário mínimo
INSERT INTO minimum_wage_history (effective_date, value, notes) VALUES
  ('2020-01-01', 1039.00, 'SM 2020'),
  ('2020-02-01', 1045.00, 'SM 2020 (reajuste)'),
  ('2021-01-01', 1100.00, 'SM 2021'),
  ('2022-01-01', 1212.00, 'SM 2022'),
  ('2023-01-01', 1302.00, 'SM 2023'),
  ('2023-05-01', 1320.00, 'SM 2023 (reajuste maio)'),
  ('2024-01-01', 1412.00, 'SM 2024'),
  ('2025-01-01', 1518.00, 'SM 2025')
ON CONFLICT (effective_date) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_minimum_wage_date ON minimum_wage_history(effective_date DESC);

-- 2. ADICIONAR CAMPOS NA TABELA CLIENTS
-- =====================================================

-- Campo para armazenar o honorário em quantidade de salários mínimos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'fee_in_minimum_wages') THEN
    ALTER TABLE public.clients ADD COLUMN fee_in_minimum_wages NUMERIC(10,4);
  END IF;
END $$;

-- Data do último reajuste aplicado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'last_fee_adjustment_date') THEN
    ALTER TABLE public.clients ADD COLUMN last_fee_adjustment_date DATE;
  END IF;
END $$;

-- Salário mínimo base usado no último reajuste
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'last_adjustment_minimum_wage') THEN
    ALTER TABLE public.clients ADD COLUMN last_adjustment_minimum_wage NUMERIC(10,2);
  END IF;
END $$;

-- Flag para indicar se usa reajuste automático por SM
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'auto_adjust_by_minimum_wage') THEN
    ALTER TABLE public.clients ADD COLUMN auto_adjust_by_minimum_wage BOOLEAN DEFAULT true;
  END IF;
END $$;

COMMENT ON COLUMN public.clients.fee_in_minimum_wages IS 'Honorário convertido em quantidade de salários mínimos';
COMMENT ON COLUMN public.clients.last_fee_adjustment_date IS 'Data do último reajuste de honorário aplicado';
COMMENT ON COLUMN public.clients.last_adjustment_minimum_wage IS 'Valor do SM usado no último reajuste';
COMMENT ON COLUMN public.clients.auto_adjust_by_minimum_wage IS 'Se true, reajusta automaticamente pelo SM';

-- 3. TABELA DE HISTÓRICO DE REAJUSTES
-- =====================================================
CREATE TABLE IF NOT EXISTS fee_adjustment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL,
  previous_fee NUMERIC(10,2) NOT NULL,
  new_fee NUMERIC(10,2) NOT NULL,
  previous_minimum_wage NUMERIC(10,2) NOT NULL,
  new_minimum_wage NUMERIC(10,2) NOT NULL,
  fee_in_minimum_wages NUMERIC(10,4) NOT NULL,
  adjustment_percentage NUMERIC(5,2), -- Ex: 7.5 para 7,5%
  adjustment_type TEXT DEFAULT 'minimum_wage', -- 'minimum_wage', 'manual', 'contract'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE fee_adjustment_history IS 'Histórico de todos os reajustes de honorários';

CREATE INDEX IF NOT EXISTS idx_fee_adjustment_client ON fee_adjustment_history(client_id, adjustment_date DESC);

-- 4. CAMPOS DE MULTA E JUROS EM INVOICES
-- =====================================================

-- Valor de multa recebida
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'fine_amount') THEN
    ALTER TABLE public.invoices ADD COLUMN fine_amount NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- Valor de juros recebidos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'interest_amount') THEN
    ALTER TABLE public.invoices ADD COLUMN interest_amount NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- Valor total recebido (amount + fine + interest)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'total_received') THEN
    ALTER TABLE public.invoices ADD COLUMN total_received NUMERIC(10,2);
  END IF;
END $$;

-- Desconto concedido (se houver)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'discount_amount') THEN
    ALTER TABLE public.invoices ADD COLUMN discount_amount NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN public.invoices.fine_amount IS 'Valor de multa por atraso (2% padrão)';
COMMENT ON COLUMN public.invoices.interest_amount IS 'Valor de juros por atraso (1% ao mês padrão)';
COMMENT ON COLUMN public.invoices.total_received IS 'Valor total efetivamente recebido';
COMMENT ON COLUMN public.invoices.discount_amount IS 'Desconto concedido ao cliente';

-- 5. FUNÇÕES DE CÁLCULO E REAJUSTE
-- =====================================================

-- Função para obter o salário mínimo vigente em uma data
CREATE OR REPLACE FUNCTION get_minimum_wage_at_date(p_date DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC AS $$
  SELECT value
  FROM minimum_wage_history
  WHERE effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Função para converter honorário atual em salários mínimos
CREATE OR REPLACE FUNCTION convert_fee_to_minimum_wages(
  p_client_id UUID,
  p_reference_minimum_wage NUMERIC DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_monthly_fee NUMERIC;
  v_min_wage NUMERIC;
BEGIN
  -- Obter honorário atual
  SELECT monthly_fee INTO v_monthly_fee
  FROM clients WHERE id = p_client_id;

  IF v_monthly_fee IS NULL OR v_monthly_fee = 0 THEN
    RETURN 0;
  END IF;

  -- Usar SM de referência ou o atual
  v_min_wage := COALESCE(p_reference_minimum_wage, get_minimum_wage_at_date());

  IF v_min_wage IS NULL OR v_min_wage = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND(v_monthly_fee / v_min_wage, 4);
END;
$$ LANGUAGE plpgsql STABLE;

-- Função para calcular novo honorário baseado no SM atual
CREATE OR REPLACE FUNCTION calculate_adjusted_fee(
  p_fee_in_minimum_wages NUMERIC,
  p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_current_min_wage NUMERIC;
BEGIN
  v_current_min_wage := get_minimum_wage_at_date(p_target_date);

  IF v_current_min_wage IS NULL OR p_fee_in_minimum_wages IS NULL THEN
    RETURN NULL;
  END IF;

  -- Arredondar para 2 casas decimais
  RETURN ROUND(p_fee_in_minimum_wages * v_current_min_wage, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Função principal: Aplicar reajuste em um cliente
CREATE OR REPLACE FUNCTION apply_fee_adjustment(
  p_client_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  previous_fee NUMERIC,
  new_fee NUMERIC,
  adjustment_percentage NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_client RECORD;
  v_current_min_wage NUMERIC;
  v_new_fee NUMERIC;
  v_adjustment_pct NUMERIC;
BEGIN
  -- Obter dados do cliente
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;

  IF v_client IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 'Cliente não encontrado'::TEXT;
    RETURN;
  END IF;

  -- Verificar se usa reajuste automático
  IF NOT COALESCE(v_client.auto_adjust_by_minimum_wage, true) THEN
    RETURN QUERY SELECT false, v_client.monthly_fee, v_client.monthly_fee, 0::NUMERIC,
      'Cliente não usa reajuste automático por SM'::TEXT;
    RETURN;
  END IF;

  -- Verificar se tem fee_in_minimum_wages
  IF v_client.fee_in_minimum_wages IS NULL OR v_client.fee_in_minimum_wages = 0 THEN
    RETURN QUERY SELECT false, v_client.monthly_fee, v_client.monthly_fee, 0::NUMERIC,
      'Cliente não tem honorário em SM definido. Execute init_client_minimum_wage_fee primeiro.'::TEXT;
    RETURN;
  END IF;

  -- Obter SM atual
  v_current_min_wage := get_minimum_wage_at_date();

  -- Verificar se já foi reajustado com este SM
  IF v_client.last_adjustment_minimum_wage = v_current_min_wage THEN
    RETURN QUERY SELECT false, v_client.monthly_fee, v_client.monthly_fee, 0::NUMERIC,
      format('Já reajustado para SM de R$ %s', v_current_min_wage)::TEXT;
    RETURN;
  END IF;

  -- Calcular novo honorário
  v_new_fee := calculate_adjusted_fee(v_client.fee_in_minimum_wages);

  -- Calcular percentual de reajuste
  IF v_client.monthly_fee > 0 THEN
    v_adjustment_pct := ROUND(((v_new_fee - v_client.monthly_fee) / v_client.monthly_fee) * 100, 2);
  ELSE
    v_adjustment_pct := 0;
  END IF;

  -- Registrar histórico
  INSERT INTO fee_adjustment_history (
    client_id, adjustment_date, previous_fee, new_fee,
    previous_minimum_wage, new_minimum_wage, fee_in_minimum_wages,
    adjustment_percentage, adjustment_type, notes
  ) VALUES (
    p_client_id, CURRENT_DATE, v_client.monthly_fee, v_new_fee,
    COALESCE(v_client.last_adjustment_minimum_wage, get_minimum_wage_at_date(v_client.created_at::DATE)),
    v_current_min_wage, v_client.fee_in_minimum_wages,
    v_adjustment_pct, 'minimum_wage', p_notes
  );

  -- Atualizar cliente
  UPDATE clients SET
    monthly_fee = v_new_fee,
    last_fee_adjustment_date = CURRENT_DATE,
    last_adjustment_minimum_wage = v_current_min_wage,
    updated_at = NOW()
  WHERE id = p_client_id;

  RETURN QUERY SELECT true, v_client.monthly_fee, v_new_fee, v_adjustment_pct,
    format('Reajustado de R$ %s para R$ %s (%s%%)',
      v_client.monthly_fee, v_new_fee, v_adjustment_pct)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Função para inicializar o fee_in_minimum_wages de um cliente
CREATE OR REPLACE FUNCTION init_client_minimum_wage_fee(
  p_client_id UUID,
  p_reference_date DATE DEFAULT NULL -- Data de referência para o SM (ex: data do contrato)
)
RETURNS TABLE (
  success BOOLEAN,
  monthly_fee NUMERIC,
  minimum_wage_used NUMERIC,
  fee_in_minimum_wages NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_client RECORD;
  v_min_wage NUMERIC;
  v_fee_in_mw NUMERIC;
  v_ref_date DATE;
BEGIN
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;

  IF v_client IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 'Cliente não encontrado'::TEXT;
    RETURN;
  END IF;

  IF v_client.monthly_fee IS NULL OR v_client.monthly_fee = 0 THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 'Cliente não tem honorário definido'::TEXT;
    RETURN;
  END IF;

  -- Usar data de referência ou a data de criação do cliente
  v_ref_date := COALESCE(p_reference_date, v_client.created_at::DATE);

  -- Obter SM da época
  v_min_wage := get_minimum_wage_at_date(v_ref_date);

  IF v_min_wage IS NULL THEN
    -- Se não tiver SM histórico, usar o mais antigo disponível
    SELECT value INTO v_min_wage FROM minimum_wage_history ORDER BY effective_date ASC LIMIT 1;
  END IF;

  -- Calcular quantos SM representa o honorário
  v_fee_in_mw := ROUND(v_client.monthly_fee / v_min_wage, 4);

  -- Atualizar cliente
  UPDATE clients SET
    fee_in_minimum_wages = v_fee_in_mw,
    last_adjustment_minimum_wage = v_min_wage,
    last_fee_adjustment_date = v_ref_date,
    updated_at = NOW()
  WHERE id = p_client_id;

  RETURN QUERY SELECT true, v_client.monthly_fee, v_min_wage, v_fee_in_mw,
    format('Honorário de R$ %s = %s salários mínimos (SM de R$ %s em %s)',
      v_client.monthly_fee, v_fee_in_mw, v_min_wage, v_ref_date)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. VIEW DE AUDITORIA - Clientes que precisam reajuste
-- =====================================================

CREATE OR REPLACE VIEW v_clients_pending_adjustment AS
WITH current_wage AS (
  SELECT get_minimum_wage_at_date() AS value
)
SELECT
  c.id,
  c.name,
  c.cnpj,
  c.monthly_fee AS current_fee,
  c.fee_in_minimum_wages,
  c.last_fee_adjustment_date,
  c.last_adjustment_minimum_wage,
  cw.value AS current_minimum_wage,
  CASE
    WHEN c.fee_in_minimum_wages IS NOT NULL AND c.fee_in_minimum_wages > 0
    THEN ROUND(c.fee_in_minimum_wages * cw.value, 2)
    ELSE c.monthly_fee
  END AS expected_fee,
  CASE
    WHEN c.fee_in_minimum_wages IS NOT NULL AND c.fee_in_minimum_wages > 0
    THEN ROUND(c.fee_in_minimum_wages * cw.value, 2) - c.monthly_fee
    ELSE 0
  END AS fee_difference,
  CASE
    WHEN c.last_adjustment_minimum_wage IS NULL THEN 'NUNCA_AJUSTADO'
    WHEN c.last_adjustment_minimum_wage < cw.value THEN 'REAJUSTE_PENDENTE'
    ELSE 'ATUALIZADO'
  END AS adjustment_status,
  c.auto_adjust_by_minimum_wage
FROM clients c
CROSS JOIN current_wage cw
WHERE c.is_active = true
  AND NOT COALESCE(c.is_pro_bono, false)
  AND NOT COALESCE(c.is_barter, false)
  AND c.monthly_fee > 0
ORDER BY
  CASE
    WHEN c.last_adjustment_minimum_wage IS NULL THEN 0
    WHEN c.last_adjustment_minimum_wage < cw.value THEN 1
    ELSE 2
  END,
  c.name;

COMMENT ON VIEW v_clients_pending_adjustment IS 'Lista clientes que precisam de reajuste de honorários';

-- 7. FUNÇÃO DE REAJUSTE EM LOTE
-- =====================================================

CREATE OR REPLACE FUNCTION batch_apply_fee_adjustments(
  p_only_pending BOOLEAN DEFAULT true, -- Se true, só reajusta quem precisa
  p_dry_run BOOLEAN DEFAULT true -- Se true, apenas simula sem aplicar
)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  previous_fee NUMERIC,
  new_fee NUMERIC,
  adjustment_percentage NUMERIC,
  status TEXT
) AS $$
DECLARE
  v_client RECORD;
  v_result RECORD;
  v_current_min_wage NUMERIC;
BEGIN
  v_current_min_wage := get_minimum_wage_at_date();

  FOR v_client IN
    SELECT c.id, c.name, c.monthly_fee, c.fee_in_minimum_wages,
           c.last_adjustment_minimum_wage, c.auto_adjust_by_minimum_wage
    FROM clients c
    WHERE c.is_active = true
      AND NOT COALESCE(c.is_pro_bono, false)
      AND NOT COALESCE(c.is_barter, false)
      AND c.monthly_fee > 0
      AND COALESCE(c.auto_adjust_by_minimum_wage, true)
      AND (NOT p_only_pending OR COALESCE(c.last_adjustment_minimum_wage, 0) < v_current_min_wage)
  LOOP
    -- Verificar se tem fee_in_minimum_wages
    IF v_client.fee_in_minimum_wages IS NULL OR v_client.fee_in_minimum_wages = 0 THEN
      client_id := v_client.id;
      client_name := v_client.name;
      previous_fee := v_client.monthly_fee;
      new_fee := v_client.monthly_fee;
      adjustment_percentage := 0;
      status := 'IGNORADO: Sem fee_in_minimum_wages definido';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Calcular novo valor
    new_fee := calculate_adjusted_fee(v_client.fee_in_minimum_wages);
    adjustment_percentage := ROUND(((new_fee - v_client.monthly_fee) / v_client.monthly_fee) * 100, 2);

    client_id := v_client.id;
    client_name := v_client.name;
    previous_fee := v_client.monthly_fee;

    IF NOT p_dry_run THEN
      -- Aplicar reajuste
      SELECT * INTO v_result FROM apply_fee_adjustment(v_client.id);
      status := 'APLICADO';
    ELSE
      status := 'SIMULADO';
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 8. FUNÇÃO PARA REGISTRAR PAGAMENTO COM MULTA/JUROS
-- =====================================================

CREATE OR REPLACE FUNCTION register_invoice_payment(
  p_invoice_id UUID,
  p_payment_date DATE,
  p_total_received NUMERIC,
  p_fine_amount NUMERIC DEFAULT 0,
  p_interest_amount NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  invoice_amount NUMERIC,
  fine NUMERIC,
  interest NUMERIC,
  discount NUMERIC,
  total NUMERIC
) AS $$
DECLARE
  v_invoice RECORD;
  v_expected_total NUMERIC;
BEGIN
  -- Obter invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;

  IF v_invoice IS NULL THEN
    RETURN QUERY SELECT false, 'Fatura não encontrada'::TEXT,
      0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN QUERY SELECT false, 'Fatura já está paga'::TEXT,
      v_invoice.amount, v_invoice.fine_amount, v_invoice.interest_amount,
      v_invoice.discount_amount, v_invoice.total_received;
    RETURN;
  END IF;

  -- Calcular total esperado
  v_expected_total := v_invoice.amount + p_fine_amount + p_interest_amount - p_discount_amount;

  -- Se total_received não foi informado, usar o calculado
  IF p_total_received IS NULL OR p_total_received = 0 THEN
    p_total_received := v_expected_total;
  END IF;

  -- Atualizar invoice
  UPDATE invoices SET
    status = 'paid',
    payment_date = p_payment_date,
    fine_amount = p_fine_amount,
    interest_amount = p_interest_amount,
    discount_amount = p_discount_amount,
    total_received = p_total_received,
    description = COALESCE(description, '') ||
      CASE WHEN p_notes IS NOT NULL THEN ' | ' || p_notes ELSE '' END,
    updated_at = NOW()
  WHERE id = p_invoice_id;

  RETURN QUERY SELECT true,
    format('Pagamento registrado: R$ %s (honorário) + R$ %s (multa) + R$ %s (juros) - R$ %s (desconto) = R$ %s',
      v_invoice.amount, p_fine_amount, p_interest_amount, p_discount_amount, p_total_received)::TEXT,
    v_invoice.amount, p_fine_amount, p_interest_amount, p_discount_amount, p_total_received;
END;
$$ LANGUAGE plpgsql;

-- 9. GRANTS
-- =====================================================

GRANT SELECT ON minimum_wage_history TO authenticated;
GRANT SELECT, INSERT ON fee_adjustment_history TO authenticated;
GRANT SELECT ON v_clients_pending_adjustment TO authenticated;

GRANT EXECUTE ON FUNCTION get_minimum_wage_at_date TO authenticated;
GRANT EXECUTE ON FUNCTION convert_fee_to_minimum_wages TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_adjusted_fee TO authenticated;
GRANT EXECUTE ON FUNCTION apply_fee_adjustment TO authenticated;
GRANT EXECUTE ON FUNCTION init_client_minimum_wage_fee TO authenticated;
GRANT EXECUTE ON FUNCTION batch_apply_fee_adjustments TO authenticated;
GRANT EXECUTE ON FUNCTION register_invoice_payment TO authenticated;

-- 10. COMENTÁRIOS FINAIS
-- =====================================================

COMMENT ON FUNCTION get_minimum_wage_at_date IS 'Retorna o salário mínimo vigente em uma data';
COMMENT ON FUNCTION convert_fee_to_minimum_wages IS 'Converte o honorário de um cliente para quantidade de salários mínimos';
COMMENT ON FUNCTION calculate_adjusted_fee IS 'Calcula o honorário reajustado com base no SM atual';
COMMENT ON FUNCTION apply_fee_adjustment IS 'Aplica o reajuste de honorário em um cliente específico';
COMMENT ON FUNCTION init_client_minimum_wage_fee IS 'Inicializa o campo fee_in_minimum_wages de um cliente';
COMMENT ON FUNCTION batch_apply_fee_adjustments IS 'Aplica reajustes em lote para todos os clientes pendentes';
COMMENT ON FUNCTION register_invoice_payment IS 'Registra pagamento de fatura com multa, juros e desconto';
