-- Corrigir Impostos conforme extrato OFX
-- Extrato mostra apenas: DAS Simples Nacional R$ 2.232,28 em 15/01
-- Os outros valores não existem no extrato e devem ser removidos

-- Apagar lançamentos de impostos que não existem no extrato
DELETE FROM accounting_entries
WHERE id IN (
    '67d76cb8-bf36-4769-a0c8-d49fb7137916',  -- ISS Próprio R$ 624,42 (não existe no extrato)
    '732caebf-ab99-419e-a219-557d5ac78b82',  -- ISS Completo R$ 3.684,74 (não existe no extrato)
    '04f1fe22-7820-464d-a3c0-0edb96df0fef'   -- Simples Nacional R$ 2.960,08 (valor errado)
);

-- Criar lançamento correto do Simples Nacional conforme extrato
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-15', '2025-01-01', 'DAS Simples Nacional - Ampla Contabilidade', 'pagamento_despesa', 2232.28, 2232.28,
 (SELECT id FROM cost_centers WHERE code = '1.19'))
ON CONFLICT DO NOTHING;

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Impostos corrigidos com extrato.';
