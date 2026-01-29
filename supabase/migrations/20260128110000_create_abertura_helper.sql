-- Migration: Criar função helper para bypass do tenant trigger
-- Esta função será usada temporariamente para criar os lançamentos de abertura

CREATE OR REPLACE FUNCTION create_abertura_entry(
  p_tenant_id UUID,
  p_entry_date DATE,
  p_client_name TEXT,
  p_competence TEXT,
  p_valor NUMERIC,
  p_conta_cliente_id UUID,
  p_conta_contra_id UUID,
  p_cob_id UUID
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id UUID;
BEGIN
  -- Gerar UUID
  v_entry_id := gen_random_uuid();
  
  -- Criar entry
  INSERT INTO accounting_entries (
    id, tenant_id, entry_date, competence_date, entry_type,
    document_type, reference_type, description, total_debit, total_credit,
    created_at, updated_at
  ) VALUES (
    v_entry_id,
    p_tenant_id,
    p_entry_date,
    p_entry_date,
    'SALDO_ABERTURA',
    'ABERTURA',
    'saldo_inicial',
    'Saldo de abertura ' || to_char(p_entry_date, 'DD/MM/YYYY') || ' - ' || p_client_name || ' (' || p_competence || ')',
    p_valor,
    p_valor,
    NOW(),
    NOW()
  );
  
  -- Linha débito
  INSERT INTO accounting_entry_lines (
    id, tenant_id, entry_id, account_id, debit, credit, description, created_at
  ) VALUES (
    gen_random_uuid(),
    p_tenant_id,
    v_entry_id,
    p_conta_cliente_id,
    p_valor,
    0,
    'D - Saldo devedor abertura - ' || p_client_name,
    NOW()
  );
  
  -- Linha crédito
  INSERT INTO accounting_entry_lines (
    id, tenant_id, entry_id, account_id, debit, credit, description, created_at
  ) VALUES (
    gen_random_uuid(),
    p_tenant_id,
    v_entry_id,
    p_conta_contra_id,
    0,
    p_valor,
    'C - Contrapartida abertura - ' || p_client_name,
    NOW()
  );
  
  -- Atualizar status
  UPDATE client_opening_balance
  SET status = 'processed', updated_at = NOW()
  WHERE id = p_cob_id;
  
  RETURN v_entry_id;
END;
$$;

-- Permitir execução via service_role
GRANT EXECUTE ON FUNCTION create_abertura_entry TO service_role;
