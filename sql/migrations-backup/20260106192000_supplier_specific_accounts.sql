-- FASE 2.5: FORNECEDORES ESPECÍFICOS E DESPESAS DETALHADAS
-- Autor: Dr. Cicero

BEGIN;

-- 1. Vincular Fornecedores a Contas Contábeis (Passivo)
-- Adicionar coluna account_id na tabela suppliers
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN suppliers.account_id IS 'Conta contábil analítica no Passivo (2.1.1.01.xxxx)';

-- 2. Vincular Despesas a Fornecedores e Natureza Contábil
-- Adicionar supplier_id e chart_account_id na tabela expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
ADD COLUMN IF NOT EXISTS chart_account_id UUID REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN expenses.chart_account_id IS 'Conta de Resultado (Despesa) - Natureza do gasto';

-- 3. Transformar conta "Fornecedores Nacionais" (2.1.1.01) em SINTÉTICA
UPDATE chart_of_accounts SET is_analytical = false WHERE code = '2.1.1.01';

-- 4. Função para criar conta do Fornecedor automaticamente
CREATE OR REPLACE FUNCTION fn_create_supplier_account()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_id UUID;
  v_parent_code VARCHAR;
  v_next_code VARCHAR;
  v_new_account_id UUID;
  v_count INTEGER;
BEGIN
  IF NEW.account_id IS NOT NULL THEN RETURN NEW; END IF;

  -- Busca pai: Fornecedores Nacionais (2.1.1.01)
  SELECT id, code INTO v_parent_id, v_parent_code FROM chart_of_accounts WHERE code = '2.1.1.01';

  IF v_parent_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE parent_id = v_parent_id;
  v_next_code := v_parent_code || '.' || LPAD((v_count + 1)::TEXT, 4, '0');

  INSERT INTO chart_of_accounts (
    code, name, account_type, nature, level, is_analytical, parent_id, sped_referencial_code
  ) VALUES (
    v_next_code, NEW.name, 'PASSIVO', 'CREDORA', 5, true, v_parent_id, '2.01.01.01.00'
  ) RETURNING id INTO v_new_account_id;

  NEW.account_id := v_new_account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_supplier_account ON suppliers;
CREATE TRIGGER trg_create_supplier_account
BEFORE INSERT ON suppliers
FOR EACH ROW
EXECUTE FUNCTION fn_create_supplier_account();

-- 5. Backfill para Fornecedores Existentes
DO $$
DECLARE
  r_supplier RECORD;
  v_parent_id UUID;
  v_parent_code VARCHAR;
  v_count INTEGER;
  v_next_code VARCHAR;
  v_new_id UUID;
BEGIN
  SELECT id, code INTO v_parent_id, v_parent_code FROM chart_of_accounts WHERE code = '2.1.1.01';
  IF v_parent_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE parent_id = v_parent_id;
    FOR r_supplier IN SELECT * FROM suppliers WHERE account_id IS NULL LOOP
      v_count := v_count + 1;
      v_next_code := v_parent_code || '.' || LPAD(v_count::TEXT, 4, '0');
      
      INSERT INTO chart_of_accounts (
        code, name, account_type, nature, level, is_analytical, parent_id, sped_referencial_code
      ) VALUES (
        v_next_code, r_supplier.name, 'PASSIVO', 'CREDORA', 5, true, v_parent_id, '2.01.01.01.00'
      ) RETURNING id INTO v_new_id;

      UPDATE suppliers SET account_id = v_new_id WHERE id = r_supplier.id;
    END LOOP;
  END IF;
END $$;

COMMIT;
