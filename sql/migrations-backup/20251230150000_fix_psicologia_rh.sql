-- Mover Dep. Psicologia para RH
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.8')
WHERE description ILIKE '%dep. psicologia%';

-- Criar centro de custo para Anuidades Profissionais
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.18', 'AMPLA.ANUIDADES', 'Anuidades CRC, CFC e outras', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Mover anuidades CRC
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.18')
WHERE description ILIKE '%anuidade crc%';
