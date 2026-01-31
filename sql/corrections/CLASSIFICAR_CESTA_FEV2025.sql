-- ============================================================================
-- CLASSIFICAÇÃO: CESTA DE RELACIONAMENTO - Fevereiro/2025
-- Aprovado por: Dr. Cícero
-- Data: 31/01/2026
-- ============================================================================

-- PRIMEIRO: Listar triggers existentes (execute isso separadamente se quiser ver)
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgrelid = 'accounting_entries'::regclass;

-- DESABILITAR TRIGGERS USER-DEFINED (exceto os de sistema que começam com RI_)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tgname, tgrelid::regclass as tabela
    FROM pg_trigger 
    WHERE tgrelid IN ('accounting_entries'::regclass, 'accounting_entry_lines'::regclass, 'bank_transactions'::regclass)
    AND tgname NOT LIKE 'RI_%'
    AND NOT tgisinternal
  LOOP
    EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', r.tabela, r.tgname);
    RAISE NOTICE 'Desabilitado: %.%', r.tabela, r.tgname;
  END LOOP;
END $$;

DO $$
DECLARE
  v_entry_id UUID := gen_random_uuid();
  v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_conta_tarifa UUID := '3bf3b44b-8f3c-4a86-9fdb-4cc104a5f59c'; -- 4.1.3.02 Tarifas Bancárias
  v_transitoria_debitos UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0'; -- 1.1.9.01
  v_tx_id UUID := '3113deff-7b93-41d7-b00a-f4f288fba413';
  v_valor NUMERIC := 59.28;
  v_data DATE := '2025-02-05';
  v_internal_code TEXT := 'CLASS_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_CESTA_FEV';
BEGIN
  -- 1. Criar lançamento de classificação
  INSERT INTO accounting_entries (
    id, tenant_id, entry_date, competence_date, description, 
    internal_code, source_type, entry_type, reference_type, reference_id
  ) VALUES (
    v_entry_id, v_tenant_id, v_data, v_data,
    'Classificação: Cesta de Relacionamento Bancário - Fevereiro/2025',
    v_internal_code, 'classification', 'CLASSIFICACAO', 'bank_transaction', v_tx_id
  );

  -- 2. Linha de DÉBITO: Despesa Bancária (aumenta despesa)
  INSERT INTO accounting_entry_lines (
    id, tenant_id, entry_id, account_id, debit, credit, description
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_entry_id, v_conta_tarifa,
    v_valor, 0, 'Despesa bancária - Cesta de Relacionamento'
  );

  -- 3. Linha de CRÉDITO: Transitória Débitos (zera pendência)
  INSERT INTO accounting_entry_lines (
    id, tenant_id, entry_id, account_id, debit, credit, description
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_entry_id, v_transitoria_debitos,
    0, v_valor, 'Baixa transitória - despesa identificada'
  );

  -- 4. Atualizar transação como conciliada
  UPDATE bank_transactions 
  SET status = 'reconciled', 
      is_reconciled = true, 
      reconciled_at = NOW()
  WHERE id = v_tx_id;

  RAISE NOTICE '✅ CLASSIFICAÇÃO CONFIRMADA';
  RAISE NOTICE '📄 Lançamento: %', v_internal_code;
  RAISE NOTICE '📅 Data: %', v_data;
  RAISE NOTICE '💰 Valor: R$ %', v_valor;
  RAISE NOTICE '';
  RAISE NOTICE 'D - 4.1.3.02 Tarifas Bancárias      R$ %', v_valor;
  RAISE NOTICE 'C - 1.1.9.01 Transitória Débitos    R$ %', v_valor;
END $$;

-- REABILITAR TRIGGERS USER-DEFINED
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tgname, tgrelid::regclass as tabela
    FROM pg_trigger 
    WHERE tgrelid IN ('accounting_entries'::regclass, 'accounting_entry_lines'::regclass, 'bank_transactions'::regclass)
    AND tgname NOT LIKE 'RI_%'
    AND NOT tgisinternal
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %I', r.tabela, r.tgname);
    RAISE NOTICE 'Reabilitado: %.%', r.tabela, r.tgname;
  END LOOP;
END $$;

-- Verificar resultado
SELECT 
  ae.entry_date,
  ae.description,
  ae.internal_code,
  ael.debit,
  ael.credit,
  coa.code || ' - ' || coa.name as conta
FROM accounting_entries ae
JOIN accounting_entry_lines ael ON ael.entry_id = ae.id
JOIN chart_of_accounts coa ON coa.id = ael.account_id
WHERE ae.internal_code LIKE 'CLASS_%CESTA%'
ORDER BY ae.created_at DESC
LIMIT 4;
