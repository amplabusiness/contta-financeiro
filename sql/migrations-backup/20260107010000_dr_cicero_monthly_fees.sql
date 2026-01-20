
-- ============================================================================
-- DR. CICERO - AUTOMATION ROUTINE
-- 🤖 Gerador de Honorários Mensais (Provisionamento)
-- ============================================================================

-- Ensure columns exist
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'standard';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;

-- FIX: Remove potentially harmful defaults on FK and drop the constraint to avoid circular dependency
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_journal_entry_id_fkey;
ALTER TABLE invoices ALTER COLUMN journal_entry_id DROP DEFAULT;
ALTER TABLE invoices ALTER COLUMN journal_entry_id DROP NOT NULL;

-- Drop first to allow return type change
DROP FUNCTION IF EXISTS public.generate_monthly_fees(DATE, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION public.generate_monthly_fees(
    p_competence_date DATE, -- Ex: '2025-01-01' para Competencia Janeiro/2025
    p_due_day INTEGER DEFAULT 10, -- Dia de vencimento no mês seguinte
    p_simulate BOOLEAN DEFAULT FALSE -- Se TRUE, só retorna o que faria sem inserir
)
RETURNS TABLE (
    client_name TEXT,
    fee_value NUMERIC,
    result_status TEXT -- Renamed from status
) AS $$
DECLARE
    r_client RECORD;
    v_due_date DATE;
    v_competence_text VARCHAR;
    v_count INTEGER := 0;
    v_sm_value NUMERIC;
BEGIN
    -- 1. Obter Salário Mínimo Vigente na Competência
    SELECT value INTO v_sm_value
    FROM minimum_wage_history
    WHERE effective_date <= p_competence_date
    ORDER BY effective_date DESC
    LIMIT 1;

    -- 1.1 Configurar datas
    -- Vencimento no mês seguinte
    v_due_date := (p_competence_date + INTERVAL '1 month')::DATE;
    -- Ajustar dia do vencimento
    v_due_date := make_date(
        EXTRACT(YEAR FROM v_due_date)::INTEGER,
        EXTRACT(MONTH FROM v_due_date)::INTEGER,
        p_due_day
    );
    
    v_competence_text := TO_CHAR(p_competence_date, 'MM/YYYY');

    -- 2. Loop por contratos válidos no período
    FOR r_client IN 
        SELECT 
            c.id as client_id,
            c.name as client_name, 
            c.fee_in_minimum_wages, -- Adicionado para cálculo dinâmico
            con.monthly_fee,
            con.id as contract_id,
            con.start_date,
            con.adjustment_index
        FROM accounting_contracts con
        JOIN clients c ON con.client_id = c.id
        WHERE 
            -- Contrato deve ter iniciado antes ou no mês da competência
            con.start_date <= (p_competence_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE
            -- Contrato não pode ter sido encerrado antes do início da competência
            AND (con.termination_date IS NULL OR con.termination_date >= p_competence_date)
            -- Apenas contratos com valor (qualquer um dos dois)
            AND (con.monthly_fee > 0 OR c.fee_in_minimum_wages > 0)
            -- Status considerados (ignora rascunhos 'draft')
            AND con.status IN ('active', 'suspended', 'terminated')
    LOOP
        -- Definir valor do honorário (Prioridade: Salário Mínimo > Valor Fixo do Contrato)
        IF r_client.fee_in_minimum_wages IS NOT NULL AND r_client.fee_in_minimum_wages > 0 AND v_sm_value IS NOT NULL THEN
            fee_value := ROUND(r_client.fee_in_minimum_wages * v_sm_value, 2);
        ELSE
            fee_value := r_client.monthly_fee;
        END IF;

        -- Verifica se já existe invoice para esta competencia e cliente
        -- (Adicionado verificação extra de contrato para evitar duplicidade se houver multiplos contratos, embora nao deva haver)
        IF EXISTS (
            SELECT 1 FROM invoices 
            WHERE client_id = r_client.client_id 
              AND competence = v_competence_text
        ) THEN
            client_name := r_client.client_name;
            fee_value := r_client.monthly_fee;
            result_status := 'SKIPPED (Already Exists)';
            RETURN NEXT;
            CONTINUE;
        END IF;

        IF p_simulate THEN
            client_name := r_client.client_name;
            -- fee_value já calculado acima
            result_status := 'SIMULATED (Would Create)';
            RETURN NEXT;
        ELSE
            -- 3. Criar Invoice
            IF fee_value IS NOT NULL AND fee_value > 0 THEN
                INSERT INTO invoices (
                    client_id,
                    amount,
                    due_date,
                    competence,
                    description,
                    status,
                    type
                ) VALUES (
                    r_client.client_id,
                    fee_value, -- Usando valor calculado
                    v_due_date,
                    v_competence_text,
                    'Honorários Mensais - ' || v_competence_text || ' (Contrato ' || TO_CHAR(r_client.start_date, 'DD/MM/YYYY') || ')',
                    'pending',
                    'honorario_mensal'
                );
                
                client_name := r_client.client_name;
                -- fee_value definido acima
                result_status := 'CREATED';
                RETURN NEXT;
            END IF;
        END IF;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
