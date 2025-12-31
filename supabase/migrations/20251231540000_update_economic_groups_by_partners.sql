-- ================================================
-- Atualização dos Grupos Econômicos baseada na análise de sócios
-- Fonte: API CNPJA - Análise completa em analise_socios_grupos.json
-- ================================================

-- ========================================
-- 1. CORREÇÕES NOS GRUPOS EXISTENTES
-- ========================================

-- 1.1 Grupo ACTION: Adicionar PREMIER SOLUÇÕES (Giovani Augusto Magri de Castro é sócio)
INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES ('a1000005-0000-0000-0000-000000000005', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 344.98)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- Atualizar total do grupo ACTION (12143.72 + 12143.72 + 344.98 = 24632.42)
UPDATE economic_groups
SET total_monthly_fee = 24632.42
WHERE id = 'a1000005-0000-0000-0000-000000000005';

-- 1.2 Grupo VISTORIAS: Adicionar DBCON SOLUCOES (Wendell Macedo de Andrade é sócio de todas)
INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES ('a1000013-0000-0000-0000-000000000013', '655178a7-2792-4e08-aa06-0c7d71490a54', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 1.3 Grupo BCS: Adicionar DR BERNARDO GUIMARAES (Bernardo Carneiro é sócio)
INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES ('a1000006-0000-0000-0000-000000000006', '01247d35-327e-416f-b928-b85e64e8b070', 977.45)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- Atualizar total do grupo BCS (977.45 x 4 = 3909.80)
UPDATE economic_groups
SET total_monthly_fee = 3909.80
WHERE id = 'a1000006-0000-0000-0000-000000000006';

-- 1.4 Grupo DSL: Adicionar PROMERCANTIL (Guilherme Otniel é sócio)
INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES ('a1000008-0000-0000-0000-000000000008', 'b94f3025-c93c-4de3-ab0e-414e3d9a011f', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 1.5 Grupo POLIMAX: Adicionar PLX INDUSTRIA (José Roberto/Bruna são sócios)
INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES ('a1000011-0000-0000-0000-000000000011', 'ed7f82bd-2c9b-466e-bac3-e960ab298bf3', 0)
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- ========================================
-- 2. NOVOS GRUPOS ECONÔMICOS IDENTIFICADOS
-- ========================================

-- 2.1 GRUPO FAMÍLIA SÁ / IPE AGRO (8+ empresas - Jeferson Roberto Disconsi de Sa)
-- Maior grupo identificado na análise de sócios
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000014-0000-0000-0000-000000000014',
  'Grupo FAMÍLIA SÁ / IPE AGRO',
  '8545268d-d93e-42ea-99c0-4110f22f6929', -- MUNDIM SA E GUIMARAES (maior fee R$ 2194.11)
  6540.41,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  -- Empresas de Jeferson Roberto Disconsi de Sa
  ('a1000014-0000-0000-0000-000000000014', '1c74f368-b34b-48ba-b7b7-dd7b518e1d21', 0),  -- BOA ESPERANCA AGRO
  ('a1000014-0000-0000-0000-000000000014', 'b7f1a46b-86c2-486b-b714-1580f6e7c044', 0),  -- COLORADO AGROPECUARIA
  ('a1000014-0000-0000-0000-000000000014', 'f715c9d2-641c-4d94-b858-e651c15d2362', 0),  -- FAZENDA IPE
  ('a1000014-0000-0000-0000-000000000014', 'e1b1cbf5-58a6-40f3-b0c1-f45dd9f84fe7', 0),  -- IPE AGROINDUSTRIAL
  ('a1000014-0000-0000-0000-000000000014', '8545268d-d93e-42ea-99c0-4110f22f6929', 2194.11), -- MUNDIM SA E GUIMARAES
  ('a1000014-0000-0000-0000-000000000014', '66b3f691-4ff6-494c-b258-77a4d6ebc660', 0),  -- RIO FORMOSO AGRO
  ('a1000014-0000-0000-0000-000000000014', '741e7702-5cb2-42ac-b821-5a37820dcc05', 0),  -- TUNA AGROPECUARIA
  ('a1000014-0000-0000-0000-000000000014', '98d6eda9-1d21-412a-94d6-3eb2390fec86', 0),  -- YPE AGRO
  -- Holdings e empresas conectadas (IF PARTICIPACOES, JPL, SA CAMPOS, CEDRO)
  ('a1000014-0000-0000-0000-000000000014', '1d455ed8-2b55-4b08-82db-3a5b16664685', 0),  -- IF PARTICIPACOES
  ('a1000014-0000-0000-0000-000000000014', '1f759ac5-a12f-4791-a9e1-773945260670', 4346.30), -- JPL AGROPECUARIA
  ('a1000014-0000-0000-0000-000000000014', '60096228-dc38-4c39-831e-b95fc78d1c66', 0),  -- CEDRO AGRO
  ('a1000014-0000-0000-0000-000000000014', '7308bef0-c3b9-4e88-8dfc-d0245f52b97c', 0)   -- DANTAS DE SA SAUDE
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.2 GRUPO AVENIR BARBOSA (6 empresas agropecuárias)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000015-0000-0000-0000-000000000015',
  'Grupo AVENIR BARBOSA',
  '5964e7af-f57d-4911-8330-453c16e16111', -- AGROPECUARIA CRB
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000015-0000-0000-0000-000000000015', '5964e7af-f57d-4911-8330-453c16e16111', 0),  -- AGROPECUARIA CRB
  ('a1000015-0000-0000-0000-000000000015', 'e2241cb3-79a1-49ac-9984-ac50535521e4', 0),  -- BJB AGROPECUARIA
  ('a1000015-0000-0000-0000-000000000015', 'a0f9cfe8-92dd-4188-957d-40617fed72b3', 0),  -- J.A. AGROPECUARIA
  ('a1000015-0000-0000-0000-000000000015', 'b086de44-77d9-4bd8-8c9f-6974c4f784a1', 0),  -- J.B AGROPECUARIA
  ('a1000015-0000-0000-0000-000000000015', '414b8da4-1caa-4d7a-8e1a-7bfc1cc6be49', 0),  -- M NUTRITION
  ('a1000015-0000-0000-0000-000000000015', '5350a0b3-fe31-400e-96b4-526464b06251', 0)   -- MEDLOG LOGISTICA
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.3 GRUPO ESTAÇÃO ALEGRIA (Mario Lucio Pinheiro Milazzo - 4 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000016-0000-0000-0000-000000000016',
  'Grupo ESTAÇÃO ALEGRIA',
  '41f72a96-f012-48b1-92d9-1587625973d0', -- M L PINHEIRO MILAZZO (maior fee)
  3294.63,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000016-0000-0000-0000-000000000016', '7d6f13c4-deb7-4c6e-939d-a4ea682f538d', 1034.97), -- CDC OLIVEIRA ESTACAO
  ('a1000016-0000-0000-0000-000000000016', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 603.73),  -- CDC PLAYGROUND
  ('a1000016-0000-0000-0000-000000000016', 'e3858efb-9ed5-4fa5-b741-723b10c1f678', 0),       -- ESTACAO ALEGRIA BRINQUEDOS
  ('a1000016-0000-0000-0000-000000000016', '41f72a96-f012-48b1-92d9-1587625973d0', 1655.93)  -- M L PINHEIRO MILAZZO
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.4 GRUPO GESSO (Antonio Marcos Gusmão de Oliveira - 4 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000017-0000-0000-0000-000000000017',
  'Grupo GESSO',
  '33faf6ea-f461-4223-9029-7183c6988987', -- AMG INDUSTRIA (maior fee)
  2322.80,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000017-0000-0000-0000-000000000017', '33faf6ea-f461-4223-9029-7183c6988987', 2322.80), -- AMG INDUSTRIA
  ('a1000017-0000-0000-0000-000000000017', '2f1a5231-0f0b-41af-8c43-f69e9a248f27', 0),       -- AV INDUSTRIA FERROS
  ('a1000017-0000-0000-0000-000000000017', 'f91b1f1d-78b4-4df4-9b73-0d13c6b45f79', 0),       -- GUSMAO E GUSMAO
  ('a1000017-0000-0000-0000-000000000017', '6fa4489a-3ab4-428e-9316-6540c9140fe5', 0)        -- IPE COMERCIO GESSO
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.5 GRUPO KROVER / HOKMA (Vinicius/Croverly Domingues - 3 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000018-0000-0000-0000-000000000018',
  'Grupo KROVER / HOKMA',
  '183d2e36-cf1a-4708-a656-1750a39e7f51', -- KROVER ENGENHARIA (maior fee)
  1677.07,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000018-0000-0000-0000-000000000018', 'e9a47af5-5fa8-44e4-8058-da1429660260', 551.97),  -- HOKMA ELETROMONTAGEM
  ('a1000018-0000-0000-0000-000000000018', '183d2e36-cf1a-4708-a656-1750a39e7f51', 963.10),  -- KROVER ENGENHARIA
  ('a1000018-0000-0000-0000-000000000018', '574cbdfa-4bde-4a8b-a582-c975c30783a9', 162.00)   -- VR CONSULTORIA
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.6 GRUPO LAJES NUNES (Emilio Santiago Costa Nunes - 3 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000019-0000-0000-0000-000000000019',
  'Grupo LAJES NUNES',
  'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', -- LAJES NUNES (maior fee)
  4496.98,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000019-0000-0000-0000-000000000019', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 1138.48), -- LAJES MORADA
  ('a1000019-0000-0000-0000-000000000019', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 3036.00), -- LAJES NUNES
  ('a1000019-0000-0000-0000-000000000019', '61346d91-1fd4-41bf-9567-bab696f9475e', 322.50)   -- NUNES MOTA AGROPECUARIA
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.7 GRUPO MARTINS MONTAGEM (Janilton/Sther Martins - 3 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000020-0000-0000-0000-000000000020',
  'Grupo MARTINS MONTAGEM',
  '97520bbf-d33c-4c71-a9fc-a817031b47a4', -- MARTINS MONTAGEM
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000020-0000-0000-0000-000000000020', '97520bbf-d33c-4c71-a9fc-a817031b47a4', 0),  -- MARTINS MONTAGEM
  ('a1000020-0000-0000-0000-000000000020', '89e24204-fd0e-41aa-98ff-fce5a1888fe3', 0),  -- MG ALTERNATIVA
  ('a1000020-0000-0000-0000-000000000020', '61917784-8839-44c3-926e-732a1efb4849', 0)   -- SG MARTINS
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.8 GRUPO MURANO / TSD (Decio Caetano / Flavia Caetano - 3 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000021-0000-0000-0000-000000000021',
  'Grupo MURANO / TSD',
  'cca5abc2-a34f-4a8c-86ee-f48dab227a91', -- TSD DISTRIBUIDORA (maior fee)
  8807.69,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000021-0000-0000-0000-000000000021', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 4244.67), -- MURANO ADM
  ('a1000021-0000-0000-0000-000000000021', 'eb3ee3ca-48c8-42d0-b4c3-65f1b9b5064f', 0),       -- TCC COMERCIO CARTOES
  ('a1000021-0000-0000-0000-000000000021', 'cca5abc2-a34f-4a8c-86ee-f48dab227a91', 4563.02)  -- TSD DISTRIBUIDORA
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.9 GRUPO CRYSTAL / ECD (Enzo Donadi - 3 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000022-0000-0000-0000-000000000022',
  'Grupo CRYSTAL / ECD',
  '9156ed38-ac9d-4068-97f4-9426f9f1dac4', -- CRYSTAL PARTICIPACOES
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000022-0000-0000-0000-000000000022', '9156ed38-ac9d-4068-97f4-9426f9f1dac4', 0),  -- CRYSTAL PARTICIPACOES
  ('a1000022-0000-0000-0000-000000000022', '4e38b563-a69d-4880-93e3-9ec8553011fc', 0),  -- ECD CONSTRUTORA
  ('a1000022-0000-0000-0000-000000000022', '1f8c7178-59f6-456a-8165-8942047e83da', 0)   -- VERDI E ECD
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.10 GRUPO PHG GUSMÃO (Pedro Henrique Gusmão - 3 empresas de gesso)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000023-0000-0000-0000-000000000023',
  'Grupo PHG GUSMÃO',
  'e0ddfe90-a6ab-4e27-b7c1-c9f2da60652a', -- CONSTRUGESSO
  0,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000023-0000-0000-0000-000000000023', 'e0ddfe90-a6ab-4e27-b7c1-c9f2da60652a', 0),  -- CONSTRUGESSO
  ('a1000023-0000-0000-0000-000000000023', '1f44b4c1-c099-42a3-ac7a-d1997f777c90', 0),  -- PHG ACABAMENTOS
  ('a1000023-0000-0000-0000-000000000023', '10bab7c2-2ac3-4d13-ac58-226b27aea8b4', 0)   -- PHI LOCACAO
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.11 GRUPO CONTRONWEB (Alan Arantes - 3 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000024-0000-0000-0000-000000000024',
  'Grupo CONTRONWEB',
  'a1674d59-970f-483a-bf51-c7425454f191', -- CONTRONWEB (R$ 759)
  759.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000024-0000-0000-0000-000000000024', '1a7909e9-109a-4f45-9eba-3ced6978bebf', 0),      -- CARVALHO NEGOCIOS
  ('a1000024-0000-0000-0000-000000000024', 'a1674d59-970f-483a-bf51-c7425454f191', 759.00), -- CONTRONWEB
  ('a1000024-0000-0000-0000-000000000024', '66640522-445d-4747-a7ee-c1636a7b417a', 0)       -- JCP NEGOCIOS
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.12 GRUPO TIMES (Fabiano/Rafael - 2 empresas imobiliárias)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000025-0000-0000-0000-000000000025',
  'Grupo TIMES IMOBILIÁRIOS',
  '0502041f-05a1-43ed-8459-bd349df8b0e9', -- TIMES NEGOCIOS
  1130.30,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000025-0000-0000-0000-000000000025', '4f78dbc7-750b-4ec9-a73d-0869684bf66b', 0),       -- IMOBILIARIS TIMES
  ('a1000025-0000-0000-0000-000000000025', '0502041f-05a1-43ed-8459-bd349df8b0e9', 1130.30)  -- TIMES NEGOCIOS
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.13 GRUPO CAGI / PA ROUPAS (Heronides/Lindaura Cesario - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000026-0000-0000-0000-000000000026',
  'Grupo CAGI / PA ROUPAS',
  '06b604d4-a3d2-4e5a-8716-169bde1dceb3', -- CAGI INDUSTRIA
  1012.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000026-0000-0000-0000-000000000026', '06b604d4-a3d2-4e5a-8716-169bde1dceb3', 506.00), -- CAGI INDUSTRIA
  ('a1000026-0000-0000-0000-000000000026', 'eea670cd-6f00-4a0a-9425-aeed5d3fc233', 506.00)  -- PA INDUSTRIA ROUPAS
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.14 GRUPO COLLOR GEL / CASA NOVA TINTAS (Sergio Okazima - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000027-0000-0000-0000-000000000027',
  'Grupo COLLOR GEL / TINTAS',
  'f1b01a43-38b8-4521-94cf-6a2b6087c80e', -- COLLOR GEL (maior fee)
  2277.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000027-0000-0000-0000-000000000027', '177369ad-808a-4633-8edc-42583d3ee833', 759.00),  -- CASA NOVA TINTAS
  ('a1000027-0000-0000-0000-000000000027', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 1518.00)  -- COLLOR GEL
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.15 GRUPO COVALE (Fernanda Covas - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000028-0000-0000-0000-000000000028',
  'Grupo COVALE',
  '5c1f28c9-212d-4038-ae1d-65ed06b0c617', -- COVALE USINAGEM (maior fee)
  1905.36,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000028-0000-0000-0000-000000000028', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 1525.86), -- COVALE USINAGEM
  ('a1000028-0000-0000-0000-000000000028', 'b7e50813-4cf2-4e39-8d63-faff187524be', 379.50)   -- COVAS SERVICOS PINTURAS
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.16 GRUPO CENTRO MÉDICO MILHOMEM (Pablio Milhomem - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000029-0000-0000-0000-000000000029',
  'Grupo CENTRO MÉDICO MILHOMEM',
  '8fe85a29-d159-43dd-8874-f85da9375e32', -- CENTRO MEDICO (maior fee)
  2519.95,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000029-0000-0000-0000-000000000029', '8fe85a29-d159-43dd-8874-f85da9375e32', 1518.00), -- CENTRO MEDICO MILHOMEM
  ('a1000029-0000-0000-0000-000000000029', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 1001.95)  -- PM ADMINISTRACAO
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.17 GRUPO RAMAYOLE (Marcos Adriano Pires - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000030-0000-0000-0000-000000000030',
  'Grupo RAMAYOLE / MM LANCHES',
  'd3a203cf-1e94-476a-8e44-12e4112755dc', -- M.M LANCHES
  1518.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000030-0000-0000-0000-000000000030', 'd3a203cf-1e94-476a-8e44-12e4112755dc', 759.00),  -- M.M LANCHES
  ('a1000030-0000-0000-0000-000000000030', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 759.00)   -- RAMAYOLE
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.18 GRUPO BOM FUTURO (Filipi Santos Peixoto - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000031-0000-0000-0000-000000000031',
  'Grupo BOM FUTURO',
  '943c4c68-45b8-414f-8dd3-097484aaa2ff', -- FUTURA AGROPECUARIA
  600.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000031-0000-0000-0000-000000000031', '943c4c68-45b8-414f-8dd3-097484aaa2ff', 300.00), -- FUTURA AGROPECUARIA
  ('a1000031-0000-0000-0000-000000000031', '5f7c0c62-ffa1-486f-a40d-e2d9183427d8', 300.00)  -- HOLDING BOM FUTURO
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.19 GRUPO GARIBALDI / MARIAH (Garibaldi Adriano Neto - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000032-0000-0000-0000-000000000032',
  'Grupo GARIBALDI / MARIAH',
  'd346239a-9c52-41f8-a740-ba6dd85baef4', -- MARIAH PARTICIPACOES (maior fee)
  3036.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000032-0000-0000-0000-000000000032', '199a1d9a-e92a-4170-b813-e9dff65196a5', 0),       -- GARIBALDI ADM
  ('a1000032-0000-0000-0000-000000000032', 'd346239a-9c52-41f8-a740-ba6dd85baef4', 3036.00)  -- MARIAH PARTICIPACOES
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.20 GRUPO MARO / MUNDIM (Taissa Tormin Mundim - 2 empresas)
-- Conectado ao Grupo Família SÁ via MUNDIM SA E GUIMARAES
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000033-0000-0000-0000-000000000033',
  'Grupo MARO INVESTIMENTOS',
  '6869b050-94ca-428e-83f1-36a81e613ba4', -- MARO INVESTIMENTOS (maior fee)
  2879.90,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000033-0000-0000-0000-000000000033', '6869b050-94ca-428e-83f1-36a81e613ba4', 2879.90) -- MARO INVESTIMENTOS
  -- MUNDIM SA E GUIMARAES já está no Grupo Família SÁ
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.21 GRUPO AMAGU / SHARKSPACE (William Bonifacio Peixoto - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000034-0000-0000-0000-000000000034',
  'Grupo AMAGU / SHARKSPACE',
  '8d125b22-fa6d-4b86-bcc3-4795a60f2096', -- AMAGU FESTAS
  1518.00,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000034-0000-0000-0000-000000000034', '8d125b22-fa6d-4b86-bcc3-4795a60f2096', 759.00), -- AMAGU FESTAS
  ('a1000034-0000-0000-0000-000000000034', '888b75da-b434-4a48-a929-cfe422033b53', 759.00)  -- SHARKSPACE GASTRO
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.22 GRUPO CRJ AR CONDICIONADO (Jullyana Mendonca - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000035-0000-0000-0000-000000000035',
  'Grupo CRJ AR CONDICIONADO',
  'dfc1df26-e264-4fec-b427-effcda2e6dd4', -- CRJ MANUTENCAO
  551.96,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000035-0000-0000-0000-000000000035', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 275.98), -- CRJ MANUTENCAO
  ('a1000035-0000-0000-0000-000000000035', '692166ce-e85d-4436-9714-07fc9891c315', 275.98)  -- JULLYANA MENDONCA
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- 2.23 GRUPO NUTRYMED (Geniel/Claudenir - 2 empresas)
INSERT INTO economic_groups (id, name, main_payer_client_id, total_monthly_fee, payment_day, is_active)
VALUES (
  'a1000036-0000-0000-0000-000000000036',
  'Grupo NUTRYMED / QUELUZ',
  '174cd5bf-6795-4741-855e-3937254d17e1', -- NUTRYMED (maior fee)
  2276.85,
  10,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO economic_group_members (economic_group_id, client_id, individual_fee)
VALUES
  ('a1000036-0000-0000-0000-000000000036', '174cd5bf-6795-4741-855e-3937254d17e1', 2276.85), -- NUTRYMED
  ('a1000036-0000-0000-0000-000000000036', '3c59be98-91bd-4a00-9047-48b24ff7ee9d', 0)        -- QUELUZ ADM
ON CONFLICT (economic_group_id, client_id) DO NOTHING;

-- ========================================
-- RESUMO: 36 Grupos Econômicos
-- ========================================
-- Grupos 1-13: Já existentes (com correções)
-- Grupos 14-36: Novos grupos identificados por sócios
--
-- Grupos expandidos:
-- - ACTION: adicionou PREMIER (Giovani)
-- - VISTORIAS: adicionou DBCON (Wendell)
-- - BCS: adicionou DR BERNARDO (Bernardo)
-- - DSL: adicionou PROMERCANTIL (Guilherme)
-- - POLIMAX: adicionou PLX (José Roberto/Bruna)
-- ========================================
