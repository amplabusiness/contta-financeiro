-- =====================================================
-- FIX: Corrigir função validate_due_date que usava campo 'description' inexistente
-- A tabela invoices não possui o campo 'description', causando erro no trigger
-- =====================================================

-- Atualizar a função para não usar NEW.description
-- Em vez disso, usamos NEW.competence ou apenas NEW.id
CREATE OR REPLACE FUNCTION validate_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.due_date < CURRENT_DATE THEN
    -- Avisar mas permitir (pode ser importação de dados históricos)
    RAISE WARNING 'Due date % is in the past for invoice %', NEW.due_date, COALESCE(NEW.competence, NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger para garantir que usa a função atualizada
DROP TRIGGER IF EXISTS validate_invoice_due_date ON invoices;
CREATE TRIGGER validate_invoice_due_date
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_due_date();
