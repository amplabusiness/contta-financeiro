-- Criar centros de custo para separar sistemas
-- ERP Principal (Domínio + DataUnique)
INSERT INTO cost_centers (code, name, description, is_active)
VALUES ('2.1', 'SISTEMAS.ERP', 'ERP Principal - Domínio Sistema + DataUnique', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
RETURNING id, code, name;

-- Ferramentas Auxiliares
INSERT INTO cost_centers (code, name, description, is_active)
VALUES ('2.2', 'SISTEMAS.AUXILIARES', 'Ferramentas auxiliares - Contus, CR Sistema, Objetiva, Econete, Sittax, Veri Soluções', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
RETURNING id, code, name;
