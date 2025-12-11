-- =====================================================
-- CLASSIFICAÇÃO CONTÁBIL OBRIGATÓRIA
-- =====================================================
-- Toda transação que entra no sistema DEVE ter uma conta contábil
-- Assim como CPF, é uma identidade única e imutável
-- Não pode ficar "solto" sem classificação
-- =====================================================

-- 1. Criar conta para transações pendentes de classificação (se não existir)
-- Esta conta é temporária - transações aqui precisam ser reclassificadas

-- Conta para DÉBITOS pendentes (despesas não classificadas)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, description)
VALUES ('1.1.9.01', 'Pendente de Classificação - Débitos', 'ATIVO', 'DEVEDORA', 4, true, true,
        'Conta temporária para débitos aguardando classificação. Dr. Cícero monitora esta conta.')
ON CONFLICT (code) DO NOTHING;

-- Conta para CRÉDITOS pendentes (receitas não classificadas)
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, description)
VALUES ('2.1.9.01', 'Pendente de Classificação - Créditos', 'PASSIVO', 'CREDORA', 4, true, true,
        'Conta temporária para créditos aguardando classificação. Dr. Cícero monitora esta conta.')
ON CONFLICT (code) DO NOTHING;

-- 2. Criar função para classificar transação automaticamente na entrada
CREATE OR REPLACE FUNCTION classify_transaction_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_account_code TEXT;
  v_account_name TEXT;
  v_confidence NUMERIC;
  v_description_lower TEXT;
BEGIN
  -- Se já tem ai_suggestion, não fazer nada
  IF NEW.ai_suggestion IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Normalizar descrição para busca
  v_description_lower := LOWER(COALESCE(NEW.description, ''));
  v_confidence := 0;

  -- =====================================================
  -- REGRAS DE CLASSIFICAÇÃO AUTOMÁTICA (ordem de prioridade)
  -- =====================================================

  -- ENERGIA ELÉTRICA
  IF v_description_lower ~ '(cemig|copel|light|enel|celpe|coelba|energia|eletric)' THEN
    v_account_code := '4.1.2.02';
    v_account_name := 'Energia Elétrica';
    v_confidence := 95;

  -- ÁGUA E ESGOTO
  ELSIF v_description_lower ~ '(copasa|sabesp|cedae|saneago|embasa|agua|sanea)' THEN
    v_account_code := '4.1.2.03';
    v_account_name := 'Água e Esgoto';
    v_confidence := 95;

  -- TELECOMUNICAÇÕES
  ELSIF v_description_lower ~ '(vivo|tim|claro|oi telecom|net combo|internet|fibra|telefon)' THEN
    v_account_code := '4.1.2.04';
    v_account_name := 'Telefone e Comunicação';
    v_confidence := 92;

  -- IMPOSTOS E TAXAS
  ELSIF v_description_lower ~ '(darf|gps|inss|fgts|irrf|simples|das mei|iss|iptu|ipva|taxa)' THEN
    v_account_code := '4.1.4.01';
    v_account_name := 'Simples Nacional';
    v_confidence := 93;

  -- TARIFAS BANCÁRIAS
  ELSIF v_description_lower ~ '(tarifa|tar\.bancaria|iof|taxa.*manut|anuidade|ted|doc|pix.*taxa)' THEN
    v_account_code := '4.1.3.02';
    v_account_name := 'Tarifas Bancárias';
    v_confidence := 90;

  -- SOFTWARE E SISTEMAS
  ELSIF v_description_lower ~ '(google|microsoft|adobe|dropbox|slack|zoom|notion|aws|azure|github|dominio|alterdata)' THEN
    v_account_code := '4.1.2.12';
    v_account_name := 'Software e Sistemas';
    v_confidence := 88;

  -- HONORÁRIOS (RECEITA)
  ELSIF v_description_lower ~ '(honorario|mensalidade|contabil)' AND NEW.amount > 0 THEN
    v_account_code := '3.1.1.01';
    v_account_name := 'Honorários Contábeis';
    v_confidence := 90;

  -- SALÁRIOS
  ELSIF v_description_lower ~ '(salario|folha|pagto.*func|adiantamento.*func)' THEN
    v_account_code := '4.1.1.01';
    v_account_name := 'Salários e Ordenados';
    v_confidence := 92;

  -- MATERIAL DE LIMPEZA/ESCRITÓRIO
  ELSIF v_description_lower ~ '(kalunga|papelaria|material.*escrit|limpeza)' THEN
    v_account_code := '4.1.2.08';
    v_account_name := 'Material de Limpeza';
    v_confidence := 85;

  -- CONDOMÍNIO
  ELSIF v_description_lower ~ '(condominio|cond\.|taxa.*cond)' THEN
    v_account_code := '4.1.2.01';
    v_account_name := 'Aluguel e Condomínio';
    v_confidence := 90;

  -- ALUGUEL
  ELSIF v_description_lower ~ '(aluguel|locacao|imobil)' THEN
    v_account_code := '4.1.2.01';
    v_account_name := 'Aluguel e Condomínio';
    v_confidence := 90;

  -- SEGUROS
  ELSIF v_description_lower ~ '(seguro|porto.*seguro|sulamerica|bradesco.*seg|mapfre)' THEN
    v_account_code := '4.1.2.99';
    v_account_name := 'Outras Despesas Administrativas';
    v_confidence := 85;

  -- SE NÃO CONSEGUIU CLASSIFICAR - VAI PARA CONTA PENDENTE
  ELSE
    IF NEW.amount < 0 OR NEW.transaction_type = 'debit' THEN
      -- Débito não classificado
      v_account_code := '1.1.9.01';
      v_account_name := 'Pendente de Classificação - Débitos';
      v_confidence := 0;
    ELSE
      -- Crédito não classificado
      v_account_code := '2.1.9.01';
      v_account_name := 'Pendente de Classificação - Créditos';
      v_confidence := 0;
    END IF;
  END IF;

  -- SEMPRE atribuir classificação (nunca deixar NULL)
  IF v_confidence > 0 THEN
    NEW.ai_suggestion := 'Dr. Cícero (' || v_confidence || '%): ' || v_account_name || ' | Conta: ' || v_account_code;
  ELSE
    NEW.ai_suggestion := 'Dr. Cícero (PENDENTE): ' || v_account_name || ' | Conta: ' || v_account_code || ' | Requer reclassificação manual';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para classificar automaticamente na inserção
