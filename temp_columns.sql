SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'accounting_entry_lines'
ORDER BY ordinal_position;
