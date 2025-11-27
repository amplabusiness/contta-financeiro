-- ==========================================
-- ADICIONAR COLUNA is_pro_bono NA TABELA clients
-- ==========================================
-- Execute no SQL Editor: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new

-- Adicionar coluna is_pro_bono
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS is_pro_bono BOOLEAN DEFAULT false;

-- Adicionar colunas relacionadas ao Pro-Bono
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pro_bono_start_date DATE;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pro_bono_end_date DATE;

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS pro_bono_reason TEXT;

-- Adicionar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_clients_is_pro_bono ON clients(is_pro_bono) WHERE is_pro_bono = true;

-- Comentários
COMMENT ON COLUMN clients.is_pro_bono IS 'Indica se o cliente é atendido gratuitamente (Pro-Bono)';
COMMENT ON COLUMN clients.pro_bono_start_date IS 'Data de início do atendimento Pro-Bono';
COMMENT ON COLUMN clients.pro_bono_end_date IS 'Data de término do atendimento Pro-Bono (NULL = indefinido)';
COMMENT ON COLUMN clients.pro_bono_reason IS 'Justificativa para o atendimento Pro-Bono';

-- Verificação
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name IN ('is_pro_bono', 'pro_bono_start_date', 'pro_bono_end_date', 'pro_bono_reason')
ORDER BY ordinal_position;
