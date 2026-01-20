-- Classificar adiantamentos a sócios por centro de custo
-- Permite acompanhar quanto foi adiantado para cada pessoa
-- Centros de custo:
-- 3. SERGIO - Sergio Carneiro Leão (id: 40d9d6ae-6b72-4744-a400-a29dc3b71b55)
-- 3.1.1 SERGIO.FILHOS.NAYARA - Nayara (id: 9f4a0624-88df-4650-9056-2364f40bd5ad)
-- 3.1.2 SERGIO.FILHOS.VICTOR - Victor Hugo (id: 2f4d4958-7f65-43d4-94f7-9e94a63d3091)
-- 3.1.3 SERGIO.FILHOS.SERGIO_AUGUSTO - Sergio Augusto (id: 5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d)

-- 1. Classificar adiantamentos para Nayara
UPDATE accounting_entries
SET cost_center_id = '9f4a0624-88df-4650-9056-2364f40bd5ad'
WHERE cost_center_id IS NULL
AND (
  description ILIKE '%nayara%'
  OR description ILIKE '%babá%nayara%'
);

-- 2. Classificar adiantamentos para Victor Hugo
UPDATE accounting_entries
SET cost_center_id = '2f4d4958-7f65-43d4-94f7-9e94a63d3091'
WHERE cost_center_id IS NULL
AND (
  description ILIKE '%victor hugo%'
  OR description ILIKE '%victor%adiantamento%'
  OR description ILIKE '%adiantamento%victor%'
  OR description ILIKE '%ipva bmw%victor%'
);

-- 3. Classificar adiantamentos para Sergio Augusto (filho)
UPDATE accounting_entries
SET cost_center_id = '5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d'
WHERE cost_center_id IS NULL
AND (
  description ILIKE '%sérgio augusto%'
  OR description ILIKE '%sergio augusto%'
);

-- 4. Classificar adiantamentos para Sergio (pai) - despesas pessoais dele
-- Inclui: Personal, Gás, Energia, IPVA veículos dele, Plano de Saúde, CRC, Casa do Lago
UPDATE accounting_entries
SET cost_center_id = '40d9d6ae-6b72-4744-a400-a29dc3b71b55'
WHERE cost_center_id IS NULL
AND (
  (description ILIKE '%sergio%' AND description NOT ILIKE '%augusto%')
  OR description ILIKE '%personal%sergio%'
  OR description ILIKE '%plano de saúde%sergio%'
  OR description ILIKE '%gás%sergio%'
  OR description ILIKE '%energia%sergio%'
  OR description ILIKE '%ipva cg%sergio%'
  OR description ILIKE '%ipva biz%sergio%'
  OR description ILIKE '%ipva carretinha%sergio%'
  OR description ILIKE '%crc%sergio%'
  OR description ILIKE '%anuidade crc%sergio%'
  OR description ILIKE '%casa lago%'
  OR description ILIKE '%tharson diego%'
);

-- 5. Classificar pagamentos de adiantamentos que não têm nome específico
-- (provavelmente são do Sergio pai)
UPDATE accounting_entries
SET cost_center_id = '40d9d6ae-6b72-4744-a400-a29dc3b71b55'
WHERE cost_center_id IS NULL
AND description ILIKE 'adiantamento: adiantamento sergio'
AND entry_type = 'adiantamento_socio';

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis. Adiantamentos a sócios classificados por centro de custo para acompanhamento individual.';
