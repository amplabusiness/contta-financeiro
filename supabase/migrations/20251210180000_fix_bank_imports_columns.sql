-- Migration para adicionar colunas faltantes em bank_imports
-- Erro 400 ocorria porque as colunas total_debits, total_credits e error_message não existiam

-- Adicionar colunas faltantes
ALTER TABLE public.bank_imports
ADD COLUMN IF NOT EXISTS total_debits DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.bank_imports
ADD COLUMN IF NOT EXISTS total_credits DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.bank_imports
ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.bank_imports
ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Garantir que start_date e end_date existam (aliases para period_start/period_end)
ALTER TABLE public.bank_imports
ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.bank_imports
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Comentários
COMMENT ON COLUMN public.bank_imports.total_debits IS 'Total de débitos importados';
COMMENT ON COLUMN public.bank_imports.total_credits IS 'Total de créditos importados';
COMMENT ON COLUMN public.bank_imports.error_message IS 'Mensagem de erro durante importação';