DROP TRIGGER IF EXISTS trg_classify_transaction_on_insert ON bank_transactions;
CREATE TRIGGER trg_classify_transaction_on_insert
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION classify_transaction_on_insert();

-- 4. Classificar todas as transações existentes que estão sem classificação
DO $$
DECLARE
  v_pending_count INTEGER;
  v_classified_count INTEGER := 0;
  v_tx RECORD;
BEGIN
  -- Contar transações sem classificação
  SELECT COUNT(*) INTO v_pending_count
  FROM bank_transactions
  WHERE ai_suggestion IS NULL;

  RAISE NOTICE '[Dr. Cícero] Encontradas % transações sem classificação. Iniciando classificação obrigatória...', v_pending_count;

  -- Classificar cada transação pendente
  FOR v_tx IN
    SELECT id, description, amount, transaction_type
    FROM bank_transactions
    WHERE ai_suggestion IS NULL
  LOOP
    -- Aplicar regras de classificação
    UPDATE bank_transactions
    SET ai_suggestion = CASE
      -- ENERGIA
      WHEN LOWER(description) ~ '(cemig|copel|light|enel|energia|eletric)' THEN
        'Dr. Cícero (95%): Energia Elétrica | Conta: 4.1.2.02'
      -- ÁGUA
      WHEN LOWER(description) ~ '(copasa|sabesp|cedae|agua|sanea)' THEN
        'Dr. Cícero (95%): Água e Esgoto | Conta: 4.1.2.03'
      -- TELECOM
      WHEN LOWER(description) ~ '(vivo|tim|claro|telecom|internet)' THEN
        'Dr. Cícero (92%): Telefone e Comunicação | Conta: 4.1.2.04'
      -- IMPOSTOS
      WHEN LOWER(description) ~ '(darf|gps|inss|fgts|simples|das|iss|iptu|ipva)' THEN
        'Dr. Cícero (93%): Impostos e Taxas | Conta: 4.1.4.01'
      -- TARIFAS
      WHEN LOWER(description) ~ '(tarifa|iof|ted|doc)' THEN
        'Dr. Cícero (90%): Tarifas Bancárias | Conta: 4.1.3.02'
      -- SOFTWARE
      WHEN LOWER(description) ~ '(google|microsoft|adobe|dropbox|github|dominio)' THEN
        'Dr. Cícero (88%): Software e Sistemas | Conta: 4.1.2.12'
      -- HONORÁRIOS
      WHEN LOWER(description) ~ '(honorario|mensalidade)' AND amount > 0 THEN
        'Dr. Cícero (90%): Honorários Contábeis | Conta: 3.1.1.01'
      -- SALÁRIOS
      WHEN LOWER(description) ~ '(salario|folha)' THEN
        'Dr. Cícero (92%): Salários e Ordenados | Conta: 4.1.1.01'
      -- PENDENTE DÉBITO
      WHEN amount < 0 OR transaction_type = 'debit' THEN
        'Dr. Cícero (PENDENTE): Pendente de Classificação - Débitos | Conta: 1.1.9.01 | Requer reclassificação manual'
      -- PENDENTE CRÉDITO
      ELSE
        'Dr. Cícero (PENDENTE): Pendente de Classificação - Créditos | Conta: 2.1.9.01 | Requer reclassificação manual'
    END
    WHERE id = v_tx.id;

    v_classified_count := v_classified_count + 1;
  END LOOP;

  RAISE NOTICE '[Dr. Cícero] ✓ % transações classificadas. Nenhuma transação ficará sem conta contábil.', v_classified_count;
END;
$$;

-- 5. Verificar se há transações sem classificação (deve ser 0)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM bank_transactions WHERE ai_suggestion IS NULL;

  IF v_count > 0 THEN
    RAISE WARNING '[Dr. Cícero] ATENÇÃO: Ainda existem % transações sem classificação!', v_count;
  ELSE
    RAISE NOTICE '[Dr. Cícero] ✓ SUCESSO: Todas as transações possuem classificação contábil.';
  END IF;
END;
$$;

-- 6. Criar índice para busca rápida de pendentes
CREATE INDEX IF NOT EXISTS idx_bank_tx_pending_classification
ON bank_transactions (ai_suggestion)
WHERE ai_suggestion LIKE '%PENDENTE%';

-- 7. Criar view para monitorar transações pendentes de reclassificação
CREATE OR REPLACE VIEW vw_pending_classification AS
SELECT
  id,
  transaction_date,
  description,
  amount,
  transaction_type,
  ai_suggestion,
  created_at
FROM bank_transactions
WHERE ai_suggestion LIKE '%PENDENTE%'
ORDER BY ABS(amount) DESC, transaction_date DESC;

COMMENT ON VIEW vw_pending_classification IS
'Transações que entraram no sistema mas não puderam ser classificadas automaticamente.
Dr. Cícero monitora esta view e alerta quando há itens pendentes.';
