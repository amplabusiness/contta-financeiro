-- Criar subcategorias de Copa para análise de crescimento dos gastos
-- E corrigir descrições dos reembolsos Josimar (tudo pão de queijo)

-- Criar subcategorias
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES
    ('1.14.1', 'AMPLA.COPA.AGUA', 'Água Mineral',
     (SELECT id FROM cost_centers WHERE code = '1.14'), true, 'expenses'),
    ('1.14.2', 'AMPLA.COPA.PAO_QUEIJO', 'Pão de Queijo e Lanches',
     (SELECT id FROM cost_centers WHERE code = '1.14'), true, 'expenses'),
    ('1.14.3', 'AMPLA.COPA.CAFE', 'Café e Chá',
     (SELECT id FROM cost_centers WHERE code = '1.14'), true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Mover Água Mineral para subcategoria
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.14.1')
WHERE description ILIKE '%água mineral%' OR description ILIKE '%luiz alves taveira%';

-- Mover Pão de Queijo para subcategoria (incluindo reembolsos Josimar)
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.14.2'),
    description = REPLACE(description, 'Café e Pão de Queijo', 'Pão de Queijo')
WHERE id IN (
    'b0465887-231f-46b5-9fe2-2d52e13fc90c',  -- Reembolso Josimar 28/01 R$ 81,46
    'bb5c2bb7-f76e-4144-ab8a-312851e79c77',  -- Reembolso Josimar 23/01 R$ 35,98
    'be68434b-657f-4e6e-8074-274b0001ec16'   -- Reembolso Josimar 10/01 R$ 35,98
);

-- Mover "Pao de queijo e cha" para subcategoria pão de queijo
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.14.2'),
    description = 'Copa: Pão de Queijo e Chá - Ampla'
WHERE description ILIKE '%pao de queijo%';

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Copa separado em subcategorias.';
