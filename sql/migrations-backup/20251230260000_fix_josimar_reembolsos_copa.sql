-- Corrigir reembolsos do Josimar - são despesas de Copa (café e pão de queijo), não salário
-- Total: R$ 35,98 + R$ 35,98 + R$ 81,46 = R$ 153,42

-- Mover para AMPLA.COPA e corrigir descrição
UPDATE accounting_entries
SET
    cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.14'),
    description = 'Reembolso: Café e Pão de Queijo - Josimar'
WHERE id IN (
    'be68434b-657f-4e6e-8074-274b0001ec16',  -- 10/01 - R$ 35,98
    'bb5c2bb7-f76e-4144-ab8a-312851e79c77',  -- 23/01 - R$ 35,98
    'b0465887-231f-46b5-9fe2-2d52e13fc90c'   -- 28/01 - R$ 81,46
);

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Reembolsos Josimar movidos para Copa.';
