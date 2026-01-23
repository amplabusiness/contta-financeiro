-- ============================================================================
-- PROVISÕES DE HONORÁRIOS E CORREÇÕES CONTÁBEIS
-- ============================================================================

-- Desabilitar triggers durante a migração
ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;
ALTER TABLE chart_of_accounts DISABLE TRIGGER USER;

-- ============================================================================
-- PARTE 1: FUNÇÃO PARA GERAR PROVISÕES MENSAIS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_generate_monthly_provisions(
  p_tenant_id UUID,
  p_year INTEGER,
  p_month INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_client RECORD;
  v_entry_id UUID;
  v_revenue_account_id UUID;
  v_competence_date DATE;
  v_entry_date DATE;
  v_next_number INTEGER;
  v_count INTEGER := 0;
  v_total NUMERIC := 0;
BEGIN
  -- Data de competência e entrada (primeiro dia do mês)
  v_competence_date := make_date(p_year, p_month, 1);
  v_entry_date := v_competence_date;

  -- Buscar conta de receita de honorários
  SELECT id INTO v_revenue_account_id
  FROM chart_of_accounts
  WHERE tenant_id = p_tenant_id
    AND (code = '3.1.01' OR code LIKE '3.1.01%' OR name ILIKE '%honorário%')
    AND is_active = true
  ORDER BY LENGTH(code), code
  LIMIT 1;

  IF v_revenue_account_id IS NULL THEN
    -- Buscar qualquer conta de receita
    SELECT id INTO v_revenue_account_id
    FROM chart_of_accounts
    WHERE tenant_id = p_tenant_id
      AND code LIKE '3.%'
      AND is_active = true
    ORDER BY code
    LIMIT 1;
  END IF;

  IF v_revenue_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta de receita não encontrada');
  END IF;

  -- Para cada cliente ativo com honorário definido
  FOR v_client IN
    SELECT
      c.id,
      c.name,
      c.monthly_fee,
      c.accounting_account_id
    FROM clients c
    WHERE c.tenant_id = p_tenant_id
      AND c.is_active = true
      AND c.monthly_fee > 0
      AND c.accounting_account_id IS NOT NULL
      -- Não duplicar provisões já existentes
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.tenant_id = p_tenant_id
          AND ae.competence_date = v_competence_date
          AND ae.description ILIKE '%provisão%honorário%' || SUBSTRING(c.name FROM 1 FOR 20) || '%'
      )
  LOOP
    -- Próximo número de lançamento
    SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_next_number
    FROM accounting_entries
    WHERE tenant_id = p_tenant_id;

    -- Criar lançamento de provisão
    INSERT INTO accounting_entries (
      tenant_id,
      entry_number,
      entry_date,
      competence_date,
      description,
      entry_type,
      total_debit,
      total_credit,
      ai_generated,
      created_at
    ) VALUES (
      p_tenant_id,
      v_next_number,
      v_entry_date,
      v_competence_date,
      'Provisão de Honorários - ' || v_client.name || ' - ' || TO_CHAR(v_competence_date, 'MM/YYYY'),
      'provisao',
      v_client.monthly_fee,
      v_client.monthly_fee,
      true,
      NOW()
    )
    RETURNING id INTO v_entry_id;

    -- Linha de débito: Clientes a Receber (aumenta ativo)
    INSERT INTO accounting_entry_lines (
      tenant_id,
      entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      p_tenant_id,
      v_entry_id,
      v_client.accounting_account_id,
      v_client.monthly_fee,
      0,
      'Provisão honorários ' || TO_CHAR(v_competence_date, 'MM/YYYY')
    );

    -- Linha de crédito: Receita de Honorários (aumenta receita)
    INSERT INTO accounting_entry_lines (
      tenant_id,
      entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      p_tenant_id,
      v_entry_id,
      v_revenue_account_id,
      0,
      v_client.monthly_fee,
      'Receita honorários ' || v_client.name
    );

    v_count := v_count + 1;
    v_total := v_total + v_client.monthly_fee;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'provisions_created', v_count,
    'total_amount', v_total,
    'competence', v_competence_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- PARTE 2: CORRIGIR LANÇAMENTOS EXISTENTES PARA MARCAR COMO AUTOMÁTICOS
-- ============================================================================

UPDATE accounting_entries
SET ai_generated = true
WHERE description LIKE 'Recebimento:%'
   OR description LIKE 'Pagamento de Despesa%';

-- ============================================================================
-- PARTE 3: GERAR PROVISÕES RETROATIVAS PARA JANEIRO/2025
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    SELECT fn_generate_monthly_provisions(v_tenant_id, 2025, 1) INTO v_result;
    RAISE NOTICE 'Provisões Janeiro/2025: %', v_result;
  END IF;
END $$;

-- Reabilitar triggers
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
ALTER TABLE chart_of_accounts ENABLE TRIGGER USER;

-- ============================================================================
-- PARTE 4: VERIFICAR E EXIBIR RESULTADO
-- ============================================================================

DO $$
DECLARE
  v_provisoes INTEGER;
  v_receitas NUMERIC;
  v_a_receber NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(ael.credit), 0)
  INTO v_provisoes, v_receitas
  FROM accounting_entries ae
  JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
  WHERE ae.description ILIKE '%provisão%honorário%'
    AND ael.credit > 0;

  SELECT COALESCE(SUM(ael.debit) - SUM(ael.credit), 0)
  INTO v_a_receber
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '1.1.2.01%';

  RAISE NOTICE '=== RESULTADO FINAL ===';
  RAISE NOTICE 'Provisões criadas: %', v_provisoes;
  RAISE NOTICE 'Receitas reconhecidas: R$ %', v_receitas;
  RAISE NOTICE 'Saldo A Receber: R$ %', v_a_receber;
END $$;

-- ============================================================================
-- PARTE 5: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION fn_generate_monthly_provisions(UUID, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION fn_generate_monthly_provisions IS
  'Gera provisões de honorários para todos clientes ativos com monthly_fee > 0';
