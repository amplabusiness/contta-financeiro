-- Adicionar ISS Fixo da Ampla conforme extrato
-- 06/01 - PMGO-C R$ 608,61 (ISS fixo mensal)

-- Criar subcategorias de Impostos para separar ISS do Simples
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES
    ('1.19.1', 'AMPLA.IMPOSTOS.SIMPLES', 'DAS Simples Nacional',
     (SELECT id FROM cost_centers WHERE code = '1.19'), true, 'expenses'),
    ('1.19.2', 'AMPLA.IMPOSTOS.ISS', 'ISS Fixo Mensal (Prefeitura)',
     (SELECT id FROM cost_centers WHERE code = '1.19'), true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Mover o Simples Nacional existente para subcategoria
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.19.1')
WHERE description ILIKE '%simples nacional%' AND entry_date >= '2025-01-01' AND entry_date <= '2025-01-31';

-- Adicionar ISS Fixo conforme extrato
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-06', '2025-01-01', 'ISS Fixo Mensal - Ampla (PMGO)', 'pagamento_despesa', 608.61, 608.61,
 (SELECT id FROM cost_centers WHERE code = '1.19.2'))
ON CONFLICT DO NOTHING;

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - ISS fixo adicionado.';
