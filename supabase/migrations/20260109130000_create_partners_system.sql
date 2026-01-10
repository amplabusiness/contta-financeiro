-- ============================================================================
-- SISTEMA DE PARCEIROS - VICTOR HUGO E NAYARA CRISTINA
-- Dr. Cícero - NBC TG 26 (R3)
-- Criado em: 09/01/2026
-- ============================================================================

-- 1. TABELA DE PARCEIROS (representantes que recebem comissões)
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  cpf VARCHAR(14),
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

CREATE INDEX IF NOT EXISTS idx_partners_name ON partners(name);
CREATE INDEX IF NOT EXISTS idx_partners_cpf ON partners(cpf);
CREATE INDEX IF NOT EXISTS idx_partners_pix ON partners(pix_key);

-- 2. TABELA DE VÍNCULO CLIENTE-PARCEIRO (qual parceiro recebe de qual cliente)
CREATE TABLE IF NOT EXISTS client_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 50.00, -- Percentual que o parceiro recebe
  is_active BOOLEAN DEFAULT true,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id, partner_id) -- Cada parceiro só pode estar vinculado uma vez por cliente
);

CREATE INDEX IF NOT EXISTS idx_client_partners_client ON client_partners(client_id);
CREATE INDEX IF NOT EXISTS idx_client_partners_partner ON client_partners(partner_id);

-- 3. TABELA DE PAGAMENTOS/REPASSES PARA PARCEIROS
CREATE TABLE IF NOT EXISTS partner_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  client_id UUID REFERENCES clients(id),
  
  -- Referência ao pagamento original do cliente
  source_type VARCHAR(50) NOT NULL, -- 'bank_transaction', 'invoice_payment', 'opening_balance'
  source_id UUID, -- ID da transação/pagamento original
  
  -- Valores
  client_payment_amount DECIMAL(15,2) NOT NULL, -- Quanto o cliente pagou
  partner_percentage DECIMAL(5,2) NOT NULL, -- Percentual do parceiro
  partner_amount DECIMAL(15,2) NOT NULL, -- Quanto o parceiro deve receber
  
  -- Competência
  competence VARCHAR(7), -- MM/YYYY
  reference_description TEXT, -- Descrição do que se refere
  
  -- Status do repasse
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled
  
  -- Dados do pagamento ao parceiro
  paid_date DATE,
  paid_amount DECIMAL(15,2),
  payment_method VARCHAR(50), -- pix, transfer, cash
  payment_reference VARCHAR(200), -- Comprovante PIX, etc
  
  -- Lançamento contábil
  accounting_entry_id UUID REFERENCES accounting_entries(id),
  
  -- Auditoria
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_payments_partner ON partner_payments(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_payments_client ON partner_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_partner_payments_status ON partner_payments(status);
CREATE INDEX IF NOT EXISTS idx_partner_payments_competence ON partner_payments(competence);
CREATE INDEX IF NOT EXISTS idx_partner_payments_source ON partner_payments(source_type, source_id);

-- 4. CONTAS CONTÁBEIS PARA REPASSES
-- Conta de Passivo: Repasses a Efetuar
INSERT INTO chart_of_accounts (code, name, type, nature, parent_code, is_active, description)
SELECT '2.1.05', 'Repasses a Efetuar', 'liability', 'credit', '2.1', true, 'Valores recebidos de clientes para repasse a terceiros'
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.05');

INSERT INTO chart_of_accounts (code, name, type, nature, parent_code, is_active, description)
SELECT '2.1.05.01', 'Repasses a Parceiros', 'liability', 'credit', '2.1.05', true, 'Comissões/honorários a repassar para parceiros (Victor/Nayara)'
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '2.1.05.01');

-- Conta de Despesa: Comissões Pagas (alternativa se tratar como despesa)
INSERT INTO chart_of_accounts (code, name, type, nature, parent_code, is_active, description)
SELECT '3.2.05', 'Comissões e Repasses', 'expense', 'debit', '3.2', true, 'Comissões e repasses pagos a terceiros'
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '3.2.05');

INSERT INTO chart_of_accounts (code, name, type, nature, parent_code, is_active, description)
SELECT '3.2.05.01', 'Comissões a Parceiros', 'expense', 'debit', '3.2.05', true, 'Comissões pagas a parceiros sobre honorários'
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE code = '3.2.05.01');

-- 5. INSERIR VICTOR E NAYARA
INSERT INTO partners (name, cpf, pix_key, pix_key_type, notes)
SELECT 'VICTOR HUGO LEÃO', '752.126.331-68', '75212633168', 'cpf', 'Filho - recebe 50% dos honorários de clientes vinculados'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE cpf = '752.126.331-68' OR pix_key = '75212633168');

INSERT INTO partners (name, cpf, pix_key, pix_key_type, notes)
SELECT 'NAYARA CRISTINA LEÃO', '037.887.511-69', '03788751169', 'cpf', 'Filha - recebe 50% dos honorários de clientes vinculados'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE cpf = '037.887.511-69' OR pix_key = '03788751169');

