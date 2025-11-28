-- =====================================================
-- ADICIONAR CAMPOS end_date E source NA TABELA minimum_wage_history
-- =====================================================
-- Para suportar sincronização automática via API do BCB
-- =====================================================

-- 1. Adicionar coluna end_date (data de fim da vigência)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'minimum_wage_history' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE minimum_wage_history
    ADD COLUMN end_date DATE;

    COMMENT ON COLUMN minimum_wage_history.end_date IS 'Data de fim da vigência (NULL = vigência atual)';
  END IF;
END $$;

-- 2. Adicionar coluna source (origem do dado)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'minimum_wage_history' AND column_name = 'source'
  ) THEN
    ALTER TABLE minimum_wage_history
    ADD COLUMN source TEXT DEFAULT 'MANUAL';

    COMMENT ON COLUMN minimum_wage_history.source IS 'Origem do dado: MANUAL, BCB_SGS_1619, IBGE';
  END IF;
END $$;

-- 3. Atualizar registros existentes com end_dates
-- =====================================================
-- Calcular end_date com base no próximo registro
WITH ordered_wages AS (
  SELECT
    id,
    effective_date,
    LEAD(effective_date) OVER (ORDER BY effective_date) AS next_date
  FROM minimum_wage_history
)
UPDATE minimum_wage_history mwh
SET end_date = ow.next_date - INTERVAL '1 day'
FROM ordered_wages ow
WHERE mwh.id = ow.id
  AND ow.next_date IS NOT NULL
  AND mwh.end_date IS NULL;

-- 4. Marcar registros existentes como MANUAL
-- =====================================================
UPDATE minimum_wage_history
SET source = 'MANUAL'
WHERE source IS NULL;

-- 5. Criar função para obter SM atual
-- =====================================================
CREATE OR REPLACE FUNCTION get_current_minimum_wage()
RETURNS TABLE (
  value NUMERIC(10,2),
  effective_date DATE,
  end_date DATE,
  source TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mwh.value,
    mwh.effective_date,
    mwh.end_date,
    mwh.source
  FROM minimum_wage_history mwh
  WHERE mwh.end_date IS NULL
     OR mwh.end_date >= CURRENT_DATE
  ORDER BY mwh.effective_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_minimum_wage IS 'Retorna o salário mínimo atual vigente';

-- 6. Criar view para histórico de SM com formatação
-- =====================================================
CREATE OR REPLACE VIEW v_minimum_wage_history AS
SELECT
  id,
  effective_date,
  end_date,
  value,
  source,
  notes,
  CASE
    WHEN end_date IS NULL THEN 'VIGENTE'
    WHEN end_date >= CURRENT_DATE THEN 'VIGENTE'
    ELSE 'ENCERRADO'
  END AS status,
  CASE
    WHEN end_date IS NULL THEN NULL
    ELSE end_date - effective_date + 1
  END AS days_in_effect,
  created_at
FROM minimum_wage_history
ORDER BY effective_date DESC;

COMMENT ON VIEW v_minimum_wage_history IS 'Histórico de salários mínimos com status de vigência';

-- 7. Grant permissões
-- =====================================================
GRANT SELECT ON v_minimum_wage_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_minimum_wage TO authenticated;
