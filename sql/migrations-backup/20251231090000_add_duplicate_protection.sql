-- Migration: Add duplicate protection and helper functions
-- Provides functions to check for duplicates before inserting

BEGIN;

-- Function to check if an entry already exists based on source
CREATE OR REPLACE FUNCTION check_entry_exists(
    p_source_type VARCHAR,
    p_source_id UUID,
    p_date DATE DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL
) RETURNS TABLE (
    exists_flag BOOLEAN,
    existing_id UUID,
    existing_code VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE,
        ae.id,
        ae.internal_code
    FROM accounting_entries ae
    WHERE (ae.source_type = p_source_type AND ae.source_id = p_source_id)
       OR (ae.reference_type = p_source_type AND ae.reference_id = p_source_id)
    LIMIT 1;

    -- If no rows returned, return false
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::VARCHAR;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to safely create entry (returns existing if duplicate)
CREATE OR REPLACE FUNCTION safe_create_entry(
    p_entry_date DATE,
    p_competence_date DATE,
    p_description VARCHAR,
    p_entry_type VARCHAR,
    p_total_debit NUMERIC,
    p_total_credit NUMERIC,
    p_source_type VARCHAR DEFAULT NULL,
    p_source_id UUID DEFAULT NULL,
    p_reference_type VARCHAR DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
) RETURNS TABLE (
    entry_id UUID,
    internal_code VARCHAR,
    is_new BOOLEAN,
    message VARCHAR
) AS $$
DECLARE
    v_existing_id UUID;
    v_existing_code VARCHAR;
    v_new_id UUID;
    v_new_code VARCHAR;
    v_source VARCHAR;
    v_source_uuid UUID;
BEGIN
    -- Determine source
    v_source := COALESCE(p_source_type, p_reference_type, p_entry_type);
    v_source_uuid := COALESCE(p_source_id, p_reference_id);

    -- Check if already exists
    SELECT ae.id, ae.internal_code INTO v_existing_id, v_existing_code
    FROM accounting_entries ae
    WHERE (v_source_uuid IS NOT NULL AND (ae.source_id = v_source_uuid OR ae.reference_id = v_source_uuid))
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Return existing entry
        RETURN QUERY SELECT v_existing_id, v_existing_code, FALSE, 'Entry already exists'::VARCHAR;
        RETURN;
    END IF;

    -- Create new entry
    INSERT INTO accounting_entries (
        entry_date,
        competence_date,
        description,
        entry_type,
        total_debit,
        total_credit,
        balanced,
        source_type,
        source_id,
        reference_type,
        reference_id
    ) VALUES (
        p_entry_date,
        p_competence_date,
        p_description,
        p_entry_type,
        p_total_debit,
        p_total_credit,
        TRUE,
        v_source,
        v_source_uuid,
        p_reference_type,
        p_reference_id
    )
    RETURNING id, accounting_entries.internal_code INTO v_new_id, v_new_code;

    RETURN QUERY SELECT v_new_id, v_new_code, TRUE, 'Entry created successfully'::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- Create view for entry tracking with source info
CREATE OR REPLACE VIEW v_accounting_entries_with_source AS
SELECT
    ae.id,
    ae.internal_code,
    ae.entry_date,
    ae.competence_date,
    ae.description,
    ae.entry_type,
    ae.total_debit,
    ae.total_credit,
    ae.source_type,
    ae.source_id,
    ae.created_at,
    -- Source details
    CASE
        WHEN ae.source_type = 'bank_transaction' THEN bt.description
        WHEN ae.source_type = 'invoice' THEN CONCAT('Fatura: ', i.competence)
        ELSE NULL
    END as source_description,
    CASE
        WHEN ae.source_type = 'bank_transaction' THEN bt.fitid
        ELSE NULL
    END as source_external_id,
    -- Count of lines
    (SELECT COUNT(*) FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id) as line_count
FROM accounting_entries ae
LEFT JOIN bank_transactions bt ON ae.source_id = bt.id AND ae.source_type = 'bank_transaction'
LEFT JOIN invoices i ON ae.source_id = i.id AND ae.source_type = 'invoice';

-- Add index for faster lookups by source
CREATE INDEX IF NOT EXISTS idx_accounting_entries_source
ON accounting_entries(source_type, source_id)
WHERE source_id IS NOT NULL;

-- Add constraint to prevent duplicate source entries
-- (commented out for now as we need to clean existing data first)
-- ALTER TABLE accounting_entries
-- ADD CONSTRAINT uq_accounting_entries_source
-- UNIQUE (source_type, source_id)
-- WHERE source_id IS NOT NULL;

COMMIT;
