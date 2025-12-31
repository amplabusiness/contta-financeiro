-- Adicionar IPVA/Licenciamento DETRAN como adiantamento a sócios
-- Pagamentos de veículos do proprietário/filhos - não entram no DRE

-- Criar subcategoria para IPVA/Veículos dentro de Sérgio
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES
    ('3.3', 'SERGIO.VEICULOS', 'IPVA, Licenciamento e Despesas com Veículos',
     (SELECT id FROM cost_centers WHERE code = '3. SERGIO'), true, 'assets')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Adicionar lançamentos conforme extrato
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
-- 06/01 - 4 veículos
('2025-01-06', '2025-01-01', 'IPVA/Licenciamento - DETRAN (veículo 1)', 'adiantamento_socio', 10843.02, 10843.02,
 (SELECT id FROM cost_centers WHERE code = '3.3')),
('2025-01-06', '2025-01-01', 'IPVA/Licenciamento - DETRAN (veículo 2)', 'adiantamento_socio', 1420.08, 1420.08,
 (SELECT id FROM cost_centers WHERE code = '3.3')),
('2025-01-06', '2025-01-01', 'IPVA/Licenciamento - DETRAN (veículo 3)', 'adiantamento_socio', 504.53, 504.53,
 (SELECT id FROM cost_centers WHERE code = '3.3')),
('2025-01-06', '2025-01-01', 'IPVA/Licenciamento - DETRAN (veículo 4)', 'adiantamento_socio', 457.12, 457.12,
 (SELECT id FROM cost_centers WHERE code = '3.3')),
-- 15/01 - 1 veículo
('2025-01-15', '2025-01-01', 'IPVA/Licenciamento - DETRAN (veículo 5)', 'adiantamento_socio', 251.25, 251.25,
 (SELECT id FROM cost_centers WHERE code = '3.3'))
ON CONFLICT DO NOTHING;

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - IPVA/DETRAN adicionado como adiantamento.';
