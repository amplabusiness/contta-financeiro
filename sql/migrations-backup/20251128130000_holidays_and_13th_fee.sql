-- =====================================================
-- SISTEMA DE FERIADOS E 13º HONORÁRIO
-- =====================================================
-- 1. Tabela de feriados nacionais e estaduais
-- 2. Função para calcular dia útil
-- 3. Sistema de 13º honorário (13 parcelas/ano)
-- 4. Vencimento em dia 20 de dezembro para 13º
-- =====================================================

-- 1. TABELA DE FERIADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('national', 'state', 'municipal', 'optional')),
  state_code TEXT, -- UF para feriados estaduais (ex: 'SP', 'RJ')
  municipality_code TEXT, -- Código IBGE para feriados municipais
  is_recurring BOOLEAN DEFAULT false, -- Repete todo ano (Natal, Ano Novo, etc)
  recurring_month INTEGER CHECK (recurring_month BETWEEN 1 AND 12),
  recurring_day INTEGER CHECK (recurring_day BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (date, state_code, municipality_code)
);

COMMENT ON TABLE holidays IS 'Tabela de feriados nacionais, estaduais e municipais para cálculo de dias úteis';

-- Índices
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_recurring ON holidays(is_recurring, recurring_month, recurring_day);

-- 2. INSERIR FERIADOS NACIONAIS FIXOS (recorrentes)
-- =====================================================
INSERT INTO holidays (date, name, type, is_recurring, recurring_month, recurring_day) VALUES
  ('2025-01-01', 'Confraternização Universal', 'national', true, 1, 1),
  ('2025-04-21', 'Tiradentes', 'national', true, 4, 21),
  ('2025-05-01', 'Dia do Trabalho', 'national', true, 5, 1),
  ('2025-09-07', 'Independência do Brasil', 'national', true, 9, 7),
  ('2025-10-12', 'Nossa Senhora Aparecida', 'national', true, 10, 12),
  ('2025-11-02', 'Finados', 'national', true, 11, 2),
  ('2025-11-15', 'Proclamação da República', 'national', true, 11, 15),
  ('2025-11-20', 'Consciência Negra', 'national', true, 11, 20),
  ('2025-12-25', 'Natal', 'national', true, 12, 25)
ON CONFLICT (date, state_code, municipality_code) DO NOTHING;

-- Feriados móveis 2025 (Páscoa, Carnaval, Corpus Christi)
INSERT INTO holidays (date, name, type, is_recurring) VALUES
  ('2025-03-03', 'Carnaval', 'national', false),
  ('2025-03-04', 'Carnaval', 'national', false),
  ('2025-04-18', 'Sexta-feira Santa', 'national', false),
  ('2025-04-20', 'Páscoa', 'national', false),
  ('2025-06-19', 'Corpus Christi', 'national', false)
ON CONFLICT (date, state_code, municipality_code) DO NOTHING;

-- Feriados móveis 2026
INSERT INTO holidays (date, name, type, is_recurring) VALUES
  ('2026-02-16', 'Carnaval', 'national', false),
  ('2026-02-17', 'Carnaval', 'national', false),
  ('2026-04-03', 'Sexta-feira Santa', 'national', false),
  ('2026-04-05', 'Páscoa', 'national', false),
  ('2026-06-04', 'Corpus Christi', 'national', false)
ON CONFLICT (date, state_code, municipality_code) DO NOTHING;

