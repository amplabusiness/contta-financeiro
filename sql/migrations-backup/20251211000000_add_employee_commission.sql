-- =====================================================
-- Adicionar campos de comissão do funcionário
-- Quando a Ampla recebe o honorário variável, paga uma % para o funcionário
-- Exemplo: Cliente paga 2,87%, Ampla paga 1,25% do recebido ao funcionário
-- =====================================================

-- Adicionar campos na tabela de honorários variáveis
ALTER TABLE client_variable_fees
ADD COLUMN IF NOT EXISTS employee_commission_rate DECIMAL(5,2) DEFAULT 0;

ALTER TABLE client_variable_fees
ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);

ALTER TABLE client_variable_fees
ADD COLUMN IF NOT EXISTS employee_pix_key VARCHAR(255);

ALTER TABLE client_variable_fees
ADD COLUMN IF NOT EXISTS employee_pix_type VARCHAR(20);

-- Adicionar campos de comissão na tabela de cálculos
ALTER TABLE variable_fee_calculations
ADD COLUMN IF NOT EXISTS employee_commission DECIMAL(15,2) DEFAULT 0;

ALTER TABLE variable_fee_calculations
ADD COLUMN IF NOT EXISTS employee_commission_paid BOOLEAN DEFAULT false;

ALTER TABLE variable_fee_calculations
ADD COLUMN IF NOT EXISTS employee_commission_paid_at TIMESTAMPTZ;

COMMENT ON COLUMN client_variable_fees.employee_commission_rate IS 'Taxa de comissão do funcionário sobre o honorário recebido';
COMMENT ON COLUMN client_variable_fees.employee_name IS 'Nome do funcionário que recebe a comissão';
COMMENT ON COLUMN client_variable_fees.employee_pix_key IS 'Chave PIX do funcionário para pagamento da comissão';
COMMENT ON COLUMN client_variable_fees.employee_pix_type IS 'Tipo da chave PIX (cpf, email, telefone, aleatoria)';