-- 6. VIEW PARA RELATÓRIO DE PARCEIROS
CREATE OR REPLACE VIEW vw_partner_summary AS
SELECT 
  p.id as partner_id,
  p.name as partner_name,
  p.cpf,
  p.pix_key,
  COUNT(DISTINCT cp.client_id) as total_clients,
  COUNT(DISTINCT pp.id) as total_payments,
  COALESCE(SUM(CASE WHEN pp.status = 'pending' THEN pp.partner_amount ELSE 0 END), 0) as pending_amount,
  COALESCE(SUM(CASE WHEN pp.status = 'paid' THEN pp.paid_amount ELSE 0 END), 0) as paid_amount,
  COALESCE(SUM(pp.partner_amount), 0) as total_amount
FROM partners p
LEFT JOIN client_partners cp ON cp.partner_id = p.id AND cp.is_active = true
LEFT JOIN partner_payments pp ON pp.partner_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.cpf, p.pix_key;

-- 7. VIEW PARA RELATÓRIO MENSAL POR PARCEIRO
CREATE OR REPLACE VIEW vw_partner_monthly AS
SELECT 
  p.id as partner_id,
  p.name as partner_name,
  pp.competence,
  COUNT(pp.id) as payment_count,
  SUM(pp.client_payment_amount) as total_client_payments,
  SUM(pp.partner_amount) as total_partner_amount,
  SUM(CASE WHEN pp.status = 'paid' THEN pp.paid_amount ELSE 0 END) as total_paid,
  SUM(CASE WHEN pp.status = 'pending' THEN pp.partner_amount ELSE 0 END) as total_pending
FROM partners p
JOIN partner_payments pp ON pp.partner_id = p.id
GROUP BY p.id, p.name, pp.competence
ORDER BY p.name, pp.competence DESC;

-- 8. FUNÇÃO PARA PROCESSAR PAGAMENTO DE CLIENTE E CRIAR REPASSES
CREATE OR REPLACE FUNCTION process_client_payment_for_partners(
  p_client_id UUID,
  p_amount DECIMAL(15,2),
  p_source_type VARCHAR(50),
  p_source_id UUID,
  p_competence VARCHAR(7),
  p_description TEXT DEFAULT NULL
) RETURNS TABLE(partner_id UUID, partner_name TEXT, partner_amount DECIMAL(15,2)) AS $$
DECLARE
  v_partner RECORD;
  v_partner_amount DECIMAL(15,2);
BEGIN
  -- Para cada parceiro vinculado ao cliente
  FOR v_partner IN 
    SELECT cp.partner_id, cp.percentage, pt.name
    FROM client_partners cp
    JOIN partners pt ON pt.id = cp.partner_id
    WHERE cp.client_id = p_client_id 
      AND cp.is_active = true
      AND pt.is_active = true
      AND (cp.end_date IS NULL OR cp.end_date >= CURRENT_DATE)
  LOOP
    -- Calcular valor do parceiro
    v_partner_amount := ROUND(p_amount * (v_partner.percentage / 100), 2);
    
    -- Inserir registro de pagamento pendente
    INSERT INTO partner_payments (
      partner_id, client_id, source_type, source_id,
      client_payment_amount, partner_percentage, partner_amount,
      competence, reference_description, status
    ) VALUES (
      v_partner.partner_id, p_client_id, p_source_type, p_source_id,
      p_amount, v_partner.percentage, v_partner_amount,
      p_competence, p_description, 'pending'
    );
    
    -- Retornar dados do parceiro
    partner_id := v_partner.partner_id;
    partner_name := v_partner.name;
    partner_amount := v_partner_amount;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 9. FUNÇÃO PARA MARCAR REPASSE COMO PAGO
CREATE OR REPLACE FUNCTION mark_partner_payment_as_paid(
  p_payment_id UUID,
  p_paid_date DATE,
  p_paid_amount DECIMAL(15,2),
  p_payment_method VARCHAR(50) DEFAULT 'pix',
  p_payment_reference VARCHAR(200) DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE partner_payments
  SET 
    status = 'paid',
    paid_date = p_paid_date,
    paid_amount = p_paid_amount,
    payment_method = p_payment_method,
    payment_reference = p_payment_reference,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 10. COMENTÁRIOS
COMMENT ON TABLE partners IS 'Parceiros/representantes que recebem comissões sobre honorários de clientes';
COMMENT ON TABLE client_partners IS 'Vínculo entre clientes e parceiros com percentual de comissão';
COMMENT ON TABLE partner_payments IS 'Registro de pagamentos/repasses devidos e efetuados a parceiros';
COMMENT ON FUNCTION process_client_payment_for_partners IS 'Processa pagamento de cliente e cria registros de repasse para parceiros vinculados';
