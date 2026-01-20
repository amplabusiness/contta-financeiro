-- Drop existing trigger and function
DROP TRIGGER IF EXISTS validate_client_document_trigger ON public.clients;
DROP FUNCTION IF EXISTS public.validate_client_document();

-- Create improved validation function that handles both CNPJ and CPF
CREATE OR REPLACE FUNCTION public.validate_client_document()
RETURNS TRIGGER AS $$
DECLARE
  normalized_cnpj TEXT;
  normalized_cpf TEXT;
  existing_id UUID;
  cnpj_root TEXT;
BEGIN
  -- Require at least one document
  IF (NEW.cnpj IS NULL OR btrim(NEW.cnpj) = '')
     AND (NEW.cpf IS NULL OR btrim(NEW.cpf) = '') THEN
    RAISE EXCEPTION 'Cliente precisa ter CNPJ ou CPF para ser cadastrado.';
  END IF;

  -- Validate CNPJ format and uniqueness (allowing different branches)
  IF NEW.cnpj IS NOT NULL AND btrim(NEW.cnpj) <> '' THEN
    normalized_cnpj := regexp_replace(NEW.cnpj, '[^0-9]', '', 'g');
    
    -- Check if it's actually a CPF (11 digits) misplaced in CNPJ field
    IF length(normalized_cnpj) = 11 THEN
      -- Move to CPF field and clear CNPJ
      NEW.cpf := normalized_cnpj;
      NEW.cnpj := NULL;
      normalized_cnpj := NULL;
    ELSIF length(normalized_cnpj) <> 14 THEN
      RAISE EXCEPTION 'CNPJ inválido (deve conter 14 dígitos). Se for CPF, o campo deve conter 11 dígitos.';
    END IF;

    -- Only validate CNPJ uniqueness if it wasn't moved to CPF
    IF normalized_cnpj IS NOT NULL THEN
      -- Check for exact CNPJ duplicate (same company + same branch)
      SELECT id INTO existing_id
      FROM public.clients
      WHERE status = 'active'
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND regexp_replace(cnpj, '[^0-9]', '', 'g') = normalized_cnpj
      LIMIT 1;

      IF existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'CNPJ já cadastrado para outro cliente ativo.';
      END IF;

      -- Get CNPJ root (first 8 digits)
      cnpj_root := substring(normalized_cnpj from 1 for 8);
    END IF;
  END IF;

  -- Validate CPF format and uniqueness
  IF NEW.cpf IS NOT NULL AND btrim(NEW.cpf) <> '' THEN
    normalized_cpf := regexp_replace(NEW.cpf, '[^0-9]', '', 'g');
    
    IF length(normalized_cpf) <> 11 THEN
      RAISE EXCEPTION 'CPF inválido (deve conter 11 dígitos).';
    END IF;

    -- Check for CPF duplicate
    SELECT id INTO existing_id
    FROM public.clients
    WHERE status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND regexp_replace(cpf, '[^0-9]', '', 'g') = normalized_cpf
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'CPF já cadastrado para outro cliente ativo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER validate_client_document_trigger
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_client_document();