-- =====================================================
-- CORREÇÃO: Saldo bancário
-- O saldo deve bater com o extrato OFX importado
-- Último extrato: Nov/2025 = R$ 54.849,25
-- =====================================================

-- Adicionar coluna de saldo de abertura se não existir
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS initial_balance_date DATE;

COMMENT ON COLUMN bank_accounts.initial_balance IS 'Saldo inicial/abertura da conta';
COMMENT ON COLUMN bank_accounts.initial_balance_date IS 'Data do saldo inicial';

-- Atualizar o saldo atual para o valor do último extrato (Nov/2025)
-- Conta Sicredi: 5e4054e1-b9e2-454e-94eb-71cffbbbfd2b
UPDATE bank_accounts
SET current_balance = 54849.25
WHERE id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b';

-- Definir saldo inicial como o do primeiro extrato (Jan/2025)
-- Para calcular o saldo inicial de Dez/2024, precisamos:
-- Saldo final Jan/2025 = 18553.54
-- Saldo inicial Dez/2024 = Saldo inicial + (créditos - débitos de Jan/2025)
-- Como temos apenas o extrato de Jan/2025, vamos usar como base

-- Por ora, definir o saldo de abertura como 0 (será ajustado manualmente)
UPDATE bank_accounts
SET initial_balance = 0,
    initial_balance_date = '2024-12-31'
WHERE id = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b';

-- =====================================================
-- FUNÇÃO: Recalcular saldo baseado nas transações
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_bank_balance(p_bank_account_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_initial_balance DECIMAL;
    v_credits DECIMAL;
    v_debits DECIMAL;
    v_calculated_balance DECIMAL;
BEGIN
    -- Buscar saldo inicial
    SELECT COALESCE(initial_balance, 0) INTO v_initial_balance
    FROM bank_accounts WHERE id = p_bank_account_id;

    -- Somar créditos (valores positivos)
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_credits
    FROM bank_transactions
    WHERE bank_account_id = p_bank_account_id
      AND transaction_type = 'credit';

    -- Somar débitos (valores positivos)
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_debits
    FROM bank_transactions
    WHERE bank_account_id = p_bank_account_id
      AND transaction_type = 'debit';

    -- Calcular saldo: inicial + créditos - débitos
    v_calculated_balance := v_initial_balance + v_credits - v_debits;

    RETURN v_calculated_balance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_bank_balance IS 'Recalcula o saldo bancário baseado no saldo inicial + transações';

-- =====================================================
-- CORREÇÃO: Valores negativos em transações
-- Os valores devem ser sempre positivos, tipo determina o sinal
-- =====================================================

-- Corrigir transações com valores negativos
UPDATE bank_transactions
SET amount = ABS(amount)
WHERE amount < 0;

-- =====================================================
-- TRIGGER: Atualizar saldo ao inserir/atualizar transações
-- =====================================================
CREATE OR REPLACE FUNCTION update_bank_balance_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_old_amount DECIMAL := 0;
    v_new_amount DECIMAL := 0;
    v_balance_change DECIMAL := 0;
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Reverter a transação deletada
        IF OLD.transaction_type = 'credit' THEN
            v_balance_change := -ABS(OLD.amount);
        ELSE
            v_balance_change := ABS(OLD.amount);
        END IF;

        UPDATE bank_accounts
        SET current_balance = current_balance + v_balance_change
        WHERE id = OLD.bank_account_id;

        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Aplicar nova transação
        IF NEW.transaction_type = 'credit' THEN
            v_balance_change := ABS(NEW.amount);
        ELSE
            v_balance_change := -ABS(NEW.amount);
        END IF;

        UPDATE bank_accounts
        SET current_balance = current_balance + v_balance_change
        WHERE id = NEW.bank_account_id;

        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Reverter antiga e aplicar nova se mudou
        IF OLD.bank_account_id = NEW.bank_account_id THEN
            -- Mesma conta, calcular diferença
            IF OLD.transaction_type = 'credit' THEN
                v_old_amount := ABS(OLD.amount);
            ELSE
                v_old_amount := -ABS(OLD.amount);
            END IF;

            IF NEW.transaction_type = 'credit' THEN
                v_new_amount := ABS(NEW.amount);
            ELSE
                v_new_amount := -ABS(NEW.amount);
            END IF;

            v_balance_change := v_new_amount - v_old_amount;

            UPDATE bank_accounts
            SET current_balance = current_balance + v_balance_change
            WHERE id = NEW.bank_account_id;
        ELSE
            -- Mudou de conta, reverter na antiga e aplicar na nova
            IF OLD.transaction_type = 'credit' THEN
                UPDATE bank_accounts SET current_balance = current_balance - ABS(OLD.amount) WHERE id = OLD.bank_account_id;
            ELSE
                UPDATE bank_accounts SET current_balance = current_balance + ABS(OLD.amount) WHERE id = OLD.bank_account_id;
            END IF;

            IF NEW.transaction_type = 'credit' THEN
                UPDATE bank_accounts SET current_balance = current_balance + ABS(NEW.amount) WHERE id = NEW.bank_account_id;
            ELSE
                UPDATE bank_accounts SET current_balance = current_balance - ABS(NEW.amount) WHERE id = NEW.bank_account_id;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_update_bank_balance ON bank_transactions;

-- Nota: O trigger está comentado para não recalcular automaticamente
-- já que o saldo foi definido manualmente do extrato
-- Descomente abaixo quando quiser que o sistema calcule automaticamente
/*
CREATE TRIGGER trigger_update_bank_balance
    AFTER INSERT OR UPDATE OR DELETE ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_balance_on_transaction();
*/

COMMENT ON FUNCTION update_bank_balance_on_transaction IS 'Atualiza saldo da conta bancária quando transações são inseridas/atualizadas/deletadas';
