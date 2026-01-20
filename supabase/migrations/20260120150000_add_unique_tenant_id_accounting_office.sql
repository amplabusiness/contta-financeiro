-- Add UNIQUE constraint on tenant_id for accounting_office table
-- This allows upsert operations based on tenant_id

-- First, check if there are duplicate tenant_ids and keep only the most recent one
DELETE FROM public.accounting_office a
WHERE a.id NOT IN (
    SELECT DISTINCT ON (tenant_id) id
    FROM public.accounting_office
    ORDER BY tenant_id, created_at DESC
);

-- Add unique constraint
ALTER TABLE public.accounting_office
ADD CONSTRAINT accounting_office_tenant_id_unique UNIQUE (tenant_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT accounting_office_tenant_id_unique ON public.accounting_office IS
  'Garante que cada tenant tenha apenas um registro de configuração do escritório';

-- Add inscricao_municipal column if it doesn't exist
ALTER TABLE public.accounting_office
ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT;

COMMENT ON COLUMN public.accounting_office.inscricao_municipal IS
  'Inscrição municipal do escritório para emissão de NFSe';
