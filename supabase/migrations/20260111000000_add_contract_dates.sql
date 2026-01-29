-- Migration: Adicionar campos de data de contrato na tabela clients
-- Data: 2026-01-11
-- Autor: Dr. Cicero (IA) + Ampla Contabilidade

-- Adicionar campo de data de inicio do contrato com a Ampla
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_start_date DATE;

-- Adicionar campo de data de fim do contrato com a Ampla (quando cliente encerra)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- Adicionar campo de motivo de inativacao
ALTER TABLE clients ADD COLUMN IF NOT EXISTS inactivation_reason TEXT;

-- Comentarios nos campos
COMMENT ON COLUMN clients.contract_start_date IS 'Data de inicio do contrato com a Ampla Contabilidade';
COMMENT ON COLUMN clients.contract_end_date IS 'Data de fim do contrato com a Ampla (quando cliente encerra)';
COMMENT ON COLUMN clients.inactivation_reason IS 'Motivo da inativacao do cliente';

-- Criar indice para consultas por status e datas
CREATE INDEX IF NOT EXISTS idx_clients_contract_dates ON clients(contract_start_date, contract_end_date);
CREATE INDEX IF NOT EXISTS idx_clients_status_active ON clients(status, is_active);

-- Inicializar contract_start_date com opening_balance_date onde existir
UPDATE clients
SET contract_start_date = opening_balance_date::date
WHERE contract_start_date IS NULL
  AND opening_balance_date IS NOT NULL;

-- Para clientes sem opening_balance_date, usar created_at
UPDATE clients
SET contract_start_date = created_at::date
WHERE contract_start_date IS NULL;
