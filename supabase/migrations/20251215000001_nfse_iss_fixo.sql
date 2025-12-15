-- =====================================================
-- ADICIONA SUPORTE A ISS FIXO NA NFS-e
-- =====================================================

-- Adicionar campo de ISS fixo na configuração
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS iss_fixo DECIMAL(15,2) DEFAULT NULL;
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS usar_iss_fixo BOOLEAN DEFAULT TRUE;

-- Atualizar configuração padrão da Ampla com ISS fixo de R$ 70,00
UPDATE nfse_config
SET iss_fixo = 70.00, usar_iss_fixo = TRUE
WHERE prestador_cnpj = '23893032000169';

-- Comentários
COMMENT ON COLUMN nfse_config.iss_fixo IS 'Valor fixo do ISS quando usar_iss_fixo=true';
COMMENT ON COLUMN nfse_config.usar_iss_fixo IS 'Se true, usa iss_fixo. Se false, calcula pela aliquota';
