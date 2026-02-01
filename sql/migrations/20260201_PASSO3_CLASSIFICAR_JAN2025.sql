-- ============================================================================
-- PASSO 3 — CLASSIFICAÇÃO COMPLETA JANEIRO/2025
-- ============================================================================
-- Data: 01/02/2026
-- Autorizado por: Dr. Cícero - Contador Responsável
-- 
-- OBJETIVO: Criar 183 lançamentos de classificação para zerar transitórias
-- 
-- APROVAÇÕES:
-- ✅ PIX AMPLA (R$ 173.116,65) → Transferência interna (1.1.1.02)
-- ✅ PIX SERGIO CARNEIRO → Pró-labore (4.2.1.06)
-- ✅ Matriz geral aprovada integralmente
-- ============================================================================

-- 1. DESABILITAR TRIGGERS PARA PERFORMANCE
ALTER TABLE accounting_entries DISABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER USER;
ALTER TABLE bank_transactions DISABLE TRIGGER USER;

-- 2. VARIÁVEIS DE CONTAS
DO $$
DECLARE
  -- Tenant
  v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  
  -- ATIVO
  v_banco_sicredi UUID := '10d5892d-a843-4034-8d62-9fec95b8fd56';      -- 1.1.1.05
  v_banco_bradesco UUID := '05190443-cdc1-4222-87e7-358b1feacbd1';     -- 1.1.1.02
  v_transitoria_debitos UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0'; -- 1.1.9.01
  
  -- PASSIVO
  v_transitoria_creditos UUID := '28085461-9e5a-4fb4-847d-c9fc047fe0a1'; -- 2.1.9.01
  
  -- RECEITA
  v_honorarios UUID := '3273fd5b-a16f-4a10-944e-55c8cb27f363';         -- 3.1.1.01
  
  -- DESPESAS
  v_pro_labore UUID := 'c1a6f23a-8950-4b2b-8399-2d5fd9f5afa7';         -- 4.2.1.06
  v_tarifas UUID := '88caf258-d747-492e-9161-275ab67e967c';            -- 4.3.1.02
  v_iof UUID := 'd539bb20-5a2f-42cc-b3d1-a9fcb00a80e8';                -- 4.3.1.03
  
  -- Variáveis de controle
  v_tx RECORD;
  v_entry_id UUID;
  v_internal_code TEXT;
  v_categoria TEXT;
  v_conta_debito UUID;
  v_conta_credito UUID;
  v_descricao TEXT;
  v_valor NUMERIC;
  v_total_entradas NUMERIC := 0;
  v_total_saidas NUMERIC := 0;
  v_contador INTEGER := 0;
  
BEGIN
  RAISE NOTICE '╔═══════════════════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║        PASSO 3 — CLASSIFICAÇÃO JANEIRO/2025 — DR. CÍCERO                      ║';
  RAISE NOTICE '╚═══════════════════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- 3. PROCESSAR CADA TRANSAÇÃO DE JANEIRO/2025
  FOR v_tx IN 
    SELECT id, transaction_date, amount, description, fitid
    FROM bank_transactions
    WHERE tenant_id = v_tenant_id
      AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
    ORDER BY transaction_date, amount
  LOOP
    v_valor := ABS(v_tx.amount);
    v_entry_id := gen_random_uuid();
    v_internal_code := 'CLASS_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || COALESCE(v_tx.fitid, LEFT(v_tx.id::TEXT, 8));
    
    -- =========================================
    -- CLASSIFICAR BASEADO NA DESCRIÇÃO
    -- =========================================
    
    IF v_tx.amount > 0 THEN
      -- ========== ENTRADAS (zerar transitória créditos) ==========
      v_categoria := 'RECEITA_HONORARIOS';
      v_conta_debito := v_transitoria_creditos;  -- Zera a transitória
      v_conta_credito := v_honorarios;           -- Reconhece receita
      v_descricao := 'Class.: Recebimento - Honorários';
      v_total_entradas := v_total_entradas + v_valor;
      
    ELSE
      -- ========== SAÍDAS (zerar transitória débitos) ==========
      
      -- 1. TRANSFERÊNCIA AMPLA
      IF UPPER(v_tx.description) LIKE '%AMPLA CONTABILID%' OR UPPER(v_tx.description) LIKE '%23893032000169%' THEN
        v_categoria := 'TRANSFERENCIA_INTERNA';
        v_conta_debito := v_banco_bradesco;          -- Entrada no outro banco
        v_conta_credito := v_transitoria_debitos;    -- Zera transitória
        v_descricao := 'Class.: Transferência interna - Ampla Contabilidade';
        
      -- 2. PRÓ-LABORE (Sérgio Carneiro)
      ELSIF UPPER(v_tx.description) LIKE '%SERGIO CARNEIRO%' OR UPPER(v_tx.description) LIKE '%48656488104%' THEN
        v_categoria := 'PRO_LABORE';
        v_conta_debito := v_pro_labore;              -- Despesa
        v_conta_credito := v_transitoria_debitos;    -- Zera transitória
        v_descricao := 'Class.: Pró-labore - Sérgio Carneiro';
        
      -- 3. TARIFAS BANCÁRIAS
      ELSIF UPPER(v_tx.description) LIKE '%TARIFA%' OR UPPER(v_tx.description) LIKE '%TAR %' THEN
        v_categoria := 'TARIFA_BANCARIA';
        v_conta_debito := v_tarifas;                 -- Despesa
        v_conta_credito := v_transitoria_debitos;    -- Zera transitória
        v_descricao := 'Class.: Tarifa bancária';
        
      -- 4. IOF
      ELSIF UPPER(v_tx.description) LIKE '%IOF%' THEN
        v_categoria := 'IOF';
        v_conta_debito := v_iof;                     -- Despesa
        v_conta_credito := v_transitoria_debitos;    -- Zera transitória
        v_descricao := 'Class.: IOF';
        
      -- 5. PIX ENVIADO (outros terceiros/sócios)
      ELSIF UPPER(v_tx.description) LIKE '%PIX%' THEN
        v_categoria := 'PIX_TERCEIROS';
        v_conta_debito := v_pro_labore;              -- Pró-labore/terceiros
        v_conta_credito := v_transitoria_debitos;    -- Zera transitória
        v_descricao := 'Class.: Pagamento PIX - Terceiros/Sócios';
        
      -- 6. DEMAIS SAÍDAS (boletos, liquidações)
      ELSE
        v_categoria := 'DESPESA_GERAL';
        v_conta_debito := v_tarifas;                 -- Usa despesa geral
        v_conta_credito := v_transitoria_debitos;    -- Zera transitória
        v_descricao := 'Class.: Pagamento fornecedor/tributo';
      END IF;
      
      v_total_saidas := v_total_saidas + v_valor;
    END IF;
    
    -- =========================================
    -- CRIAR LANÇAMENTO CONTÁBIL
    -- =========================================
    
    -- 1. Cabeçalho (accounting_entries)
    INSERT INTO accounting_entries (
      id, tenant_id, entry_date, competence_date, description,
      internal_code, source_type, entry_type, reference_type, reference_id,
      source_id, total_debit, total_credit, balanced
    ) VALUES (
      v_entry_id, v_tenant_id, v_tx.transaction_date, v_tx.transaction_date,
      v_descricao || ' | ' || LEFT(v_tx.description, 50),
      v_internal_code, 'classification', 'CLASSIFICACAO', 'bank_transaction', v_tx.id,
      v_tx.id, v_valor, v_valor, true
    );
    
    -- 2. Linha de DÉBITO
    INSERT INTO accounting_entry_lines (
      id, tenant_id, entry_id, account_id, debit, credit, description
    ) VALUES (
      gen_random_uuid(), v_tenant_id, v_entry_id, v_conta_debito,
      v_valor, 0, v_descricao
    );
    
    -- 3. Linha de CRÉDITO
    INSERT INTO accounting_entry_lines (
      id, tenant_id, entry_id, account_id, debit, credit, description
    ) VALUES (
      gen_random_uuid(), v_tenant_id, v_entry_id, v_conta_credito,
      0, v_valor, v_descricao
    );
    
    v_contador := v_contador + 1;
    
    -- Log a cada 20 transações
    IF v_contador % 20 = 0 THEN
      RAISE NOTICE '   ✅ Processadas % transações...', v_contador;
    END IF;
    
  END LOOP;
  
  -- =========================================
  -- RESUMO FINAL
  -- =========================================
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 RESULTADO FINAL:';
  RAISE NOTICE '   Total de lançamentos criados: %', v_contador;
  RAISE NOTICE '   Valor total ENTRADAS: R$ %', v_total_entradas;
  RAISE NOTICE '   Valor total SAÍDAS: R$ %', v_total_saidas;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════════════════';
  
