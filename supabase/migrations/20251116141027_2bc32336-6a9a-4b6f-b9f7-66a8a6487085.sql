-- Drop the existing unique index on full CNPJ
DROP INDEX IF EXISTS ux_clients_cnpj_normalized_active;

-- Create unique index on CNPJ complete (all 14 digits) to prevent exact duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_cnpj_full_normalized_active
  ON public.clients ((regexp_replace(cnpj, '[^0-9]', '', 'g')))
  WHERE cnpj IS NOT NULL AND btrim(cnpj) <> '' AND status = 'active';

-- Update validation function to allow different branches (filiais) of same company
DROP FUNCTION IF EXISTS public.validate_client_before_insert() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_client_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_cnpj TEXT;
  normalized_cpf  TEXT;
  existing_id     UUID;
BEGIN
  -- Require at least one document
  IF (NEW.cnpj IS NULL OR btrim(NEW.cnpj) = '')
     AND (NEW.cpf IS NULL OR btrim(NEW.cpf) = '') THEN
    RAISE EXCEPTION 'Cliente precisa ter CNPJ ou CPF para ser cadastrado.';
  END IF;

  -- Validate CNPJ format and uniqueness (allowing different branches)
  IF NEW.cnpj IS NOT NULL AND btrim(NEW.cnpj) <> '' THEN
    normalized_cnpj := regexp_replace(NEW.cnpj, '[^0-9]', '', 'g');
    
    IF length(normalized_cnpj) <> 14 THEN
      RAISE EXCEPTION 'CNPJ inválido (deve conter 14 dígitos).';
    END IF;

    -- Check for exact CNPJ duplicate (same company + same branch)
    SELECT id INTO existing_id
    FROM public.clients
    WHERE status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND regexp_replace(cnpj, '[^0-9]', '', 'g') = normalized_cnpj
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe cliente ativo com este CNPJ exato (ID: %). Filiais diferentes da mesma empresa são permitidas.', existing_id;
    END IF;
  END IF;

  -- Validate CPF format and uniqueness
  IF NEW.cpf IS NOT NULL AND btrim(NEW.cpf) <> '' THEN
    normalized_cpf := regexp_replace(NEW.cpf, '[^0-9]', '', 'g');
    
    IF length(normalized_cpf) <> 11 THEN
      RAISE EXCEPTION 'CPF inválido (deve conter 11 dígitos).';
    END IF;

    SELECT id INTO existing_id
    FROM public.clients
    WHERE status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND regexp_replace(cpf, '[^0-9]', '', 'g') = normalized_cpf
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe cliente ativo com este CPF (ID: %).', existing_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_client_before_insert
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.validate_client_before_insert();

-- Add helper function to get CNPJ root (first 8 digits)
CREATE OR REPLACE FUNCTION public.get_cnpj_root(cnpj_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT substring(regexp_replace(cnpj_value, '[^0-9]', '', 'g'), 1, 8);
$$;

-- Add helper function to get CNPJ branch code (digits 9-12)
CREATE OR REPLACE FUNCTION public.get_cnpj_branch(cnpj_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT substring(regexp_replace(cnpj_value, '[^0-9]', '', 'g'), 9, 4);
$$;

-- Create index on CNPJ root for quick branch lookups
CREATE INDEX IF NOT EXISTS idx_clients_cnpj_root
  ON public.clients (public.get_cnpj_root(cnpj))
  WHERE cnpj IS NOT NULL AND btrim(cnpj) <> '' AND status = 'active';