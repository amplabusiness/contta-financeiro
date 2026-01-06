-- Script para popular os balance_after no banco de dados
-- Baseado nos arquivos OFX:
-- - Saldo 31/12/2024: R$ 90.725,06
-- - Saldo 31/01/2025: R$ 18.553,54
-- - Soma de amounts em janeiro: -72.171,52

-- LÓGICA: 
-- balance_after = saldo_inicial (90725.06) + SUM(amount) acumulado até essa transação

WITH all_transactions AS (
  SELECT 
    id,
    transaction_date,
    amount,
    bank_account_id,
    ROW_NUMBER() OVER (
      PARTITION BY bank_account_id 
      ORDER BY transaction_date ASC, id ASC
    ) as tx_sequence
  FROM bank_transactions
),
balance_calc AS (
  SELECT 
    id,
    transaction_date,
    amount,
    bank_account_id,
    -- Saldo inicial de 31/12/2024
    90725.06 + 
    SUM(amount) OVER (
      PARTITION BY bank_account_id
      ORDER BY transaction_date ASC, id ASC
    ) as balance_after
  FROM all_transactions
  WHERE bank_account_id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b'
)
UPDATE bank_transactions bt
SET balance_after = bc.balance_after
FROM balance_calc bc
WHERE bt.id = bc.id;

-- ===== VERIFICAÇÕES =====

-- 1. Verificar saldo final de 31/12/2024 (primeira transação tem saldo = saldo_inicial)
SELECT 
  'Saldo 31/12/2024 (primeira transação antes de 01/01)' as periodo,
  transaction_date,
  balance_after,
  amount
FROM bank_transactions
WHERE bank_account_id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b'
  AND transaction_date < '2025-01-01'
ORDER BY transaction_date DESC, id DESC
LIMIT 5;

-- 2. Saldo de 01/01/2025 (primeira transação de janeiro)
SELECT 
  'Saldo 01/01/2025 (primeira transação de janeiro)' as periodo,
  transaction_date,
  balance_after,
  amount
FROM bank_transactions
WHERE bank_account_id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b'
  AND EXTRACT(YEAR FROM transaction_date) = 2025
  AND EXTRACT(MONTH FROM transaction_date) = 1
ORDER BY transaction_date ASC, id ASC
LIMIT 1;

-- 3. Saldo de 31/01/2025 (última transação de janeiro - deve ser 18553.54)
SELECT 
  'Saldo 31/01/2025 (última transação de janeiro)' as periodo,
  transaction_date,
  balance_after,
  amount
FROM bank_transactions
WHERE bank_account_id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b'
  AND EXTRACT(YEAR FROM transaction_date) = 2025
  AND EXTRACT(MONTH FROM transaction_date) = 1
ORDER BY transaction_date DESC, id DESC
LIMIT 1;

-- 4. Resumo por mês
SELECT 
  DATE_TRUNC('month', transaction_date)::date as mes,
  COUNT(*) as total_transacoes,
  SUM(amount) as soma_amounts,
  ROUND(MIN(balance_after)::numeric, 2) as saldo_minimo,
  ROUND(MAX(balance_after)::numeric, 2) as saldo_maximo,
  ROUND(
    (SELECT balance_after 
     FROM bank_transactions bt2 
     WHERE bt2.bank_account_id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b'
       AND DATE_TRUNC('month', bt2.transaction_date)::date = DATE_TRUNC('month', bt1.transaction_date)::date
     ORDER BY bt2.transaction_date DESC, bt2.id DESC 
     LIMIT 1)::numeric, 2
  ) as saldo_final
FROM bank_transactions bt1
WHERE bank_account_id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b'
  AND transaction_date >= '2024-12-01'
GROUP BY DATE_TRUNC('month', transaction_date)
ORDER BY mes ASC;
