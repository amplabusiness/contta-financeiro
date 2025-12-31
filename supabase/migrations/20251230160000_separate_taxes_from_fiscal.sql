-- Separar impostos do centro de custo Fiscal
-- Impostos são obrigações tributárias, não custo do departamento fiscal

-- 1. Criar centro de custo para Impostos
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.19', 'AMPLA.IMPOSTOS', 'Impostos e Tributos (ISS, Simples Nacional, etc)', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Mover ISS e Simples Nacional para centro de custo de Impostos
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.19')
WHERE (
  description ILIKE '%ISS Completo%'
  OR description ILIKE '%ISS Próprio%'
  OR description ILIKE '%ISS Prórprio%'
  OR description ILIKE '%Simples Nacional%'
);

-- Agora o Fiscal terá apenas:
-- - Dep. Fiscal (Daniel) = R$ 10.500,00
-- - Comissão (participação Daniel) = R$ 2.278,62
-- Total real do Fiscal = R$ 12.778,62
