-- =====================================================
-- CORREÇÃO: Data de vencimento dos honorários
-- O vencimento deve ser no MÊS SEGUINTE à competência
-- Ex: Competência 01/2025 -> Vencimento 02/2025
-- =====================================================

-- Atualizar honorários de Janeiro/2025 que estão com vencimento em Janeiro
-- O vencimento correto seria em Fevereiro/2025
UPDATE invoices
SET due_date = (due_date + INTERVAL '1 month')::date
WHERE competence = '01/2025'
  AND EXTRACT(MONTH FROM due_date) = 1  -- Vencimento em Janeiro (errado)
  AND EXTRACT(YEAR FROM due_date) = 2025
  AND status = 'pending';  -- Apenas pendentes

-- Criar função para corrigir vencimentos de qualquer competência
CREATE OR REPLACE FUNCTION fix_invoice_due_dates(p_competence TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_updated INTEGER := 0;
    v_comp_month INTEGER;
    v_comp_year INTEGER;
BEGIN
    -- Extrair mês e ano da competência (formato MM/YYYY)
    v_comp_month := CAST(SPLIT_PART(p_competence, '/', 1) AS INTEGER);
    v_comp_year := CAST(SPLIT_PART(p_competence, '/', 2) AS INTEGER);

    -- Atualizar invoices onde o vencimento está no mesmo mês da competência
    UPDATE invoices
    SET due_date = (due_date + INTERVAL '1 month')::date
    WHERE competence = p_competence
      AND EXTRACT(MONTH FROM due_date) = v_comp_month
      AND EXTRACT(YEAR FROM due_date) = v_comp_year
      AND status = 'pending';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fix_invoice_due_dates IS 'Corrige datas de vencimento de honorários para o mês seguinte à competência';
