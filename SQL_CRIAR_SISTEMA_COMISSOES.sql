-- ============================================================================
-- SISTEMA DE COMISSÕES PARA PARCEIROS (VICTOR HUGO E NAYARA)
-- Execute este SQL no Supabase Dashboard: SQL Editor
-- EXECUTE CADA BLOCO SEPARADAMENTE SE HOUVER ERRO
-- ============================================================================

-- ========== PASSO 1: CRIAR TABELA COMMISSION_AGENTS ==========
DROP TABLE IF EXISTS agent_commissions CASCADE;
DROP TABLE IF EXISTS client_commission_agents CASCADE;
DROP TABLE IF EXISTS commission_agents CASCADE;

CREATE TABLE commission_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  pix_key VARCHAR(100),
  pix_key_type VARCHAR(20) DEFAULT 'cpf',
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

-- ========== PASSO 2: CRIAR TABELA CLIENT_COMMISSION_AGENTS ==========
CREATE TABLE client_commission_agents (
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

-- ========== PASSO 3: CRIAR TABELA AGENT_COMMISSIONS ==========
CREATE TABLE agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES commission_agents(id),
  client_id UUID REFERENCES clients(id),
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  source_description TEXT,
  client_payment_amount DECIMAL(15,2) NOT NULL,
  agent_percentage DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(15,2) NOT NULL,
  competence VARCHAR(7),
  payment_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  paid_date DATE,
  paid_amount DECIMAL(15,2),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(200),
  accounting_entry_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========== PASSO 4: CRIAR ÍNDICES ==========
CREATE INDEX idx_commission_agents_cpf ON commission_agents(cpf);
CREATE INDEX idx_commission_agents_pix ON commission_agents(pix_key);
CREATE INDEX idx_client_commission_agents_client ON client_commission_agents(client_id);
CREATE INDEX idx_client_commission_agents_agent ON client_commission_agents(agent_id);
CREATE INDEX idx_agent_commissions_agent ON agent_commissions(agent_id);
CREATE INDEX idx_agent_commissions_client ON agent_commissions(client_id);
CREATE INDEX idx_agent_commissions_status ON agent_commissions(status);
CREATE INDEX idx_agent_commissions_competence ON agent_commissions(competence);

-- ========== PASSO 5: HABILITAR RLS ==========
ALTER TABLE commission_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_commission_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_commissions ENABLE ROW LEVEL SECURITY;

-- ========== PASSO 6: CRIAR POLÍTICAS ==========
CREATE POLICY "Allow all for service role" ON commission_agents FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON client_commission_agents FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON agent_commissions FOR ALL USING (true);

-- ========== PASSO 7: INSERIR VICTOR E NAYARA ==========
INSERT INTO commission_agents (name, cpf, pix_key, pix_key_type, notes)
VALUES 
  ('VICTOR HUGO LEÃO', '752.126.331-68', '75212633168', 'cpf', 'Filho - recebe 50% dos honorários de clientes vinculados'),
  ('NAYARA CRISTINA LEÃO', '037.887.511-69', '03788751169', 'cpf', 'Filha - recebe 50% dos honorários de clientes vinculados');

-- ========== VERIFICAR RESULTADO ==========
SELECT * FROM commission_agents;
