# ✅ INSTRUÇÕES: Execute estas SQLs no Supabase SQL Editor

## 📋 Ordem de Execução

Execute os comandos SQL abaixo **NA ORDEM** no Supabase SQL Editor:
**Acesse:** https://supabase.com/dashboard/project/nrodnjassdrvqtgfdodf/sql/new

---

## 1️⃣ CRIAR TABELA DE SALDO DE ABERTURA (PRIORIDADE MÁXIMA 🔥)

**Copie e execute todo este bloco SQL:**

```sql
-- 1. Adicionar campos na tabela clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS opening_balance_details JSONB,
ADD COLUMN IF NOT EXISTS opening_balance_date DATE DEFAULT '2024-12-31';

COMMENT ON COLUMN clients.opening_balance IS 'Total opening balance amount (auto-calculated from client_opening_balance)';
COMMENT ON COLUMN clients.opening_balance_details IS 'Additional JSON details about opening balance';
COMMENT ON COLUMN clients.opening_balance_date IS 'Reference date for opening balance (default: 2024-12-31)';

-- 2. Criar tabela de detalhamento do saldo de abertura
CREATE TABLE IF NOT EXISTS client_opening_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competence VARCHAR(7) NOT NULL, -- Format: 'MM/YYYY' (e.g., '01/2024', '03/2024')
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  original_invoice_id UUID, -- Reference to original invoice if exists
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'partial'
  paid_amount DECIMAL(15,2) DEFAULT 0 CHECK (paid_amount >= 0),
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT competence_format_check CHECK (competence ~ '^\d{2}/\d{4}$'),
  CONSTRAINT paid_amount_not_greater CHECK (paid_amount <= amount)
);

COMMENT ON TABLE client_opening_balance IS 'Detailed opening balance by competence - tracks pre-2025 outstanding fees';
COMMENT ON COLUMN client_opening_balance.competence IS 'Month/Year format: MM/YYYY (e.g., 01/2024, 03/2024)';
COMMENT ON COLUMN client_opening_balance.status IS 'Payment status: pending (unpaid), paid (fully paid), partial (partially paid)';
COMMENT ON COLUMN client_opening_balance.amount IS 'Original amount for this competence';
COMMENT ON COLUMN client_opening_balance.paid_amount IS 'Amount already paid towards this competence';

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_opening_balance_client ON client_opening_balance(client_id);
CREATE INDEX IF NOT EXISTS idx_opening_balance_status ON client_opening_balance(status);
CREATE INDEX IF NOT EXISTS idx_opening_balance_competence ON client_opening_balance(competence);
CREATE INDEX IF NOT EXISTS idx_opening_balance_due_date ON client_opening_balance(due_date);
CREATE INDEX IF NOT EXISTS idx_opening_balance_created_at ON client_opening_balance(created_at DESC);

-- 4. Habilitar Row Level Security
ALTER TABLE client_opening_balance ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS
DROP POLICY IF EXISTS "Enable all for authenticated users" ON client_opening_balance;
CREATE POLICY "Enable all for authenticated users"
ON client_opening_balance FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Criar função para auto-atualizar saldo
CREATE OR REPLACE FUNCTION update_client_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
BEGIN
  -- Determine which client_id to update
  IF (TG_OP = 'DELETE') THEN
    v_client_id := OLD.client_id;
  ELSE
    v_client_id := NEW.client_id;
  END IF;

  -- Update the client's opening_balance field
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

COMMENT ON FUNCTION update_client_opening_balance() IS 'Automatically updates client.opening_balance when opening balance entries change';

-- 7. Criar trigger para auto-atualizar saldo
DROP TRIGGER IF EXISTS trigger_update_opening_balance ON client_opening_balance;
CREATE TRIGGER trigger_update_opening_balance
AFTER INSERT OR UPDATE OR DELETE ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION update_client_opening_balance();

-- 8. Criar função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_opening_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_opening_balance_timestamp ON client_opening_balance;
CREATE TRIGGER trigger_opening_balance_timestamp
BEFORE UPDATE ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION update_opening_balance_timestamp();

-- 9. Criar view para resumo
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

COMMENT ON VIEW v_client_opening_balance_summary IS 'Summary view of opening balance per client with aggregated statistics';

-- 10. Grant permissions
GRANT SELECT ON v_client_opening_balance_summary TO authenticated;
```

