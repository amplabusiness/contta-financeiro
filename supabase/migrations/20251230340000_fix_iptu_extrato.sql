-- Corrigir IPTU conforme extrato OFX
-- Extrato mostra:
-- 10/01 - PMGO-C R$ 312,21 (parcelamento 2018)
-- 10/01 - PMGO-C R$ 312,21 (parcelamento 2022)
-- 15/01 - PMGO-C R$ 3.076,13 (IPTU 2025 parcela 1/12)
-- TOTAL: R$ 3.700,55

-- Apagar todos os lançamentos de IPTU existentes (valores errados)
DELETE FROM accounting_entries
WHERE id IN (
    '239c5184-f74f-48a5-a07f-2faad02ab028',  -- IPTU 2022 R$ 583,84 (errado)
    '2ecc1310-3e7d-45f7-971a-b119eb7fa59c',  -- IPTU 2018 R$ 3.076,13 (errado)
    '682be8b8-b7a8-4dba-921a-ca2d490f5189',  -- Provisionamento IPTU 2022
    '00c3d95b-1a7a-4d69-bceb-0c77a61ae066',  -- Provisionamento IPTU 2020
    'fb2b5a15-c291-4db4-b808-525cacbb8d5b'   -- Provisionamento IPTU 2018
);

-- Criar lançamentos corretos conforme extrato
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
-- Parcelamento IPTU 2018
('2025-01-10', '2025-01-01', 'IPTU 2018 - Parcelamento (PMGO)', 'pagamento_despesa', 312.21, 312.21,
 (SELECT id FROM cost_centers WHERE code = '1.10')),
-- Parcelamento IPTU 2022
('2025-01-10', '2025-01-01', 'IPTU 2022 - Parcelamento (PMGO)', 'pagamento_despesa', 312.21, 312.21,
 (SELECT id FROM cost_centers WHERE code = '1.10')),
-- IPTU 2025 parcela 1/12
('2025-01-15', '2025-01-01', 'IPTU 2025 - Parcela 1/12 (PMGO)', 'pagamento_despesa', 3076.13, 3076.13,
 (SELECT id FROM cost_centers WHERE code = '1.10'))
ON CONFLICT DO NOTHING;

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 - IPTU corrigido com extrato.';
