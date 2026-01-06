SELECT id, import_date, status, total_transactions, new_transactions, duplicated_transactions 
FROM bank_imports 
WHERE status = 'processing' 
ORDER BY import_date DESC;
