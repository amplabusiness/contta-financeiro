-- =====================================================
-- CONFIGURAÇÕES DO ESCRITÓRIO CONTÁBIL
-- Dados usados em contratos, propostas e documentos oficiais
-- =====================================================

-- Tabela para armazenar dados do escritório contábil
CREATE TABLE IF NOT EXISTS accounting_office (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados principais
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,

  -- Registro profissional
  crc_number TEXT, -- Ex: CRC/GO 007640/O
  crc_state TEXT, -- Ex: GO

  -- Responsável técnico
  responsavel_tecnico TEXT, -- Nome do contador responsável
  responsavel_crc TEXT, -- Ex: CRC/GO 024.270/O-5
  responsavel_cpf TEXT,

  -- Endereço
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,

  -- Contato
  telefone TEXT,
  celular TEXT,
  email TEXT,
  website TEXT,

  -- Dados bancários (para recebimento de honorários)
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT, -- corrente, poupanca
  pix_key TEXT,

  -- Metadados
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE accounting_office ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accounting_office" ON accounting_office
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert accounting_office" ON accounting_office
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update accounting_office" ON accounting_office
  FOR UPDATE TO authenticated USING (true);

-- Inserir dados da Ampla
INSERT INTO accounting_office (
  razao_social,
  nome_fantasia,
  cnpj,
  crc_number,
  crc_state,
  responsavel_tecnico,
  responsavel_crc,
  endereco,
  numero,
  bairro,
  cidade,
  estado,
  cep,
  telefone,
  email,
  website
) VALUES (
  'AMPLA ASSESSORIA CONTABIL LTDA',
  'Ampla Business',
  '21.565.040/0001-07',
  '007640/O',
  'GO',
  'Sergio Carneiro Leão',
  'CRC/GO 008074',
  'Rua 1, Qd. 24, Lt. 08',
  'S/N',
  'Setor Maracanã',
  'Goiânia',
  'GO',
  '74.680-320',
  '(62) 3932-1365',
  'contato@amplabusiness.com.br',
  'www.amplabusiness.com.br'
) ON CONFLICT DO NOTHING;

-- Função para buscar dados do escritório (singleton pattern)
CREATE OR REPLACE FUNCTION get_accounting_office()
RETURNS accounting_office AS $$
  SELECT * FROM accounting_office WHERE is_active = true LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE accounting_office IS 'Configurações do escritório contábil para uso em contratos e documentos oficiais';
COMMENT ON FUNCTION get_accounting_office IS 'Retorna os dados do escritório contábil ativo';
