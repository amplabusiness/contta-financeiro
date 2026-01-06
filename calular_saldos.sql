-- Descobrir os saldos de 31/12/2024 e 01/01/2025
-- Saldo final 31/01/2025 = R$ 18.553,54 (do arquivo OFX)

-- CÁLCULO:
-- Saldo final 31/01 = R$ 18.553,54
-- Soma de todos os amounts em janeiro = ?
-- Saldo 31/12/2024 = Saldo 31/01 - Soma de amounts de janeiro

WITH january_totals AS (
  SELECT 
    COALESCE(SUM(amount), 0) as soma_janeiro,
    COUNT(*) as total_transacoes
  FROM bank_transactions
  WHERE bank_account_id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b'
    AND EXTRACT(YEAR FROM transaction_date) = 2025
    AND EXTRACT(MONTH FROM transaction_date) = 1
)
SELECT 
  'Saldo 31/12/2024 (Saldo Anterior)' as descricao,
  (18553.54 - soma_janeiro) as saldo,
  'R$ ' || TO_CHAR((18553.54 - soma_janeiro), '999999.99') as saldo_formatado,
  soma_janeiro,
  18553.54 as saldo_final_janeiro,
  total_transacoes as transacoes_janeiro
FROM january_totals

UNION ALL

SELECT 
  'Saldo 01/01/2025 (Saldo Inicial) = Saldo 31/12/2024',
  (18553.54 - soma_janeiro),
  'R$ ' || TO_CHAR((18553.54 - soma_janeiro), '999999.99'),
  soma_janeiro,
  18553.54,
  total_transacoes
FROM january_totals

UNION ALL

SELECT 
  'Saldo 31/01/2025 (Saldo Final)',
  18553.54,
  'R$ ' || TO_CHAR(18553.54, '999999.99'),
  soma_janeiro,
  18553.54,
  total_transacoes
FROM january_totals;
