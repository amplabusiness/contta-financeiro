-- Corrigir duplicidade de escritórios e deixar apenas a Ampla Contabilidade ativa

-- 1. Ver todos os escritórios existentes
-- SELECT id, razao_social, nome_fantasia, cnpj, is_active FROM accounting_office;

-- 2. Desativar TODOS exceto um único registro da Ampla
UPDATE accounting_office
SET is_active = false
WHERE id NOT IN (
  SELECT id FROM accounting_office
  WHERE cnpj = '23893032000169'
  ORDER BY created_at DESC
  LIMIT 1
);

-- 3. Garantir que existe apenas um escritório ativo com CNPJ da Ampla
-- Se houver duplicatas, manter apenas a mais recente
WITH ranked_offices AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY cnpj ORDER BY created_at DESC) as rn
  FROM accounting_office
  WHERE cnpj = '23893032000169'
)
UPDATE accounting_office
SET is_active = false
WHERE id IN (
  SELECT id FROM ranked_offices WHERE rn > 1
);

-- 4. Ativar apenas o registro mais recente da Ampla
UPDATE accounting_office
SET is_active = true,
    razao_social = 'AMPLA CONTABILIDADE LTDA',
    nome_fantasia = 'AMPLA CONTABILIDADE',
    cidade = 'Goiânia',
    estado = 'GO'
WHERE cnpj = '23893032000169'
  AND id = (
    SELECT id FROM accounting_office
    WHERE cnpj = '23893032000169'
    ORDER BY created_at DESC
    LIMIT 1
  );

-- 5. Deletar escritórios sem CNPJ ou com CNPJ diferente da Ampla que estão inativos
DELETE FROM accounting_office
WHERE is_active = false
  AND (cnpj IS NULL OR cnpj != '23893032000169');

-- 6. Deletar registros duplicados da Ampla (manter apenas 1)
DELETE FROM accounting_office
WHERE cnpj = '23893032000169'
  AND id != (
    SELECT id FROM accounting_office
    WHERE cnpj = '23893032000169'
    ORDER BY created_at DESC
    LIMIT 1
  );
