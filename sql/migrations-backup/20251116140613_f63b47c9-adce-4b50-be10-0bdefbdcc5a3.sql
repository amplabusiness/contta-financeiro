-- 1) Add CPF column to clients (if not exists)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cpf text;

-- 2) Unique indexes on normalized documents for active clients
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_cnpj_normalized_active
  ON public.clients ((regexp_replace(cnpj, '[^0-9]', '', 'g')))
  WHERE cnpj IS NOT NULL AND btrim(cnpj) <> '' AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_cpf_normalized_active
  ON public.clients ((regexp_replace(cpf, '[^0-9]', '', 'g')))
  WHERE cpf IS NOT NULL AND btrim(cpf) <> '' AND status = 'active';

-- 3) Validation trigger: require CNPJ or CPF and prevent duplicates by document
DROP TRIGGER IF EXISTS trigger_validate_client_before_insert ON public.clients;
DROP FUNCTION IF EXISTS public.validate_client_before_insert();

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

  -- Validate and enforce uniqueness by CNPJ when provided
  IF NEW.cnpj IS NOT NULL AND btrim(NEW.cnpj) <> '' THEN
    normalized_cnpj := regexp_replace(NEW.cnpj, '[^0-9]', '', 'g');
    IF length(normalized_cnpj) <> 14 THEN
      RAISE EXCEPTION 'CNPJ inválido (deve conter 14 dígitos).';
    END IF;

    SELECT id INTO existing_id
    FROM public.clients
    WHERE status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND regexp_replace(cnpj, '[^0-9]', '', 'g') = normalized_cnpj
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe cliente ativo com este CNPJ (ID: %).', existing_id;
    END IF;
  END IF;

  -- Validate and enforce uniqueness by CPF when provided
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