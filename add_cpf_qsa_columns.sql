-- ==========================================
-- ADICIONAR COLUNAS cpf e qsa NA TABELA clients
-- ==========================================
-- Execute no SQL Editor: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new

-- Adicionar coluna cpf
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);

-- Adicionar coluna qsa (Quadro de Sócios e Administradores)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS qsa JSONB;

-- Adicionar índice para CPF
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON clients(cpf) WHERE cpf IS NOT NULL;

-- Adicionar constraint para garantir que tenha CPF OU CNPJ
ALTER TABLE clients 
ADD CONSTRAINT chk_cpf_or_cnpj 
CHECK (cnpj IS NOT NULL OR cpf IS NOT NULL);

-- Comentários
COMMENT ON COLUMN clients.cpf IS 'CPF do cliente (pessoa física)';
COMMENT ON COLUMN clients.qsa IS 'Quadro de Sócios e Administradores (JSON)';

-- Verificação
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('cpf', 'qsa')
ORDER BY ordinal_position;
