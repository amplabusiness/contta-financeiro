
-- 20260107000400_fix_invoices_insert_v2.sql
-- Remove description, use notes

CREATE OR REPLACE FUNCTION generate_monthly_fees(p_competence_date DATE)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    r_contract RECORD;
    v_due_date DATE;
    v_invoice_id UUID;
BEGIN
    FOR r_contract IN 
        SELECT id, client_id, monthly_fee, payment_day 
        FROM accounting_contracts 
        WHERE status = 'active'
        AND start_date <= p_competence_date
        AND (end_date IS NULL OR end_date >= p_competence_date)
    LOOP
        v_due_date := (p_competence_date + INTERVAL '1 month');
        BEGIN
            v_due_date := make_date(
                extract(year from v_due_date)::int,
                extract(month from v_due_date)::int,
                LEAST(COALESCE(r_contract.payment_day, 10), 28)
            );
        EXCEPTION WHEN OTHERS THEN
             v_due_date := (date_trunc('month', v_due_date) + interval '1 month - 1 day')::date;
        END;

        IF NOT EXISTS (
            SELECT 1 FROM invoices 
            WHERE client_id = r_contract.client_id 
            AND competence = to_char(p_competence_date, 'MM/YYYY')
        ) THEN
            INSERT INTO invoices (
                client_id,
                amount,
                due_date,
                status,
                notes,
                competence
            ) VALUES (
                r_contract.client_id,
                r_contract.monthly_fee,
                v_due_date,
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
