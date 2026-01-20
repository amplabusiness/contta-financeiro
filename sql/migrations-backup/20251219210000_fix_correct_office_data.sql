-- =====================================================
-- CORREÇÃO DOS DADOS DO ESCRITÓRIO CONTÁBIL
-- Dados corretos da AMPLA ASSESSORIA CONTABIL LTDA
-- =====================================================

-- Limpar todos os registros antigos/incorretos
DELETE FROM accounting_office;

-- Inserir os dados corretos
INSERT INTO accounting_office (
  razao_social,
  nome_fantasia,
  cnpj,
  crc_number,
  crc_state,
  responsavel_tecnico,
  responsavel_crc,
  responsavel_cpf,
  endereco,
  numero,
  complemento,
  bairro,
  cidade,
  estado,
  cep,
  telefone,
  celular,
  email,
  website,
  is_active
) VALUES (
  'AMPLA ASSESSORIA CONTABIL LTDA',
  'Ampla Business',
  '23.893.032/0001-69',
  'CRC/GO 007640/O',
  'GO',
  'Sergio Carneiro Leão',
  'CRC/GO 007640/O',
  NULL,
  'Rua 1, Qd. 24, Lt. 08, S/N',
  'S/N',
  'Setor Maracanã',
  'Setor Maracanã',
  'Goiânia',
  'GO',
  '74.680-320',
  '(62) 3932-1365',
  NULL,
  'contato@amplabusiness.com.br',
  'www.amplabusiness.com.br',
  true
);

-- Comentário para referência
COMMENT ON TABLE accounting_office IS 'Dados do escritório contábil AMPLA ASSESSORIA CONTABIL LTDA - CNPJ 23.893.032/0001-69 - CRC/GO 007640/O';
