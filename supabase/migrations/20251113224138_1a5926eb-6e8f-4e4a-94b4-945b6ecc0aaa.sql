-- Add unique constraint to CNPJ to prevent duplicate companies
ALTER TABLE public.clients 
ADD CONSTRAINT clients_cnpj_unique UNIQUE (cnpj);

-- Add index for better query performance on CNPJ lookups
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON public.clients(cnpj) WHERE cnpj IS NOT NULL;