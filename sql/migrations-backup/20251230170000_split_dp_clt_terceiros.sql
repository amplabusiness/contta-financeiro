-- Separar Departamento Pessoal em CLT e Terceiros
-- Permite acompanhar separadamente o custo com funcionários registrados vs PJs

-- 1. Criar centro de custo para DP CLT
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.1.1', 'AMPLA.DP.CLT', 'Dep. Pessoal - Funcionários CLT', 'dff8e3e6-9f67-4908-a715-aeafe7715458', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Criar centro de custo para DP Terceiros
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.1.2', 'AMPLA.DP.TERCEIROS', 'Dep. Pessoal - Terceiros/PJ', 'dff8e3e6-9f67-4908-a715-aeafe7715458', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 3. Mover terceiros do DP para o novo centro de custo
-- Coraci Aline, Deuza Resende, Andrea Leone são terceiros
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.1.2')
WHERE cost_center_id = 'dff8e3e6-9f67-4908-a715-aeafe7715458'
AND (
  description ILIKE '%coraci%'
  OR description ILIKE '%deuza%'
  OR description ILIKE '%andrea leone%'
);

-- 4. Fazer o mesmo para o Fiscal - separar CLT de Terceiros
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.2.1', 'AMPLA.FISCAL.CLT', 'Dep. Fiscal - Funcionários CLT', '97ebef26-92fd-4db0-bd9f-7acb63880c97', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.2.2', 'AMPLA.FISCAL.TERCEIROS', 'Dep. Fiscal - Terceiros/PJ (Daniel)', '97ebef26-92fd-4db0-bd9f-7acb63880c97', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Daniel é terceiro do Fiscal
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.2.2')
WHERE cost_center_id = '97ebef26-92fd-4db0-bd9f-7acb63880c97'
AND (
  description ILIKE '%dep. fiscal%'
  OR description ILIKE '%comissão%'
);

-- 5. Fazer o mesmo para Contábil
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.3.1', 'AMPLA.CONTABIL.CLT', 'Dep. Contábil - Funcionários CLT', '67f8112d-a934-40c8-99bb-57630e29bc62', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.3.2', 'AMPLA.CONTABIL.TERCEIROS', 'Dep. Contábil - Terceiros/PJ', '67f8112d-a934-40c8-99bb-57630e29bc62', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 6. Fazer o mesmo para Legalização
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.4.1', 'AMPLA.LEGALIZACAO.CLT', 'Legalização - Funcionários CLT', '3148dccf-4458-4d63-a152-c813097ce1e9', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.4.2', 'AMPLA.LEGALIZACAO.TERCEIROS', 'Legalização - Terceiros/PJ', '3148dccf-4458-4d63-a152-c813097ce1e9', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Dep. Legalização - verificar se é CLT ou terceiro
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.4.2')
WHERE cost_center_id = '3148dccf-4458-4d63-a152-c813097ce1e9'
AND description ILIKE '%dep. legalização%';

COMMENT ON TABLE cost_centers IS 'Centros de custo com separação CLT x Terceiros por departamento';
