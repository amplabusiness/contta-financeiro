
-- 20260107000100_generate_monthly_fees.sql
-- Function to generate monthly accounting fees based on active contracts
-- Automatically handles provisioning via existing triggers

CREATE OR REPLACE FUNCTION generate_monthly_fees(p_competence_date DATE)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    r_contract RECORD;
    v_due_date DATE;
    v_invoice_id UUID;
BEGIN
    -- Loop through active contracts
    FOR r_contract IN 
        SELECT id, client_id, monthly_fee, payment_day 
        FROM accounting_contracts 
        WHERE status = 'active'
        AND start_date <= p_competence_date
        AND (end_date IS NULL OR end_date >= p_competence_date)
    LOOP
        -- Calculate Due Date (Next Month, day = payment_day, default 10)
        -- Example: Competence 2025-01-01 -> Due Date 2025-02-10
        v_due_date := (p_competence_date + INTERVAL '1 month');
        -- Adjust day
        BEGIN
            v_due_date := make_date(
                extract(year from v_due_date)::int,
                extract(month from v_due_date)::int,
                LEAST(COALESCE(r_contract.payment_day, 10), 28) -- Prevent Feb 30th errors
            );
        EXCEPTION WHEN OTHERS THEN
             -- Fallback for end of month logic if needed
             v_due_date := (date_trunc('month', v_due_date) + interval '1 month - 1 day')::date;
        END;

        -- Check duplication
        IF NOT EXISTS (
            SELECT 1 FROM invoices 
            WHERE client_id = r_contract.client_id 
            AND competence = to_char(p_competence_date, 'MM/YYYY')
            -- Check competence column type? Assuming text 'MM/YYYY' or date 'competence_date'
            -- Based on previous context, 'competence' is text but we might have added 'competence_date'
            -- Let's check schema via logic. Invoice trigger uses NEW.competence (text)
        ) THEN
            INSERT INTO invoices (
                client_id,
                amount,
                due_date,
                issue_date,
                status,
                description,
                competence -- Storing MM/YYYY text format
            ) VALUES (
                r_contract.client_id,
                r_contract.monthly_fee,
                v_due_date,
                now(),
                'pending',
                'Honorários Contábeis ' || to_char(p_competence_date, 'MM/YYYY'),
                to_char(p_competence_date, 'MM/YYYY')
            );
            
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Try to schedule with pg_cron (if available) - Runs at 2 AM on day 30
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'generate-monthly-fees',
            '0 2 30 * *', -- At 02:00 on day-of-month 30
            'SELECT generate_monthly_fees(date_trunc(''month'', now())::date)'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available or permission denied.';
END $$;
