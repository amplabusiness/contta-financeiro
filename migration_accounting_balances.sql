
-- =================================================================
-- ESTRUTURA DE SALDOS FECHADOS (PARTIDAS DOBRADAS)
-- Garantia de que Saldo Final = Saldo Anterior + Entradas - Saídas
-- =================================================================

CREATE TABLE IF NOT EXISTS accounting_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    competence DATE NOT NULL, -- Ex: '2025-01-01'
    opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_debits NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_credits NUMERIC(15,2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(15,2) GENERATED ALWAYS AS (opening_balance + total_debits - total_credits) STORED,
    last_updated TIMESTAMPTZ DEFAULT now(),
    UNIQUE(account_id, competence)
);

-- Inserir o Saldo de DEZEMBRO/2024 (Base para Janeiro)
-- Conta Sicredi: 1.1.1.05 (Busque o ID correto no seu banco)
DO $$
DECLARE
    acc_id UUID;
BEGIN
    SELECT id INTO acc_id FROM chart_of_accounts WHERE code = '1.1.1.05';
    
    IF acc_id IS NOT NULL THEN
        -- Dezembro 2024 (Saldo Final 90.725,06)
        -- Como é o primeiro registro, colocamos opening + movimentos = closing
        INSERT INTO accounting_balances (account_id, competence, opening_balance, total_debits, total_credits)
        VALUES (acc_id, '2024-12-01', 90725.06, 0, 0) -- Simplificação: Saldo já vem pronto
        ON CONFLICT (account_id, competence) DO UPDATE 
        SET opening_balance = 90725.06;

        -- Janeiro 2025
        -- Saldo Inicial puxa do Final de Dezembro (Automático na lógica da aplicação, aqui hardcoded para registro)
        INSERT INTO accounting_balances (account_id, competence, opening_balance, total_debits, total_credits)
        VALUES (acc_id, '2025-01-01', 90725.06, 298527.29, 370698.81)
        ON CONFLICT (account_id, competence) DO UPDATE 
        SET opening_balance = 90725.06, total_debits = 298527.29, total_credits = 370698.81;
    END IF;
END $$;
