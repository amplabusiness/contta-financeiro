-- Rosemeire Rodrigues - Chefe do Departamento Pessoal
-- Parte CLT e parte por fora (terceiro)

-- Pagamento 15/01 - R$ 2.508,00 (parte CLT)
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-15', '2025-01-01', 'Salário: ROSEMEIRE RODRIGUES - Adiantamento CLT', 'pagamento_despesa', 2508.00, 2508.00, (SELECT id FROM cost_centers WHERE code = '1.1.1'))
ON CONFLICT DO NOTHING;

-- Pagamento 30/01 - R$ 3.870,00 (salário + por fora)
-- Vamos dividir: assumindo que o salário CLT é similar ao adiantamento
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-30', '2025-01-01', 'Salário: ROSEMEIRE RODRIGUES - Salário CLT', 'pagamento_despesa', 3870.00, 3870.00, (SELECT id FROM cost_centers WHERE code = '1.1.1'))
ON CONFLICT DO NOTHING;

-- Nota: O usuário informou que parte é CLT e parte é "por fora"
-- Por enquanto classificamos tudo como DP.CLT
-- Posteriormente pode-se separar a parte "por fora" para DP.TERCEIROS

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Rosemeire (Chefe DP) adicionada.';
