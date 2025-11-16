-- Primeiro, vamos mesclar todos os clientes duplicados
-- Mantém o cliente mais antigo com CNPJ (se houver) ou o com mais faturas

-- Criar função temporária para mesclar duplicados
CREATE OR REPLACE FUNCTION merge_duplicate_clients()
RETURNS TABLE(
  grupos_mesclados INT,
  clientes_deletados INT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  grupo RECORD;
  cliente_manter UUID;
  cliente_deletar UUID;
  total_grupos INT := 0;
  total_deletados INT := 0;
BEGIN
  -- Para cada grupo de clientes com mesmo nome normalizado
  FOR grupo IN 
    WITH normalized_clients AS (
      SELECT 
        id,
        name,
        cnpj,
        created_at,
        UPPER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))) as normalized_name
      FROM clients
      WHERE status = 'active'
    )
    SELECT 
      normalized_name,
      ARRAY_AGG(id ORDER BY 
        CASE WHEN cnpj IS NOT NULL AND cnpj != '' THEN 0 ELSE 1 END,
        created_at ASC
      ) as client_ids
    FROM normalized_clients
    GROUP BY normalized_name
    HAVING COUNT(*) > 1
  LOOP
    -- O primeiro ID é o que vamos manter
    cliente_manter := grupo.client_ids[1];
    
    -- Mesclar todos os outros neste grupo
    FOR i IN 2..array_length(grupo.client_ids, 1) LOOP
      cliente_deletar := grupo.client_ids[i];
      
      -- Transferir faturas
      UPDATE invoices 
      SET client_id = cliente_manter 
      WHERE client_id = cliente_deletar;
      
      -- Transferir client_ledger
      UPDATE client_ledger 
      SET client_id = cliente_manter 
      WHERE client_id = cliente_deletar;
      
      -- Transferir collection_work_orders
      UPDATE collection_work_orders 
      SET client_id = cliente_manter 
      WHERE client_id = cliente_deletar;
      
      -- Transferir bank_transaction_matches
      UPDATE bank_transaction_matches 
      SET client_id = cliente_manter 
      WHERE client_id = cliente_deletar;
      
      -- Transferir client_payers
      UPDATE client_payers 
      SET client_id = cliente_manter 
      WHERE client_id = cliente_deletar;
      
      -- Transferir boleto_report_items
      UPDATE boleto_report_items 
      SET client_id = cliente_manter 
      WHERE client_id = cliente_deletar;
      
      -- Deletar client_partners duplicados
      DELETE FROM client_partners 
      WHERE client_id = cliente_deletar;
      
      -- Deletar client_enrichment duplicados
      DELETE FROM client_enrichment 
      WHERE client_id = cliente_deletar;
      
      -- Deletar o cliente duplicado
      DELETE FROM clients 
      WHERE id = cliente_deletar;
      
      total_deletados := total_deletados + 1;
    END LOOP;
    
    total_grupos := total_grupos + 1;
  END LOOP;
  
  RETURN QUERY SELECT total_grupos, total_deletados;
END;
$$;

-- Executar a mesclagem
SELECT * FROM merge_duplicate_clients();

-- Deletar a função temporária
DROP FUNCTION merge_duplicate_clients();

-- Agora vamos adicionar validações para PREVENIR duplicados no futuro

-- 1. Criar índice único para CNPJ (normalizado, sem pontuação)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cnpj_normalized 
ON clients (REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g'))
WHERE cnpj IS NOT NULL 
  AND cnpj != '' 
  AND status = 'active';

-- 2. Criar índice único para nome normalizado (previne duplicatas por nome)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_name_normalized 
ON clients (UPPER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))))
WHERE status = 'active';

-- 3. Criar função de validação antes de inserir
CREATE OR REPLACE FUNCTION validate_client_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_name TEXT;
  normalized_cnpj TEXT;
  existing_client_id UUID;
BEGIN
  -- Normalizar nome
  normalized_name := UPPER(TRIM(REGEXP_REPLACE(NEW.name, '\s+', ' ', 'g')));
  
  -- Verificar duplicata por nome
  SELECT id INTO existing_client_id
  FROM clients
  WHERE UPPER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))) = normalized_name
    AND status = 'active'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cliente com nome "%" já existe (ID: %)', NEW.name, existing_client_id;
  END IF;
  
  -- Se tem CNPJ, verificar duplicata por CNPJ
  IF NEW.cnpj IS NOT NULL AND NEW.cnpj != '' THEN
    normalized_cnpj := REGEXP_REPLACE(NEW.cnpj, '[^0-9]', '', 'g');
    
    SELECT id INTO existing_client_id
    FROM clients
    WHERE REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = normalized_cnpj
      AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_client_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cliente com CNPJ "%" já existe (ID: %)', NEW.cnpj, existing_client_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar trigger para validar antes de inserir/atualizar
DROP TRIGGER IF EXISTS trigger_validate_client_before_insert ON clients;
CREATE TRIGGER trigger_validate_client_before_insert
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION validate_client_before_insert();