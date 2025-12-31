-- Remover lançamentos IPVA duplicados que não existem no extrato
-- Extrato confirma apenas 5 pagamentos ao DETRAN:
-- 06/01: R$ 10.843,02 + R$ 1.420,08 + R$ 504,53 + R$ 457,12
-- 15/01: R$ 251,25
-- Total correto: R$ 13.476,00

-- Estes lançamentos do dia 10/01 NÃO existem no extrato bancário
DELETE FROM accounting_entries
WHERE id IN (
    '3ebd66a9-f92a-47da-b077-b172a67c1857',  -- Adiantamento: IPVA BMW - Victor R$ 11.551,39
    '691b7795-5c77-45ce-87b9-6d965bbea843',  -- Pagamento: IPVA BMW - Victor R$ 7.000,00
    '01f914e8-3db2-4eee-9ef3-17d3768de613',  -- Provisionamento IPVA BMW - Victor R$ 7.000,00
    'ec29acea-63b9-4a81-812f-7362062a5255',  -- Pagamento: IPVA BMW - Victor R$ 7.000,00
    '713a971e-8084-4f64-ace1-96543732beff',  -- Pagamento: IPVA Carretinha - Sergio R$ 1.551,39
    '6b51be06-22cc-4c0d-9a76-54224aa06b37',  -- Pagamento: IPVA Carretinha - Sergio R$ 1.551,39
    '33776aa6-daf6-4fab-8e2b-0ec124524b4c',  -- Provisionamento IPVA Carretinha - Sergio R$ 1.551,39
    '8aac6638-21b2-41b0-931a-1307eae0d172',  -- Provisionamento IPVA CG - Sergio R$ 1.500,00
    '7da75d03-29bc-4b64-ae19-192293974e2d',  -- Pagamento: IPVA CG - Sergio R$ 1.500,00
    '3b6fb0b9-529c-43e5-8fa0-567ef0477156',  -- Pagamento: IPVA CG - Sergio R$ 1.500,00
    '6338e1c5-07eb-48c5-870c-643dc6d5bafd',  -- Pagamento: IPVA BIZ - Sergio R$ 1.000,00
    '58926ce6-00d6-441a-835f-f6082d0bf277',  -- Pagamento: IPVA BIZ - Sergio R$ 1.000,00
    '3d304566-fed4-4f5c-8cd9-ff47e0aa5fb4'   -- Provisionamento IPVA BIZ - Sergio R$ 1.000,00
);

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - IPVA duplicados removidos (não existem no extrato).';