-- 3. FUNÇÃO PARA VERIFICAR SE É DIA ÚTIL
-- =====================================================
CREATE OR REPLACE FUNCTION is_business_day(
  p_date DATE,
  p_state_code TEXT DEFAULT NULL,
  p_municipality_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week INTEGER;
  v_is_holiday BOOLEAN;
BEGIN
  -- Verificar se é fim de semana (0 = domingo, 6 = sábado)
  v_day_of_week := EXTRACT(DOW FROM p_date);
  IF v_day_of_week IN (0, 6) THEN
    RETURN false;
  END IF;

  -- Verificar se é feriado
  SELECT EXISTS (
    SELECT 1 FROM holidays
    WHERE (
      -- Feriado na data exata
      date = p_date
      OR
      -- Feriado recorrente
      (is_recurring = true AND recurring_month = EXTRACT(MONTH FROM p_date) AND recurring_day = EXTRACT(DAY FROM p_date))
    )
    AND (
      -- Feriado nacional
      type = 'national'
      OR
      -- Feriado estadual do estado do cliente
      (type = 'state' AND state_code = p_state_code)
      OR
      -- Feriado municipal da cidade do cliente
      (type = 'municipal' AND municipality_code = p_municipality_code)
    )
  ) INTO v_is_holiday;

  RETURN NOT v_is_holiday;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_business_day IS 'Verifica se uma data é dia útil considerando feriados nacionais, estaduais e municipais';

-- 4. FUNÇÃO PARA AJUSTAR DATA PARA DIA ÚTIL
-- =====================================================
CREATE OR REPLACE FUNCTION adjust_to_business_day(
  p_date DATE,
  p_direction TEXT DEFAULT 'forward', -- 'forward' = próximo dia útil, 'backward' = dia útil anterior
  p_state_code TEXT DEFAULT NULL,
  p_municipality_code TEXT DEFAULT NULL
)
RETURNS DATE AS $$
DECLARE
  v_result DATE := p_date;
  v_max_iterations INTEGER := 10; -- Evitar loop infinito
  v_iterations INTEGER := 0;
BEGIN
  WHILE NOT is_business_day(v_result, p_state_code, p_municipality_code) AND v_iterations < v_max_iterations LOOP
    IF p_direction = 'forward' THEN
      v_result := v_result + INTERVAL '1 day';
    ELSE
      v_result := v_result - INTERVAL '1 day';
    END IF;
    v_iterations := v_iterations + 1;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION adjust_to_business_day IS 'Ajusta uma data para o próximo dia útil (forward) ou dia útil anterior (backward)';

-- 5. FUNÇÃO PARA CALCULAR DATA DE VENCIMENTO
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_due_date(
  p_year INTEGER,
  p_month INTEGER,
  p_payment_day INTEGER,
  p_state_code TEXT DEFAULT NULL,
  p_municipality_code TEXT DEFAULT NULL,
  p_adjust_direction TEXT DEFAULT 'backward' -- Antecipar por padrão
)
RETURNS DATE AS $$
DECLARE
  v_due_date DATE;
  v_last_day INTEGER;
BEGIN
  -- Calcular último dia do mês
  v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1)) + INTERVAL '1 month - 1 day'));

  -- Se o dia de vencimento for maior que o último dia do mês, usar último dia
  IF p_payment_day > v_last_day THEN
    v_due_date := MAKE_DATE(p_year, p_month, v_last_day);
  ELSE
    v_due_date := MAKE_DATE(p_year, p_month, p_payment_day);
  END IF;

  -- Ajustar para dia útil
  RETURN adjust_to_business_day(v_due_date, p_adjust_direction, p_state_code, p_municipality_code);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_due_date IS 'Calcula a data de vencimento ajustada para dia útil';

-- 6. ADICIONAR CAMPOS DE 13º HONORÁRIO NA TABELA CLIENTS
-- =====================================================
DO $$
BEGIN
  -- Flag para habilitar cobrança do 13º
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'has_13th_fee') THEN
    ALTER TABLE clients ADD COLUMN has_13th_fee BOOLEAN DEFAULT true;
    COMMENT ON COLUMN clients.has_13th_fee IS 'Se cobra 13º honorário (parcela extra em dezembro)';
  END IF;

  -- Dia de vencimento do 13º (padrão: 20)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'thirteenth_fee_day') THEN
    ALTER TABLE clients ADD COLUMN thirteenth_fee_day INTEGER DEFAULT 20 CHECK (thirteenth_fee_day BETWEEN 1 AND 31);
    COMMENT ON COLUMN clients.thirteenth_fee_day IS 'Dia de vencimento do 13º honorário (padrão: 20 de dezembro)';
  END IF;

  -- Valor do 13º (se diferente do honorário mensal)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'thirteenth_fee_amount') THEN
    ALTER TABLE clients ADD COLUMN thirteenth_fee_amount NUMERIC(10,2);
    COMMENT ON COLUMN clients.thirteenth_fee_amount IS 'Valor do 13º honorário (se NULL, usa monthly_fee)';
  END IF;
END $$;

-- 7. FUNÇÃO PARA GERAR FATURAS DO ANO (13 PARCELAS)
-- =====================================================
CREATE OR REPLACE FUNCTION generate_annual_invoices(
  p_client_id UUID,
  p_year INTEGER,
  p_include_13th BOOLEAN DEFAULT true,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  month INTEGER,
  competence TEXT,
  due_date DATE,
  amount NUMERIC,
  is_13th BOOLEAN,
  status TEXT
) AS $$
DECLARE
  v_client RECORD;
  v_due_date DATE;
  v_amount NUMERIC;
  v_invoice_id UUID;
  v_competence TEXT;
