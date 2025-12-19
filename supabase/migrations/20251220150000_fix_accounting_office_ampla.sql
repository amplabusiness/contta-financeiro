-- =====================================================
-- CORREÇÃO DOS DADOS DO ESCRITÓRIO CONTÁBIL
-- Atualiza para os dados corretos da Ampla Contabilidade LTDA
-- CNPJ: 23.893.032/0001-69
-- =====================================================

-- Primeiro, desativar registros antigos incorretos
UPDATE accounting_office
SET is_active = false
WHERE cnpj != '23.893.032/0001-69';

-- Verificar se já existe o registro correto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounting_office
    WHERE cnpj = '23.893.032/0001-69'
  ) THEN
    -- Inserir os dados corretos da Ampla Contabilidade LTDA
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
      bairro,
      cidade,
      estado,
      cep,
      telefone,
      email,
      website,
      is_active
    ) VALUES (
      'AMPLA CONTABILIDADE LTDA',
      'Ampla Contabilidade',
      '23.893.032/0001-69',
      NULL, -- Será preenchido via API CNPJa ou manualmente
      'GO',
      'Sergio Carneiro Leão',
      NULL, -- Será preenchido manualmente
      NULL, -- Será preenchido manualmente
      NULL, -- Será preenchido via API CNPJa
      NULL,
      NULL,
      'Goiânia',
      'GO',
      NULL,
      NULL, -- Será preenchido via API CNPJa
      NULL, -- Será preenchido via API CNPJa
      NULL,
      true
    );
  ELSE
    -- Garantir que o registro correto está ativo
    UPDATE accounting_office
    SET is_active = true
    WHERE cnpj = '23.893.032/0001-69';
  END IF;
END $$;

-- Comentário para referência
COMMENT ON TABLE accounting_office IS 'Configurações do escritório contábil Ampla Contabilidade LTDA - CNPJ 23.893.032/0001-69';
