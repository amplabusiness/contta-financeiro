-- Migration: Adicionar constraint UNIQUE para client_monthly_revenue
-- Problema: Upsert falha porque não existe constraint UNIQUE em (client_id, reference_month)

-- Verificar se a constraint já existe antes de criar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_monthly_revenue_client_id_reference_month_key'
  ) THEN
    -- Adicionar constraint UNIQUE
    ALTER TABLE client_monthly_revenue
    ADD CONSTRAINT client_monthly_revenue_client_id_reference_month_key
    UNIQUE (client_id, reference_month);

    RAISE NOTICE 'Constraint UNIQUE adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Constraint já existe, pulando...';
  END IF;
END $$;