END $$;

-- 4. REABILITAR TRIGGERS
ALTER TABLE accounting_entries ENABLE TRIGGER USER;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER USER;
ALTER TABLE bank_transactions ENABLE TRIGGER USER;

-- 5. VERIFICAR SALDOS DAS TRANSITÓRIAS APÓS CLASSIFICAÇÃO
SELECT 
  '🔍 VERIFICAÇÃO PÓS-CLASSIFICAÇÃO' as titulo;

SELECT 
  c.code,
  c.name,
  COALESCE(SUM(l.debit), 0) as total_debitos,
  COALESCE(SUM(l.credit), 0) as total_creditos,
  COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as saldo_final,
  CASE 
    WHEN ABS(COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)) < 0.01 THEN '✅ ZERADO'
    ELSE '⚠️ PENDENTE'
  END as status
FROM chart_of_accounts c
LEFT JOIN accounting_entry_lines l ON l.account_id = c.id
LEFT JOIN accounting_entries e ON e.id = l.entry_id
WHERE c.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND c.code IN ('1.1.9.01', '2.1.9.01')
  AND (e.entry_date BETWEEN '2025-01-01' AND '2025-01-31' OR e.entry_date IS NULL)
GROUP BY c.id, c.code, c.name
ORDER BY c.code;

-- 6. CONTAGEM DE LANÇAMENTOS DE CLASSIFICAÇÃO
SELECT 
  '📊 LANÇAMENTOS DE CLASSIFICAÇÃO JANEIRO/2025' as titulo;

SELECT 
  source_type,
  COUNT(*) as quantidade,
  SUM(total_debit) as valor_total
FROM accounting_entries
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND entry_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY source_type
ORDER BY quantidade DESC;

-- 7. VERIFICAR SE TODAS AS 183 TRANSAÇÕES AGORA TÊM CLASSIFICAÇÃO
SELECT 
  '📋 STATUS FINAL DAS 183 TRANSAÇÕES' as titulo;

SELECT 
  COUNT(*) FILTER (WHERE has_classification = false) as sem_classificacao,
  COUNT(*) FILTER (WHERE has_classification = true) as com_classificacao,
  COUNT(*) as total
FROM (
  SELECT 
    bt.id,
    EXISTS (
      SELECT 1 FROM accounting_entries class
      WHERE class.tenant_id = bt.tenant_id
        AND class.source_type = 'classification'
        AND (class.reference_id = bt.id OR class.source_id = bt.id)
    ) as has_classification
  FROM bank_transactions bt
  WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
) sub;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
-- Dr. Cícero - Contador Responsável
-- Data: 01/02/2026
-- Autorização: APROVADO
-- ============================================================================
