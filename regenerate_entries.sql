
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM bank_transactions 
             WHERE transaction_date >= '2025-02-01' 
               AND transaction_date <= '2025-02-28'
               AND journal_entry_id IS NULL
    LOOP
        PERFORM create_entry_from_bank_transaction(r.id);
    END LOOP;
END $$;
