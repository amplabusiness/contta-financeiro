-- =====================================================
-- Migration: Corrigir lançamentos errados na transitória
-- Data: 2026-01-28
-- =====================================================
-- 
-- PROBLEMA: 7 lançamentos de DESPESAS (saídas do banco) foram
-- erroneamente registrados como ENTRADAS na conta transitória.
-- Eles são na verdade pagamentos a fornecedores/sócios.
--
-- VALORES E CLASSIFICAÇÃO CORRETA:
-- R$ 35,98  - Josimar (funcionário) - reembolso compra Ampla
-- R$ 81,46  - Josimar (funcionário) - reembolso compra Ampla
-- R$ 96,00  - Luiz Alves Taveira - Água mineral escritório
-- R$ 255,80 - PIX Marketplace - Compra/Despesa
-- R$ 210,00 - Vonoria Amélia - Adiantamento sócio Sergio
-- R$ 1.302,30 - Nova Visão Imports - Adiantamento sócio Sergio
-- R$ 868,11 - Equatorial (energia) - Casa Sergio (Marista)
-- TOTAL: R$ 2.849,65
--
-- AÇÃO: Excluir os lançamentos errados da transitória
-- (já existem os lançamentos corretos nas despesas via OFX)
-- =====================================================

-- Desabilitar RLS para esta operação
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_conta_transitoria_id UUID := '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
  v_valores NUMERIC[] := ARRAY[35.98, 81.46, 96.00, 255.80, 210.00, 1302.30, 868.11];
  v_valor NUMERIC;
  v_item_id UUID;
  v_entry_id UUID;
  v_count INTEGER := 0;
  v_deleted_items INTEGER := 0;
  v_deleted_entries INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  CORREÇÃO LANÇAMENTOS ERRADOS NA TRANSITÓRIA - JAN/2025       ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Estes 7 valores são DESPESAS (saídas) que foram lançados como';
  RAISE NOTICE 'ENTRADAS na transitória. Vamos removê-los.';
  RAISE NOTICE '';

  -- Para cada valor incorreto
  FOREACH v_valor IN ARRAY v_valores LOOP
    RAISE NOTICE '─────────────────────────────────────────────────────────────────';
    RAISE NOTICE 'Procurando valor: R$ %', v_valor;
    v_count := 0;
    
    -- Buscar items na transitória com esse valor (credit > 0 = entrada errada)
    -- Tabela accounting_entry_items usa debit/credit como colunas numéricas
    FOR v_item_id, v_entry_id IN
      SELECT i.id, i.entry_id
      FROM accounting_entry_items i
      JOIN accounting_entries e ON e.id = i.entry_id
      WHERE e.tenant_id = v_tenant_id
        AND i.account_id = v_conta_transitoria_id
        AND i.credit > 0  -- Crédito = entrada errada
        AND ABS(i.credit - v_valor) < 0.01
        AND e.entry_date >= '2025-01-01'
        AND e.entry_date <= '2025-01-31'
    LOOP
      RAISE NOTICE '  Encontrado item_id: % | entry_id: %', v_item_id, v_entry_id;
      
      -- Deletar o item
      DELETE FROM accounting_entry_items WHERE id = v_item_id;
      v_deleted_items := v_deleted_items + 1;
      
      -- Verificar se o entry ficou sem items e deletar também
      IF NOT EXISTS (SELECT 1 FROM accounting_entry_items WHERE entry_id = v_entry_id) 
         AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines WHERE entry_id = v_entry_id) THEN
        DELETE FROM accounting_entries WHERE id = v_entry_id;
        v_deleted_entries := v_deleted_entries + 1;
        RAISE NOTICE '  -> Entry também deletado (ficou vazio)';
      END IF;
      
      v_count := v_count + 1;
    END LOOP;
    
    -- Se não encontrou em items, buscar em lines
    IF v_count = 0 THEN
      FOR v_entry_id IN
        SELECT DISTINCT l.entry_id
        FROM accounting_entry_lines l
        JOIN accounting_entries e ON e.id = l.entry_id
        WHERE e.tenant_id = v_tenant_id
          AND l.account_id = v_conta_transitoria_id
          AND l.credit > 0  -- Crédito na transitória = entrada errada
          AND ABS(l.credit - v_valor) < 0.01
          AND e.entry_date >= '2025-01-01'
          AND e.entry_date <= '2025-01-31'
      LOOP
        RAISE NOTICE '  Encontrado em lines, entry_id: %', v_entry_id;
        
        -- Deletar as lines
        DELETE FROM accounting_entry_lines WHERE entry_id = v_entry_id;
        v_deleted_items := v_deleted_items + 1;
        
        -- Deletar o entry se ficou vazio
        IF NOT EXISTS (SELECT 1 FROM accounting_entry_items WHERE entry_id = v_entry_id) 
           AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines WHERE entry_id = v_entry_id) THEN
          DELETE FROM accounting_entries WHERE id = v_entry_id;
          v_deleted_entries := v_deleted_entries + 1;
        END IF;
        
        v_count := v_count + 1;
      END LOOP;
    END IF;
    
    IF v_count = 0 THEN
      RAISE NOTICE '  NÃO ENCONTRADO - já foi corrigido ou não existe';
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'RESUMO:';
  RAISE NOTICE '  Items deletados: %', v_deleted_items;
  RAISE NOTICE '  Entries deletados: %', v_deleted_entries;
  RAISE NOTICE '═════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Verificar saldo final da transitória
  RAISE NOTICE 'VERIFICAÇÃO DO SALDO DA TRANSITÓRIA APÓS CORREÇÃO:';
  RAISE NOTICE '';
  
  DECLARE
    v_creditos_items NUMERIC;
    v_debitos_items NUMERIC;
    v_creditos_lines NUMERIC;
    v_debitos_lines NUMERIC;
    v_saldo NUMERIC;
  BEGIN
    -- Items (debit/credit como colunas separadas)
    SELECT COALESCE(SUM(credit), 0),
           COALESCE(SUM(debit), 0)
    INTO v_creditos_items, v_debitos_items
    FROM accounting_entry_items i
    JOIN accounting_entries e ON e.id = i.entry_id
    WHERE e.tenant_id = v_tenant_id
      AND i.account_id = v_conta_transitoria_id
      AND e.entry_date >= '2025-01-01'
      AND e.entry_date <= '2025-01-31';
    
    -- Lines  
    SELECT COALESCE(SUM(credit), 0), COALESCE(SUM(debit), 0)
    INTO v_creditos_lines, v_debitos_lines
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    WHERE e.tenant_id = v_tenant_id
      AND l.account_id = v_conta_transitoria_id
      AND e.entry_date >= '2025-01-01'
      AND e.entry_date <= '2025-01-31';
    
    v_saldo := (v_creditos_items + v_creditos_lines) - (v_debitos_items + v_debitos_lines);
    
    RAISE NOTICE '  Créditos (items): R$ %', v_creditos_items;
    RAISE NOTICE '  Débitos (items): R$ %', v_debitos_items;
    RAISE NOTICE '  Créditos (lines): R$ %', v_creditos_lines;
    RAISE NOTICE '  Débitos (lines): R$ %', v_debitos_lines;
    RAISE NOTICE '  ─────────────────────────────────';
    RAISE NOTICE '  SALDO TRANSITÓRIA: R$ %', v_saldo;
    
    IF ABS(v_saldo) < 0.01 THEN
      RAISE NOTICE '';
      RAISE NOTICE '  ✅ TRANSITÓRIA ZERADA! Conciliação OK!';
    ELSE
      RAISE NOTICE '';
      RAISE NOTICE '  ⚠️  SALDO NÃO ZERADO - Verificar outros lançamentos';
    END IF;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  DOCUMENTAÇÃO PARA DR. CÍCERO                                  ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Os seguintes pagamentos de Janeiro/2025 estavam incorretamente';
  RAISE NOTICE 'lançados na conta Transitória como recebimentos de clientes:';
  RAISE NOTICE '';
  RAISE NOTICE '┌──────────┬───────────┬────────────────────────────────────────┐';
  RAISE NOTICE '│ DATA     │ VALOR     │ DESCRIÇÃO / BENEFICIÁRIO               │';
  RAISE NOTICE '├──────────┼───────────┼────────────────────────────────────────┤';
  RAISE NOTICE '│ 23/01/25 │ R$ 35,98  │ JOSIMAR - Reembolso compra Ampla       │';
  RAISE NOTICE '│ 28/01/25 │ R$ 81,46  │ JOSIMAR - Reembolso compra Ampla       │';
  RAISE NOTICE '│ 24/01/25 │ R$ 96,00  │ LUIZ ALVES TAVEIRA - Água mineral      │';
  RAISE NOTICE '│ 28/01/25 │ R$ 255,80 │ PIX Marketplace - Compra diversa       │';
  RAISE NOTICE '│ 29/01/25 │ R$ 210,00 │ VONORIA - Adiant. Sergio C. Leão       │';
  RAISE NOTICE '│ 28/01/25 │ R$1302,30 │ NOVA VISÃO IMPORTS - Adiant. Sergio    │';
  RAISE NOTICE '│ 24/01/25 │ R$ 868,11 │ EQUATORIAL - Energia casa Sergio       │';
  RAISE NOTICE '├──────────┼───────────┼────────────────────────────────────────┤';
  RAISE NOTICE '│ TOTAL    │ R$2849,65 │ Removidos da Transitória               │';
  RAISE NOTICE '└──────────┴───────────┴────────────────────────────────────────┘';
  RAISE NOTICE '';
  RAISE NOTICE 'OBSERVAÇÕES:';
  RAISE NOTICE '• JOSIMAR é funcionário da Ampla que faz compras e é reembolsado';
  RAISE NOTICE '• LUIZ ALVES TAVEIRA fornece água mineral para o escritório';
  RAISE NOTICE '• VONORIA e NOVA VISÃO são despesas pessoais do sócio Sergio';
  RAISE NOTICE '• EQUATORIAL R$ 868,11 é a conta de energia da casa do Sergio';
  RAISE NOTICE '  (Rua 27 Setor Marista), NÃO é da sede da Ampla (Rua P-25)';
  RAISE NOTICE '';
END $$;

-- Reabilitar RLS
SET session_replication_role = 'origin';
