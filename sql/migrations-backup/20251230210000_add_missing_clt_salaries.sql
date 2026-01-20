-- Adicionar salários CLT faltantes de Janeiro/2025
-- Estes pagamentos existem no extrato OFX mas não foram importados como accounting_entries

-- Josimar dos Santos Mota (Contábil CLT)
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-10', '2025-01-01', 'Salário: JOSIMAR DOS SANTOS MOTA - Adiantamento', 'pagamento_despesa', 35.98, 35.98, (SELECT id FROM cost_centers WHERE code = '1.3.1')),
('2025-01-15', '2025-01-01', 'Salário: JOSIMAR DOS SANTOS MOTA - Adiantamento', 'pagamento_despesa', 1504.80, 1504.80, (SELECT id FROM cost_centers WHERE code = '1.3.1')),
('2025-01-23', '2025-01-01', 'Salário: JOSIMAR DOS SANTOS MOTA - Reembolso', 'pagamento_despesa', 35.98, 35.98, (SELECT id FROM cost_centers WHERE code = '1.3.1')),
('2025-01-28', '2025-01-01', 'Salário: JOSIMAR DOS SANTOS MOTA - Reembolso', 'pagamento_despesa', 81.46, 81.46, (SELECT id FROM cost_centers WHERE code = '1.3.1')),
('2025-01-30', '2025-01-01', 'Salário: JOSIMAR DOS SANTOS MOTA - Salário', 'pagamento_despesa', 1813.22, 1813.22, (SELECT id FROM cost_centers WHERE code = '1.3.1')),
('2025-01-30', '2025-01-01', 'Salário: JOSIMAR DOS SANTOS MOTA - Bonificação', 'pagamento_despesa', 2000.00, 2000.00, (SELECT id FROM cost_centers WHERE code = '1.3.1')),
('2025-01-30', '2025-01-01', 'Salário: JOSIMAR DOS SANTOS MOTA - Participação', 'pagamento_despesa', 2508.00, 2508.00, (SELECT id FROM cost_centers WHERE code = '1.3.1'))
ON CONFLICT DO NOTHING;

-- Thaynara Conceição de Melo (Contábil CLT)
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-15', '2025-01-01', 'Salário: THAYNARA CONCEICAO DE MELO - Adiantamento', 'pagamento_despesa', 1491.10, 1491.10, (SELECT id FROM cost_centers WHERE code = '1.3.1')),
('2025-01-30', '2025-01-01', 'Salário: THAYNARA CONCEICAO DE MELO - Salário', 'pagamento_despesa', 2020.92, 2020.92, (SELECT id FROM cost_centers WHERE code = '1.3.1'))
ON CONFLICT DO NOTHING;

-- Lilian Moreira da Costa (Limpeza CLT)
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-15', '2025-01-01', 'Salário: LILIAN MOREIRA DA COSTA - Adiantamento', 'pagamento_despesa', 1045.00, 1045.00, (SELECT id FROM cost_centers WHERE code = '1.11')),
('2025-01-30', '2025-01-01', 'Salário: LILIAN MOREIRA DA COSTA - Salário', 'pagamento_despesa', 1567.50, 1567.50, (SELECT id FROM cost_centers WHERE code = '1.11'))
ON CONFLICT DO NOTHING;

-- Corrigir duplicidade do Luiz Alves Taveira na Copa
-- Remover o lançamento de provisionamento (tipo despesa) pois já existe o pagamento
DELETE FROM accounting_entries
WHERE description ILIKE '%luiz alves taveira%'
AND entry_type = 'despesa';

-- Mover Papelaria de Copa para centro de custo apropriado (Material de Escritório)
-- Por enquanto deixar em Copa, mas marcar para revisão
UPDATE accounting_entries
SET description = 'Pagamento: Material de Escritório - Papelaria - Ampla'
WHERE description ILIKE '%papelaria%';

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Salários CLT adicionados.';
