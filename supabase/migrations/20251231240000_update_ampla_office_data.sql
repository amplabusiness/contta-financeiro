-- Atualização dos dados da Ampla Contabilidade via API CNPJA
-- E limpeza dos outros escritórios para evitar confusão

-- 1. Adicionar colunas que podem não existir
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS natureza_juridica TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS regime_tributario TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS porte TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS cnae_principal TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS descricao_cnae TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS capital_social DECIMAL(15,2);
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS data_abertura DATE;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS situacao_cadastral TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE accounting_office ADD COLUMN IF NOT EXISTS estado TEXT;

-- 2. Atualizar dados da Ampla Contabilidade com informações oficiais da Receita Federal
UPDATE accounting_office
SET
  razao_social = 'AMPLA CONTABILIDADE LTDA',
  nome_fantasia = 'AMPLA CONTABILIDADE',
  cnpj = '23893032000169',
  endereco = 'Rua P25, 931',
  numero = '931',
  complemento = 'Quadra P 89, Lote 44/45, Sala 09',
  bairro = 'Setor dos Funcionários',
  cidade = 'Goiânia',
  estado = 'GO',
  cep = '74543395',
  telefone = '(62) 3233-8888',
  email = 'legalizacao@amplabusiness.com.br',
  natureza_juridica = 'Sociedade Empresária Limitada',
  regime_tributario = 'Simples Nacional',
  porte = 'Micro Empresa',
  cnae_principal = '6920-6/01',
  descricao_cnae = 'Atividades de contabilidade',
  capital_social = 5000.00,
  data_abertura = '2015-12-28',
  situacao_cadastral = 'Ativa',
  is_active = true,
  updated_at = NOW()
WHERE cnpj = '23893032000169'
   OR cnpj = '23.893.032/0001-69'
   OR UPPER(razao_social) LIKE '%AMPLA%CONTABILIDADE%';

-- 3. Desativar todos os outros escritórios (não apagar para preservar histórico)
UPDATE accounting_office
SET is_active = false
WHERE cnpj != '23893032000169'
  AND (cnpj IS NULL OR cnpj NOT LIKE '%23893032000169%');

-- 4. Se não existir a Ampla, criar
INSERT INTO accounting_office (
  razao_social,
  nome_fantasia,
  cnpj,
  endereco,
  numero,
  complemento,
  bairro,
  cidade,
  estado,
  cep,
  telefone,
  email,
  natureza_juridica,
  regime_tributario,
  porte,
  cnae_principal,
  descricao_cnae,
  capital_social,
  data_abertura,
  situacao_cadastral,
  is_active
)
SELECT
  'AMPLA CONTABILIDADE LTDA',
  'AMPLA CONTABILIDADE',
  '23893032000169',
  'Rua P25, 931',
  '931',
  'Quadra P 89, Lote 44/45, Sala 09',
  'Setor dos Funcionários',
  'Goiânia',
  'GO',
  '74543395',
  '(62) 3233-8888',
  'legalizacao@amplabusiness.com.br',
  'Sociedade Empresária Limitada',
  'Simples Nacional',
  'Micro Empresa',
  '6920-6/01',
  'Atividades de contabilidade',
  5000.00,
  '2015-12-28',
  'Ativa',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_office
  WHERE cnpj = '23893032000169'
);

-- 5. Garantir que todos os usuários tenham acesso ao escritório Ampla
INSERT INTO user_office_access (user_id, office_id, role, is_default)
SELECT
  u.id as user_id,
  ao.id as office_id,
  'admin' as role,
  true as is_default
FROM auth.users u
CROSS JOIN accounting_office ao
WHERE ao.cnpj = '23893032000169'
  AND ao.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_office_access uoa
    WHERE uoa.user_id = u.id AND uoa.office_id = ao.id
  )
ON CONFLICT (user_id, office_id) DO UPDATE
SET is_default = true;
