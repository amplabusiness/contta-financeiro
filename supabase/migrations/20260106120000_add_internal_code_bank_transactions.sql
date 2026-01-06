BEGIN;

-- Garante que a coluna exista
ALTER TABLE public.bank_transactions
ADD COLUMN IF NOT EXISTS internal_code VARCHAR(100);

-- Remove completamente as funções e o trigger antigos para evitar conflitos de assinatura ou nome.
-- Isso torna a migração re-executável com segurança.
DROP TRIGGER IF EXISTS tr_set_bank_tx_internal_code ON public.bank_transactions;
DROP FUNCTION IF EXISTS public.set_bank_tx_internal_code();
DROP FUNCTION IF EXISTS public.generate_bank_tx_code(TEXT, DATE, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.generate_bank_tx_code(TEXT, DATE, NUMERIC, TEXT, UUID);


-- Recria a função de geração de código com a assinatura correta, usando UUID para garantir unicidade.
CREATE OR REPLACE FUNCTION public.generate_bank_tx_code(
    p_reference TEXT,
    p_date DATE,
    p_amount NUMERIC,
    p_description TEXT,
    p_uuid UUID
) RETURNS TEXT AS $$
DECLARE
    v_hash TEXT;
BEGIN
    -- Usamos o UUID da transação para garantir uma unicidade absoluta.
    v_hash := LEFT(MD5(CONCAT_WS('|', COALESCE(p_reference, 'ref'), p_date::TEXT, p_amount::TEXT, COALESCE(p_description, 'desc'), p_uuid::TEXT)), 8);
    RETURN CONCAT('bank_tx:', TO_CHAR(p_date, 'YYYYMMDD'), ':', v_hash);
END;
$$ LANGUAGE plpgsql;


-- Recria a função do trigger.
CREATE OR REPLACE FUNCTION public.set_bank_tx_internal_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.internal_code IS NULL THEN
        NEW.internal_code := public.generate_bank_tx_code(
            NEW.bank_reference,
            NEW.transaction_date,
            NEW.amount,
            NEW.description,
            NEW.id -- Passando o UUID da transação
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Recria o trigger que chama a função acima antes de qualquer inserção.
CREATE TRIGGER tr_set_bank_tx_internal_code
    BEFORE INSERT ON public.bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_bank_tx_internal_code();


-- Garante que o índice único exista. A criação é condicional.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_internal_code
ON public.bank_transactions(internal_code)
WHERE internal_code IS NOT NULL;


-- Backfill: Preenche o código para transações existentes que ainda não o possuem.
-- A lógica agora usa o UUID (id) da transação para garantir a unicidade.
UPDATE public.bank_transactions bt
SET internal_code = public.generate_bank_tx_code(bt.bank_reference, bt.transaction_date, bt.amount, bt.description, bt.id)
WHERE bt.internal_code IS NULL;


COMMENT ON COLUMN public.bank_transactions.internal_code IS 'Identificador interno único do extrato (bank_tx:YYYYMMDD:hash8).';

COMMIT;
