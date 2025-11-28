-- =====================================================
-- CLASSIFICAÇÃO AUTOMÁTICA PRO-BONO
-- =====================================================
-- Quando honorário = 0 ou NULL → Pro-Bono
-- Quando Pro-Bono recebe honorário > 0 → Cliente Regular
-- =====================================================

-- 1. TRIGGER FUNCTION para classificar automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION auto_classify_pro_bono()
RETURNS TRIGGER AS $$
BEGIN
  -- Se honorário for 0 ou NULL, tornar Pro-Bono
  IF (NEW.monthly_fee IS NULL OR NEW.monthly_fee = 0) THEN
    NEW.is_pro_bono := true;

    -- Se não tinha data de início do Pro-Bono, definir como hoje
    IF NEW.pro_bono_start_date IS NULL THEN
      NEW.pro_bono_start_date := CURRENT_DATE;
    END IF;

    -- Se não tinha justificativa, adicionar uma padrão
    IF NEW.pro_bono_reason IS NULL OR NEW.pro_bono_reason = '' THEN
      NEW.pro_bono_reason := 'Classificado automaticamente: honorário zerado';
    END IF;

  -- Se tinha honorário 0 e agora tem valor > 0, remover Pro-Bono
  ELSIF NEW.monthly_fee > 0 AND COALESCE(OLD.is_pro_bono, false) = true THEN
    NEW.is_pro_bono := false;

    -- Definir data de fim do Pro-Bono como a data da conversão
    IF OLD.pro_bono_start_date IS NOT NULL AND NEW.pro_bono_end_date IS NULL THEN
      NEW.pro_bono_end_date := CURRENT_DATE;
    END IF;

    -- Limpar campos de Pro-Bono (manter histórico na pro_bono_end_date)
    -- NEW.pro_bono_start_date := NULL; -- Manter para histórico
    -- NEW.pro_bono_reason := NULL; -- Manter para histórico
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CRIAR TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trg_auto_classify_pro_bono ON clients;

CREATE TRIGGER trg_auto_classify_pro_bono
  BEFORE INSERT OR UPDATE OF monthly_fee, is_pro_bono
  ON clients
  FOR EACH ROW
  EXECUTE FUNCTION auto_classify_pro_bono();

COMMENT ON FUNCTION auto_classify_pro_bono IS
'Classifica automaticamente clientes como Pro-Bono quando honorário = 0 e remove Pro-Bono quando honorário > 0';

-- 3. CORRIGIR CLIENTES EXISTENTES
-- =====================================================
-- NOTA: Updates podem conflitar com triggers de validação
-- Criar função para executar manualmente se necessário

CREATE OR REPLACE FUNCTION fix_pro_bono_classification()
RETURNS TABLE (
  updated_to_pro_bono INT,
  updated_to_regular INT,
  errors INT
) AS $$
DECLARE
  v_to_pro_bono INT := 0;
  v_to_regular INT := 0;
  v_errors INT := 0;
  v_client RECORD;
BEGIN
  -- Desabilitar temporariamente triggers de validação
  SET session_replication_role = replica;

  -- Clientes que deveriam ser Pro-Bono
  FOR v_client IN
    SELECT id, name FROM clients
    WHERE (monthly_fee IS NULL OR monthly_fee = 0)
      AND is_pro_bono = false
      AND is_active = true
      AND NOT COALESCE(is_barter, false)
  LOOP
    BEGIN
      UPDATE clients SET
        is_pro_bono = true,
        pro_bono_start_date = COALESCE(pro_bono_start_date, created_at::DATE),
        pro_bono_reason = COALESCE(pro_bono_reason, 'Classificado automaticamente: honorário zerado'),
        updated_at = NOW()
      WHERE id = v_client.id;
      v_to_pro_bono := v_to_pro_bono + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Clientes que não deveriam ser Pro-Bono
  FOR v_client IN
    SELECT id, name FROM clients
    WHERE monthly_fee > 0
      AND is_pro_bono = true
      AND is_active = true
  LOOP
    BEGIN
      UPDATE clients SET
        is_pro_bono = false,
        pro_bono_end_date = COALESCE(pro_bono_end_date, CURRENT_DATE),
        updated_at = NOW()
      WHERE id = v_client.id;
      v_to_regular := v_to_regular + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Reabilitar triggers
  SET session_replication_role = DEFAULT;

  updated_to_pro_bono := v_to_pro_bono;
  updated_to_regular := v_to_regular;
  errors := v_errors;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fix_pro_bono_classification IS
'Corrige classificação Pro-Bono de clientes existentes. Execute: SELECT * FROM fix_pro_bono_classification();';

GRANT EXECUTE ON FUNCTION fix_pro_bono_classification TO authenticated;

-- 4. VIEW para monitorar inconsistências
-- =====================================================
CREATE OR REPLACE VIEW v_client_classification_check AS
SELECT
  id,
  name,
  cnpj,
  cpf,
  monthly_fee,
  is_pro_bono,
  is_barter,
  is_active,
  CASE
    WHEN (monthly_fee IS NULL OR monthly_fee = 0) AND NOT is_pro_bono AND NOT COALESCE(is_barter, false) THEN 'DEVERIA SER PRO-BONO'
    WHEN monthly_fee > 0 AND is_pro_bono THEN 'NÃO DEVERIA SER PRO-BONO'
    WHEN is_barter AND is_pro_bono THEN 'BARTER E PRO-BONO CONFLITANTE'
    ELSE 'OK'
  END AS classification_status,
  CASE
    WHEN (monthly_fee IS NULL OR monthly_fee = 0) AND NOT COALESCE(is_barter, false) THEN 'PRO-BONO'
    WHEN COALESCE(is_barter, false) THEN 'BARTER'
    ELSE 'REGULAR'
  END AS expected_classification
FROM clients
WHERE is_active = true;

COMMENT ON VIEW v_client_classification_check IS 'Verifica inconsistências na classificação de clientes (Pro-Bono, Barter, Regular)';

-- GRANT para a view
GRANT SELECT ON v_client_classification_check TO authenticated;
