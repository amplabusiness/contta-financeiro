-- ============================================================================
-- SISTEMA DE REPRESENTANTES/COMISSIONADOS - VICTOR HUGO E NAYARA CRISTINA
-- Dr. Cícero - NBC TG 26 (R3)
-- Criado em: 09/01/2026
-- 
-- NOTA: Tabela "partners" já existe para sócios de empresas clientes
--       Usando "commission_agents" para evitar conflito
-- ============================================================================

-- 1. TABELA DE AGENTES COMISSIONADOS (representantes que recebem comissões)
CREATE TABLE IF NOT EXISTS commission_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  pix_key VARCHAR(100),
  pix_key_type VARCHAR(20) DEFAULT 'cpf', -- cpf, cnpj, email, phone, random
  email VARCHAR(200),
  phone VARCHAR(20),
  bank_name VARCHAR(100),
  bank_agency VARCHAR(20),
  bank_account VARCHAR(30),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE VÍNCULO CLIENTE-AGENTE (qual agente recebe de qual cliente)
CREATE TABLE IF NOT EXISTS client_commission_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES commission_agents(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  is_active BOOLEAN DEFAULT true,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id, agent_id)
);

-- 3. TABELA DE COMISSÕES/REPASSES
CREATE TABLE IF NOT EXISTS agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES commission_agents(id),
  client_id UUID REFERENCES clients(id),
  
  -- Referência ao pagamento original
  source_type VARCHAR(50) NOT NULL, -- 'bank_transaction', 'invoice', 'manual'
  source_id UUID,
  source_description TEXT,
  
  -- Valores
  client_payment_amount DECIMAL(15,2) NOT NULL,
  agent_percentage DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(15,2) NOT NULL,
  
  -- Competência
  competence VARCHAR(7), -- MM/YYYY
  payment_date DATE, -- Data do pagamento do cliente
  
  -- Status do repasse
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled
  
  -- Dados do pagamento ao agente
  paid_date DATE,
  paid_amount DECIMAL(15,2),
  payment_method VARCHAR(50), -- pix, transfer, cash
  payment_reference VARCHAR(200),
  
  -- Lançamento contábil
  accounting_entry_id UUID REFERENCES accounting_entries(id),
  
  -- Auditoria
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_commission_agents_name ON commission_agents(name);
CREATE INDEX IF NOT EXISTS idx_commission_agents_cpf ON commission_agents(cpf);
CREATE INDEX IF NOT EXISTS idx_client_commission_agents_client ON client_commission_agents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_commission_agents_agent ON client_commission_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent ON agent_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_client ON agent_commissions(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_status ON agent_commissions(status);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_competence ON agent_commissions(competence);

-- TRIGGER para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_commission_agents_updated_at ON commission_agents;
CREATE TRIGGER update_commission_agents_updated_at
    BEFORE UPDATE ON commission_agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_commissions_updated_at ON agent_commissions;
CREATE TRIGGER update_agent_commissions_updated_at
    BEFORE UPDATE ON agent_commissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
