-- Corrigir tarifas bancárias com valores exatos do extrato OFX
-- Total sistema: R$ 316,21 | Total extrato: R$ 331,44 | Diferença: R$ 15,23

-- Adicionar tarifas faltantes baseado no extrato OFX

-- Taxa de Boletos faltante: R$ 5,78
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-02', '2025-01-01', 'Tarifa: Emissão de Boleto (ajuste extrato)', 'pagamento_despesa', 5.78, 5.78,
 (SELECT id FROM cost_centers WHERE code = '1.13.1'))
ON CONFLICT DO NOTHING;

-- Manutenção de Títulos faltante: R$ 9,45
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-06', '2025-01-01', 'Tarifa: Manutenção de Títulos (ajuste extrato)', 'pagamento_despesa', 9.45, 9.45,
 (SELECT id FROM cost_centers WHERE code = '1.13.2'))
ON CONFLICT DO NOTHING;

-- Atualizar o valor de manutenção de títulos existente (R$ 62,37 está incorreto, deveria ser parte do total R$ 71,82)
-- O lançamento de R$ 62,37 já existe, vamos apenas manter e o ajuste de R$ 9,45 completa

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Tarifas ajustadas com extrato OFX.';
