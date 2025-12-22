-- =====================================================
-- SALDO DE ABERTURA - JANEIRO 2025
-- =====================================================
-- Cálculo do saldo de abertura:
-- Saldo Final Jan/2025 (extrato OFX): R$ 18.553,54
-- Soma transações Jan/2025: -R$ 72.171,50
-- Saldo Inicial (31/12/2024): R$ 90.725,10
--
-- IMPORTANTE: Janeiro/2025 é o mês de abertura do sistema
-- As receitas de Janeiro são pagamentos de honorários de
-- competências anteriores (Dezembro/2024 ou antes)
-- =====================================================

-- Atualizar saldo de abertura na conta Sicredi
UPDATE bank_accounts
SET initial_balance = 90725.10,
    initial_balance_date = '2024-12-31'
WHERE id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b';

-- =====================================================
-- Adicionar coluna para marcar transações como saldo de abertura
-- =====================================================
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS is_opening_balance BOOLEAN DEFAULT false;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS opening_balance_note TEXT;

COMMENT ON COLUMN bank_transactions.is_opening_balance IS 'Indica se a transação faz parte do saldo de abertura (competência anterior)';
COMMENT ON COLUMN bank_transactions.opening_balance_note IS 'Nota explicativa sobre a origem da transação de saldo de abertura';

-- =====================================================
-- Marcar todas as RECEITAS de Janeiro/2025 como saldo de abertura
-- São pagamentos de honorários de competências anteriores
-- =====================================================
UPDATE bank_transactions
SET is_opening_balance = true,
    opening_balance_note = 'Pagamento recebido em Jan/2025 referente a honorários de competência anterior (Dez/2024 ou antes)'
WHERE transaction_date >= '2025-01-01'
  AND transaction_date <= '2025-01-31'
  AND transaction_type = 'credit';

-- =====================================================
-- Criar view para saldo por período
-- =====================================================
CREATE OR REPLACE VIEW v_bank_balance_by_period AS
SELECT
    ba.id AS bank_account_id,
    ba.name AS account_name,
    EXTRACT(YEAR FROM bt.transaction_date) AS year,
    EXTRACT(MONTH FROM bt.transaction_date) AS month,

    -- Créditos do período (excluindo saldo de abertura)
    SUM(CASE WHEN bt.transaction_type = 'credit' AND NOT COALESCE(bt.is_opening_balance, false)
        THEN ABS(bt.amount) ELSE 0 END) AS credits,

    -- Créditos de saldo de abertura
    SUM(CASE WHEN bt.transaction_type = 'credit' AND COALESCE(bt.is_opening_balance, false)
        THEN ABS(bt.amount) ELSE 0 END) AS opening_balance_credits,

    -- Débitos do período
    SUM(CASE WHEN bt.transaction_type = 'debit' THEN ABS(bt.amount) ELSE 0 END) AS debits,

    -- Total de transações
    COUNT(*) AS transaction_count
FROM bank_accounts ba
LEFT JOIN bank_transactions bt ON bt.bank_account_id = ba.id
WHERE bt.transaction_date IS NOT NULL
GROUP BY ba.id, ba.name, EXTRACT(YEAR FROM bt.transaction_date), EXTRACT(MONTH FROM bt.transaction_date)
ORDER BY year, month;

COMMENT ON VIEW v_bank_balance_by_period IS 'Resumo de movimentação bancária por período, separando saldo de abertura';

-- =====================================================
-- Criar função para calcular saldo em uma data específica
-- =====================================================
CREATE OR REPLACE FUNCTION get_bank_balance_at_date(
    p_bank_account_id UUID,
    p_date DATE
) RETURNS DECIMAL AS $$
DECLARE
    v_initial_balance DECIMAL;
    v_initial_date DATE;
    v_credits DECIMAL;
    v_debits DECIMAL;
BEGIN
    -- Buscar saldo inicial e data
    SELECT COALESCE(initial_balance, 0), initial_balance_date
    INTO v_initial_balance, v_initial_date
    FROM bank_accounts
    WHERE id = p_bank_account_id;

    -- Se a data solicitada é anterior ao saldo inicial, retornar NULL
    IF p_date < v_initial_date THEN
        RETURN NULL;
    END IF;

    -- Somar créditos até a data (incluindo a data)
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_credits
    FROM bank_transactions
    WHERE bank_account_id = p_bank_account_id
      AND transaction_date <= p_date
      AND transaction_type = 'credit';

    -- Somar débitos até a data
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_debits
    FROM bank_transactions
    WHERE bank_account_id = p_bank_account_id
      AND transaction_date <= p_date
      AND transaction_type = 'debit';

    -- Retornar saldo: inicial + créditos - débitos
    RETURN v_initial_balance + v_credits - v_debits;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_bank_balance_at_date IS 'Calcula o saldo bancário em uma data específica';

-- =====================================================
-- Verificar: Saldo em 31/01/2025 deve ser R$ 18.553,54
-- =====================================================
-- SELECT get_bank_balance_at_date('5e4054e1-b9e2-454e-94eb-71cffbbbfd2b', '2025-01-31');
