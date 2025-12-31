-- Corrigir Copa - Água Mineral conforme extrato OFX
-- Extrato mostra:
-- 13/01 - AGUA PURA COM DISTRIBUIDORA LTDA: R$ 187,00 (outro fornecedor - não é Ampla)
-- 13/01 - LUIZ ALVES TAVEIRA: R$ 96,00
-- 24/01 - LUIZ ALVES TAVEIRA: R$ 96,00
-- Total Luiz Alves (Ampla): R$ 192,00

-- 1. Remover o lançamento incorreto de R$ 192,00 "Água Mineral - Ampla"
DELETE FROM accounting_entries
WHERE id = '1db7969d-15db-4fbf-8a08-e99502e80bef';

-- 2. Remover provisionamentos duplicados
DELETE FROM accounting_entries
WHERE id IN (
    '400650cb-f778-4acf-926f-43d2821b9ccd',  -- Provisionamento Água Mineral R$ 192,00
    '6c91fb5b-5be9-43fb-806b-7aa08b6365fa'   -- Provisionamento Luiz Alves R$ 96,00
);

-- 3. Corrigir o pagamento do Luiz Alves 13/01 para ter centro de custo Copa
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.14'),
    description = 'Copa: Água Mineral - Luiz Alves Taveira (10 galões)'
WHERE id = 'ee6ac275-7edc-4468-af4b-7932d3c149b3';

-- 4. Corrigir descrição do pagamento 24/01
UPDATE accounting_entries
SET description = 'Copa: Água Mineral - Luiz Alves Taveira (10 galões)'
WHERE id = '35078207-fb34-4f88-bdf9-6b2eb2e3823c';

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - Copa/Água Mineral corrigido com extrato.';
