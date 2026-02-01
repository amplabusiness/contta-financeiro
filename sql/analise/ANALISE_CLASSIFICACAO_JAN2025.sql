-- ============================================================================
-- CORREÇÃO: Gerar lançamentos de classificação retroativos - Jan/2025
-- ============================================================================
-- Data: 01/02/2026
-- Autor: Dr. Cícero - Contador Responsável
--
-- ATENÇÃO: Este script gera lançamentos de classificação para transações
--          que foram importadas via OFX mas nunca foram classificadas.
--          
--          Isso zerará as contas transitórias do período.
-- ============================================================================

-- PARTE 1: DIAGNÓSTICO DETALHADO
-- ============================================================================

-- 1.1 Transações com lançamentos que movimentaram transitórias
WITH transacoes_ofx AS (
  SELECT 
    bt.id,
    bt.transaction_date,
    bt.amount,
    bt.description,
    ae.id as entry_id,
    ae.source_type,
    CASE 
      WHEN bt.amount > 0 THEN 'ENTRADA'  -- Crédito no banco → vai para 2.1.9.01
      ELSE 'SAIDA'                        -- Débito no banco → vai para 1.1.9.01
    END as tipo
  FROM bank_transactions bt
  JOIN accounting_entries ae ON ae.id = bt.journal_entry_id
  WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
)
SELECT 
  tipo,
  source_type,
  COUNT(*) as qtd,
  SUM(ABS(amount)) as valor_total
FROM transacoes_ofx
GROUP BY tipo, source_type
ORDER BY tipo, source_type;

-- 1.2 Verificar se há transações SEM lançamento (órfãs)
SELECT 
  'Transações sem lançamento' as tipo,
  COUNT(*) as qtd
FROM bank_transactions bt
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND bt.journal_entry_id IS NULL;

-- PARTE 2: ANÁLISE POR CATEGORIA
-- ============================================================================

-- 2.1 Agrupar por padrões de descrição para classificação em lote
SELECT 
  CASE 
    WHEN description ILIKE '%TARIFA%' THEN 'TARIFA_BANCARIA'
    WHEN description ILIKE '%PIX%' AND amount > 0 THEN 'PIX_RECEBIDO'
    WHEN description ILIKE '%PIX%' AND amount < 0 THEN 'PIX_ENVIADO'
    WHEN description ILIKE '%TED%' AND amount > 0 THEN 'TED_RECEBIDO'
    WHEN description ILIKE '%TED%' AND amount < 0 THEN 'TED_ENVIADO'
    WHEN description ILIKE '%BOLETO%' AND amount > 0 THEN 'BOLETO_RECEBIDO'
    WHEN description ILIKE '%TITULO%' AND amount > 0 THEN 'TITULO_RECEBIDO'
    WHEN amount > 0 THEN 'OUTROS_CREDITOS'
    ELSE 'OUTROS_DEBITOS'
  END as categoria,
  COUNT(*) as qtd,
  SUM(amount) as valor_liquido,
  SUM(ABS(amount)) as valor_absoluto
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY 1
ORDER BY ABS(SUM(amount)) DESC;

-- PARTE 3: OPÇÕES DE CORREÇÃO
-- ============================================================================

/*
OPÇÃO A: Classificação individualizada (recomendada para auditoria)
-----------------------------------------------------------------
Criar um lançamento de classificação para CADA transação OFX.
Vantagem: Rastreabilidade total
Desvantagem: Volume alto de lançamentos

OPÇÃO B: Classificação por lote (mais prática)
-----------------------------------------------------------------
Agrupar transações similares e criar um lançamento consolidado.
Vantagem: Menos lançamentos
Desvantagem: Perde detalhamento

OPÇÃO C: Ajuste de saldo (emergencial - NÃO recomendada)
-----------------------------------------------------------------
Criar um único lançamento de ajuste para zerar as transitórias.
Vantagem: Rápido
Desvantagem: Perde toda rastreabilidade
*/

-- PARTE 4: PROPOSTA DE CLASSIFICAÇÃO (para aprovação do Dr. Cícero)
-- ============================================================================

-- Esta é uma PROPOSTA. Não executa automaticamente.
-- O Dr. Cícero deve revisar e aprovar cada classificação.

/*

-- ENTRADAS (valores a classificar: R$ 418.535,32)
-- Maioria são recebimentos de clientes (PIX, TED, boleto)

-- Lançamento de classificação para ENTRADAS:
D - 2.1.9.01 Transitória Créditos    R$ 418.535,32
C - 1.1.2.01.xxx Clientes a Receber  R$ XXX.XXX,XX  (baixa de duplicatas)
C - 3.1.1.01 Receita de Honorários   R$ XXX.XXX,XX  (receitas diretas)


-- SAÍDAS (valores a classificar: R$ 99.252,15)
-- Pagamentos de despesas, fornecedores, impostos

-- Lançamento de classificação para SAÍDAS:
D - 4.x.x.xx Despesas diversas       R$ XXX.XXX,XX
D - 2.1.1.xx Fornecedores a Pagar    R$ XXX.XXX,XX
C - 1.1.9.01 Transitória Débitos     R$ 99.252,15

*/

-- PARTE 5: QUERY PARA GERAR CSV DE ANÁLISE
-- ============================================================================

-- Exportar para análise detalhada (executar no Supabase e baixar CSV)
SELECT 
  bt.id,
  bt.transaction_date,
  bt.amount,
  bt.description,
  ae.source_type,
  ae.internal_code,
  CASE WHEN bt.amount > 0 THEN '2.1.9.01' ELSE '1.1.9.01' END as transitoria_usada,
  CASE 
    WHEN bt.description ILIKE '%TARIFA%' THEN '4.2.1.01 - Despesas Bancárias'
    WHEN bt.description ILIKE '%IOF%' THEN '4.2.1.02 - IOF'
    WHEN bt.description ILIKE '%PIX%' AND bt.amount > 0 THEN 'ANALISAR - Receita ou Cliente?'
    WHEN bt.description ILIKE '%PIX%' AND bt.amount < 0 THEN 'ANALISAR - Despesa ou Fornecedor?'
    ELSE 'CLASSIFICAÇÃO MANUAL'
  END as sugestao_classificacao
FROM bank_transactions bt
LEFT JOIN accounting_entries ae ON ae.id = bt.journal_entry_id
WHERE bt.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND bt.transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY bt.transaction_date, bt.amount;
