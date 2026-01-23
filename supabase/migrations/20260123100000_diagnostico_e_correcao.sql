-- ============================================================================
-- DIAGNÓSTICO E CORREÇÃO DO FLUXO DE CONCILIAÇÃO
-- Execute este script para verificar e corrigir problemas
-- ============================================================================

-- ============================================================================
-- PARTE 1: DIAGNÓSTICO (já executado com sucesso)
-- ============================================================================

-- Resultados do diagnóstico:
-- - Total de transações: 5279
-- - Com tenant_id: 5279
-- - Com CNPJ extraído: 3438
-- - Créditos (recebimentos): 4561
-- - Clientes ativos: 346
-- - Com conta contábil: 339
-- - Total de lançamentos: 5892
-- - Provisões: 0 (PROBLEMA!)

-- ============================================================================
-- PARTE 2: CORREÇÕES (com triggers desabilitados)
-- ============================================================================

-- Desabilitar apenas triggers de usuário (não sistema/FK)
ALTER TABLE bank_transactions DISABLE TRIGGER USER;
ALTER TABLE clients DISABLE TRIGGER USER;
ALTER TABLE chart_of_accounts DISABLE TRIGGER USER;

-- 2.1 Re-extrair metadados das transações que não têm CNPJ
DO $$
DECLARE
  v_tx RECORD;
  v_count INTEGER := 0;
  v_desc TEXT;
  v_cnpj TEXT;
  v_cpf TEXT;
BEGIN
  FOR v_tx IN
    SELECT id, description
    FROM bank_transactions
    WHERE amount > 0
      AND extracted_cnpj IS NULL
      AND extracted_cpf IS NULL
  LOOP
    v_desc := UPPER(v_tx.description);

    -- Tentar extrair CNPJ (14 dígitos - vários formatos)
    v_cnpj := (SELECT (regexp_matches(v_desc, '(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2})'))[1]);
    IF v_cnpj IS NULL THEN
      v_cnpj := (SELECT (regexp_matches(v_desc, '(\d{14})'))[1]);
    END IF;

    -- Tentar extrair CPF (11 dígitos)
    IF v_cnpj IS NULL THEN
      v_cpf := (SELECT (regexp_matches(v_desc, '(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})'))[1]);
      IF v_cpf IS NULL THEN
        v_cpf := (SELECT (regexp_matches(v_desc, '(\d{11})'))[1]);
      END IF;
    END IF;

    IF v_cnpj IS NOT NULL OR v_cpf IS NOT NULL THEN
      UPDATE bank_transactions
      SET
        extracted_cnpj = v_cnpj,
        extracted_cpf = v_cpf,
        metadata_extracted_at = NOW()
      WHERE id = v_tx.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Metadados extraídos de % transações', v_count;
END $$;

-- 2.2 Criar contas contábeis para clientes que não têm
-- NOTA: 339 de 346 clientes já têm conta, pulando criação manual
-- Os 7 restantes podem ser criados via trigger fn_auto_create_client_account
DO $$
DECLARE
  v_sem_conta INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_sem_conta FROM clients WHERE is_active = true AND accounting_account_id IS NULL;
  RAISE NOTICE 'Clientes sem conta contábil: % (serão criados via trigger quando necessário)', v_sem_conta;
END $$;

-- Reabilitar triggers de usuário
ALTER TABLE bank_transactions ENABLE TRIGGER USER;
ALTER TABLE clients ENABLE TRIGGER USER;
ALTER TABLE chart_of_accounts ENABLE TRIGGER USER;

-- 2.3 Executar identificação de pagadores em lote
-- (Usa função SECURITY DEFINER que já bypassa RLS)
DO $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    -- Usar a função SQL direta que é SECURITY DEFINER
    SELECT fn_identify_payers_batch(v_tenant_id, 500) INTO v_result;
    RAISE NOTICE 'Resultado da identificação: %', v_result;
  END IF;
END $$;

-- ============================================================================
-- PARTE 3: VERIFICAÇÃO PÓS-CORREÇÃO
-- ============================================================================

-- 3.1 Estatísticas de identificação
DO $$
DECLARE
  v_total INTEGER;
  v_identificados INTEGER;
  v_auto INTEGER;
  v_revisao INTEGER;
  v_confianca NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE suggested_client_id IS NOT NULL),
    COUNT(*) FILTER (WHERE auto_matched = true),
    COUNT(*) FILTER (WHERE needs_review = true),
    ROUND(AVG(identification_confidence) FILTER (WHERE identification_confidence > 0), 1)
  INTO v_total, v_identificados, v_auto, v_revisao, v_confianca
  FROM bank_transactions
  WHERE amount > 0;

  RAISE NOTICE '=== ESTATÍSTICAS PÓS-CORREÇÃO ===';
  RAISE NOTICE 'Total de créditos: %', v_total;
  RAISE NOTICE 'Identificados: %', v_identificados;
  RAISE NOTICE 'Auto-conciliados: %', v_auto;
  RAISE NOTICE 'Aguardando revisão: %', v_revisao;
  RAISE NOTICE 'Confiança média: %', v_confianca;
END $$;

-- ============================================================================
-- FIM
-- ============================================================================
