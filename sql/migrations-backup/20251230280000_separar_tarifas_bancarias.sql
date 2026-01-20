-- Separar Tarifas Bancárias em subcategorias para análise de custo por boleto

-- Criar subcategorias de Tarifas
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES
    ('1.13.1', 'AMPLA.TARIFAS.BOLETOS', 'Taxa de Emissão de Boletos (R$ 1,89/boleto)',
     (SELECT id FROM cost_centers WHERE code = '1.13'), true, 'expenses'),
    ('1.13.2', 'AMPLA.TARIFAS.MANUT_TITULOS', 'Manutenção de Títulos em Aberto (>3 meses)',
     (SELECT id FROM cost_centers WHERE code = '1.13'), true, 'expenses'),
    ('1.13.3', 'AMPLA.TARIFAS.CESTA', 'Cesta de Relacionamento Bancário (mensal)',
     (SELECT id FROM cost_centers WHERE code = '1.13'), true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Mover lançamentos para subcategorias corretas

-- Boletos (todos que contêm "Tarifa Boleto")
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.13.1'),
    description = REPLACE(description, 'Pagamento: Pagamento: Tarifa Boleto', 'Tarifa: Emissão de Boleto')
WHERE id IN (
    '83f28d43-619a-4a80-a50d-acc2c68646ac',  -- R$ 149,20
    '694e1f0a-cb49-4b74-9812-04454ab1fa5f',  -- R$ 9,45
    '8a2f9e50-5924-44ea-b0c3-c3bbb0d66dee',  -- R$ 3,78
    '95f28d29-9249-4352-93fd-6f0b67b28d0c',  -- R$ 3,78
    'e0773ef8-643a-44e8-8bba-d6b23dc13dc5',  -- R$ 9,45
    '25d05a19-d9be-44a7-ba7c-4eccb1cc88af',  -- R$ 9,45
    '99245da1-5d39-46ff-98b1-df0805fd4239'   -- R$ 9,45
);

-- Manutenção de Títulos
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.13.2'),
    description = 'Tarifa: Manutenção de Títulos em Aberto'
WHERE id = 'ba9afc94-fbf7-4162-ae74-4a8b38e0455c';  -- R$ 62,37

-- Cesta de Relacionamento (manutenção conta)
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.13.3'),
    description = 'Tarifa: Cesta de Relacionamento Bancário'
WHERE id = '3220808c-4bae-446b-bb29-a8365795e1b0';  -- R$ 59,28

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Tarifas bancárias separadas.';
