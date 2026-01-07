-- FASE 2.4: CONTAS INDIVIDUAIS POR CLIENTE
-- Autor: Dr. Cicero

BEGIN;

-- 1. Alterar tabela de Clientes para ter vínculo com Conta Contábil
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN clients.account_id IS 'ID da conta contábil analítica específica deste cliente (Ex: 1.1.2.01.0001)';

-- 2. Transformar a conta "Clientes a Receber" (1.1.2.01) em SINTÉTICA
-- Para que ela possa ter filhos (os clientes)
-- Obs: Se já houver lançamentos nela, precisaremos migrá-los depois.
UPDATE chart_of_accounts 
SET is_analytical = false 
WHERE code = '1.1.2.01';

-- 3. Função para criar conta do cliente automaticamente
CREATE OR REPLACE FUNCTION fn_create_client_account()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_id UUID;
  v_parent_code VARCHAR;
  v_next_code VARCHAR;
  v_new_account_id UUID;
  v_count INTEGER;
BEGIN
  -- Se já tem conta, não faz nada
  IF NEW.account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Busca o pai (Grupo Clientes a Receber - 1.1.2.01)
  SELECT id, code INTO v_parent_id, v_parent_code 
  FROM chart_of_accounts 
  WHERE code = '1.1.2.01';

  IF v_parent_id IS NULL THEN
     RAISE WARNING 'Conta pai Clientes a Receber (1.1.2.01) não encontrada.';
     RETURN NEW;
  END IF;

  -- Gera o próximo código sequencial (Ex: 1.1.2.01.0001)
  -- Lógica simples: conta quantos filhos já existem e soma 1
  SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE parent_id = v_parent_id;
  
  v_next_code := v_parent_code || '.' || LPAD((v_count + 1)::TEXT, 4, '0');

  -- Cria a conta no Plano de Contas
  INSERT INTO chart_of_accounts (
    code, 
    name, 
    account_type, 
    nature, 
    level, 
    is_analytical, 
    parent_id,
    sped_referencial_code
  ) VALUES (
    v_next_code,
    NEW.name, -- Nome do Cliente
    'ATIVO',
    'DEVEDORA',
    5, -- Nível 5 (Analítica)
    true,
    v_parent_id,
    '1.01.02.01.00' -- Código Referencial SPED padrão para clientes
  ) RETURNING id INTO v_new_account_id;

  -- Atualiza o cliente com o ID da nova conta
  NEW.account_id := v_new_account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger ao criar Cliente
DROP TRIGGER IF EXISTS trg_create_client_account ON clients;
CREATE TRIGGER trg_create_client_account
BEFORE INSERT ON clients
FOR EACH ROW
EXECUTE FUNCTION fn_create_client_account();

-- 4. Script para gerar contas para clientes JÁ EXISTENTES (Backfill)
DO $$
DECLARE
  r_client RECORD;
  v_parent_id UUID;
  v_parent_code VARCHAR;
  v_count INTEGER;
  v_next_code VARCHAR;
  v_new_id UUID;
BEGIN
  SELECT id, code INTO v_parent_id, v_parent_code 
  FROM chart_of_accounts 
  WHERE code = '1.1.2.01';

  IF v_parent_id IS NOT NULL THEN
    -- Contador inicial
    SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE parent_id = v_parent_id;

    FOR r_client IN SELECT * FROM clients WHERE account_id IS NULL LOOP
      v_count := v_count + 1;
      v_next_code := v_parent_code || '.' || LPAD(v_count::TEXT, 4, '0');
      
      INSERT INTO chart_of_accounts (
        code, name, account_type, nature, level, is_analytical, parent_id, sped_referencial_code
      ) VALUES (
        v_next_code, r_client.name, 'ATIVO', 'DEVEDORA', 5, true, v_parent_id, '1.01.02.01.00'
      ) RETURNING id INTO v_new_id;

      UPDATE clients SET account_id = v_new_id WHERE id = r_client.id;
    END LOOP;
  END IF;
END $$;

COMMIT;
