-- =====================================================
-- RETENÇÕES NA NFS-e - AMPLA É SIMPLES NACIONAL
-- =====================================================

-- REGRAS IMPORTANTES:
-- 1. A AMPLA é optante pelo SIMPLES NACIONAL
-- 2. Empresas do Simples Nacional NÃO sofrem retenção de PIS/COFINS/CSLL
-- 3. O IR pode ou não ser retido dependendo do serviço e legislação
-- 4. Nas notas da Ampla, não haverá retenção de tributos federais

-- Adicionar campos de controle na tabela de clientes (para referência futura)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS regime_tributario VARCHAR(20) DEFAULT 'lucro_presumido';

-- Comentários explicativos
COMMENT ON COLUMN clients.regime_tributario IS 'Regime tributário do cliente: simples_nacional, lucro_presumido, lucro_real, mei';

-- Atualizar configuração da Ampla para indicar que é Simples Nacional
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS optante_simples_nacional BOOLEAN DEFAULT TRUE;
ALTER TABLE nfse_config ADD COLUMN IF NOT EXISTS regime_tributario VARCHAR(20) DEFAULT 'simples_nacional';

-- Atualizar a configuração da Ampla
UPDATE nfse_config
SET optante_simples_nacional = TRUE, regime_tributario = 'simples_nacional'
WHERE prestador_cnpj = '23893032000169';

-- Como a Ampla é Simples Nacional:
-- - valor_pis = 0
-- - valor_cofins = 0
-- - valor_csll = 0
-- - valor_ir = 0
-- - valor_inss = 0 (se não tiver funcionário na nota)
-- - outras_retencoes = 0

-- A tributação do Simples Nacional é feita pelo DAS mensal, não por nota

COMMENT ON TABLE nfse_config IS 'Configuração do prestador para emissão de NFS-e. Ampla é optante do Simples Nacional.';
