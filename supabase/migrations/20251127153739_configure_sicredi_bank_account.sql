-- Migration: Configure SICREDI Bank Account
-- Purpose: Add SICREDI bank account for Ampla Contabilidade
-- Date: 2025-11-27

-- Bank Code: 748 (SICREDI)
-- Agency: 3950
-- Account: 27806-8

-- Insert SICREDI bank account
INSERT INTO bank_accounts (
  bank_code,
  bank_name,
  agency,
  account_number,
  account_digit,
  account_type,
  is_active,
  balance,
  notes,
  created_at
) VALUES (
  '748',
  'SICREDI - Sistema de Crédito Cooperativo',
  '3950',
  '27806',
  '8',
  'checking',
  true,
  0.00,
  'Conta bancária principal para recebimento de honorários via boleto. Integração com extrato OFX e relatórios Excel do banco.',
  now()
)
ON CONFLICT (bank_code, agency, account_number, account_digit) 
DO UPDATE SET
  is_active = true,
  bank_name = 'SICREDI - Sistema de Crédito Cooperativo',
  notes = 'Conta bancária principal para recebimento de honorários via boleto. Integração com extrato OFX e relatórios Excel do banco.',
  updated_at = now();

-- Verify the account was created
SELECT 
  id,
  bank_code,
  bank_name,
  agency,
  account_number,
  account_digit,
  account_type,
  is_active
FROM bank_accounts
WHERE bank_code = '748' 
  AND agency = '3950' 
  AND account_number = '27806';

COMMENT ON TABLE bank_accounts IS 'Bank accounts for the accounting firm';
