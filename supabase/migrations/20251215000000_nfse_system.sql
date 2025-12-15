-- =====================================================
-- SISTEMA DE NFS-e (Nota Fiscal de Serviços Eletrônica)
-- Integração com webservice ABRASF 2.04
-- =====================================================

-- Tabela principal de NFS-e
CREATE TABLE IF NOT EXISTS nfse (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação da nota
    numero_nfse VARCHAR(20),
    codigo_verificacao VARCHAR(50),
    numero_rps VARCHAR(20) NOT NULL,
    serie_rps VARCHAR(10) DEFAULT 'A',
    tipo_rps INTEGER DEFAULT 1,

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'authorized', 'cancelled', 'error')),

    -- Protocolo do lote
    numero_lote VARCHAR(20),
    protocolo VARCHAR(100),

    -- Datas
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    competencia DATE NOT NULL,
    data_autorizacao TIMESTAMPTZ,
    data_cancelamento TIMESTAMPTZ,

    -- Prestador
    prestador_cnpj VARCHAR(14) NOT NULL,
    prestador_inscricao_municipal VARCHAR(20),
    prestador_razao_social VARCHAR(200),

    -- Tomador (cliente)
    tomador_cnpj VARCHAR(14),
    tomador_cpf VARCHAR(11),
    tomador_razao_social VARCHAR(200) NOT NULL,
    tomador_email VARCHAR(200),
    tomador_endereco VARCHAR(200),
    tomador_numero VARCHAR(20),
    tomador_complemento VARCHAR(100),
    tomador_bairro VARCHAR(100),
    tomador_cidade VARCHAR(100),
    tomador_uf VARCHAR(2),
    tomador_cep VARCHAR(8),
    tomador_codigo_municipio VARCHAR(7),

    -- Serviço
    item_lista_servico VARCHAR(10) DEFAULT '1701',
    codigo_cnae VARCHAR(10) DEFAULT '6920601',
    discriminacao TEXT NOT NULL,
    codigo_municipio VARCHAR(7) DEFAULT '5208707',
    municipio_incidencia VARCHAR(7) DEFAULT '5208707',
    exigibilidade_iss INTEGER DEFAULT 1,

    -- Valores
    valor_servicos DECIMAL(15,2) NOT NULL,
    valor_deducoes DECIMAL(15,2) DEFAULT 0,
    valor_pis DECIMAL(15,2) DEFAULT 0,
    valor_cofins DECIMAL(15,2) DEFAULT 0,
    valor_inss DECIMAL(15,2) DEFAULT 0,
    valor_ir DECIMAL(15,2) DEFAULT 0,
    valor_csll DECIMAL(15,2) DEFAULT 0,
    outras_retencoes DECIMAL(15,2) DEFAULT 0,
    valor_iss DECIMAL(15,2) DEFAULT 0,
    aliquota DECIMAL(5,4) DEFAULT 0.02,
    desconto_incondicionado DECIMAL(15,2) DEFAULT 0,
    desconto_condicionado DECIMAL(15,2) DEFAULT 0,
    valor_liquido DECIMAL(15,2),
    iss_retido BOOLEAN DEFAULT FALSE,

    -- Opções
    optante_simples_nacional BOOLEAN DEFAULT FALSE,
    incentivo_fiscal BOOLEAN DEFAULT FALSE,

    -- Vínculo com honorário
    invoice_id UUID REFERENCES invoices(id),
    client_id UUID REFERENCES clients(id),

    -- XML
    xml_rps TEXT,
    xml_nfse TEXT,
    xml_cancelamento TEXT,

    -- Mensagens de erro
    codigo_erro VARCHAR(10),
    mensagem_erro TEXT,

    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    cancelled_by UUID REFERENCES auth.users(id),
    motivo_cancelamento TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_nfse_status ON nfse(status);
