-- Verificar status das importações após limpeza
SELECT status, COUNT(*) as total
FROM bank_imports
GROUP BY status
ORDER BY status;
