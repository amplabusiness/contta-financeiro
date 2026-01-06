-- Resetar status 'matched' para transactions de Fevereiro 2025
-- para que apareçam na lista de "Pendentes" e possam ser auditadas.

UPDATE public.bank_transactions
SET matched = FALSE
WHERE transaction_date >= '2025-02-01'
  AND transaction_date <= '2025-02-28';
