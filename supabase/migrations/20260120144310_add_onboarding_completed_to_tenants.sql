-- Add onboarding_completed flag to tenants table
-- This flag controls whether the tenant has completed the initial setup wizard

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.onboarding_completed IS
  'Indica se o tenant completou o wizard de configuração inicial (onboarding)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding_completed
ON public.tenants(onboarding_completed)
WHERE onboarding_completed = false;
