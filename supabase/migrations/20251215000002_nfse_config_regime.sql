-- =====================================================
-- ADICIONA CAMPOS DE REGIME TRIBUTÁRIO NA NFS-e CONFIG
-- =====================================================

-- Adicionar campos de regime tributário
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS regime_especial_tributacao INTEGER DEFAULT 3;
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS optante_simples_nacional BOOLEAN DEFAULT FALSE;
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS incentivo_fiscal BOOLEAN DEFAULT FALSE;

-- Atualizar configuração padrão da Ampla (Sociedade de Profissionais)
UPDATE nfse_config
SET
  regime_especial_tributacao = 3, -- 3 = Sociedade de Profissionais
  optante_simples_nacional = FALSE,
  incentivo_fiscal = FALSE
WHERE prestador_cnpj = '23893032000169';

-- Comentários
COMMENT ON COLUMN nfse_config.regime_especial_tributacao IS 'Regime: 1=Microempresa Municipal, 2=Estimativa, 3=Sociedade de Profissionais, 4=Cooperativa, 5=MEI, 6=ME EPP';
COMMENT ON COLUMN nfse_config.optante_simples_nacional IS 'Prestador é optante pelo Simples Nacional';
COMMENT ON COLUMN nfse_config.incentivo_fiscal IS 'Prestador possui incentivo fiscal';
