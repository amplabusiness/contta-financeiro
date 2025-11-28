-- Garantir coluna notes na tabela clients (usada pelo frontend e enriquecimento)
ALTER TABLE IF NOT EXISTS public.clients
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.clients.notes IS 'Observações do cliente (texto livre)';
