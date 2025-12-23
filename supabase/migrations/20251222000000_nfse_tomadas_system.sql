-- ============================================================================
-- NFS-e Tomadas (Serviços Recebidos) - Integração com Contas a Pagar
-- ============================================================================

-- Tabela para armazenar NFS-e de serviços tomados (despesas)
CREATE TABLE IF NOT EXISTS nfse_tomadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação da nota
  numero_nfse TEXT NOT NULL,
  codigo_verificacao TEXT,
  data_emissao DATE,
  competencia TEXT,

  -- Prestador (quem emitiu a nota - fornecedor)
  prestador_cnpj TEXT NOT NULL,
  prestador_cpf TEXT,
  prestador_razao_social TEXT,
  prestador_inscricao_municipal TEXT,
  prestador_endereco TEXT,
  prestador_municipio TEXT,
  prestador_uf TEXT,

  -- Tomador (nós - Ampla)
  tomador_cnpj TEXT NOT NULL,
  tomador_razao_social TEXT,

  -- Valores
  valor_servicos NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_deducoes NUMERIC(15,2) DEFAULT 0,
  valor_pis NUMERIC(15,2) DEFAULT 0,
  valor_cofins NUMERIC(15,2) DEFAULT 0,
  valor_inss NUMERIC(15,2) DEFAULT 0,
  valor_ir NUMERIC(15,2) DEFAULT 0,
  valor_csll NUMERIC(15,2) DEFAULT 0,
  valor_iss NUMERIC(15,2) DEFAULT 0,
  outras_retencoes NUMERIC(15,2) DEFAULT 0,
  aliquota NUMERIC(6,4) DEFAULT 0,
  valor_liquido NUMERIC(15,2) DEFAULT 0,

  -- Serviço
  discriminacao TEXT,
  item_lista_servico TEXT,
  codigo_cnae TEXT,
  codigo_municipio TEXT,

  -- XML
  xml_nfse TEXT,

  -- Status e integração
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'lancada', 'ignorada', 'erro')),
  conta_pagar_id UUID REFERENCES accounts_payable(id),
  supplier_id UUID REFERENCES suppliers(id),

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraint única para evitar duplicatas
  CONSTRAINT nfse_tomadas_unique UNIQUE (numero_nfse, prestador_cnpj)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nfse_tomadas_prestador ON nfse_tomadas(prestador_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfse_tomadas_tomador ON nfse_tomadas(tomador_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfse_tomadas_data ON nfse_tomadas(data_emissao);
CREATE INDEX IF NOT EXISTS idx_nfse_tomadas_status ON nfse_tomadas(status);
CREATE INDEX IF NOT EXISTS idx_nfse_tomadas_conta_pagar ON nfse_tomadas(conta_pagar_id);

-- Adicionar coluna na accounts_payable para referência à NFS-e tomada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts_payable' AND column_name = 'nfse_tomada_id'
  ) THEN
    ALTER TABLE accounts_payable ADD COLUMN nfse_tomada_id UUID REFERENCES nfse_tomadas(id);
  END IF;
END $$;

-- Adicionar colunas de cancelamento na tabela nfse
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nfse' AND column_name = 'data_cancelamento'
  ) THEN
    ALTER TABLE nfse ADD COLUMN data_cancelamento TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nfse' AND column_name = 'motivo_cancelamento'
  ) THEN
    ALTER TABLE nfse ADD COLUMN motivo_cancelamento TEXT;
  END IF;
END $$;

-- RLS
ALTER TABLE nfse_tomadas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS "nfse_tomadas_select" ON nfse_tomadas;
CREATE POLICY "nfse_tomadas_select" ON nfse_tomadas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "nfse_tomadas_insert" ON nfse_tomadas;
CREATE POLICY "nfse_tomadas_insert" ON nfse_tomadas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "nfse_tomadas_update" ON nfse_tomadas;
CREATE POLICY "nfse_tomadas_update" ON nfse_tomadas
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "nfse_tomadas_delete" ON nfse_tomadas;
CREATE POLICY "nfse_tomadas_delete" ON nfse_tomadas
  FOR DELETE TO authenticated USING (true);

-- Service role full access
DROP POLICY IF EXISTS "nfse_tomadas_service" ON nfse_tomadas;
CREATE POLICY "nfse_tomadas_service" ON nfse_tomadas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_nfse_tomadas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nfse_tomadas_updated_at ON nfse_tomadas;
CREATE TRIGGER trigger_nfse_tomadas_updated_at
  BEFORE UPDATE ON nfse_tomadas
  FOR EACH ROW
  EXECUTE FUNCTION update_nfse_tomadas_updated_at();

