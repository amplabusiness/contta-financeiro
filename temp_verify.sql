-- Verificar centros de custo criados
SELECT code, name, description FROM cost_centers WHERE code LIKE '2.%' ORDER BY code;
