-- Deuza Resende - Adiantamento dia 15/01 de R$ 1.200,00
-- Ela saiu em 24/01/2025, então este é o último adiantamento antes da rescisão

INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-15', '2025-01-01', 'Salário: DEUZA RESENDE DE JESUS - Adiantamento', 'pagamento_despesa', 1200.00, 1200.00, (SELECT id FROM cost_centers WHERE code = '1.1.1'))
ON CONFLICT DO NOTHING;

-- Mover a rescisão para centro de custo correto (já feito anteriormente, mas garantir)
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.20')
WHERE description ILIKE '%deuza%rescis%';
