-- =====================================================
-- SCRIPT PARA INICIALIZAR HONORÁRIOS EM SALÁRIOS MÍNIMOS
-- =====================================================
-- Este script deve ser executado UMA VEZ para converter
-- os honorários atuais para quantidade de salários mínimos
-- usando o SM de referência de R$ 1.518,00 (2025)
--
-- IMPORTANTE: O usuário mencionou que o honorário base era
-- R$ 275,98 quando o SM era R$ 1.518,00
-- Isso significa: 275,98 / 1518 = 0,1818 SM
-- =====================================================

-- 1. Verificar o salário mínimo atual na tabela
SELECT * FROM minimum_wage_history ORDER BY effective_date DESC LIMIT 5;

-- 2. Ver quantos clientes ativos precisam ser inicializados
SELECT
  COUNT(*) AS total_clientes,
  COUNT(CASE WHEN fee_in_minimum_wages IS NULL THEN 1 END) AS sem_fee_in_mw,
  COUNT(CASE WHEN fee_in_minimum_wages IS NOT NULL THEN 1 END) AS com_fee_in_mw
FROM clients
WHERE is_active = true
  AND NOT COALESCE(is_pro_bono, false)
  AND NOT COALESCE(is_barter, false)
  AND monthly_fee > 0;

-- 3. Preview: Ver como ficaria a conversão
-- Usando SM atual de R$ 1.518,00 como referência
SELECT
  c.id,
  c.name,
  c.monthly_fee,
  c.fee_in_minimum_wages AS atual_fee_in_mw,
  ROUND(c.monthly_fee / 1518.00, 4) AS novo_fee_in_mw,
  c.last_fee_adjustment_date,
  c.last_adjustment_minimum_wage
FROM clients c
WHERE c.is_active = true
  AND NOT COALESCE(c.is_pro_bono, false)
  AND NOT COALESCE(c.is_barter, false)
  AND c.monthly_fee > 0
ORDER BY c.name
LIMIT 20;

-- 4. EXECUTAR INICIALIZAÇÃO
-- Descomente o bloco abaixo para executar
/*
DO $$
DECLARE
  v_client RECORD;
  v_result RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_client IN
    SELECT id, name, monthly_fee
    FROM clients
    WHERE is_active = true
      AND NOT COALESCE(is_pro_bono, false)
      AND NOT COALESCE(is_barter, false)
      AND monthly_fee > 0
      AND (fee_in_minimum_wages IS NULL OR fee_in_minimum_wages = 0)
  LOOP
    -- Usar '2025-01-01' como data de referência (SM = R$ 1.518,00)
    SELECT * INTO v_result FROM init_client_minimum_wage_fee(v_client.id, '2025-01-01'::DATE);
    v_count := v_count + 1;
    RAISE NOTICE 'Inicializado: % - %', v_client.name, v_result.message;
  END LOOP;

  RAISE NOTICE 'Total de clientes inicializados: %', v_count;
END $$;
*/

-- 5. Verificar clientes pendentes de reajuste
SELECT * FROM v_clients_pending_adjustment;

-- 6. Simular reajuste em lote (DRY RUN)
SELECT * FROM batch_apply_fee_adjustments(true, true);

-- 7. APLICAR REAJUSTE EM LOTE (só descomente quando tiver certeza!)
-- SELECT * FROM batch_apply_fee_adjustments(true, false);

-- 8. Verificar histórico de reajustes
SELECT
  fah.*,
  c.name AS client_name
FROM fee_adjustment_history fah
JOIN clients c ON c.id = fah.client_id
ORDER BY fah.adjustment_date DESC;
