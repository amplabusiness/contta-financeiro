-- =====================================================
-- LIMPEZA DE CONTA BANCÁRIA DUPLICADA
-- Desativa a conta Sicredi com saldo R$ 0,00 (duplicada)
-- Mantém a conta correta com saldo R$ 90.725,10
-- =====================================================

-- Desativar a conta duplicada (saldo = 0)
UPDATE bank_accounts
SET
  is_active = false,
  name = name || ' (DUPLICADA - DESATIVADA)'
WHERE current_balance = 0
  AND bank_name ILIKE '%sicredi%'
  AND is_active = true;

-- Verificar resultado
DO $$
DECLARE
  v_active_count INT;
  v_inactive_count INT;
BEGIN
  SELECT COUNT(*) INTO v_active_count FROM bank_accounts WHERE is_active = true;
  SELECT COUNT(*) INTO v_inactive_count FROM bank_accounts WHERE is_active = false;

  RAISE NOTICE 'Limpeza concluída!';
  RAISE NOTICE 'Contas ativas: %', v_active_count;
  RAISE NOTICE 'Contas inativas: %', v_inactive_count;
END $$;
