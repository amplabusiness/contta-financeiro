-- =====================================================
-- CORREÇÃO DOS DADOS DO ESCRITÓRIO CONTÁBIL
-- =====================================================

-- Atualizar dados corretos da Ampla Contabilidade
UPDATE accounting_office
SET
  razao_social = 'AMPLA CONTABILIDADE LTDA',
  nome_fantasia = 'Ampla Contabilidade',
  cnpj = '23893032000169',
  crc_number = '007640/O',
  crc_state = 'GO',
  responsavel_tecnico = 'Sérgio Carneiro Leão',
  responsavel_crc = 'CRC/GO 008074',
  cidade = 'Goiânia',
  estado = 'GO',
  updated_at = now()
WHERE cnpj = '21.565.040/0001-07' OR cnpj = '21565040000107';

-- Se não encontrou para atualizar, inserir
INSERT INTO accounting_office (
  razao_social,
  nome_fantasia,
  cnpj,
  crc_number,
  crc_state,
  responsavel_tecnico,
  responsavel_crc,
  cidade,
  estado,
  is_active
)
SELECT
  'AMPLA CONTABILIDADE LTDA',
  'Ampla Contabilidade',
  '23893032000169',
  '007640/O',
  'GO',
  'Sérgio Carneiro Leão',
  'CRC/GO 008074',
  'Goiânia',
  'GO',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_office WHERE cnpj = '23893032000169'
);

-- Garantir que pelo menos o escritório Ampla existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounting_office WHERE is_active = true) THEN
    INSERT INTO accounting_office (
      razao_social,
      nome_fantasia,
      cnpj,
      cidade,
      estado,
      is_active
    ) VALUES (
      'AMPLA CONTABILIDADE LTDA',
      'Ampla Contabilidade',
      '23893032000169',
      'Goiânia',
      'GO',
      true
    );
  END IF;
END
$$;
