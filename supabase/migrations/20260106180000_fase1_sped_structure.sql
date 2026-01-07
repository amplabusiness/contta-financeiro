-- ADICIONA COLUNA CODIGO REFERENCIAL SPED E TRAVA SINTETICA
-- Autor: Dr. Cicero

BEGIN;

-- 1. Adicionar coluna para o Código Referencial (Registro I051 do SPED ECD)
ALTER TABLE chart_of_accounts 
ADD COLUMN IF NOT EXISTS sped_referencial_code VARCHAR(50);

COMMENT ON COLUMN chart_of_accounts.sped_referencial_code IS 'Código da conta no Plano Referencial da Receita Federal (SPED ECD/ECF)';

-- 2. Função de Segurança: Impedir lançamentos em contas Sintéticas
-- "Nenhum lançamento pode ser feito em nó de agrupamento, apenas nas folhas (analíticas)"
CREATE OR REPLACE FUNCTION check_analytical_account_only()
RETURNS TRIGGER AS $$
DECLARE
  v_is_analytical BOOLEAN;
  v_account_code VARCHAR;
BEGIN
  -- Buscar se a conta é analítica
  SELECT is_analytical, code INTO v_is_analytical, v_account_code
  FROM chart_of_accounts
  WHERE id = NEW.account_id;

  -- Se não encontrar a conta (erro de integridade referencial pegaria, mas validamos aqui)
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Conta contábil ID % não encontrada.', NEW.account_id;
  END IF;

  -- A Regra de Ouro do SPED
  IF v_is_analytical = FALSE THEN
     RAISE EXCEPTION 'ERRO CONTÁBIL: Tentativa de lançamento na conta Sintética/Grupo "%". Lançamentos são permitidos APENAS em contas Analíticas.', v_account_code;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger para aplicar a segurança nos itens de lançamento
DROP TRIGGER IF EXISTS trg_check_analytical_account ON accounting_entry_items;

CREATE TRIGGER trg_check_analytical_account
BEFORE INSERT OR UPDATE ON accounting_entry_items
FOR EACH ROW
EXECUTE FUNCTION check_analytical_account_only();

COMMIT;
