-- ============================================================================
-- PHASE 10: SMART CONCILIATION (AI-LITE)
-- 🧠 Aprendizado de Máquina para Classificação Contábil
-- ============================================================================

-- 0. Adicionar coluna de classificação na Transação Bancária
-- Se ainda não existe, criamos para permitir o link direto
ALTER TABLE public.bank_transactions 
ADD COLUMN IF NOT EXISTS chart_account_id UUID REFERENCES public.chart_of_accounts(id);

-- 1. Tabela de Habilidade Aprendida (Knowledge Base)
-- Armazena padrões textuais e a conta contábil associada
CREATE TABLE IF NOT EXISTS classification_learning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL, -- Palavra chave ou descrição exata. Ex: "CEMIG", "UBER"
    chart_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    confidence_score INTEGER DEFAULT 1, -- Quantas vezes foi confirmado
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(keyword, chart_account_id) -- Evitar duplicatas do mesmo par
);

-- Indice para busca rápida textual
CREATE INDEX IF NOT EXISTS idx_classification_keyword ON classification_learning(keyword);

-- 2. Função de Aprendizado (Learning Trigger)
-- Dispara quando um humano classifica uma transação bancária manualmente
CREATE OR REPLACE FUNCTION public.fn_learn_from_classification()
RETURNS TRIGGER AS $$
DECLARE
    clean_desc TEXT;
BEGIN
    -- Só aprende se:
    -- 1. A conta contábil foi definida (não era nula e agora é, ou mudou)
    -- 2. A transação não é antiga demais (opcional, aqui aceitamos tudo)
    -- 3. Trigger disparado por UPDATE
    
    IF NEW.chart_account_id IS NOT NULL AND (OLD.chart_account_id IS NULL OR OLD.chart_account_id <> NEW.chart_account_id) THEN
        
        -- Limpeza básica da descrição para virar padrão
        -- Pega a descrição, remove espaços extras e converte para maiúsculo
        clean_desc := TRIM(UPPER(NEW.description));
        
        -- Regra simplificada V1: Aprende a descrição EXATA.
        -- Futuro: Extrair apenas as 2-3 primeiras palavras.
        
        IF length(clean_desc) > 3 THEN
            INSERT INTO classification_learning (keyword, chart_account_id, confidence_score)
            VALUES (clean_desc, NEW.chart_account_id, 1)
            ON CONFLICT (keyword, chart_account_id) 
            DO UPDATE SET 
                confidence_score = classification_learning.confidence_score + 1,
                last_used_at = NOW();
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger de Aprendizado
DROP TRIGGER IF EXISTS tr_learn_classification ON bank_transactions;
CREATE TRIGGER tr_learn_classification
    AFTER UPDATE OF chart_account_id
    ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION fn_learn_from_classification();


-- 3. Função de Aplicação (Prediction Trigger)
-- Dispara quando uma nova transação bancária entra (Importação/Webhook)
CREATE OR REPLACE FUNCTION public.fn_predict_classification()
RETURNS TRIGGER AS $$
DECLARE
    match_record RECORD;
BEGIN
    -- Só tenta prever se ainda não tem classificação
    IF NEW.chart_account_id IS NULL THEN
        
        -- Tenta encontrar a melhor correspondência
        -- Ordena por score de confiança (mais usados primeiro)
        -- Estratégia: ILIKE para encontrar se a KEYWORD aprendida está contida na NOVA DESCRIÇÃO
        -- Ex: Pattern "UBER" (aprendido) dá match em "UBER DO BRASIL VIAGENS" (nova)
        
        SELECT chart_account_id 
        INTO match_record
        FROM classification_learning
        WHERE NEW.description ILIKE '%' || keyword || '%'
        ORDER BY confidence_score DESC, length(keyword) DESC
        LIMIT 1;

        -- Se achou, aplica
        IF FOUND THEN
            NEW.chart_account_id := match_record.chart_account_id;
            -- Podemos marcar algo como "auto_classified = true" se tiver coluna pra isso
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger de Predição
DROP TRIGGER IF EXISTS tr_predict_classification ON bank_transactions;
CREATE TRIGGER tr_predict_classification
    BEFORE INSERT
    ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION fn_predict_classification();

-- 4. Permissões
GRANT ALL ON classification_learning TO authenticated;
GRANT ALL ON classification_learning TO service_role;
