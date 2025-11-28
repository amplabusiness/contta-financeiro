-- Garantir coluna notes na tabela clients (usada pelo frontend e enriquecimento)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'notes') THEN
    ALTER TABLE public.clients ADD COLUMN notes TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.clients.notes IS 'Observações do cliente (texto livre)';
