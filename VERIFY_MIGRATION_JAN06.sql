-- VERIFICAÇÃO PÓS-MIGRAÇÃO (06/JAN)
-- Execute este script no SQL Editor do Supabase para confirmar se os lançamentos foram gerados corretamente.

BEGIN;

-- 1. Contagem total de lançamentos contábeis gerados
SELECT 
    (SELECT COUNT(*) FROM accounting_entries) as total_lancamentos,
    (SELECT COUNT(*) FROM clients WHERE account_id IS NOT NULL) as clientes_com_conta_definida,
    (SELECT COUNT(*) FROM suppliers WHERE account_id IS NOT NULL) as fornecedores_com_conta_definida;

-- 2. Resumo por Tipo de Lançamento (Esperado: PROVISAO_RECEITA e PROVISAO_DESPESA)
SELECT entry_type, COUNT(*) as qtd, SUM(total_debit) as valor_total
FROM accounting_entries 
GROUP BY entry_type;

-- 3. Verificar intervalo de datas (Deve começar em Jan/2025)
SELECT MIN(entry_date) as primeira_data, MAX(entry_date) as ultima_data 
FROM accounting_entries;

-- 4. Verificar se há inconsistências (Lançamentos sem partidas ou desbalanceados)
SELECT count(*) as lancamentos_com_erro
FROM accounting_entries e
WHERE 
   (SELECT SUM(debit) FROM accounting_entry_items WHERE entry_id = e.id) != 
   (SELECT SUM(credit) FROM accounting_entry_items WHERE entry_id = e.id);

-- 5. Amostra visual dos dados (Capa + Partidas)
-- Retorna 5 linhas para inspeção visual rápida
SELECT 
  TO_CHAR(e.entry_date, 'DD/MM/YYYY') as data,
  e.entry_type,
  c.code as conta,
  c.name as nome_conta,
  i.debit as debito, 
  i.credit as credito,
  i.history
FROM accounting_entries e
JOIN accounting_entry_items i ON i.entry_id = e.id
JOIN chart_of_accounts c ON c.id = i.account_id
ORDER BY e.created_at DESC
LIMIT 10;

COMMIT;