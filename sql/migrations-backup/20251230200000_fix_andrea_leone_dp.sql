-- Andrea Leone Bastos é do DP.TERCEIROS, não RH
-- A psicóloga é a outra ANDREIA (já está em RH corretamente)
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.1.2')
WHERE description ILIKE '%andrea leone%';
