-- Migration: Registrar conta Cora Bank na tabela bank_accounts
-- Cora é o banco 403 (ISPB 37880206) usado pela Ampla Contabilidade

-- Inserir conta Cora apenas se não existir
INSERT INTO bank_accounts (
  bank_code,
  bank_name,
  agency,
  account_number,
  account_type,
  is_active,
  is_default
)
SELECT
  '403',
  'Cora (Banco 403)',
  '0001',
  '',          -- preencher com o número da conta Cora
  'checking',
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts WHERE bank_code = '403'
);

-- Comentário: após inserir, atualizar o account_number com o número real da conta
-- UPDATE bank_accounts SET account_number = 'NUMERO_DA_CONTA' WHERE bank_code = '403';
