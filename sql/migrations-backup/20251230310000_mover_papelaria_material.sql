-- Mover Papelaria de Copa para Material de Escritório

-- Mover o pagamento para Material (1.21)
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.21'),
    description = 'Material: Papelaria - Ampla'
WHERE id = '6a09b9f3-f6a5-456b-a1ec-785ca06d6022';

-- Remover provisionamento duplicado
DELETE FROM accounting_entries
WHERE id = '2df104d1-9dbc-4015-9b96-5e3310fba7dd';

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Papelaria movida para Material.';
