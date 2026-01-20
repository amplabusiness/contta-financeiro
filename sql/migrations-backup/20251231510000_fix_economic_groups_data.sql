-- ================================================
-- FIX: Corrigir dados dos grupos econômicos
-- 1. Grupo Cezário: Adicionar A.I EMPREENDIMENTOS como membro
-- 2. Grupo 3: Remover por ter apenas 1 membro (não é grupo)
-- ================================================

-- 1. Adicionar A.I EMPREENDIMENTOS ao Grupo Cezário
-- O pagador deve estar na lista de membros
INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
SELECT
  'd2335257-6209-4d71-990a-4fb339e24b27'::uuid, -- Grupo Cezário
  '9841edf9-1767-4710-aa25-7abc8223d29f'::uuid, -- A.I EMPREENDIMENTOS
  (SELECT monthly_fee FROM clients WHERE id = '9841edf9-1767-4710-aa25-7abc8223d29f'::uuid)
WHERE NOT EXISTS (
  SELECT 1 FROM economic_group_members
  WHERE economic_group_id = 'd2335257-6209-4d71-990a-4fb339e24b27'::uuid
  AND client_id = '9841edf9-1767-4710-aa25-7abc8223d29f'::uuid
);

-- 2. Atualizar total do Grupo Cezário
UPDATE economic_groups
SET total_monthly_fee = (
  SELECT COALESCE(SUM(individual_fee), 0)
  FROM economic_group_members
  WHERE economic_group_id = 'd2335257-6209-4d71-990a-4fb339e24b27'::uuid
)
WHERE id = 'd2335257-6209-4d71-990a-4fb339e24b27'::uuid;

-- 3. Remover Grupo 3 (apenas 1 membro não é grupo)
-- Primeiro remove os membros
DELETE FROM economic_group_members
WHERE economic_group_id = '0e901f25-a9c2-4f9e-b99a-a46f9dbff984'::uuid;

-- Depois desativa o grupo
UPDATE economic_groups
SET is_active = false
WHERE id = '0e901f25-a9c2-4f9e-b99a-a46f9dbff984'::uuid;
