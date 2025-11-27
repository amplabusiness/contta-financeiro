# 🔄 MIGRAÇÃO COMPLETA - SQL PARA EXECUTAR NO SUPABASE

## ⚡ ATENÇÃO: Execute este SQL no SQL Editor do Supabase

**Acesse:** https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new

---

## ✅ SCRIPT COMPLETO DE MIGRAÇÃO

**Copie e execute TODO este bloco SQL de uma vez:**

\`\`\`sql
-- ==========================================
-- 1. CRIAR TABELAS PRINCIPAIS
-- ==========================================

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  monthly_fee NUMERIC(15,2) DEFAULT 0,
  fee_due_day INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  opening_balance NUMERIC(15,2) DEFAULT 0,
  opening_balance_details JSONB,
  opening_balance_date DATE DEFAULT '2024-12-31',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  agency TEXT,
  account_number TEXT NOT NULL,
  account_digit TEXT,
  account_type TEXT DEFAULT 'checking',
  is_active BOOLEAN DEFAULT true,
  balance NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bank_code, agency, account_number, account_digit)
);

-- Tabela de Faturas/Honorários
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  competence VARCHAR(7), -- MM/YYYY
  amount NUMERIC(15,2) NOT NULL,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  paid_date DATE,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  boleto_digitable_line TEXT,
  external_charge_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Transações Bancárias
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(15,2) NOT NULL,
  type VARCHAR(20), -- 'credit', 'debit'
  balance_after NUMERIC(15,2),
  document_number TEXT,
  reconciled BOOLEAN DEFAULT false,
  invoice_id UUID REFERENCES invoices(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. SALDO DE ABERTURA (NOVO!)
-- ==========================================

CREATE TABLE IF NOT EXISTS client_opening_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competence VARCHAR(7) NOT NULL CHECK (competence ~ '^\d{2}/\d{4}$'),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  original_invoice_id UUID,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  paid_amount NUMERIC(15,2) DEFAULT 0 CHECK (paid_amount >= 0),
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  CONSTRAINT paid_amount_not_greater CHECK (paid_amount <= amount)
);

-- ==========================================
-- 3. ÍNDICES PARA PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON clients(cnpj);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_competence ON invoices(competence);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_opening_balance_client ON client_opening_balance(client_id);
CREATE INDEX IF NOT EXISTS idx_opening_balance_status ON client_opening_balance(status);
CREATE INDEX IF NOT EXISTS idx_opening_balance_competence ON client_opening_balance(competence);

-- ==========================================
-- 4. HABILITAR RLS (ROW LEVEL SECURITY)
-- ==========================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_opening_balance ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. POLÍTICAS RLS (Acesso para usuários autenticados)
-- ==========================================

-- Clients
DROP POLICY IF EXISTS "Enable all for authenticated users" ON clients;
CREATE POLICY "Enable all for authenticated users" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bank Accounts
DROP POLICY IF EXISTS "Enable all for authenticated users" ON bank_accounts;
CREATE POLICY "Enable all for authenticated users" ON bank_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoices
DROP POLICY IF EXISTS "Enable all for authenticated users" ON invoices;
CREATE POLICY "Enable all for authenticated users" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bank Transactions
DROP POLICY IF EXISTS "Enable all for authenticated users" ON bank_transactions;
CREATE POLICY "Enable all for authenticated users" ON bank_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Opening Balance
DROP POLICY IF EXISTS "Enable all for authenticated users" ON client_opening_balance;
CREATE POLICY "Enable all for authenticated users" ON client_opening_balance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- 6. TRIGGERS E FUNCTIONS
-- ==========================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para clients
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger para invoices
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Função para auto-atualizar saldo de abertura do cliente
CREATE OR REPLACE FUNCTION update_client_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_client_id := OLD.client_id;
  ELSE
    v_client_id := NEW.client_id;
  END IF;

  UPDATE clients
  SET opening_balance = (
    SELECT COALESCE(SUM(amount - paid_amount), 0)
    FROM client_opening_balance
    WHERE client_id = v_client_id
    AND status != 'paid'
  )
  WHERE id = v_client_id;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para opening balance
DROP TRIGGER IF EXISTS trigger_update_opening_balance ON client_opening_balance;
CREATE TRIGGER trigger_update_opening_balance
AFTER INSERT OR UPDATE OR DELETE ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION update_client_opening_balance();

-- Trigger updated_at para opening balance
DROP TRIGGER IF EXISTS trigger_opening_balance_timestamp ON client_opening_balance;
CREATE TRIGGER trigger_opening_balance_timestamp
BEFORE UPDATE ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 7. VIEW DE RESUMO
-- ==========================================

CREATE OR REPLACE VIEW v_client_opening_balance_summary AS
SELECT 
  c.id as client_id,
  c.name as client_name,
  c.cnpj,
  COUNT(cob.id) as total_competences,
  SUM(cob.amount) as total_amount,
  SUM(cob.paid_amount) as total_paid,
  SUM(cob.amount - cob.paid_amount) as total_pending,
  COUNT(CASE WHEN cob.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN cob.status = 'paid' THEN 1 END) as paid_count,
  COUNT(CASE WHEN cob.status = 'partial' THEN 1 END) as partial_count,
  MIN(cob.due_date) as oldest_due_date,
  MAX(cob.due_date) as newest_due_date
FROM clients c
LEFT JOIN client_opening_balance cob ON c.id = cob.client_id
GROUP BY c.id, c.name, c.cnpj;

GRANT SELECT ON v_client_opening_balance_summary TO authenticated;

-- ==========================================
-- 8. INSERIR CONTA BANCÁRIA SICREDI
-- ==========================================

INSERT INTO bank_accounts (
  bank_code,
  bank_name,
  agency,
  account_number,
  account_digit,
  account_type,
  is_active,
  balance,
  notes
) VALUES (
  '748',
  'SICREDI - Sistema de Crédito Cooperativo',
  '3950',
  '27806',
  '8',
  'checking',
  true,
  0.00,
  'Conta bancária principal para recebimento de honorários via boleto'
)
ON CONFLICT (bank_code, agency, account_number, account_digit) 
DO UPDATE SET
  is_active = true,
  bank_name = 'SICREDI - Sistema de Crédito Cooperativo',
  updated_at = now();

-- ==========================================
-- 9. COMENTÁRIOS
-- ==========================================

COMMENT ON TABLE clients IS 'Clientes da contabilidade';
COMMENT ON TABLE bank_accounts IS 'Contas bancárias';
COMMENT ON TABLE invoices IS 'Faturas e honorários';
COMMENT ON TABLE bank_transactions IS 'Transações bancárias do extrato';
COMMENT ON TABLE client_opening_balance IS 'Saldo de abertura detalhado por competência - honorários anteriores a 2025';
COMMENT ON COLUMN client_opening_balance.competence IS 'Formato: MM/YYYY - Ex: 01/2024, 03/2024';
COMMENT ON COLUMN client_opening_balance.status IS 'Status: pending (pendente), paid (pago), partial (pago parcial)';
\`\`\`

---

## ✅ VERIFICAÇÃO

**Após executar, rode este SQL para verificar:**

\`\`\`sql
-- Ver todas as tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Ver conta SICREDI
SELECT * FROM bank_accounts WHERE bank_code = '748';

-- Ver estrutura da tabela de saldo de abertura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'client_opening_balance'
ORDER BY ordinal_position;
\`\`\`

**✅ Resultado esperado:**
- Deve mostrar pelo menos 5 tabelas: clients, bank_accounts, invoices, bank_transactions, client_opening_balance
- Conta SICREDI deve aparecer
- Tabela opening_balance deve ter todas as colunas

---

## 🚀 PRÓXIMOS PASSOS

Depois de executar este SQL:

1. **Testar aplicação:**
   \`\`\`powershell
   npm run dev
   \`\`\`

2. **Acessar:** http://localhost:5173

3. **Fazer login** (ou criar conta)

4. **Testar páginas:**
   - `/clients` - Gestão de clientes
   - `/client-opening-balance` - Saldo de abertura
   - `/bank-folder-import` - Importação de arquivos

---

## 📝 NOTAS

- Este SQL cria APENAS as tabelas essenciais
- Se precisar de mais tabelas (despesas, plano de contas, etc), me avise
- As migrations locais estão com problemas de ordem/dependências
- Por isso é melhor aplicar este SQL consolidado direto

**Tempo estimado:** 2-3 minutos para executar o SQL completo