**✅ Resultado esperado:** Deve aparecer "Success. No rows returned"

---

## 2️⃣ CONFIGURAR CONTA BANCÁRIA SICREDI

**Copie e execute todo este bloco SQL:**

```sql
-- Insert SICREDI bank account
INSERT INTO bank_accounts (
  bank_code,
  bank_name,
  agency,
  account_number,
  account_digit,
  account_type,
  is_active,
  balance,
  notes,
  created_at
) VALUES (
  '748',
  'SICREDI - Sistema de Crédito Cooperativo',
  '3950',
  '27806',
  '8',
  'checking',
  true,
  0.00,
  'Conta bancária principal para recebimento de honorários via boleto. Integração com extrato OFX e relatórios Excel do banco.',
  now()
)
ON CONFLICT (bank_code, agency, account_number, account_digit) 
DO UPDATE SET
  is_active = true,
  bank_name = 'SICREDI - Sistema de Crédito Cooperativo',
  notes = 'Conta bancária principal para recebimento de honorários via boleto. Integração com extrato OFX e relatórios Excel do banco.',
  updated_at = now();

-- Verificar que a conta foi criada
SELECT 
  id,
  bank_code,
  bank_name,
  agency,
  account_number,
  account_digit,
  account_type,
  is_active
FROM bank_accounts
WHERE bank_code = '748' 
  AND agency = '3950' 
  AND account_number = '27806';
```

**✅ Resultado esperado:** Deve retornar 1 linha com os dados da conta SICREDI

---

## 3️⃣ VERIFICAR INSTALAÇÃO

**Execute este SQL para verificar que tudo está OK:**

```sql
-- Verificar tabela de saldo de abertura
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'client_opening_balance'
ORDER BY ordinal_position;

-- Verificar view
SELECT COUNT(*) as view_exists
FROM information_schema.views
WHERE table_name = 'v_client_opening_balance_summary';

-- Verificar conta bancária
SELECT 
  id,
  bank_code || ' - ' || bank_name as bank,
  'Ag: ' || agency || ' | Conta: ' || account_number || '-' || account_digit as account,
  is_active
FROM bank_accounts
WHERE bank_code = '748';
```

**✅ Resultado esperado:**
- Primeira query: Lista de colunas da tabela client_opening_balance
- Segunda query: `view_exists = 1`
- Terceira query: Dados da conta SICREDI ativa

---

## 📊 PRÓXIMOS PASSOS

Depois de executar estas SQLs, você pode:

1. **Acessar a página de Saldo de Abertura:**
   - URL: `http://localhost:5173/client-opening-balance`
   - Cadastre os honorários devidos de 2024 para cada cliente

2. **Testar importação de arquivos bancários:**
   - URL: `http://localhost:5173/bank-folder-import`
   - Faça upload dos arquivos OFX + Excel da pasta "banco"

3. **Verificar conciliação bancária:**
   - URL: `http://localhost:5173/bank-reconciliation`
   - Conferir pagamentos identificados automaticamente

---

## ⚠️ IMPORTANTE

**NÃO ESQUEÇA:**
- Antes de importar extratos de 2025, cadastre TODOS os saldos de abertura de 2024
- Isso garante que o sistema saiba quais débitos são de 2024 e quais são de 2025
- A conciliação automática vai identificar corretamente cada pagamento

---

## 🆘 SE DER ERRO

Se alguma SQL falhar, copie o erro e cole aqui no chat para análise.

**Erros comuns:**
- `relation "bank_accounts" does not exist` → A tabela bank_accounts não existe, precisa criar primeiro
- `duplicate key value` → A conta já existe (OK, pode ignorar)
- `permission denied` → Seu usuário não tem permissão (use o SQL Editor do Supabase)
