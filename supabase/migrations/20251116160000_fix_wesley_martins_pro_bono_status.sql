-- Fix Wesley Martins de Moura client - NOT pro-bono
-- This client has been paying invoices regularly and should not be marked as pro-bono
-- Invoices paid from Jan 2025 to Nov 2025 with values around R$ 766.88

-- Update client to remove pro-bono status
UPDATE clients
SET
  is_pro_bono = false,
  pro_bono_start_date = NULL,
  pro_bono_end_date = NULL,
  pro_bono_reason = NULL,
  monthly_fee = CASE
    WHEN monthly_fee = 0 OR monthly_fee IS NULL THEN 766.88
    ELSE monthly_fee
  END,
  updated_at = NOW()
WHERE
  (name ILIKE '%wesley%martins%moura%' OR name ILIKE '%wesley martins de moura%')
  AND (is_pro_bono = true OR monthly_fee = 0);

-- Log the update
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Fixed Wesley Martins de Moura pro-bono status. Rows affected: %', affected_count;
END $$;