-- View para relatório de NFS-e tomadas com fornecedor
CREATE OR REPLACE VIEW vw_nfse_tomadas_detalhada AS
SELECT
  nt.*,
  s.name AS supplier_name,
  s.email AS supplier_email,
  ap.due_date AS conta_pagar_vencimento,
  ap.status AS conta_pagar_status,
  ap.amount AS conta_pagar_valor
FROM nfse_tomadas nt
LEFT JOIN suppliers s ON nt.supplier_id = s.id
LEFT JOIN accounts_payable ap ON nt.conta_pagar_id = ap.id;

-- Função para importar NFS-e tomadas e criar contas a pagar automaticamente
CREATE OR REPLACE FUNCTION fn_processar_nfse_tomada(
  p_nfse_tomada_id UUID,
  p_criar_conta_pagar BOOLEAN DEFAULT TRUE,
  p_dias_vencimento INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
  v_nfse_tomada RECORD;
  v_supplier_id UUID;
  v_conta_pagar_id UUID;
  v_vencimento DATE;
BEGIN
  -- Buscar NFS-e tomada
  SELECT * INTO v_nfse_tomada FROM nfse_tomadas WHERE id = p_nfse_tomada_id;

  IF v_nfse_tomada IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NFS-e tomada não encontrada');
  END IF;

  IF v_nfse_tomada.status != 'pendente' THEN
    RETURN json_build_object('success', false, 'error', 'NFS-e já processada');
  END IF;

  -- Buscar ou criar fornecedor
  SELECT id INTO v_supplier_id FROM suppliers
  WHERE cnpj = v_nfse_tomada.prestador_cnpj
  LIMIT 1;

  IF v_supplier_id IS NULL THEN
    INSERT INTO suppliers (name, cnpj, status)
    VALUES (
      COALESCE(v_nfse_tomada.prestador_razao_social, 'Fornecedor ' || v_nfse_tomada.prestador_cnpj),
      v_nfse_tomada.prestador_cnpj,
      'active'
    )
    RETURNING id INTO v_supplier_id;
  END IF;

  -- Atualizar referência do fornecedor
  UPDATE nfse_tomadas SET supplier_id = v_supplier_id WHERE id = p_nfse_tomada_id;

  -- Criar conta a pagar se solicitado
  IF p_criar_conta_pagar THEN
    v_vencimento := COALESCE(v_nfse_tomada.data_emissao, CURRENT_DATE) + p_dias_vencimento;

    INSERT INTO accounts_payable (
      supplier_id,
      description,
      amount,
      due_date,
      status,
      document_number,
      nfse_tomada_id
    ) VALUES (
      v_supplier_id,
      'NFS-e ' || v_nfse_tomada.numero_nfse || ' - ' || LEFT(COALESCE(v_nfse_tomada.discriminacao, 'Serviço'), 100),
      COALESCE(v_nfse_tomada.valor_liquido, v_nfse_tomada.valor_servicos),
      v_vencimento,
      'pending',
      'NFSE-' || v_nfse_tomada.numero_nfse,
      p_nfse_tomada_id
    )
    RETURNING id INTO v_conta_pagar_id;

    -- Atualizar NFS-e com referência
    UPDATE nfse_tomadas
    SET
      conta_pagar_id = v_conta_pagar_id,
      status = 'lancada'
    WHERE id = p_nfse_tomada_id;
  ELSE
    UPDATE nfse_tomadas SET status = 'ignorada' WHERE id = p_nfse_tomada_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'nfse_tomada_id', p_nfse_tomada_id,
    'supplier_id', v_supplier_id,
    'conta_pagar_id', v_conta_pagar_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para função
GRANT EXECUTE ON FUNCTION fn_processar_nfse_tomada TO authenticated;
GRANT EXECUTE ON FUNCTION fn_processar_nfse_tomada TO service_role;

COMMENT ON TABLE nfse_tomadas IS 'NFS-e de serviços tomados (recebidas) para lançamento em contas a pagar';
COMMENT ON FUNCTION fn_processar_nfse_tomada IS 'Processa uma NFS-e tomada, criando fornecedor e conta a pagar automaticamente';
