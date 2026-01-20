-- Migration: Add internal code system to prevent duplicates
-- Creates a unique internal_code for each accounting entry based on source data
-- Format: {source_type}:{source_id}:{date}:{amount_hash}
-- Example: bank_tx:abc123:2025-01-15:a1b2c3

BEGIN;

-- Add internal_code column to accounting_entries
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS internal_code VARCHAR(100);

-- Create unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_entries_internal_code
ON accounting_entries(internal_code)
WHERE internal_code IS NOT NULL;

-- Add source tracking columns if not exist
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS source_hash VARCHAR(64);

-- Create function to generate internal code
CREATE OR REPLACE FUNCTION generate_internal_code(
    p_source_type VARCHAR,
    p_source_id UUID,
    p_date DATE,
    p_amount NUMERIC
) RETURNS VARCHAR AS $$
DECLARE
    v_hash VARCHAR;
    v_code VARCHAR;
BEGIN
    -- Generate hash from source data
    v_hash := LEFT(MD5(CONCAT(
        COALESCE(p_source_type, 'manual'),
        ':',
        COALESCE(p_source_id::TEXT, gen_random_uuid()::TEXT),
        ':',
        p_date::TEXT,
        ':',
        p_amount::TEXT
    )), 12);

    -- Build internal code
    v_code := CONCAT(
        COALESCE(p_source_type, 'manual'),
        ':',
        TO_CHAR(p_date, 'YYYYMMDD'),
        ':',
        v_hash
    );

    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate internal_code on insert
CREATE OR REPLACE FUNCTION set_internal_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set if not already provided
    IF NEW.internal_code IS NULL THEN
        NEW.internal_code := generate_internal_code(
            COALESCE(NEW.source_type, NEW.reference_type, 'manual'),
            COALESCE(NEW.source_id, NEW.reference_id),
            NEW.entry_date,
            NEW.total_debit
        );
    END IF;

    -- Also set source tracking if using reference fields
    IF NEW.source_type IS NULL AND NEW.reference_type IS NOT NULL THEN
        NEW.source_type := NEW.reference_type;
    END IF;
    IF NEW.source_id IS NULL AND NEW.reference_id IS NOT NULL THEN
        NEW.source_id := NEW.reference_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS tr_set_internal_code ON accounting_entries;
CREATE TRIGGER tr_set_internal_code
    BEFORE INSERT ON accounting_entries
    FOR EACH ROW
    EXECUTE FUNCTION set_internal_code();

-- Update existing entries with internal_code (for January 2025)
UPDATE accounting_entries
SET internal_code = generate_internal_code(
    COALESCE(source_type, reference_type, entry_type),
    COALESCE(source_id, reference_id, id),
    entry_date,
    total_debit
),
source_type = COALESCE(source_type, reference_type, entry_type),
source_id = COALESCE(source_id, reference_id)
WHERE internal_code IS NULL
  AND entry_date >= '2025-01-01'
  AND entry_date <= '2025-01-31';

-- Add comment explaining the system
COMMENT ON COLUMN accounting_entries.internal_code IS
'Unique internal identifier for the entry. Format: {source_type}:{YYYYMMDD}:{hash}. Prevents duplicates and enables traceability.';

COMMENT ON COLUMN accounting_entries.source_type IS
'Origin type: bank_transaction, invoice, expense, manual, etc.';

COMMENT ON COLUMN accounting_entries.source_id IS
'UUID of the source record that generated this entry.';

COMMIT;