BEGIN
  -- Buscar dados do cliente
  SELECT
    c.id, c.name, c.monthly_fee, c.payment_day, c.uf,
    c.has_13th_fee, c.thirteenth_fee_day, c.thirteenth_fee_amount,
    c.fee_in_minimum_wages, c.auto_adjust_by_minimum_wage
  INTO v_client
  FROM clients c
  WHERE c.id = p_client_id AND c.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado ou inativo';
  END IF;

  -- Gerar 12 parcelas mensais
  FOR i IN 1..12 LOOP
    v_competence := LPAD(i::TEXT, 2, '0') || '/' || p_year;
    v_due_date := calculate_due_date(p_year, i, COALESCE(v_client.payment_day, 10), v_client.uf);
    v_amount := v_client.monthly_fee;

    IF NOT p_dry_run THEN
      -- Inserir fatura (se não existir)
      INSERT INTO invoices (client_id, amount, due_date, competence, status, description)
      VALUES (
        p_client_id,
        v_amount,
        v_due_date,
        v_competence,
        'pending',
        'Honorário mensal ' || v_competence
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_invoice_id;
    END IF;

    month := i;
    competence := v_competence;
    due_date := v_due_date;
    amount := v_amount;
    is_13th := false;
    status := CASE WHEN p_dry_run THEN 'SIMULADO' ELSE 'GERADO' END;
    RETURN NEXT;
  END LOOP;

  -- Gerar 13ª parcela (se habilitado)
  IF p_include_13th AND COALESCE(v_client.has_13th_fee, true) THEN
    v_competence := '13/' || p_year;
    v_due_date := calculate_due_date(
      p_year,
      12, -- Dezembro
      COALESCE(v_client.thirteenth_fee_day, 20),
      v_client.uf
    );
    v_amount := COALESCE(v_client.thirteenth_fee_amount, v_client.monthly_fee);

    IF NOT p_dry_run THEN
      INSERT INTO invoices (client_id, amount, due_date, competence, status, description)
      VALUES (
        p_client_id,
        v_amount,
        v_due_date,
        v_competence,
        'pending',
        '13º Honorário ' || p_year
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_invoice_id;
    END IF;

    month := 13;
    competence := v_competence;
    due_date := v_due_date;
    amount := v_amount;
    is_13th := true;
    status := CASE WHEN p_dry_run THEN 'SIMULADO' ELSE 'GERADO' END;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_annual_invoices IS 'Gera as 13 faturas anuais de um cliente (12 mensais + 13º honorário)';

-- 8. FUNÇÃO PARA GERAR FATURAS EM LOTE
-- =====================================================
CREATE OR REPLACE FUNCTION batch_generate_annual_invoices(
  p_year INTEGER,
  p_include_13th BOOLEAN DEFAULT true,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  invoices_generated INTEGER,
  total_amount NUMERIC,
  status TEXT
) AS $$
DECLARE
  v_client RECORD;
  v_count INTEGER;
  v_total NUMERIC;
BEGIN
  FOR v_client IN
    SELECT c.id, c.name, c.monthly_fee
    FROM clients c
    WHERE c.is_active = true
      AND NOT COALESCE(c.is_pro_bono, false)
      AND NOT COALESCE(c.is_barter, false)
      AND c.monthly_fee > 0
  LOOP
    BEGIN
      -- Contar faturas geradas
      SELECT COUNT(*), COALESCE(SUM(amount), 0)
      INTO v_count, v_total
      FROM generate_annual_invoices(v_client.id, p_year, p_include_13th, p_dry_run);

      client_id := v_client.id;
      client_name := v_client.name;
      invoices_generated := v_count;
      total_amount := v_total;
      status := CASE WHEN p_dry_run THEN 'SIMULADO' ELSE 'GERADO' END;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      client_id := v_client.id;
      client_name := v_client.name;
      invoices_generated := 0;
      total_amount := 0;
      status := 'ERRO: ' || SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION batch_generate_annual_invoices IS 'Gera faturas anuais para todos os clientes ativos';

-- 9. VIEW PARA LISTAR FATURAS COM INFO DE 13º
-- =====================================================
CREATE OR REPLACE VIEW v_invoices_with_13th AS
SELECT
  i.*,
  c.name AS client_name,
  c.has_13th_fee,
  CASE
    WHEN i.competence LIKE '13/%' THEN true
    ELSE false
  END AS is_thirteenth_fee,
  CASE
    WHEN i.competence LIKE '13/%' THEN '13º Honorário'
    ELSE 'Honorário Mensal'
  END AS fee_type
FROM invoices i
JOIN clients c ON c.id = i.client_id
WHERE c.is_active = true;

COMMENT ON VIEW v_invoices_with_13th IS 'Faturas com identificação de 13º honorário';

-- 10. ATUALIZAR client_opening_balance PARA INCLUIR 13º
-- =====================================================
DO $$
BEGIN
  -- Adicionar flag para identificar 13º no saldo de abertura
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_opening_balance' AND column_name = 'is_thirteenth_fee') THEN
    ALTER TABLE client_opening_balance ADD COLUMN is_thirteenth_fee BOOLEAN DEFAULT false;
    COMMENT ON COLUMN client_opening_balance.is_thirteenth_fee IS 'Se esta competência é referente ao 13º honorário';
  END IF;
END $$;

-- 11. GRANT PERMISSÕES
-- =====================================================
GRANT SELECT ON holidays TO authenticated;
GRANT SELECT ON v_invoices_with_13th TO authenticated;
GRANT EXECUTE ON FUNCTION is_business_day TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_to_business_day TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_due_date TO authenticated;
GRANT EXECUTE ON FUNCTION generate_annual_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION batch_generate_annual_invoices TO authenticated;
