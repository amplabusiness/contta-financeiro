-- Migration: Fix opening balance date for clients receivable
-- The opening balance entry should be dated 2024-12-31 (end of prior period)
-- This way it appears as "Saldo Inicial" in the ledger format (SI + D - C = SF)
-- Currently it's dated 2025-01-01 which makes it appear as January movement

BEGIN;

-- Update the opening balance entry date from 2025-01-01 to 2024-12-31
UPDATE accounting_entries
SET
    entry_date = '2024-12-31',
    competence_date = '2024-12-31',
    description = 'Saldo de Abertura - Clientes a Receber em 31/12/2024'
WHERE description = 'Saldo de Abertura - Clientes a Receber Janeiro/2025'
  AND entry_date = '2025-01-01';

-- Verify the update
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM accounting_entries
    WHERE entry_date = '2024-12-31'
      AND description LIKE 'Saldo de Abertura - Clientes a Receber%';

    IF v_count = 1 THEN
        RAISE NOTICE 'Opening balance date updated successfully to 2024-12-31';
    ELSE
        RAISE NOTICE 'Opening balance entry not found or already corrected';
    END IF;
END $$;

COMMIT;
