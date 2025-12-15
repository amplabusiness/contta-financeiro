-- Migration: Bloquear lançamentos manuais em contas de folha de pagamento
-- Data: 2025-12-15
-- Descrição: Contas de folha de pagamento só podem receber lançamentos via sistema de folha

-- 1. Adicionar coluna para marcar contas bloqueadas (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chart_of_accounts' AND column_name = 'is_manual_entry_blocked'
  ) THEN
    ALTER TABLE chart_of_accounts ADD COLUMN is_manual_entry_blocked BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Marcar contas de folha de pagamento como bloqueadas
UPDATE chart_of_accounts 
SET is_manual_entry_blocked = TRUE 
WHERE code IN (
  '4.1.1.01',      -- Salários e Ordenados
  '4.1.1.02',      -- Encargos de Salários
  '4.1.1.03',      -- Plano de Saúde
  '4.1.1.04',      -- Vale Alimentação
  '4.1.2.13.02',   -- Dep. Contábil (Terceirizado)
  '4.1.2.13.04'    -- Dep. Financeiro (Terceirizado)
);

-- 3. Criar trigger para impedir lançamentos manuais
CREATE OR REPLACE FUNCTION check_manual_entry_block()
RETURNS TRIGGER AS $$
DECLARE
  v_is_blocked BOOLEAN;
  v_account_name TEXT;
BEGIN
  -- Verificar se a conta está bloqueada
  SELECT is_manual_entry_blocked, name 
  INTO v_is_blocked, v_account_name
  FROM chart_of_accounts 
  WHERE id = NEW.account_id;
  
  -- Se está bloqueada e não é um lançamento do sistema de folha
  IF v_is_blocked = TRUE AND 
     (NEW.description NOT LIKE '%Folha de Pagamento%' AND 
      NEW.description NOT LIKE '%folha_pagamento%') THEN
    RAISE EXCEPTION 'Conta "%" está bloqueada para lançamentos manuais. Use o sistema de Folha de Pagamento.', v_account_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS tr_check_manual_entry_block ON accounting_entry_lines;

-- Criar trigger
CREATE TRIGGER tr_check_manual_entry_block
  BEFORE INSERT ON accounting_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION check_manual_entry_block();

-- 4. Adicionar comentário explicativo
COMMENT ON COLUMN chart_of_accounts.is_manual_entry_blocked IS 
'Se TRUE, a conta só aceita lançamentos via sistema de Folha de Pagamento';

-- Log
DO $$
BEGIN
  RAISE NOTICE 'Contas de folha de pagamento bloqueadas para lançamentos manuais';
END $$;
