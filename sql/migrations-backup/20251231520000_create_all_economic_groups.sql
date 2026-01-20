-- ================================================
-- Criação de todos os grupos econômicos identificados
-- ================================================

-- 1. GRUPO ADMIR (3 membros)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000001-0000-0000-0000-000000000001',
  'Grupo ADMIR',
  '0105c761-a740-49c5-a487-71a3123f6296', -- ADMIR DE OLIVEIRA ALVES (principal)
  1533.64,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000001-0000-0000-0000-000000000001', '0105c761-a740-49c5-a487-71a3123f6296', 766.82),
  ('a1000001-0000-0000-0000-000000000001', '587670ad-0a1b-47a8-a1a3-bd6c43efe116', 0),
  ('a1000001-0000-0000-0000-000000000001', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 766.82)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2. GRUPO BOA VISTA AGROPECUÁRIA (4 membros - matriz e filiais)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000002-0000-0000-0000-000000000002',
  'Grupo BOA VISTA AGROPECUÁRIA',
  '3fde02cc-c2b0-49d0-9ff5-ee8ec8ecb465', -- Matriz
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000002-0000-0000-0000-000000000002', '3fde02cc-c2b0-49d0-9ff5-ee8ec8ecb465', 0),
  ('a1000002-0000-0000-0000-000000000002', '500aa4d8-31a1-4703-a805-e54b2cb4b156', 0),
  ('a1000002-0000-0000-0000-000000000002', '1ba78daa-5f74-4d1c-8112-00dd10a74b7c', 0),
  ('a1000002-0000-0000-0000-000000000002', '6180bde5-5b5e-4359-916a-60ec90d5a36b', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 3. GRUPO SOLO AGROPECUÁRIA (2 membros - matriz e filial)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000003-0000-0000-0000-000000000003',
  'Grupo SOLO AGROPECUÁRIA',
  '098c0b67-7385-48aa-a40b-a3d62f6153ae', -- Matriz
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000003-0000-0000-0000-000000000003', '098c0b67-7385-48aa-a40b-a3d62f6153ae', 0),
  ('a1000003-0000-0000-0000-000000000003', '206c8841-6a33-4519-851a-ef4b5bf6c95a', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 4. GRUPO CAETANO MÁQUINAS (3 membros)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000004-0000-0000-0000-000000000004',
  'Grupo CAETANO MÁQUINAS',
  'a3527b84-e710-41cd-9c9d-d7f05ea9d934', -- CAETANO E CAETANO
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000004-0000-0000-0000-000000000004', 'a3527b84-e710-41cd-9c9d-d7f05ea9d934', 0),
  ('a1000004-0000-0000-0000-000000000004', 'f91b80a1-946f-47a9-a786-f0db56aa33f6', 0),
  ('a1000004-0000-0000-0000-000000000004', '017b4699-5303-4830-9015-70354bf6e636', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 5. GRUPO ACTION SOLUÇÕES INDUSTRIAIS (3 membros - R$ 25.805,44)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000005-0000-0000-0000-000000000005',
  'Grupo ACTION SOLUÇÕES INDUSTRIAIS',
  'b014406f-6497-49b2-bf03-483353ae99a0', -- ACTION SERVICOS
  25805.44,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000005-0000-0000-0000-000000000005', 'b014406f-6497-49b2-bf03-483353ae99a0', 12143.72),
  ('a1000005-0000-0000-0000-000000000005', '1818eda2-6bf8-4756-af26-24e103761562', 12143.72),
  ('a1000005-0000-0000-0000-000000000005', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 1518.00)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 6. GRUPO BCS SERVIÇOS MÉDICOS (3 membros - R$ 2.932,35)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000006-0000-0000-0000-000000000006',
  'Grupo BCS SERVIÇOS MÉDICOS',
  '96c05bb8-2009-464b-a1c3-cfbdb22b8829', -- HOLDINGS BCS
  2932.35,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000006-0000-0000-0000-000000000006', 'b5a1bb23-ef78-4fb7-8f5e-2c116963b059', 977.45),
  ('a1000006-0000-0000-0000-000000000006', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 977.45),
  ('a1000006-0000-0000-0000-000000000006', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 977.45)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 7. GRUPO D'ANGE (2 membros - R$ 1.518,00)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000007-0000-0000-0000-000000000007',
  'Grupo D''ANGE',
  '48fd6593-adec-447b-91db-9ad7847daaf5', -- D'ANGE original
  1518.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000007-0000-0000-0000-000000000007', '48fd6593-adec-447b-91db-9ad7847daaf5', 759.00),
  ('a1000007-0000-0000-0000-000000000007', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 759.00)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 8. GRUPO DSL (3 membros - holding)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000008-0000-0000-0000-000000000008',
  'Grupo DSL',
  'a959fc39-2510-4b9a-b469-27e2d6524cac', -- DSL HOLDING
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000008-0000-0000-0000-000000000008', 'a959fc39-2510-4b9a-b469-27e2d6524cac', 0),
  ('a1000008-0000-0000-0000-000000000008', 'a9440faf-c429-4059-9574-9ee5de472184', 0),
  ('a1000008-0000-0000-0000-000000000008', '0733ac80-e225-4bfe-8894-0719ab73bc84', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 9. GRUPO ELETROSOL (2 membros - R$ 645,00)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000009-0000-0000-0000-000000000009',
  'Grupo ELETROSOL',
  '3bd17681-6880-476a-83a5-efdb2ad8f329', -- ELETROSOL ENERGIA
  645.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000009-0000-0000-0000-000000000009', '3bd17681-6880-476a-83a5-efdb2ad8f329', 322.50),
  ('a1000009-0000-0000-0000-000000000009', '9e424064-7d0d-46a2-9996-782599c51913', 322.50)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 10. GRUPO AGROPECUÁRIA ADM/SCA (2 membros - R$ 1.075,00)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000010-0000-0000-0000-000000000010',
  'Grupo AGROPECUÁRIA ADM/SCA',
  'e170749f-0204-4857-ad1f-66933e0dbbfe', -- ADM
  1075.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000010-0000-0000-0000-000000000010', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 537.50),
  ('a1000010-0000-0000-0000-000000000010', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 537.50)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 11. GRUPO POLIMAX (2 membros)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000011-0000-0000-0000-000000000011',
  'Grupo POLIMAX',
  'd36ad262-f132-4270-b7d9-346a3691ed1a', -- POLIMAX COBERTURAS
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000011-0000-0000-0000-000000000011', 'd36ad262-f132-4270-b7d9-346a3691ed1a', 0),
  ('a1000011-0000-0000-0000-000000000011', 'e7d6264f-896a-4f37-85f0-513a17d42827', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 12. GRUPO PRIMATAS (2 membros)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000012-0000-0000-0000-000000000012',
  'Grupo PRIMATAS',
  '8b2a3e7e-e20b-4c97-adf4-75cae1cc24da', -- CROSSFIT
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000012-0000-0000-0000-000000000012', '8b2a3e7e-e20b-4c97-adf4-75cae1cc24da', 0),
  ('a1000012-0000-0000-0000-000000000012', 'b2aca059-41c3-475e-9b9e-4c911acf5833', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 13. GRUPO VISTORIAS (6 membros - R$ 5.603,75)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000013-0000-0000-0000-000000000013',
  'Grupo VISTORIAS',
  'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', -- CENTRO OESTE (maior fee)
  5603.75,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000013-0000-0000-0000-000000000013', '685657a9-adc3-4608-b234-8a884d5c25a3', 1500.00),
  ('a1000013-0000-0000-0000-000000000013', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 3500.00),
  ('a1000013-0000-0000-0000-000000000013', 'cd12e115-8fed-44ee-9366-bb7d4b1bc4dc', 0),
  ('a1000013-0000-0000-0000-000000000013', '9fd4c5fb-2204-4988-9b6c-1936bc9e6256', 0),
  ('a1000013-0000-0000-0000-000000000013', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 603.75),
  ('a1000013-0000-0000-0000-000000000013', 'e032bfe8-56d9-4726-b682-93395d5fb180', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;
