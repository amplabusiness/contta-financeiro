-- ================================================
-- Remover JR SOLUÇÕES INDUSTRIAIS do Grupo ACTION
-- Análise de sócios confirmou que não há relação societária
-- ================================================

-- 1. Remover JR SOLUÇÕES do grupo ACTION
DELETE FROM economic_group_members
WHERE economic_group_id = 'a1000005-0000-0000-0000-000000000005'
  AND client_id = '1d8445bf-725d-4a01-a9a4-6196d14fd45b';

-- 2. Atualizar total do grupo ACTION (sem JR)
UPDATE economic_groups
SET total_monthly_fee = 24287.44,  -- 12143.72 + 12143.72
    name = 'Grupo ACTION'
WHERE id = 'a1000005-0000-0000-0000-000000000005';
