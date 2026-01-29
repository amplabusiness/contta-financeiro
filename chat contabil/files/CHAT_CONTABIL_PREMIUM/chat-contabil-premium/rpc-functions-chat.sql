-- ============================================
-- RPC FUNCTIONS PARA CHAT CONTÁBIL
-- ============================================
-- Funções otimizadas para consultas do Dr. Cícero
-- ============================================

-- ============================================
-- 1. BUSCAR RECEBIMENTOS PIX
-- ============================================

CREATE OR REPLACE FUNCTION buscar_recebimentos_pix(
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS TABLE (
  cliente_id UUID,
  cliente_nome TEXT,
  valor NUMERIC,
  data DATE,
  quantidade BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as cliente_id,
    c.name as cliente_nome,
    SUM(ael.credit) as valor,
    ae.entry_date as data,
    COUNT(*) as quantidade
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  LEFT JOIN clients c ON c.id = (ae.metadata->>'client_id')::uuid
  WHERE ae.entry_date BETWEEN p_data_inicio AND p_data_fim
    AND (ae.description ILIKE '%PIX%' OR ae.metadata->>'forma_pagamento' = 'PIX')
    AND ael.credit > 0
    AND coa.code LIKE '1.1.2.01.%'
  GROUP BY c.id, c.name, ae.entry_date
  ORDER BY SUM(ael.credit) DESC;
END;
$$;

-- ============================================
-- 2. BUSCAR CLIENTES INADIMPLENTES
-- ============================================

CREATE OR REPLACE FUNCTION buscar_clientes_inadimplentes(
  p_dias_minimo INTEGER DEFAULT 1
)
RETURNS TABLE (
  cliente_id UUID,
  nome TEXT,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  saldo_devedor NUMERIC,
  dias_atraso INTEGER,
  ultima_cobranca DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH saldos AS (
    SELECT 
      c.id as cliente_id,
      c.name as nome,
      c.cnpj,
      c.phone as telefone,
      c.email,
      COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) as saldo
    FROM clients c
    JOIN chart_of_accounts coa ON coa.name ILIKE '%' || c.name || '%' AND coa.code LIKE '1.1.2.01.%'
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    GROUP BY c.id, c.name, c.cnpj, c.phone, c.email
    HAVING COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) > 0.01
  ),
  ultima_invoice AS (
    SELECT 
      client_id,
      MAX(due_date) as ultima_cobranca
    FROM invoices
    WHERE status = 'pending'
    GROUP BY client_id
  )
  SELECT 
    s.cliente_id,
    s.nome,
    s.cnpj,
    s.telefone,
    s.email,
    s.saldo as saldo_devedor,
    GREATEST(0, (CURRENT_DATE - COALESCE(ui.ultima_cobranca, CURRENT_DATE - INTERVAL '30 days'))::INTEGER) as dias_atraso,
    ui.ultima_cobranca
  FROM saldos s
  LEFT JOIN ultima_invoice ui ON ui.client_id = s.cliente_id
  WHERE (CURRENT_DATE - COALESCE(ui.ultima_cobranca, CURRENT_DATE - INTERVAL '30 days'))::INTEGER >= p_dias_minimo
  ORDER BY (CURRENT_DATE - COALESCE(ui.ultima_cobranca, CURRENT_DATE - INTERVAL '30 days'))::INTEGER DESC;
END;
$$;

-- ============================================
-- 3. BUSCAR HISTÓRICO DO CLIENTE
-- ============================================

CREATE OR REPLACE FUNCTION buscar_historico_cliente(
  p_cliente_id UUID DEFAULT NULL,
  p_cliente_nome TEXT DEFAULT NULL,
  p_limite INTEGER DEFAULT 12
)
RETURNS TABLE (
  cliente_id UUID,
  cliente_nome TEXT,
  cnpj TEXT,
  status TEXT,
  saldo_devedor NUMERIC,
  competencia TEXT,
  valor_pago NUMERIC,
  data_pagamento DATE,
  forma_pagamento TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id UUID;
  v_cliente_nome TEXT;
  v_cnpj TEXT;
  v_saldo NUMERIC;
  v_conta_id UUID;
BEGIN
  -- Buscar cliente
  IF p_cliente_id IS NOT NULL THEN
    SELECT id, name, cnpj INTO v_cliente_id, v_cliente_nome, v_cnpj
    FROM clients WHERE id = p_cliente_id;
  ELSIF p_cliente_nome IS NOT NULL THEN
    SELECT id, name, cnpj INTO v_cliente_id, v_cliente_nome, v_cnpj
    FROM clients WHERE name ILIKE '%' || p_cliente_nome || '%'
    LIMIT 1;
  END IF;
  
  IF v_cliente_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Buscar conta analítica
  SELECT id INTO v_conta_id
  FROM chart_of_accounts
  WHERE name ILIKE '%' || v_cliente_nome || '%'
    AND code LIKE '1.1.2.01.%'
  LIMIT 1;
  
  -- Calcular saldo devedor
  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) INTO v_saldo
  FROM accounting_entry_lines
  WHERE account_id = v_conta_id;
  
  -- Retornar histórico
  RETURN QUERY
  SELECT 
    v_cliente_id as cliente_id,
    v_cliente_nome as cliente_nome,
    v_cnpj as cnpj,
    CASE WHEN v_saldo <= 0.01 THEN 'Em dia' ELSE 'Devendo' END as status,
    GREATEST(0, v_saldo) as saldo_devedor,
    to_char(ae.entry_date, 'Mon/YYYY') as competencia,
    ael.credit as valor_pago,
    ae.entry_date as data_pagamento,
    CASE 
      WHEN ae.description ILIKE '%PIX%' THEN 'PIX'
      WHEN ae.description ILIKE '%COB%' OR ae.description ILIKE '%BOLETO%' THEN 'Boleto'
      WHEN ae.description ILIKE '%TED%' THEN 'TED'
      ELSE 'Outro'
    END as forma_pagamento
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  WHERE ael.account_id = v_conta_id
    AND ael.credit > 0
  ORDER BY ae.entry_date DESC
  LIMIT p_limite;
END;
$$;

-- ============================================
-- 4. BUSCAR DESPESAS POR CATEGORIA
-- ============================================

CREATE OR REPLACE FUNCTION buscar_despesas_categoria(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_categoria TEXT DEFAULT NULL
)
RETURNS TABLE (
  categoria_codigo TEXT,
  categoria_nome TEXT,
  total NUMERIC,
  quantidade BIGINT,
  percentual NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_geral NUMERIC;
BEGIN
  -- Calcular total geral
  SELECT COALESCE(SUM(ael.debit), 0) INTO v_total_geral
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE ae.entry_date BETWEEN p_data_inicio AND p_data_fim
    AND coa.code LIKE '4.%'
    AND ael.debit > 0;
  
  -- Retornar por categoria
  RETURN QUERY
  SELECT 
    LEFT(coa.code, 5) as categoria_codigo,
    coa.name as categoria_nome,
    SUM(ael.debit) as total,
    COUNT(*) as quantidade,
    CASE WHEN v_total_geral > 0 
      THEN ROUND((SUM(ael.debit) / v_total_geral * 100)::NUMERIC, 2) 
      ELSE 0 
    END as percentual
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE ae.entry_date BETWEEN p_data_inicio AND p_data_fim
    AND coa.code LIKE '4.%'
    AND ael.debit > 0
    AND (p_categoria IS NULL OR coa.code LIKE p_categoria || '%')
  GROUP BY LEFT(coa.code, 5), coa.name
  ORDER BY SUM(ael.debit) DESC;
END;
$$;

-- ============================================
-- 5. DASHBOARD FINANCEIRO
-- ============================================

CREATE OR REPLACE FUNCTION dashboard_financeiro(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
)
RETURNS TABLE (
  receitas NUMERIC,
  despesas NUMERIC,
  lucro NUMERIC,
  saldo_bancos NUMERIC,
  a_receber NUMERIC,
  a_pagar NUMERIC,
  clientes_inadimplentes INTEGER,
  total_inadimplencia NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inicio DATE;
  v_fim DATE;
  v_receitas NUMERIC;
  v_despesas NUMERIC;
  v_saldo_bancos NUMERIC;
  v_a_receber NUMERIC;
  v_a_pagar NUMERIC;
  v_inadimplentes INTEGER;
  v_total_inad NUMERIC;
BEGIN
  -- Definir período
  v_inicio := COALESCE(p_data_inicio, date_trunc('month', CURRENT_DATE)::DATE);
  v_fim := COALESCE(p_data_fim, CURRENT_DATE);
  
  -- Receitas (créditos em contas 3.x)
  SELECT COALESCE(SUM(ael.credit), 0) INTO v_receitas
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE ae.entry_date BETWEEN v_inicio AND v_fim
    AND coa.code LIKE '3.%'
    AND ael.credit > 0;
  
  -- Despesas (débitos em contas 4.x)
  SELECT COALESCE(SUM(ael.debit), 0) INTO v_despesas
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE ae.entry_date BETWEEN v_inicio AND v_fim
    AND coa.code LIKE '4.%'
    AND ael.debit > 0;
  
  -- Saldo bancos
  SELECT COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) INTO v_saldo_bancos
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '1.1.1.%';
  
  -- A receber
  SELECT COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) INTO v_a_receber
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '1.1.2.01.%';
  
  -- A pagar (simplificado)
  SELECT COALESCE(SUM(amount), 0) INTO v_a_pagar
  FROM expenses
  WHERE status = 'pending';
  
  -- Inadimplentes
  SELECT COUNT(*), COALESCE(SUM(saldo_devedor), 0) 
  INTO v_inadimplentes, v_total_inad
  FROM buscar_clientes_inadimplentes(1);
  
  RETURN QUERY SELECT 
    v_receitas,
    v_despesas,
    v_receitas - v_despesas,
    v_saldo_bancos,
    GREATEST(0, v_a_receber),
    v_a_pagar,
    v_inadimplentes,
    v_total_inad;
END;
$$;

-- ============================================
-- 6. BUSCAR SALDO POR BANCO
-- ============================================

CREATE OR REPLACE FUNCTION buscar_saldos_bancos()
RETURNS TABLE (
  banco_codigo TEXT,
  banco_nome TEXT,
  saldo NUMERIC,
  ultima_movimentacao DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    coa.code as banco_codigo,
    coa.name as banco_nome,
    COALESCE(SUM(ael.debit), 0) - COALESCE(SUM(ael.credit), 0) as saldo,
    MAX(ae.entry_date) as ultima_movimentacao
  FROM chart_of_accounts coa
  LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
  LEFT JOIN accounting_entries ae ON ae.id = ael.entry_id
  WHERE coa.code LIKE '1.1.1.%'
    AND coa.is_analytical = true
  GROUP BY coa.code, coa.name
  ORDER BY coa.code;
END;
$$;

-- ============================================
-- 7. BUSCAR TOP CLIENTES
-- ============================================

CREATE OR REPLACE FUNCTION buscar_top_clientes(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_limite INTEGER DEFAULT 10
)
RETURNS TABLE (
  cliente_id UUID,
  cliente_nome TEXT,
  total_pago NUMERIC,
  quantidade_pagamentos BIGINT,
  ticket_medio NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as cliente_id,
    c.name as cliente_nome,
    SUM(ael.credit) as total_pago,
    COUNT(*) as quantidade_pagamentos,
    ROUND((SUM(ael.credit) / COUNT(*))::NUMERIC, 2) as ticket_medio
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  JOIN clients c ON coa.name ILIKE '%' || c.name || '%'
  WHERE ae.entry_date BETWEEN p_data_inicio AND p_data_fim
    AND coa.code LIKE '1.1.2.01.%'
    AND ael.credit > 0
  GROUP BY c.id, c.name
  ORDER BY SUM(ael.credit) DESC
  LIMIT p_limite;
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================

GRANT EXECUTE ON FUNCTION buscar_recebimentos_pix TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_clientes_inadimplentes TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_historico_cliente TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_despesas_categoria TO authenticated;
GRANT EXECUTE ON FUNCTION dashboard_financeiro TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_saldos_bancos TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_top_clientes TO authenticated;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON FUNCTION buscar_recebimentos_pix IS 'Busca recebimentos via PIX no período, agrupados por cliente';
COMMENT ON FUNCTION buscar_clientes_inadimplentes IS 'Retorna clientes com saldo devedor e dias de atraso';
COMMENT ON FUNCTION buscar_historico_cliente IS 'Retorna histórico de pagamentos de um cliente específico';
COMMENT ON FUNCTION buscar_despesas_categoria IS 'Retorna despesas agrupadas por categoria';
COMMENT ON FUNCTION dashboard_financeiro IS 'Retorna visão geral financeira (receitas, despesas, saldos)';
COMMENT ON FUNCTION buscar_saldos_bancos IS 'Retorna saldo atual de cada conta bancária';
COMMENT ON FUNCTION buscar_top_clientes IS 'Retorna os clientes que mais pagaram no período';
