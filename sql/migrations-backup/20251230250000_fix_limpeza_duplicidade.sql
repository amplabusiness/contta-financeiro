-- Corrigir duplicidade em Limpeza
-- O lançamento "Dep. Limpeza - Ampla" de R$ 2.612,50 é duplicado (soma de Lilian Adiantamento + Salário)
-- O Material de Limpeza deveria estar em outra conta

-- 1. Deletar o lançamento duplicado "Dep. Limpeza"
DELETE FROM accounting_entries
WHERE id = '47921b49-9ca2-45f0-87d3-b03f0ae26f8f';

-- 2. Criar centro de custo para Material de Escritório/Limpeza
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.21', 'AMPLA.MATERIAL', 'Material de Escritório e Limpeza', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 3. Mover o Material de Limpeza para o novo centro de custo
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.21')
WHERE id = '5b6badd2-2a6e-4137-b27d-6c078343dbc7';

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Duplicidade Limpeza corrigida.';
