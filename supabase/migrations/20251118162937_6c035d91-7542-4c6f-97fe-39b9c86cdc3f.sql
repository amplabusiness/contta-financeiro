-- Add is_internal field to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.clients.is_internal IS 'Indica se o cliente é uma empresa interna';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_is_internal ON public.clients(is_internal) WHERE is_internal = true;