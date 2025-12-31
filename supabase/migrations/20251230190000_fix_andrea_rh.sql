-- Andrea Leone Bastos é psicóloga do RH, não do DP
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.8')
WHERE description ILIKE '%andrea leone%';

-- Verificar também ANDREIA (pode ser a mesma pessoa)
-- Já está em 1.8 (RH), então ok
