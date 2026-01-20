-- Criar centros de custo para separar sistemas ERP de ferramentas auxiliares
-- ERP Principal: Domínio Sistema + DataUnique (obrigatórios para funcionamento)
-- Auxiliares: Demais ferramentas de apoio ao dia a dia

-- 1. Centro de custo para ERP Principal
INSERT INTO cost_centers (code, name, description, is_active)
VALUES ('2.1', 'SISTEMAS.ERP', 'ERP Principal - Domínio Sistema + DataUnique', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 2. Centro de custo para Ferramentas Auxiliares
INSERT INTO cost_centers (code, name, description, is_active)
VALUES ('2.2', 'SISTEMAS.AUXILIARES', 'Ferramentas auxiliares e revistas de atualização', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 3. Classificar lançamentos de Janeiro/2025 - ERP (Domínio + DataUnique)
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '2.1')
WHERE entry_date >= '2025-01-01' AND entry_date < '2025-02-01'
AND (
  description ILIKE '%dominio sistem%'
  OR description ILIKE '%dataunique%'
  OR description ILIKE '%data unique%'
);

-- 4. Classificar lançamentos de Janeiro/2025 - Ferramentas Auxiliares
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '2.2')
WHERE entry_date >= '2025-01-01' AND entry_date < '2025-02-01'
AND (
  description ILIKE '%sittax%'
  OR description ILIKE '%contus%'
  OR description ILIKE '%cr sistema%'
  OR description ILIKE '%objetiva%'
  OR description ILIKE '%veri soluç%'
  OR description ILIKE '%nb technology%'
  OR description ILIKE '%autmais%'
  OR description ILIKE '%catho%'
  OR description ILIKE '%oneflow%'
  OR description ILIKE '%clicksign%'
  OR description ILIKE '%acessorias sistema%'
  OR description ILIKE '%econete%'
);

-- 5. Remover classificação de departamento contábil dos sistemas (agora são centro de custo próprio)
-- Os sistemas NÃO são despesa do departamento contábil, são despesa operacional geral
UPDATE accounting_entries
SET cost_center_id = NULL
WHERE cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.3')
AND (
  description ILIKE '%dominio sistem%'
  OR description ILIKE '%dataunique%'
  OR description ILIKE '%sittax%'
  OR description ILIKE '%contus%'
  OR description ILIKE '%cr sistema%'
  OR description ILIKE '%objetiva%'
  OR description ILIKE '%veri soluç%'
  OR description ILIKE '%nb technology%'
);

-- Agora aplicar a classificação correta
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '2.1')
WHERE (
  description ILIKE '%dominio sistem%'
  OR description ILIKE '%dataunique%'
  OR description ILIKE '%data unique%'
);

UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '2.2')
WHERE (
  description ILIKE '%sittax%'
  OR description ILIKE '%contus%'
  OR description ILIKE '%cr sistema%'
  OR description ILIKE '%objetiva%'
  OR description ILIKE '%veri soluç%'
  OR description ILIKE '%nb technology%'
  OR description ILIKE '%autmais%'
  OR description ILIKE '%catho%'
  OR description ILIKE '%oneflow%'
  OR description ILIKE '%clicksign%'
  OR description ILIKE '%acessorias sistema%'
  OR description ILIKE '%econete%'
);

COMMENT ON TABLE cost_centers IS 'Centros de custo. Grupo 1.x = Departamentos Ampla, Grupo 2.x = Sistemas e Ferramentas';
