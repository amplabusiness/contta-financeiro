-- Adicionar campos completos da API BrasilAPI na tabela clients
ALTER TABLE clients
ADD COLUMN razao_social TEXT,
ADD COLUMN nome_fantasia TEXT,
ADD COLUMN porte TEXT,
ADD COLUMN natureza_juridica TEXT,
ADD COLUMN situacao_cadastral TEXT,
ADD COLUMN data_abertura DATE,
ADD COLUMN capital_social NUMERIC,
ADD COLUMN logradouro TEXT,
ADD COLUMN numero TEXT,
ADD COLUMN complemento TEXT,
ADD COLUMN bairro TEXT,
ADD COLUMN municipio TEXT,
ADD COLUMN uf TEXT,
ADD COLUMN cep TEXT,
ADD COLUMN atividade_principal JSONB,
ADD COLUMN atividades_secundarias JSONB,
ADD COLUMN qsa JSONB;

-- Comentários para documentação
COMMENT ON COLUMN clients.razao_social IS 'Razão social da empresa';
COMMENT ON COLUMN clients.nome_fantasia IS 'Nome fantasia da empresa';
COMMENT ON COLUMN clients.porte IS 'Porte da empresa (MEI, ME, EPP, etc)';
COMMENT ON COLUMN clients.natureza_juridica IS 'Natureza jurídica da empresa';
COMMENT ON COLUMN clients.situacao_cadastral IS 'Situação cadastral na Receita Federal';
COMMENT ON COLUMN clients.data_abertura IS 'Data de abertura/início das atividades';
COMMENT ON COLUMN clients.capital_social IS 'Capital social da empresa';
COMMENT ON COLUMN clients.atividade_principal IS 'CNAE principal da empresa';
COMMENT ON COLUMN clients.atividades_secundarias IS 'CNAEs secundários da empresa';
COMMENT ON COLUMN clients.qsa IS 'Quadro de sócios e administradores';