CREATE INDEX IF NOT EXISTS idx_nfse_prestador ON nfse(prestador_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfse_tomador ON nfse(tomador_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfse_invoice ON nfse(invoice_id);
CREATE INDEX IF NOT EXISTS idx_nfse_client ON nfse(client_id);
CREATE INDEX IF NOT EXISTS idx_nfse_competencia ON nfse(competencia);
CREATE INDEX IF NOT EXISTS idx_nfse_numero ON nfse(numero_nfse);
CREATE INDEX IF NOT EXISTS idx_nfse_protocolo ON nfse(protocolo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_nfse_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nfse_updated_at ON nfse;
CREATE TRIGGER trg_nfse_updated_at
    BEFORE UPDATE ON nfse
    FOR EACH ROW
    EXECUTE FUNCTION update_nfse_updated_at();

-- Tabela de configuração do prestador
CREATE TABLE IF NOT EXISTS nfse_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ambiente
    ambiente VARCHAR(20) DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),

    -- URLs do webservice
    base_url_homologacao VARCHAR(500) DEFAULT 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204',
    base_url_producao VARCHAR(500),
    endpoint VARCHAR(100) DEFAULT 'nfse.asmx',

    -- Prestador
    prestador_cnpj VARCHAR(14) NOT NULL,
    prestador_razao_social VARCHAR(200),
    prestador_inscricao_municipal VARCHAR(20),

    -- Certificado (nome do arquivo, não a senha!)
    certificado_arquivo VARCHAR(200),

    -- Configurações padrão
    serie_rps_padrao VARCHAR(10) DEFAULT 'A',
    item_lista_servico_padrao VARCHAR(10) DEFAULT '1701',
    codigo_cnae_padrao VARCHAR(10) DEFAULT '6920601',
    aliquota_padrao DECIMAL(5,4) DEFAULT 0.02,
    descricao_servico_padrao TEXT DEFAULT 'Serviços contábeis mensais',

    -- Último número de RPS usado
    ultimo_numero_rps INTEGER DEFAULT 0,

    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração padrão da Ampla
INSERT INTO nfse_config (
    prestador_cnpj,
    prestador_razao_social,
    prestador_inscricao_municipal,
    certificado_arquivo,
    descricao_servico_padrao
) VALUES (
    '23893032000169',
    'AMPLA CONTABILIDADE LTDA',
    '6241034',
    'ampla.pfx',
    'Serviços contábeis e assessoria fiscal conforme contrato'
) ON CONFLICT DO NOTHING;

-- Tabela de log de comunicação com webservice
CREATE TABLE IF NOT EXISTS nfse_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nfse_id UUID REFERENCES nfse(id),

    operacao VARCHAR(50) NOT NULL, -- 'enviar_lote', 'consultar_lote', 'consultar_nfse', 'cancelar'

    -- Request
    request_xml TEXT,
    request_timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- Response
    response_xml TEXT,
    response_timestamp TIMESTAMPTZ,

    -- Resultado
    sucesso BOOLEAN,
    codigo_retorno VARCHAR(10),
    mensagem_retorno TEXT,
    protocolo VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfse_log_nfse ON nfse_log(nfse_id);
CREATE INDEX IF NOT EXISTS idx_nfse_log_operacao ON nfse_log(operacao);

-- Função para gerar próximo número de RPS
CREATE OR REPLACE FUNCTION proximo_numero_rps(p_prestador_cnpj VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_numero INTEGER;
BEGIN
    UPDATE nfse_config
    SET ultimo_numero_rps = ultimo_numero_rps + 1
    WHERE prestador_cnpj = p_prestador_cnpj
    RETURNING ultimo_numero_rps INTO v_numero;

    IF v_numero IS NULL THEN
        -- Se não encontrou config, buscar máximo da tabela nfse
        SELECT COALESCE(MAX(numero_rps::INTEGER), 0) + 1 INTO v_numero
        FROM nfse
        WHERE prestador_cnpj = p_prestador_cnpj;
    END IF;

    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE nfse IS 'Notas Fiscais de Serviço Eletrônicas emitidas';
COMMENT ON TABLE nfse_config IS 'Configuração do prestador para emissão de NFS-e';
COMMENT ON TABLE nfse_log IS 'Log de comunicação com webservice NFS-e';
COMMENT ON COLUMN nfse.status IS 'pending=aguardando envio, processing=enviado aguardando retorno, authorized=autorizada, cancelled=cancelada, error=erro';
