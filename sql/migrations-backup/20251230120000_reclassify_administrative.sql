-- Reclassificar lançamentos administrativos para maior detalhamento
-- Baseado nas informações do usuário

-- 1. ANDREIA - Psicóloga terceira (vai para 1.8 AMPLA.RH)
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.8')
WHERE description ILIKE '%andreia%'
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

-- 2. Vonoria Amélia - Passadeira de roupas do Sergio (adiantamento sócio)
UPDATE accounting_entries
SET
  cost_center_id = '40d9d6ae-6b72-4744-a400-a29dc3b71b55',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%vonoria%';

-- 3. Comissão - Daniel - Participação em clientes (custo comercial/fiscal)
-- Por enquanto manter em Fiscal pois Daniel é responsável pelo Fiscal
UPDATE accounting_entries
SET cost_center_id = '97ebef26-92fd-4db0-bd9f-7acb63880c97'
WHERE description ILIKE '%comissão%ampla%';

-- 4. Criar centros de custo para melhor detalhamento
-- 1.9 Obras e Reformas
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.9', 'AMPLA.OBRAS', 'Obras e Reformas do Escritório', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 1.10 IPTU e Impostos Imobiliários
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.10', 'AMPLA.IPTU', 'IPTU e Impostos Imobiliários', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 1.11 Limpeza e Conservação
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.11', 'AMPLA.LIMPEZA', 'Limpeza e Conservação', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 1.12 Telecomunicações
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.12', 'AMPLA.TELECOM', 'Internet e Telefonia', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 1.13 Tarifas Bancárias
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.13', 'AMPLA.TARIFAS', 'Tarifas e Taxas Bancárias', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 1.14 Copa e Escritório
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.14', 'AMPLA.COPA', 'Copa, Água, Papelaria', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 1.15 Locações
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.15', 'AMPLA.LOCACOES', 'Locação de Equipamentos', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 1.16 Benefícios Funcionários
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.16', 'AMPLA.BENEFICIOS', 'Vale Alimentação, Vale Transporte', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 5. Reclassificar lançamentos
-- Obras e Reformas
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.9')
WHERE (description ILIKE '%outsider construtora%' OR description ILIKE '%obras ampla%')
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

-- IPTU
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.10')
WHERE description ILIKE '%iptu%ampla%'
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

-- Limpeza
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.11')
WHERE (description ILIKE '%dep. limpeza%' OR description ILIKE '%material de limpeza%')
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

-- Telecomunicações
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.12')
WHERE (description ILIKE '%internet%ampla%' OR description ILIKE '%telefone%ampla%')
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

-- Tarifas Bancárias
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.13')
WHERE (description ILIKE '%tarifa boleto%' OR description ILIKE '%manutenção%conta%' OR description ILIKE '%manutenção%títulos%')
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

-- Copa e Escritório
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.14')
WHERE (description ILIKE '%água mineral%' OR description ILIKE '%pao de queijo%' OR description ILIKE '%papelaria%')
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

-- Locações
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.15')
WHERE description ILIKE '%a f de oliveira%'
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

-- Benefícios
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.16')
WHERE (description ILIKE '%vale alimentação%' OR description ILIKE '%vale transporte%')
AND cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4';

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis detalhados por centro de custo específico.';
