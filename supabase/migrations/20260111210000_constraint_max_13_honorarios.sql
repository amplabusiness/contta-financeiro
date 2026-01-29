-- ============================================================================
-- TIPOS DE HONORÁRIOS E VALIDAÇÕES
-- ============================================================================
-- Tipos de honorários:
--   - monthly (mensal): Limite de 12 por ano (competências 01-12)
--   - thirteenth (13º): Limite de 1 por ano (competência 13)
--   - legalization (legalização): Sem limite
--   - amendment (alteração contratual): Sem limite
--   - extra (serviços extras): Sem limite
--   - other (outros): Sem limite
-- ============================================================================

-- 1. Adicionar campo fee_type se não existir
ALTER TABLE client_opening_balance
  ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20) DEFAULT 'monthly';

COMMENT ON COLUMN client_opening_balance.fee_type IS
  'Tipo do honorário: monthly, thirteenth, legalization, amendment, extra, other';

-- 2. Atualizar registros existentes baseado em is_thirteenth_fee e competência
UPDATE client_opening_balance
SET fee_type = CASE
  WHEN is_thirteenth_fee = true THEN 'thirteenth'
  WHEN SUBSTRING(competence FROM 1 FOR 2) = '13' THEN 'thirteenth'
  ELSE 'monthly'
END
WHERE fee_type IS NULL OR fee_type = 'monthly';

-- 3. Função para validar honorários mensais (12 por ano + 1 décimo terceiro)
CREATE OR REPLACE FUNCTION fn_validar_honorarios_mensais()
RETURNS TRIGGER AS $$
DECLARE
  v_ano VARCHAR(4);
  v_mes VARCHAR(2);
  v_count_monthly INTEGER;
  v_count_thirteenth INTEGER;
BEGIN
  -- Só validar honorários do tipo monthly ou thirteenth
  IF NEW.fee_type NOT IN ('monthly', 'thirteenth') THEN
    RETURN NEW;
  END IF;

  -- Extrair ano e mês da competência
  v_ano := SUBSTRING(NEW.competence FROM 4 FOR 4);
  v_mes := SUBSTRING(NEW.competence FROM 1 FOR 2);

  -- Validar formato da competência
  IF NOT NEW.competence ~ '^\d{2}/\d{4}$' THEN
    RAISE EXCEPTION 'Competência inválida: %. Formato esperado: MM/YYYY', NEW.competence;
  END IF;

  -- Para honorários mensais (monthly): mês deve ser 01-12
  IF NEW.fee_type = 'monthly' THEN
    IF NOT v_mes ~ '^(0[1-9]|1[0-2])$' THEN
      RAISE EXCEPTION 'Honorário mensal deve ter competência de 01 a 12. Recebido: %', v_mes;
    END IF;

    -- Verificar limite de 12 mensais por ano
    SELECT COUNT(*) INTO v_count_monthly
    FROM client_opening_balance
    WHERE client_id = NEW.client_id
      AND SUBSTRING(competence FROM 4 FOR 4) = v_ano
      AND fee_type = 'monthly'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_count_monthly >= 12 THEN
      RAISE EXCEPTION 'Limite de 12 honorários mensais por ano atingido (ano: %)', v_ano;
    END IF;
  END IF;

  -- Para 13º salário (thirteenth): mês deve ser 13
  IF NEW.fee_type = 'thirteenth' THEN
    IF v_mes != '13' THEN
      RAISE EXCEPTION '13º honorário deve ter competência 13/YYYY. Recebido: %', NEW.competence;
    END IF;

    -- Verificar limite de 1 décimo terceiro por ano
    SELECT COUNT(*) INTO v_count_thirteenth
    FROM client_opening_balance
    WHERE client_id = NEW.client_id
      AND SUBSTRING(competence FROM 4 FOR 4) = v_ano
      AND fee_type = 'thirteenth'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_count_thirteenth >= 1 THEN
      RAISE EXCEPTION 'Já existe 13º honorário para o ano %', v_ano;
    END IF;
  END IF;

  -- Verificar duplicata de competência para o mesmo tipo
  IF EXISTS (
    SELECT 1 FROM client_opening_balance
    WHERE client_id = NEW.client_id
      AND competence = NEW.competence
      AND fee_type = NEW.fee_type
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Já existe honorário (%) para competência % neste cliente', NEW.fee_type, NEW.competence;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_validar_honorarios_mensais() IS
  'Valida limite de honorários: 12 mensais + 1 décimo terceiro por ano. Outros tipos (legalização, alteração, etc.) não têm limite.';

-- 4. Criar trigger para validação
DROP TRIGGER IF EXISTS trg_validar_honorarios ON client_opening_balance;
CREATE TRIGGER trg_validar_honorarios
  BEFORE INSERT OR UPDATE ON client_opening_balance
  FOR EACH ROW
  EXECUTE FUNCTION fn_validar_honorarios_mensais();

-- 5. Índices para otimização
CREATE INDEX IF NOT EXISTS idx_opening_balance_fee_type
  ON client_opening_balance(fee_type);

CREATE INDEX IF NOT EXISTS idx_opening_balance_client_year_type
  ON client_opening_balance(client_id, fee_type, (SUBSTRING(competence FROM 4 FOR 4)));

-- 6. View para verificar honorários por cliente
CREATE OR REPLACE VIEW v_honorarios_por_cliente_ano AS
SELECT
  c.id as client_id,
  c.name as client_name,
  SUBSTRING(cob.competence FROM 4 FOR 4) as ano,
  COUNT(*) FILTER (WHERE cob.fee_type = 'monthly') as honorarios_mensais,
  COUNT(*) FILTER (WHERE cob.fee_type = 'thirteenth') as decimo_terceiro,
  COUNT(*) FILTER (WHERE cob.fee_type NOT IN ('monthly', 'thirteenth')) as outros_honorarios,
  SUM(cob.amount) as total_valor,
  SUM(CASE WHEN cob.status = 'pending' THEN cob.amount ELSE 0 END) as valor_pendente
FROM clients c
LEFT JOIN client_opening_balance cob ON c.id = cob.client_id
WHERE cob.id IS NOT NULL
GROUP BY c.id, c.name, SUBSTRING(cob.competence FROM 4 FOR 4)
ORDER BY c.name, ano;

COMMENT ON VIEW v_honorarios_por_cliente_ano IS
  'Resumo de honorários por cliente e ano, separando mensais, 13º e outros';

-- ============================================================================
-- TIPOS DE HONORÁRIOS ACEITOS:
-- ============================================================================
--
-- | Tipo         | Limite    | Competência | Descrição                    |
-- |--------------|-----------|-------------|------------------------------|
-- | monthly      | 12/ano    | 01-12       | Honorário mensal contábil    |
-- | thirteenth   | 1/ano     | 13          | 13º honorário                |
-- | legalization | Sem limite| Qualquer    | Abertura/legalização         |
-- | amendment    | Sem limite| Qualquer    | Alteração contratual         |
-- | extra        | Sem limite| Qualquer    | Serviços extras              |
-- | other        | Sem limite| Qualquer    | Outros serviços              |
--
-- ============================================================================
