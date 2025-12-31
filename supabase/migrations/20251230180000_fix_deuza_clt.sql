-- Corrigir classificação da Deuza Resende
-- Ela é CLT do DP, não terceira

-- Mover Deuza de DP.TERCEIROS para DP.CLT
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.1.1')
WHERE description ILIKE '%deuza%';

-- Lilian é faxineira CLT - classificar em LIMPEZA
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.11')
WHERE description ILIKE '%lilian%';

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - CLT classificados corretamente.';
