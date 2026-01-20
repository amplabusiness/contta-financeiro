-- Ajustes finais de classificação Janeiro/2025

-- 1. LUIZ ALVES TAVEIRA - Vende água mineral → 1.14 COPA
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.14')
WHERE description ILIKE '%luiz alves taveira%';

-- 2. CAIXA ECONOMICA FEDERAL - FGTS dos funcionários
-- Criar centro de custo para FGTS
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.17', 'AMPLA.FGTS', 'FGTS - Fundo de Garantia', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.17')
WHERE description ILIKE '%caixa economica federal%';

-- 3. Vonoria - Garantir que está como adiantamento sócio
UPDATE accounting_entries
SET
  cost_center_id = '40d9d6ae-6b72-4744-a400-a29dc3b71b55',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%vonoria%';

-- 4. Verificar o que resta no Administrativo
-- Miguel Carvalho, Anuidade CRC permanecem lá por enquanto

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - classificação detalhada completa.';
