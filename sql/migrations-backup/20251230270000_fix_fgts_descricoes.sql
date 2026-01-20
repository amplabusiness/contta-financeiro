-- Corrigir descrições do FGTS para deixar claro a que se refere cada pagamento

-- FGTS 15/01 R$ 2.188,34 - Folha de Dezembro/2024
UPDATE accounting_entries
SET description = 'FGTS: Folha Dezembro/2024 - CEF'
WHERE id = '3bd30621-75a4-49eb-ac74-91a4f4162d15';

-- FGTS 31/01 R$ 834,46 - Multa Rescisória Deuza (40% FGTS acumulado)
UPDATE accounting_entries
SET description = 'FGTS: Multa Rescisória 40% - Deuza',
    cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.20')  -- Mover para Rescisões
WHERE id = 'ef7c663a-a5e5-4f18-94dd-ca7a2c0fc635';

-- Remover lançamentos duplicados de FGTS (provisionamento e pagamento duplicado)
DELETE FROM accounting_entries
WHERE id IN (
    'db12f5ff-37b2-4805-b35d-8737da1930d0',  -- Provisionamento
    'fac4b197-30ca-4639-b4f7-506307d62553'   -- Pagamento duplicado
);

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - FGTS corrigido.';
