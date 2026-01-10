-- ============================================================================
-- CRIAR TABELA DE COMPOSIÇÃO DE PAGAMENTOS DE BOLETOS
-- Vincula liquidações consolidadas do banco com clientes individuais
-- ============================================================================

-- 1. Criar tabela boleto_payments (se não existir)
CREATE TABLE IF NOT EXISTS boleto_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  client_id UUID REFERENCES clients(id),
  invoice_id UUID REFERENCES invoices(id),
  cob VARCHAR(20),
  nosso_numero VARCHAR(50),
  data_vencimento DATE,
  data_liquidacao DATE,
  data_extrato DATE,
  valor_original DECIMAL(15,2),
  valor_liquidado DECIMAL(15,2),
  juros DECIMAL(15,2) DEFAULT 0,
  multa DECIMAL(15,2) DEFAULT 0,
  desconto DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nosso_numero)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_boleto_payments_bank_tx ON boleto_payments(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_client ON boleto_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_cob ON boleto_payments(cob);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_data_extrato ON boleto_payments(data_extrato);

-- 2. Inserir registros de baixa
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('85a69bbd-8b0d-465d-886f-dbaaa7b5c1a7', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000002', '25/200156-8', '2025-03-05', '2025-02-28', '2025-03-05', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('85a69bbd-8b0d-465d-886f-dbaaa7b5c1a7', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000002', '25/200162-2', '2025-03-05', '2025-02-28', '2025-03-05', 363.15, 363.15)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000027', '25/200119-3', '2025-03-05', '2025-03-05', '2025-03-06', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000027', '25/200120-7', '2025-03-05', '2025-03-05', '2025-03-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000027', '25/200121-5', '2025-03-05', '2025-03-05', '2025-03-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000027', '25/200122-3', '2025-03-05', '2025-03-05', '2025-03-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000027', '25/200130-4', '2025-03-05', '2025-03-05', '2025-03-06', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000027', '25/200137-1', '2025-03-05', '2025-03-05', '2025-03-06', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000027', '25/200152-5', '2025-03-05', '2025-03-05', '2025-03-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000027', '25/200153-3', '2025-03-05', '2025-03-05', '2025-03-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000027', '25/200154-1', '2025-03-05', '2025-03-05', '2025-03-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'e9a47af5-5fa8-44e4-8058-da1429660260', 'COB000027', '25/200163-0', '2025-03-10', '2025-03-05', '2025-03-06', 551.97, 551.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '7be0ec1d-783d-4156-a5e6-7a9ce59c0d1d', 'COB000027', '25/200166-5', '2025-03-05', '2025-03-05', '2025-03-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000027', '25/200169-0', '2025-03-05', '2025-03-05', '2025-03-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000027', '25/200174-6', '2025-03-05', '2025-03-05', '2025-03-06', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000027', '25/200176-2', '2025-03-05', '2025-03-05', '2025-03-06', 2276.86, 2276.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000027', '25/200177-0', '2025-03-05', '2025-03-05', '2025-03-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000027', '25/200182-7', '2025-03-05', '2025-03-05', '2025-03-06', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000027', '25/200184-3', '2025-03-05', '2025-03-05', '2025-03-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '9fabf180-853d-424e-a6ee-1941e3eb8f78', 'COB000027', '25/200196-7', '2025-03-05', '2025-03-05', '2025-03-06', 581.04, 581.04)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000027', '25/200199-1', '2025-03-05', '2025-03-05', '2025-03-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000027', '25/200201-7', '2025-03-05', '2025-03-05', '2025-03-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000027', '25/200202-5', '2025-03-05', '2025-03-05', '2025-03-06', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000027', '25/200203-3', '2025-03-05', '2025-03-05', '2025-03-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000027', '25/200206-8', '2025-03-05', '2025-03-05', '2025-03-06', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000027', '25/200207-6', '2025-03-05', '2025-03-05', '2025-03-06', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000027', '25/200210-6', '2025-03-05', '2025-03-05', '2025-03-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000027', '25/200211-4', '2025-03-05', '2025-03-05', '2025-03-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('33419928-94ca-4db0-a104-69601ecb76f4', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000027', '25/200217-3', '2025-03-05', '2025-03-05', '2025-03-06', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000029', '25/200118-5', '2025-03-10', '2025-03-10', '2025-03-11', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000029', '25/200125-8', '2025-03-10', '2025-03-10', '2025-03-11', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000029', '25/200127-4', '2025-03-10', '2025-03-10', '2025-03-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000029', '25/200132-0', '2025-03-10', '2025-03-10', '2025-03-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000029', '25/200133-9', '2025-03-10', '2025-03-10', '2025-03-11', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000029', '25/200135-5', '2025-03-10', '2025-03-10', '2025-03-11', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000029', '25/200136-3', '2025-03-10', '2025-03-10', '2025-03-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000029', '25/200141-0', '2025-03-10', '2025-03-10', '2025-03-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000029', '25/200142-8', '2025-03-10', '2025-03-10', '2025-03-11', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000029', '25/200143-6', '2025-03-10', '2025-03-10', '2025-03-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000029', '25/200147-9', '2025-03-10', '2025-03-10', '2025-03-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000029', '25/200148-7', '2025-03-10', '2025-03-10', '2025-03-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000029', '25/200149-5', '2025-03-10', '2025-03-10', '2025-03-11', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000029', '25/200155-0', '2025-03-10', '2025-03-10', '2025-03-11', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000029', '25/200157-6', '2025-03-10', '2025-03-10', '2025-03-11', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000029', '25/200160-6', '2025-03-10', '2025-03-10', '2025-03-11', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000029', '25/200167-3', '2025-03-10', '2025-03-10', '2025-03-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000029', '25/200170-3', '2025-03-10', '2025-03-10', '2025-03-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000029', '25/200172-0', '2025-03-10', '2025-03-10', '2025-03-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000029', '25/200181-9', '2025-03-10', '2025-03-10', '2025-03-11', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000029', '25/200183-5', '2025-03-10', '2025-03-10', '2025-03-11', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000029', '25/200185-1', '2025-03-05', '2025-03-10', '2025-03-11', 152.1, 155.21)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000029', '25/200186-0', '2025-03-10', '2025-03-10', '2025-03-11', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000029', '25/200187-8', '2025-03-10', '2025-03-10', '2025-03-11', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000029', '25/200189-4', '2025-03-10', '2025-03-10', '2025-03-11', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000029', '25/200200-9', '2025-03-10', '2025-03-10', '2025-03-11', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000029', '25/200209-2', '2025-03-10', '2025-03-10', '2025-03-11', 2889.92, 2889.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', 'cca5abc2-a34f-4a8c-86ee-f48dab227a91', 'COB000029', '25/200213-0', '2025-03-10', '2025-03-10', '2025-03-11', 4563.02, 4563.02)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8c29c598-280a-4fe9-b389-eee1f6fcadef', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000029', '25/200214-9', '2025-03-10', '2025-03-10', '2025-03-11', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bc19cc7-8085-438d-b0f0-d4083dd30e27', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000002', '25/200173-8', '2025-03-10', '2025-03-11', '2025-03-12', 500, 510.05)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bc19cc7-8085-438d-b0f0-d4083dd30e27', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000002', '25/200192-4', '2025-03-10', '2025-03-11', '2025-03-12', 767.58, 783)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6c8febb0-f643-4233-8edf-167c7bdc94b1', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000001', '25/200194-0', '2025-03-10', '2025-03-12', '2025-03-13', 574.96, 586.56)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1e583cf1-7901-4a54-8c64-fd66ee71f9ee', 'a9532f88-d365-452f-87db-133c22a3d5bd', 'COB000001', '25/200159-2', '2025-03-05', '2025-03-13', '2025-03-14', 759, 774.78)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3f5786da-ac7a-46be-9b46-f377229912fb', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000001', '25/200180-0', '2025-03-15', '2025-03-14', '2025-03-17', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4cc6dc91-a65b-4730-a777-50717e66b256', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000005', '25/200124-0', '2025-03-15', '2025-03-17', '2025-03-18', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4cc6dc91-a65b-4730-a777-50717e66b256', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000005', '25/200131-2', '2025-03-15', '2025-03-17', '2025-03-18', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4cc6dc91-a65b-4730-a777-50717e66b256', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000005', '25/200140-1', '2025-03-15', '2025-03-17', '2025-03-18', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4cc6dc91-a65b-4730-a777-50717e66b256', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000005', '25/200205-0', '2025-03-15', '2025-03-17', '2025-03-18', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4cc6dc91-a65b-4730-a777-50717e66b256', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000005', '25/200208-4', '2025-03-15', '2025-03-17', '2025-03-18', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('92208839-be10-4057-b89a-08882640af5d', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000002', '25/200126-6', '2025-03-21', '2025-03-20', '2025-03-21', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('92208839-be10-4057-b89a-08882640af5d', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000002', '25/200139-8', '2025-03-21', '2025-03-20', '2025-03-21', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('aa3ae73e-9eaa-485d-965b-1e5453077c20', '943c4c68-45b8-414f-8dd3-097484aaa2ff', 'COB000002', '25/200161-4', '2025-03-25', '2025-03-25', '2025-03-26', 300, 300)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('aa3ae73e-9eaa-485d-965b-1e5453077c20', '5f7c0c62-ffa1-486f-a40d-e2d9183427d8', 'COB000002', '25/200164-9', '2025-03-25', '2025-03-25', '2025-03-26', 300, 300)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d140dbbd-b684-41ec-834e-a77bb7823bf7', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000002', '25/200218-1', '2025-04-05', '2025-03-27', '2025-03-28', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d140dbbd-b684-41ec-834e-a77bb7823bf7', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000002', '25/200228-9', '2025-04-05', '2025-03-27', '2025-03-28', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f27f271c-80dc-42c5-81ad-8168f47928f5', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000001', '25/200300-5', '2025-04-05', '2025-03-31', '2025-04-01', 2276.86, 2276.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('74cbb14a-9219-42cf-aaad-33027ab7cd85', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000001', '25/200280-7', '2025-04-05', '2025-04-01', '2025-04-02', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6c12c6b2-f083-4664-8aef-510693eed3e2', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000002', '25/200286-6', '2025-04-05', '2025-04-02', '2025-04-03', 363.15, 363.15)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6c12c6b2-f083-4664-8aef-510693eed3e2', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000002', '25/200318-8', '2025-04-05', '2025-04-02', '2025-04-03', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8d8cf3f5-552d-4188-b7d0-c8430322dec1', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000004', '25/200278-5', '2025-04-05', '2025-04-03', '2025-04-04', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8d8cf3f5-552d-4188-b7d0-c8430322dec1', '7be0ec1d-783d-4156-a5e6-7a9ce59c0d1d', 'COB000004', '25/200290-4', '2025-04-05', '2025-04-03', '2025-04-04', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8d8cf3f5-552d-4188-b7d0-c8430322dec1', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000004', '25/200293-9', '2025-04-05', '2025-04-03', '2025-04-04', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8d8cf3f5-552d-4188-b7d0-c8430322dec1', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000004', '25/200320-0', '2025-04-05', '2025-04-03', '2025-04-04', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('41792aa3-782a-4c68-b9d0-b55a6fdc40ed', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000007', '25/200243-2', '2025-04-05', '2025-04-04', '2025-04-07', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('41792aa3-782a-4c68-b9d0-b55a6fdc40ed', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000007', '25/200244-0', '2025-04-05', '2025-04-04', '2025-04-07', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('41792aa3-782a-4c68-b9d0-b55a6fdc40ed', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000007', '25/200245-9', '2025-04-05', '2025-04-04', '2025-04-07', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('41792aa3-782a-4c68-b9d0-b55a6fdc40ed', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000007', '25/200306-4', '2025-04-05', '2025-04-04', '2025-04-07', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('41792aa3-782a-4c68-b9d0-b55a6fdc40ed', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000007', '25/200309-9', '2025-04-05', '2025-04-04', '2025-04-07', 152.1, 152.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('41792aa3-782a-4c68-b9d0-b55a6fdc40ed', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000007', '25/200323-4', '2025-04-05', '2025-04-04', '2025-04-07', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('41792aa3-782a-4c68-b9d0-b55a6fdc40ed', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000007', '25/200327-7', '2025-04-05', '2025-04-04', '2025-04-07', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000017', '25/200246-7', '2025-04-05', '2025-04-07', '2025-04-08', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000017', '25/200254-8', '2025-04-05', '2025-04-07', '2025-04-08', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000017', '25/200261-0', '2025-04-05', '2025-04-07', '2025-04-08', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000017', '25/200276-9', '2025-04-05', '2025-04-07', '2025-04-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000017', '25/200277-7', '2025-04-05', '2025-04-07', '2025-04-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', 'e9a47af5-5fa8-44e4-8058-da1429660260', 'COB000017', '25/200287-4', '2025-04-10', '2025-04-07', '2025-04-08', 551.97, 551.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000017', '25/200298-0', '2025-04-05', '2025-04-07', '2025-04-08', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000017', '25/200301-3', '2025-04-05', '2025-04-07', '2025-04-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000017', '25/200302-1', '2025-04-05', '2025-04-07', '2025-04-08', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000017', '25/200303-0', '2025-04-05', '2025-04-07', '2025-04-08', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000017', '25/200308-0', '2025-04-05', '2025-04-07', '2025-04-08', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000017', '25/200316-1', '2025-04-05', '2025-04-07', '2025-04-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '9fabf180-853d-424e-a6ee-1941e3eb8f78', 'COB000017', '25/200317-0', '2025-04-05', '2025-04-07', '2025-04-08', 581.04, 581.04)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000017', '25/200328-5', '2025-04-05', '2025-04-07', '2025-04-08', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000017', '25/200332-3', '2025-04-05', '2025-04-07', '2025-04-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000017', '25/200333-1', '2025-04-05', '2025-04-07', '2025-04-08', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2933787d-4bd6-4b2e-a2e3-66d830ccc603', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000017', '25/200339-0', '2025-04-05', '2025-04-07', '2025-04-08', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6b03a3fe-54c2-445c-8e2a-2b20774dd556', '8d125b22-fa6d-4b86-bcc3-4795a60f2096', 'COB000002', '25/200247-5', '2025-04-05', '2025-04-08', '2025-04-09', 759, 774.4)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6b03a3fe-54c2-445c-8e2a-2b20774dd556', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000002', '25/200249-1', '2025-04-10', '2025-04-08', '2025-04-09', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('613d5c42-5c5c-4c89-929d-afba083f62e2', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000007', '25/200259-9', '2025-04-10', '2025-04-09', '2025-04-10', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('613d5c42-5c5c-4c89-929d-afba083f62e2', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000007', '25/200266-1', '2025-04-10', '2025-04-09', '2025-04-10', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('613d5c42-5c5c-4c89-929d-afba083f62e2', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000007', '25/200273-4', '2025-04-10', '2025-04-09', '2025-04-10', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('613d5c42-5c5c-4c89-929d-afba083f62e2', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000007', '25/200284-0', '2025-04-10', '2025-04-09', '2025-04-10', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('613d5c42-5c5c-4c89-929d-afba083f62e2', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000007', '25/200296-3', '2025-04-10', '2025-04-09', '2025-04-10', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('613d5c42-5c5c-4c89-929d-afba083f62e2', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000007', '25/200305-6', '2025-04-10', '2025-04-09', '2025-04-10', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('613d5c42-5c5c-4c89-929d-afba083f62e2', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000007', '25/200322-6', '2025-04-05', '2025-04-09', '2025-04-10', 759, 774.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000024', '25/200242-4', '2025-04-10', '2025-04-10', '2025-04-11', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000024', '25/200251-3', '2025-04-10', '2025-04-10', '2025-04-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000024', '25/200256-4', '2025-04-10', '2025-04-10', '2025-04-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000024', '25/200257-2', '2025-04-10', '2025-04-10', '2025-04-11', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000024', '25/200260-2', '2025-04-10', '2025-04-10', '2025-04-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000024', '25/200265-3', '2025-04-10', '2025-04-10', '2025-04-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000024', '25/200267-0', '2025-04-10', '2025-04-10', '2025-04-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000024', '25/200268-8', '2025-04-10', '2025-04-10', '2025-04-11', 1525.86, 1525.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000024', '25/200271-8', '2025-04-10', '2025-04-10', '2025-04-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000024', '25/200272-6', '2025-04-10', '2025-04-10', '2025-04-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000024', '25/200279-3', '2025-04-10', '2025-04-10', '2025-04-11', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000024', '25/200281-5', '2025-04-10', '2025-04-10', '2025-04-11', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000024', '25/200294-7', '2025-04-10', '2025-04-10', '2025-04-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000024', '25/200297-1', '2025-04-10', '2025-04-10', '2025-04-11', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000024', '25/200307-2', '2025-04-10', '2025-04-10', '2025-04-11', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000024', '25/200310-2', '2025-04-10', '2025-04-10', '2025-04-11', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000024', '25/200311-0', '2025-04-10', '2025-04-10', '2025-04-11', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000024', '25/200312-9', '2025-04-10', '2025-04-10', '2025-04-11', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000024', '25/200315-3', '2025-04-10', '2025-04-10', '2025-04-11', 574.96, 574.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000024', '25/200321-8', '2025-04-10', '2025-04-10', '2025-04-11', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000024', '25/200324-2', '2025-04-05', '2025-04-10', '2025-04-11', 759, 774.55)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000024', '25/200330-7', '2025-04-10', '2025-04-10', '2025-04-11', 2889.92, 2889.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', 'cca5abc2-a34f-4a8c-86ee-f48dab227a91', 'COB000024', '25/200335-8', '2025-04-10', '2025-04-10', '2025-04-11', 4563.02, 4563.02)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('83db823d-e3de-464b-ac48-31dc5e00e119', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000024', '25/200336-6', '2025-04-10', '2025-04-10', '2025-04-11', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c82d741c-38dd-4c5f-98dd-c30aed6f84fa', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000002', '25/200291-2', '2025-04-10', '2025-04-11', '2025-04-14', 759, 774.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c82d741c-38dd-4c5f-98dd-c30aed6f84fa', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000002', '25/200314-5', '2025-04-10', '2025-04-11', '2025-04-14', 767.58, 783)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5c1e8554-c992-4bfa-90e8-3cc33b251264', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000007', '25/200248-3', '2025-04-15', '2025-04-15', '2025-04-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5c1e8554-c992-4bfa-90e8-3cc33b251264', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000007', '25/200255-6', '2025-04-15', '2025-04-15', '2025-04-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5c1e8554-c992-4bfa-90e8-3cc33b251264', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000007', '25/200264-5', '2025-04-15', '2025-04-15', '2025-04-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5c1e8554-c992-4bfa-90e8-3cc33b251264', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000007', '25/200304-8', '2025-04-15', '2025-04-15', '2025-04-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5c1e8554-c992-4bfa-90e8-3cc33b251264', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000007', '25/200326-9', '2025-04-15', '2025-04-15', '2025-04-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5c1e8554-c992-4bfa-90e8-3cc33b251264', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000007', '25/200329-3', '2025-04-15', '2025-04-15', '2025-04-16', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5c1e8554-c992-4bfa-90e8-3cc33b251264', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000007', '25/200341-2', '2025-04-10', '2025-04-15', '2025-04-16', 1889.59, 1928.32)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2bb48656-dcc8-4cac-8c58-dc428ea0b932', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000002', '25/200219-0', '2025-05-05', '2025-04-16', '2025-04-17', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2bb48656-dcc8-4cac-8c58-dc428ea0b932', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000002', '25/200229-7', '2025-05-05', '2025-04-16', '2025-04-17', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0915dce7-a9d6-4d58-920c-a2d639ad9bfb', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000007', '25/200144-4', '2025-04-22', '2025-04-22', '2025-04-23', 1525.86, 1525.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0915dce7-a9d6-4d58-920c-a2d639ad9bfb', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000007', '25/200145-2', '2025-04-22', '2025-04-22', '2025-04-23', 379.5, 379.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0915dce7-a9d6-4d58-920c-a2d639ad9bfb', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000007', '25/200158-4', '2025-04-22', '2025-04-22', '2025-04-23', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0915dce7-a9d6-4d58-920c-a2d639ad9bfb', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000007', '25/200250-5', '2025-04-21', '2025-04-22', '2025-04-23', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0915dce7-a9d6-4d58-920c-a2d639ad9bfb', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000007', '25/200263-7', '2025-04-21', '2025-04-22', '2025-04-23', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0915dce7-a9d6-4d58-920c-a2d639ad9bfb', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000007', '25/200269-6', '2025-04-22', '2025-04-22', '2025-04-23', 379.5, 379.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0915dce7-a9d6-4d58-920c-a2d639ad9bfb', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000007', '25/200282-3', '2025-04-22', '2025-04-22', '2025-04-23', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ffc85bbe-a4da-40bb-833b-bd7a60d6c3a2', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000003', '25/200386-2', '2025-05-05', '2025-04-30', '2025-05-02', 363.15, 363.15)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ffc85bbe-a4da-40bb-833b-bd7a60d6c3a2', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000003', '25/200400-1', '2025-05-05', '2025-04-30', '2025-05-02', 2276.86, 2276.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ffc85bbe-a4da-40bb-833b-bd7a60d6c3a2', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000003', '25/200418-4', '2025-05-05', '2025-04-30', '2025-05-02', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '943c4c68-45b8-414f-8dd3-097484aaa2ff', 'COB000020', '25/200285-8', '2025-04-25', '2025-05-05', '2025-05-06', 300, 306.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '5f7c0c62-ffa1-486f-a40d-e2d9183427d8', 'COB000020', '25/200288-2', '2025-04-25', '2025-05-05', '2025-05-06', 300, 306.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000020', '25/200354-4', '2025-05-05', '2025-05-05', '2025-05-06', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000020', '25/200360-9', '2025-05-05', '2025-05-05', '2025-05-06', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '8c91b37f-5418-4f56-8592-36ab257efe86', 'COB000020', '25/200373-0', '2025-05-05', '2025-05-05', '2025-05-06', 485.77, 485.77)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000020', '25/200376-5', '2025-05-05', '2025-05-05', '2025-05-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000020', '25/200377-3', '2025-05-05', '2025-05-05', '2025-05-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000020', '25/200380-3', '2025-05-05', '2025-05-05', '2025-05-06', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000020', '25/200393-5', '2025-05-05', '2025-05-05', '2025-05-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000020', '25/200398-6', '2025-05-05', '2025-05-05', '2025-05-06', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000020', '25/200401-0', '2025-05-05', '2025-05-05', '2025-05-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000020', '25/200402-8', '2025-05-05', '2025-05-05', '2025-05-06', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000020', '25/200403-6', '2025-05-05', '2025-05-05', '2025-05-06', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000020', '25/200408-7', '2025-05-05', '2025-05-05', '2025-05-06', 152.1, 152.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000020', '25/200416-8', '2025-05-05', '2025-05-05', '2025-05-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000020', '25/200423-0', '2025-05-05', '2025-05-05', '2025-05-06', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000020', '25/200431-1', '2025-05-05', '2025-05-05', '2025-05-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000020', '25/200436-2', '2025-05-05', '2025-05-05', '2025-05-06', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000020', '25/200439-7', '2025-05-05', '2025-05-05', '2025-05-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a714790f-51dd-4584-91f4-3f78f993fe42', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000020', '25/200442-7', '2025-05-05', '2025-05-05', '2025-05-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000010', '25/200344-7', '2025-05-05', '2025-05-06', '2025-05-07', 537.5, 548.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000010', '25/200345-5', '2025-05-05', '2025-05-06', '2025-05-07', 537.5, 548.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', '8fe85a29-d159-43dd-8874-f85da9375e32', 'COB000010', '25/200361-7', '2025-05-05', '2025-05-06', '2025-05-07', 1518, 1548.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000010', '25/200378-1', '2025-05-05', '2025-05-06', '2025-05-07', 1518, 1548.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', '7be0ec1d-783d-4156-a5e6-7a9ce59c0d1d', 'COB000010', '25/200390-0', '2025-05-05', '2025-05-06', '2025-05-07', 537.5, 548.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000010', '25/200406-0', '2025-05-05', '2025-05-06', '2025-05-07', 603.75, 615.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 'COB000010', '25/200419-2', '2025-05-05', '2025-05-06', '2025-05-07', 1001.95, 1022.08)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000010', '25/200420-6', '2025-05-05', '2025-05-06', '2025-05-07', 537.5, 548.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000010', '25/200427-3', '2025-05-05', '2025-05-06', '2025-05-07', 334.97, 341.69)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3cb44ab-f7ef-40f4-8647-c61d640d145f', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000010', '25/200437-0', '2025-05-05', '2025-05-06', '2025-05-07', 766.82, 782.22)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f515e422-6cdb-45ae-96e5-735d9941016d', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000002', '25/200424-9', '2025-05-05', '2025-05-07', '2025-05-08', 759, 774.33)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f515e422-6cdb-45ae-96e5-735d9941016d', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000002', '25/200428-1', '2025-05-05', '2025-05-07', '2025-05-08', 724.88, 739.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a64c15ee-b9ba-4b04-8af2-5e75aef41b2f', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000001', '25/200405-2', '2025-05-10', '2025-05-08', '2025-05-09', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b1d1fed2-b2df-42d0-b5c4-1e174a74dddf', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000002', '25/200372-2', '2025-05-10', '2025-05-09', '2025-05-12', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b1d1fed2-b2df-42d0-b5c4-1e174a74dddf', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000002', '25/200422-2', '2025-05-05', '2025-05-09', '2025-05-12', 759, 774.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000033', '25/200343-9', '2025-05-10', '2025-05-12', '2025-05-13', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000033', '25/200349-8', '2025-05-10', '2025-05-12', '2025-05-13', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000033', '25/200351-0', '2025-05-10', '2025-05-12', '2025-05-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000033', '25/200356-0', '2025-05-10', '2025-05-12', '2025-05-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000033', '25/200358-7', '2025-05-10', '2025-05-12', '2025-05-13', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000033', '25/200359-5', '2025-05-10', '2025-05-12', '2025-05-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000033', '25/200364-1', '2025-05-10', '2025-05-12', '2025-05-13', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000033', '25/200365-0', '2025-05-10', '2025-05-12', '2025-05-13', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000033', '25/200368-4', '2025-05-10', '2025-05-12', '2025-05-13', 379.5, 379.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000033', '25/200370-6', '2025-05-10', '2025-05-12', '2025-05-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000033', '25/200371-4', '2025-05-10', '2025-05-12', '2025-05-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000033', '25/200379-0', '2025-05-10', '2025-05-12', '2025-05-13', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000033', '25/200381-1', '2025-05-10', '2025-05-12', '2025-05-13', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000033', '25/200382-0', '2025-05-10', '2025-05-12', '2025-05-13', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000033', '25/200384-6', '2025-05-10', '2025-05-12', '2025-05-13', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', 'e9a47af5-5fa8-44e4-8058-da1429660260', 'COB000033', '25/200387-0', '2025-05-10', '2025-05-12', '2025-05-13', 551.97, 551.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000033', '25/200391-9', '2025-05-10', '2025-05-12', '2025-05-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000033', '25/200394-3', '2025-05-10', '2025-05-12', '2025-05-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000033', '25/200396-0', '2025-05-10', '2025-05-12', '2025-05-13', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000033', '25/200397-8', '2025-05-10', '2025-05-12', '2025-05-13', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000033', '25/200407-9', '2025-05-10', '2025-05-12', '2025-05-13', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000033', '25/200409-5', '2025-05-10', '2025-05-12', '2025-05-13', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000033', '25/200410-9', '2025-05-10', '2025-05-12', '2025-05-13', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000033', '25/200411-7', '2025-05-10', '2025-05-12', '2025-05-13', 7589.52, 7589.52)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000033', '25/200412-5', '2025-05-10', '2025-05-12', '2025-05-13', 1889.59, 1889.59)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000033', '25/200413-3', '2025-05-10', '2025-05-12', '2025-05-13', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 'COB000033', '25/200414-1', '2025-05-10', '2025-05-12', '2025-05-13', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000033', '25/200415-0', '2025-05-10', '2025-05-12', '2025-05-13', 574.96, 574.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000033', '25/200421-4', '2025-05-10', '2025-05-12', '2025-05-13', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000033', '25/200430-3', '2025-05-10', '2025-05-12', '2025-05-13', 2889.92, 2889.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000033', '25/200433-8', '2025-05-10', '2025-05-12', '2025-05-13', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000033', '25/200438-9', '2025-05-10', '2025-05-12', '2025-05-13', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1637cca2-fddd-4ac5-946b-bf091fc91a7b', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000033', '25/200440-0', '2025-05-10', '2025-05-12', '2025-05-13', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('147f149e-5039-414d-a712-bfe58c183a29', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000006', '25/200348-0', '2025-05-15', '2025-05-15', '2025-05-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('147f149e-5039-414d-a712-bfe58c183a29', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000006', '25/200355-2', '2025-05-15', '2025-05-15', '2025-05-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('147f149e-5039-414d-a712-bfe58c183a29', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000006', '25/200363-3', '2025-05-15', '2025-05-15', '2025-05-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('147f149e-5039-414d-a712-bfe58c183a29', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000006', '25/200404-4', '2025-05-15', '2025-05-15', '2025-05-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('147f149e-5039-414d-a712-bfe58c183a29', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000006', '25/200426-5', '2025-05-15', '2025-05-15', '2025-05-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('147f149e-5039-414d-a712-bfe58c183a29', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000006', '25/200429-0', '2025-05-15', '2025-05-15', '2025-05-16', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b1c9a977-220b-4828-9ba6-8acacecf6204', '3fde02cc-c2b0-49d0-9ff5-ee8ec8ecb465', 'COB000002', '25/100001-0', '2025-05-21', '2025-05-20', '2025-05-21', 600, 600)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b1c9a977-220b-4828-9ba6-8acacecf6204', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000002', '25/200366-8', '2025-05-10', '2025-05-20', '2025-05-21', 759, 774.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e48311f9-e012-4681-83a2-c862f5482684', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000003', '25/200350-1', '2025-05-21', '2025-05-21', '2025-05-22', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e48311f9-e012-4681-83a2-c862f5482684', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000003', '25/200362-5', '2025-05-21', '2025-05-21', '2025-05-22', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e48311f9-e012-4681-83a2-c862f5482684', '711b0c84-1365-494f-b877-7b5da7c996c3', 'COB000003', '25/200443-5', '2025-05-15', '2025-05-21', '2025-05-22', 300, 306.18)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2499564c-0a21-4988-a3e3-ff44daf9220a', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000001', '25/200444-3', '2025-05-26', '2025-05-26', '2025-05-27', 5000, 5000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6654c0ed-2522-4462-ac11-9260a7959789', '33b167c0-cf23-4b0c-b111-42085ce8bc69', 'COB000001', '25/200357-9', '2025-05-15', '2025-05-27', '2025-05-28', 919.95, 939.44)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('18d3276a-e284-4d9b-b9ed-1fef98a117b4', '18a91e2f-27e4-4478-bb28-021d6d9789ef', 'COB000003', '25/200175-4', '2025-03-05', '2025-05-28', '2025-05-29', 1518, 1561.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('18d3276a-e284-4d9b-b9ed-1fef98a117b4', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000003', '25/200220-3', '2025-06-05', '2025-05-28', '2025-05-29', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('18d3276a-e284-4d9b-b9ed-1fef98a117b4', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000003', '25/200526-1', '2025-06-05', '2025-05-28', '2025-05-29', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e8cd68db-91ed-4bae-9b46-cc81c9737146', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000001', '25/200230-0', '2025-06-05', '2025-05-29', '2025-05-30', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('27d9c20c-affc-42e3-95ca-40a8658a4d0c', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000004', '25/200459-1', '2025-06-05', '2025-06-02', '2025-06-03', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('27d9c20c-affc-42e3-95ca-40a8658a4d0c', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000004', '25/200466-4', '2025-06-05', '2025-06-02', '2025-06-03', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('27d9c20c-affc-42e3-95ca-40a8658a4d0c', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000004', '25/200486-9', '2025-06-05', '2025-06-02', '2025-06-03', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('27d9c20c-affc-42e3-95ca-40a8658a4d0c', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000004', '25/200506-7', '2025-06-05', '2025-06-02', '2025-06-03', 2276.86, 2276.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dab57d4d-ed0a-4b4b-9c47-3052d0f21195', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000003', '25/200492-3', '2025-06-05', '2025-06-03', '2025-06-04', 363.15, 363.15)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dab57d4d-ed0a-4b4b-9c47-3052d0f21195', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000003', '25/200507-5', '2025-06-05', '2025-06-03', '2025-06-04', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dab57d4d-ed0a-4b4b-9c47-3052d0f21195', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000003', '25/200515-6', '2025-06-05', '2025-06-03', '2025-06-04', 152.1, 152.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('477cee18-e6d3-4d21-852e-b96533879905', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000005', '25/200504-0', '2025-06-05', '2025-06-04', '2025-06-05', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('477cee18-e6d3-4d21-852e-b96533879905', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000005', '25/200508-3', '2025-06-05', '2025-06-04', '2025-06-05', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('477cee18-e6d3-4d21-852e-b96533879905', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000005', '25/200509-1', '2025-06-05', '2025-06-04', '2025-06-05', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('477cee18-e6d3-4d21-852e-b96533879905', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000005', '25/200524-5', '2025-06-05', '2025-06-04', '2025-06-05', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('477cee18-e6d3-4d21-852e-b96533879905', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000005', '25/200531-8', '2025-06-05', '2025-06-04', '2025-06-05', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000016', '25/200447-8', '2025-06-05', '2025-06-05', '2025-06-06', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000016', '25/200448-6', '2025-06-05', '2025-06-05', '2025-06-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000016', '25/200449-4', '2025-06-05', '2025-06-05', '2025-06-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000016', '25/200450-8', '2025-06-05', '2025-06-05', '2025-06-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '8c91b37f-5418-4f56-8592-36ab257efe86', 'COB000016', '25/200479-6', '2025-06-05', '2025-06-05', '2025-06-06', 485.77, 485.77)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000016', '25/200482-6', '2025-06-05', '2025-06-05', '2025-06-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000016', '25/200483-4', '2025-06-05', '2025-06-05', '2025-06-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000016', '25/200499-0', '2025-06-05', '2025-06-05', '2025-06-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000016', '25/200512-1', '2025-06-05', '2025-06-05', '2025-06-06', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000016', '25/200514-8', '2025-06-05', '2025-06-05', '2025-06-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000016', '25/200530-0', '2025-06-05', '2025-06-05', '2025-06-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000016', '25/200535-0', '2025-06-05', '2025-06-05', '2025-06-06', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000016', '25/200536-9', '2025-06-05', '2025-06-05', '2025-06-06', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000016', '25/200540-7', '2025-06-05', '2025-06-05', '2025-06-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000016', '25/200541-5', '2025-06-05', '2025-06-05', '2025-06-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a60ece15-af45-4005-ac4c-306fe1aef44a', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000016', '25/200546-6', '2025-06-05', '2025-06-05', '2025-06-06', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1f3ac44d-1b75-402f-843d-b4e18c2091e3', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000003', '25/200462-1', '2025-06-10', '2025-06-06', '2025-06-09', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1f3ac44d-1b75-402f-843d-b4e18c2091e3', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000003', '25/200513-0', '2025-06-10', '2025-06-06', '2025-06-09', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1f3ac44d-1b75-402f-843d-b4e18c2091e3', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000003', '25/200517-2', '2025-06-10', '2025-06-06', '2025-06-09', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8837a5d8-f442-4bf3-8d25-c9d60c070e1f', '8fe85a29-d159-43dd-8874-f85da9375e32', 'COB000006', '25/200467-2', '2025-06-05', '2025-06-09', '2025-06-10', 1518, 1548.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8837a5d8-f442-4bf3-8d25-c9d60c070e1f', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000006', '25/200478-8', '2025-06-10', '2025-06-09', '2025-06-10', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8837a5d8-f442-4bf3-8d25-c9d60c070e1f', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000006', '25/200490-7', '2025-06-10', '2025-06-09', '2025-06-10', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8837a5d8-f442-4bf3-8d25-c9d60c070e1f', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000006', '25/200503-2', '2025-06-10', '2025-06-09', '2025-06-10', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8837a5d8-f442-4bf3-8d25-c9d60c070e1f', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000006', '25/200511-3', '2025-06-10', '2025-06-09', '2025-06-10', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8837a5d8-f442-4bf3-8d25-c9d60c070e1f', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 'COB000006', '25/200527-0', '2025-06-05', '2025-06-09', '2025-06-10', 1001.95, 1022.38)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000027', '25/200446-0', '2025-06-10', '2025-06-10', '2025-06-11', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000027', '25/200453-2', '2025-06-10', '2025-06-10', '2025-06-11', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000027', '25/200455-9', '2025-06-10', '2025-06-10', '2025-06-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000027', '25/200456-7', '2025-06-10', '2025-06-10', '2025-06-11', 5000, 5000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000027', '25/200461-3', '2025-06-10', '2025-06-10', '2025-06-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000027', '25/200464-8', '2025-06-10', '2025-06-10', '2025-06-11', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000027', '25/200465-6', '2025-06-10', '2025-06-10', '2025-06-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000027', '25/200470-2', '2025-06-10', '2025-06-10', '2025-06-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000027', '25/200471-0', '2025-06-10', '2025-06-10', '2025-06-11', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000027', '25/200472-9', '2025-06-10', '2025-06-10', '2025-06-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000027', '25/200473-7', '2025-06-10', '2025-06-10', '2025-06-11', 1525.86, 1525.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000027', '25/200474-5', '2025-06-10', '2025-06-10', '2025-06-11', 379.5, 379.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000027', '25/200476-1', '2025-06-10', '2025-06-10', '2025-06-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000027', '25/200477-0', '2025-06-10', '2025-06-10', '2025-06-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000027', '25/200485-0', '2025-06-10', '2025-06-10', '2025-06-11', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000027', '25/200488-5', '2025-06-10', '2025-06-10', '2025-06-11', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000027', '25/200497-4', '2025-06-10', '2025-06-10', '2025-06-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000027', '25/200500-8', '2025-06-10', '2025-06-10', '2025-06-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000027', '25/200502-4', '2025-06-10', '2025-06-10', '2025-06-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000027', '25/200516-4', '2025-06-10', '2025-06-10', '2025-06-11', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000027', '25/200518-0', '2025-06-10', '2025-06-10', '2025-06-11', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000027', '25/200521-0', '2025-06-10', '2025-06-10', '2025-06-11', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 'COB000027', '25/200522-9', '2025-06-10', '2025-06-10', '2025-06-11', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000027', '25/200523-7', '2025-06-10', '2025-06-10', '2025-06-11', 574.96, 574.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000027', '25/200529-6', '2025-06-10', '2025-06-10', '2025-06-11', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000027', '25/200538-5', '2025-06-10', '2025-06-10', '2025-06-11', 2889.92, 2889.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f660b38b-b1d9-42b7-929b-2119b17271d0', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000027', '25/200543-1', '2025-06-10', '2025-06-10', '2025-06-11', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a7c85c6e-b4f3-4d5c-b0b6-9249d564ecd7', 'b5a1bb23-ef78-4fb7-8f5e-2c116963b059', 'COB000006', '25/200457-5', '2025-06-10', '2025-06-13', '2025-06-16', 977.45, 997.28)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a7c85c6e-b4f3-4d5c-b0b6-9249d564ecd7', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 'COB000006', '25/200458-3', '2025-06-10', '2025-06-13', '2025-06-16', 977.45, 997.28)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a7c85c6e-b4f3-4d5c-b0b6-9249d564ecd7', '01247d35-327e-416f-b928-b85e64e8b070', 'COB000006', '25/200480-0', '2025-06-10', '2025-06-13', '2025-06-16', 977.45, 997.28)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a7c85c6e-b4f3-4d5c-b0b6-9249d564ecd7', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 'COB000006', '25/200495-8', '2025-06-10', '2025-06-13', '2025-06-16', 977.45, 997.28)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a7c85c6e-b4f3-4d5c-b0b6-9249d564ecd7', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000006', '25/200519-9', '2025-06-10', '2025-06-13', '2025-06-16', 7589.52, 7743.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a7c85c6e-b4f3-4d5c-b0b6-9249d564ecd7', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000006', '25/200520-2', '2025-06-10', '2025-06-13', '2025-06-16', 1889.59, 1927.94)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('39ee7216-84df-49a9-8e32-6513bf06a38f', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000003', '25/200452-4', '2025-06-15', '2025-06-16', '2025-06-17', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('39ee7216-84df-49a9-8e32-6513bf06a38f', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000003', '25/200510-5', '2025-06-15', '2025-06-16', '2025-06-17', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('39ee7216-84df-49a9-8e32-6513bf06a38f', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000003', '25/200537-7', '2025-06-15', '2025-06-16', '2025-06-17', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5770e869-7b79-40a7-8dfb-a42b3fb896e8', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000002', '25/200454-0', '2025-06-21', '2025-06-20', '2025-06-23', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5770e869-7b79-40a7-8dfb-a42b3fb896e8', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000002', '25/200468-0', '2025-06-21', '2025-06-20', '2025-06-23', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('471e3c88-e8d7-424b-b5b8-d265b045d813', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000002', '25/200460-5', '2025-06-24', '2025-06-24', '2025-06-25', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('471e3c88-e8d7-424b-b5b8-d265b045d813', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000002', '25/200469-9', '2025-06-24', '2025-06-24', '2025-06-25', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fdf3d433-3576-4cd5-88fc-e504a71b2005', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000001', '25/200534-2', '2025-06-24', '2025-06-25', '2025-06-26', 275.98, 281.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('076da832-d73b-4224-bba3-54c8c7582fda', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000001', '25/200221-1', '2025-07-05', '2025-06-26', '2025-06-27', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6a32650b-3b0e-45e6-a2b2-9ab6f0ef09f9', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000001', '25/200231-9', '2025-07-05', '2025-06-27', '2025-06-30', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('330e2cfb-4586-429c-98f9-58ba5a488c2b', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000003', '25/200589-0', '2025-07-05', '2025-07-01', '2025-07-02', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('330e2cfb-4586-429c-98f9-58ba5a488c2b', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000003', '25/200595-4', '2025-07-05', '2025-07-01', '2025-07-02', 363.15, 363.15)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('330e2cfb-4586-429c-98f9-58ba5a488c2b', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000003', '25/200609-8', '2025-07-05', '2025-07-01', '2025-07-02', 2276.86, 2276.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c007dd4e-adb2-4782-9e74-ef86fad4c4cb', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000001', '25/200629-2', '2025-07-05', '2025-07-02', '2025-07-03', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3dbfedd-3a13-4038-b76a-91b6b5268074', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000003', '25/200611-0', '2025-07-05', '2025-07-03', '2025-07-04', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3dbfedd-3a13-4038-b76a-91b6b5268074', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000003', '25/200612-8', '2025-07-05', '2025-07-03', '2025-07-04', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f3dbfedd-3a13-4038-b76a-91b6b5268074', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000003', '25/200628-4', '2025-07-05', '2025-07-03', '2025-07-04', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0a6b5eaf-1e53-40c8-aaf5-2813f363ce36', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000007', '25/200549-0', '2025-07-05', '2025-07-04', '2025-07-07', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0a6b5eaf-1e53-40c8-aaf5-2813f363ce36', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000007', '25/200550-4', '2025-07-05', '2025-07-04', '2025-07-07', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0a6b5eaf-1e53-40c8-aaf5-2813f363ce36', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000007', '25/200551-2', '2025-07-05', '2025-07-04', '2025-07-07', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0a6b5eaf-1e53-40c8-aaf5-2813f363ce36', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000007', '25/200602-0', '2025-07-05', '2025-07-04', '2025-07-07', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0a6b5eaf-1e53-40c8-aaf5-2813f363ce36', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000007', '25/200615-2', '2025-07-05', '2025-07-04', '2025-07-07', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0a6b5eaf-1e53-40c8-aaf5-2813f363ce36', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000007', '25/200634-9', '2025-07-05', '2025-07-04', '2025-07-07', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('0a6b5eaf-1e53-40c8-aaf5-2813f363ce36', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000007', '25/200638-1', '2025-07-05', '2025-07-04', '2025-07-07', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000018', '25/200552-0', '2025-07-05', '2025-07-07', '2025-07-08', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '8d125b22-fa6d-4b86-bcc3-4795a60f2096', 'COB000018', '25/200553-9', '2025-07-05', '2025-07-07', '2025-07-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000018', '25/200562-8', '2025-07-05', '2025-07-07', '2025-07-08', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000018', '25/200569-5', '2025-07-05', '2025-07-07', '2025-07-08', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '8fe85a29-d159-43dd-8874-f85da9375e32', 'COB000018', '25/200570-9', '2025-07-05', '2025-07-07', '2025-07-08', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000018', '25/200581-4', '2025-07-10', '2025-07-07', '2025-07-08', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '8c91b37f-5418-4f56-8592-36ab257efe86', 'COB000018', '25/200582-2', '2025-07-05', '2025-07-07', '2025-07-08', 485.77, 485.77)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000018', '25/200585-7', '2025-07-05', '2025-07-07', '2025-07-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000018', '25/200586-5', '2025-07-05', '2025-07-07', '2025-07-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000018', '25/200607-1', '2025-07-05', '2025-07-07', '2025-07-08', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000018', '25/200610-1', '2025-07-05', '2025-07-07', '2025-07-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000018', '25/200618-7', '2025-07-05', '2025-07-07', '2025-07-08', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000018', '25/200619-5', '2025-07-05', '2025-07-07', '2025-07-08', 152.1, 152.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 'COB000018', '25/200630-6', '2025-07-05', '2025-07-07', '2025-07-08', 1001.95, 1001.95)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000018', '25/200635-7', '2025-07-05', '2025-07-07', '2025-07-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000018', '25/200643-8', '2025-07-05', '2025-07-07', '2025-07-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000018', '25/200644-6', '2025-07-05', '2025-07-07', '2025-07-08', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9e0ce883-530f-4eb4-8cfa-c79a7b4b32f2', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000018', '25/200649-7', '2025-07-05', '2025-07-07', '2025-07-08', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b04944ef-5329-4305-9503-66b70a1bbcf2', '33b167c0-cf23-4b0c-b111-42085ce8bc69', 'COB000004', '25/200463-0', '2025-06-15', '2025-07-08', '2025-07-09', 919.95, 940.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b04944ef-5329-4305-9503-66b70a1bbcf2', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000004', '25/200567-9', '2025-07-10', '2025-07-08', '2025-07-09', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b04944ef-5329-4305-9503-66b70a1bbcf2', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000004', '25/200593-8', '2025-07-10', '2025-07-08', '2025-07-09', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b04944ef-5329-4305-9503-66b70a1bbcf2', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000004', '25/200614-4', '2025-07-10', '2025-07-08', '2025-07-09', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1cc835e1-6898-410b-b041-b00ccd82f1c6', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000002', '25/200574-1', '2025-07-10', '2025-07-09', '2025-07-10', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1cc835e1-6898-410b-b041-b00ccd82f1c6', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000002', '25/200639-0', '2025-07-05', '2025-07-09', '2025-07-10', 724.88, 739.65)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000034', '25/200487-7', '2025-06-10', '2025-07-10', '2025-07-11', 472.06, 482.91)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000034', '25/200548-2', '2025-07-10', '2025-07-10', '2025-07-11', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000034', '25/200555-5', '2025-07-10', '2025-07-10', '2025-07-11', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000034', '25/200557-1', '2025-07-10', '2025-07-10', '2025-07-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000034', '25/200558-0', '2025-07-10', '2025-07-10', '2025-07-11', 5000, 5000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '6180bde5-5b5e-4359-916a-60ec90d5a36b', 'COB000034', '25/200561-0', '2025-07-10', '2025-07-10', '2025-07-11', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000034', '25/200564-4', '2025-07-10', '2025-07-10', '2025-07-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000034', '25/200565-2', '2025-07-10', '2025-07-10', '2025-07-11', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000034', '25/200568-7', '2025-07-10', '2025-07-10', '2025-07-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000034', '25/200573-3', '2025-07-10', '2025-07-10', '2025-07-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000034', '25/200575-0', '2025-07-10', '2025-07-10', '2025-07-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000034', '25/200576-8', '2025-07-10', '2025-07-10', '2025-07-11', 1525.86, 1525.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000034', '25/200577-6', '2025-07-10', '2025-07-10', '2025-07-11', 379.5, 379.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000034', '25/200579-2', '2025-07-10', '2025-07-10', '2025-07-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000034', '25/200580-6', '2025-07-10', '2025-07-10', '2025-07-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000034', '25/200588-1', '2025-07-10', '2025-07-10', '2025-07-11', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000034', '25/200590-3', '2025-07-10', '2025-07-10', '2025-07-11', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000034', '25/200591-1', '2025-07-10', '2025-07-10', '2025-07-11', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000034', '25/200600-4', '2025-07-10', '2025-07-10', '2025-07-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000034', '25/200603-9', '2025-07-10', '2025-07-10', '2025-07-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000034', '25/200605-5', '2025-07-10', '2025-07-10', '2025-07-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000034', '25/200606-3', '2025-07-10', '2025-07-10', '2025-07-11', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000034', '25/200616-0', '2025-07-10', '2025-07-10', '2025-07-11', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000034', '25/200620-9', '2025-07-10', '2025-07-10', '2025-07-11', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000034', '25/200621-7', '2025-07-10', '2025-07-10', '2025-07-11', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000034', '25/200622-5', '2025-07-10', '2025-07-10', '2025-07-11', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000034', '25/200625-0', '2025-07-10', '2025-07-10', '2025-07-11', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 'COB000034', '25/200626-8', '2025-07-10', '2025-07-10', '2025-07-11', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000034', '25/200627-6', '2025-07-10', '2025-07-10', '2025-07-11', 574.96, 574.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000034', '25/200632-2', '2025-07-10', '2025-07-10', '2025-07-11', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000034', '25/200641-1', '2025-07-10', '2025-07-10', '2025-07-11', 2889.92, 2889.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000034', '25/200646-2', '2025-07-10', '2025-07-10', '2025-07-11', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', '04965477-8781-4e2a-bbe5-0be150daa8be', 'COB000034', '25/200651-9', '2025-07-10', '2025-07-10', '2025-07-11', 330, 330)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c9fbcaee-b350-4680-82ca-9ed9cdb4aef7', 'd346239a-9c52-41f8-a740-ba6dd85baef4', 'COB000034', '25/200652-7', '2025-07-10', '2025-07-10', '2025-07-11', 18216, 18216)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9f593534-fd08-491d-960b-22593e9d68e6', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000001', '25/200633-0', '2025-07-05', '2025-07-11', '2025-07-14', 759, 774.63)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2e41af66-bb6f-463a-a2b8-093656ff8ef0', 'b5a1bb23-ef78-4fb7-8f5e-2c116963b059', 'COB000004', '25/200559-8', '2025-07-10', '2025-07-14', '2025-07-15', 977.45, 997.38)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2e41af66-bb6f-463a-a2b8-093656ff8ef0', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 'COB000004', '25/200560-1', '2025-07-10', '2025-07-14', '2025-07-15', 977.45, 997.38)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2e41af66-bb6f-463a-a2b8-093656ff8ef0', '01247d35-327e-416f-b928-b85e64e8b070', 'COB000004', '25/200583-0', '2025-07-10', '2025-07-14', '2025-07-15', 977.45, 997.38)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2e41af66-bb6f-463a-a2b8-093656ff8ef0', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 'COB000004', '25/200598-9', '2025-07-10', '2025-07-14', '2025-07-15', 977.45, 997.38)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6c3e443e-e73d-48d7-98a8-2ea862cd3a69', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000005', '25/200554-7', '2025-07-15', '2025-07-15', '2025-07-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6c3e443e-e73d-48d7-98a8-2ea862cd3a69', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000005', '25/200563-6', '2025-07-15', '2025-07-15', '2025-07-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6c3e443e-e73d-48d7-98a8-2ea862cd3a69', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000005', '25/200572-5', '2025-07-15', '2025-07-15', '2025-07-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6c3e443e-e73d-48d7-98a8-2ea862cd3a69', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000005', '25/200613-6', '2025-07-15', '2025-07-15', '2025-07-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6c3e443e-e73d-48d7-98a8-2ea862cd3a69', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000005', '25/200640-3', '2025-07-15', '2025-07-15', '2025-07-16', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('af3212a1-7de2-4b43-9640-3405abe1a362', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000001', '25/200637-3', '2025-07-15', '2025-07-16', '2025-07-17', 275.98, 281.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('46105f54-4cac-4fc6-9111-ea61367d6f65', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000002', '25/200623-3', '2025-07-10', '2025-07-18', '2025-07-21', 7589.52, 7747.38)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('46105f54-4cac-4fc6-9111-ea61367d6f65', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000002', '25/200624-1', '2025-07-10', '2025-07-18', '2025-07-21', 1889.59, 1928.89)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d7b7c922-043a-4fdd-95ab-fea3cda9e8b5', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000002', '25/200556-3', '2025-07-21', '2025-07-21', '2025-07-22', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d7b7c922-043a-4fdd-95ab-fea3cda9e8b5', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000002', '25/200571-7', '2025-07-21', '2025-07-21', '2025-07-22', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a90574af-d015-44eb-9f7d-c68ccbee6504', 'd3a203cf-1e94-476a-8e44-12e4112755dc', 'COB000001', '25/200617-9', '2025-07-22', '2025-07-23', '2025-07-24', 759, 774.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1fdc5d43-570b-4c58-a02d-2335023d491f', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000001', '25/200222-0', '2025-08-05', '2025-07-24', '2025-07-25', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b6732790-62f1-459f-8c4d-5ebf0f5c7e43', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000001', '25/200232-7', '2025-08-05', '2025-07-28', '2025-07-29', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1c07456b-7cb8-4f37-835a-a48a4918f26b', '711b0c84-1365-494f-b877-7b5da7c996c3', 'COB000001', '25/200547-4', '2025-07-22', '2025-07-29', '2025-07-30', 300, 306.21)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4f5d08e7-3e5e-4e5b-aacd-c0da94c850a6', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000002', '25/200692-6', '2025-08-05', '2025-07-30', '2025-07-31', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4f5d08e7-3e5e-4e5b-aacd-c0da94c850a6', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000002', '25/200733-7', '2025-08-05', '2025-07-30', '2025-07-31', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('81a247d0-8a57-47f6-94ed-59e7978a5d4b', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000001', '25/200697-7', '2025-08-05', '2025-07-31', '2025-08-01', 363.15, 363.15)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('947886e9-0d77-4b26-ad3b-3e8133a4e69a', '8c91b37f-5418-4f56-8592-36ab257efe86', 'COB000004', '25/200686-1', '2025-08-05', '2025-08-04', '2025-08-05', 485.77, 485.77)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('947886e9-0d77-4b26-ad3b-3e8133a4e69a', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000004', '25/200711-6', '2025-08-05', '2025-08-04', '2025-08-05', 2276.86, 2276.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('947886e9-0d77-4b26-ad3b-3e8133a4e69a', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000004', '25/200738-8', '2025-08-05', '2025-08-04', '2025-08-05', 4554, 4554)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('947886e9-0d77-4b26-ad3b-3e8133a4e69a', '888b75da-b434-4a48-a929-cfe422033b53', 'COB000004', '25/200743-4', '2025-08-10', '2025-08-04', '2025-08-05', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000024', '25/200655-1', '2025-08-05', '2025-08-05', '2025-08-06', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000024', '25/200656-0', '2025-08-05', '2025-08-05', '2025-08-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000024', '25/200657-8', '2025-08-05', '2025-08-05', '2025-08-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000024', '25/200658-6', '2025-08-05', '2025-08-05', '2025-08-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000024', '25/200667-5', '2025-08-05', '2025-08-05', '2025-08-06', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000024', '25/200674-8', '2025-08-05', '2025-08-05', '2025-08-06', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000024', '25/200688-8', '2025-08-05', '2025-08-05', '2025-08-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000024', '25/200689-6', '2025-08-05', '2025-08-05', '2025-08-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000024', '25/200704-3', '2025-08-05', '2025-08-05', '2025-08-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000024', '25/200709-4', '2025-08-05', '2025-08-05', '2025-08-06', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000024', '25/200712-4', '2025-08-05', '2025-08-05', '2025-08-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000024', '25/200713-2', '2025-08-05', '2025-08-05', '2025-08-06', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000024', '25/200714-0', '2025-08-05', '2025-08-05', '2025-08-06', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000024', '25/200717-5', '2025-08-05', '2025-08-05', '2025-08-06', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000024', '25/200721-3', '2025-08-05', '2025-08-05', '2025-08-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000024', '25/200722-1', '2025-08-05', '2025-08-05', '2025-08-06', 152.1, 152.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000024', '25/200732-9', '2025-08-05', '2025-08-05', '2025-08-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000024', '25/200739-6', '2025-08-05', '2025-08-05', '2025-08-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000024', '25/200742-6', '2025-08-05', '2025-08-05', '2025-08-06', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000024', '25/200744-2', '2025-08-05', '2025-08-05', '2025-08-06', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '76d31568-8388-4a98-a1de-10cb6d38dbc4', 'COB000024', '25/200747-7', '2025-08-05', '2025-08-05', '2025-08-06', 100, 100)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000024', '25/200748-5', '2025-08-05', '2025-08-05', '2025-08-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000024', '25/200749-3', '2025-08-05', '2025-08-05', '2025-08-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1bb8095c-e94f-499a-a262-f6ec052344dc', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000024', '25/200753-1', '2025-08-05', '2025-08-05', '2025-08-06', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fcf401ea-fe5f-4e38-93d2-31e9fa3d451b', '8fe85a29-d159-43dd-8874-f85da9375e32', 'COB000002', '25/200675-6', '2025-08-05', '2025-08-06', '2025-08-07', 1518, 1548.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fcf401ea-fe5f-4e38-93d2-31e9fa3d451b', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 'COB000002', '25/200734-5', '2025-08-05', '2025-08-06', '2025-08-07', 1001.95, 1022.08)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('759321a9-0d7c-4145-a8cb-4b62e10e13fb', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000001', '25/200737-0', '2025-08-05', '2025-08-07', '2025-08-08', 759, 774.33)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e762d020-40e7-4ec7-abdd-08e6e920b192', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000002', '25/200716-7', '2025-08-10', '2025-08-08', '2025-08-11', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e762d020-40e7-4ec7-abdd-08e6e920b192', '04965477-8781-4e2a-bbe5-0be150daa8be', 'COB000002', '25/200718-3', '2025-08-10', '2025-08-08', '2025-08-11', 330, 330)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000032', '25/200654-3', '2025-08-10', '2025-08-11', '2025-08-12', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000032', '25/200661-6', '2025-08-10', '2025-08-11', '2025-08-12', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000032', '25/200663-2', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000032', '25/200664-0', '2025-08-10', '2025-08-11', '2025-08-12', 5000, 5000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000032', '25/200669-1', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000032', '25/200670-5', '2025-08-10', '2025-08-11', '2025-08-12', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000032', '25/200673-0', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000032', '25/200678-0', '2025-08-10', '2025-08-11', '2025-08-12', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000032', '25/200679-9', '2025-08-10', '2025-08-11', '2025-08-12', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000032', '25/200680-2', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000032', '25/200681-0', '2025-08-10', '2025-08-11', '2025-08-12', 1525.86, 1525.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000032', '25/200683-7', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000032', '25/200684-5', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000032', '25/200691-8', '2025-08-10', '2025-08-11', '2025-08-12', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000032', '25/200693-4', '2025-08-10', '2025-08-11', '2025-08-12', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000032', '25/200695-0', '2025-08-10', '2025-08-11', '2025-08-12', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000032', '25/200702-7', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000032', '25/200705-1', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000032', '25/200707-8', '2025-08-10', '2025-08-11', '2025-08-12', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000032', '25/200708-6', '2025-08-10', '2025-08-11', '2025-08-12', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000032', '25/200719-1', '2025-08-10', '2025-08-11', '2025-08-12', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', 'd3a203cf-1e94-476a-8e44-12e4112755dc', 'COB000032', '25/200720-5', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000032', '25/200724-8', '2025-08-10', '2025-08-11', '2025-08-12', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000032', '25/200725-6', '2025-08-10', '2025-08-11', '2025-08-12', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000032', '25/200726-4', '2025-08-10', '2025-08-11', '2025-08-12', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000032', '25/200729-9', '2025-08-10', '2025-08-11', '2025-08-12', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 'COB000032', '25/200730-2', '2025-08-10', '2025-08-11', '2025-08-12', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000032', '25/200731-0', '2025-08-10', '2025-08-11', '2025-08-12', 574.96, 574.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000032', '25/200736-1', '2025-08-10', '2025-08-11', '2025-08-12', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000032', '25/200746-9', '2025-08-10', '2025-08-11', '2025-08-12', 2889.92, 2889.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000032', '25/200751-5', '2025-08-10', '2025-08-11', '2025-08-12', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a18633ca-d71c-4614-9308-7f0486779753', '985ee741-0314-422c-b91f-d20c6ab37ae3', 'COB000032', '25/200754-0', '2025-08-10', '2025-08-11', '2025-08-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('23e5b89e-ec91-4ec0-a9f7-4161e37879f5', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000001', '25/200685-3', '2025-08-10', '2025-08-12', '2025-08-13', 577.85, 589.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ff7788c7-9d1a-48e8-9091-260055b8dccd', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000002', '25/200682-9', '2025-08-10', '2025-08-13', '2025-08-14', 379.5, 387.2)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ff7788c7-9d1a-48e8-9091-260055b8dccd', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000002', '25/200694-2', '2025-08-10', '2025-08-13', '2025-08-14', 379.48, 387.17)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000010', '25/200484-2', '2025-06-05', '2025-08-15', '2025-08-18', 1518, 1559.13)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '7be0ec1d-783d-4156-a5e6-7a9ce59c0d1d', 'COB000010', '25/200496-6', '2025-06-05', '2025-08-15', '2025-08-18', 537.5, 552.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000010', '25/200528-8', '2025-06-05', '2025-08-15', '2025-08-18', 537.5, 552.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000010', '25/200587-3', '2025-07-05', '2025-08-15', '2025-08-18', 1518, 1554.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '7be0ec1d-783d-4156-a5e6-7a9ce59c0d1d', 'COB000010', '25/200599-7', '2025-07-05', '2025-08-15', '2025-08-18', 537.5, 550.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000010', '25/200631-4', '2025-07-05', '2025-08-15', '2025-08-18', 537.5, 550.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000010', '25/200660-8', '2025-08-15', '2025-08-15', '2025-08-18', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '1f759ac5-a12f-4791-a9e1-773945260670', 'COB000010', '25/200703-5', '2025-08-10', '2025-08-15', '2025-08-18', 4346.3, 4435.39)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000010', '25/200715-9', '2025-08-15', '2025-08-15', '2025-08-18', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('40deeb1b-dc35-41c1-86e1-2de5aab5b299', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000010', '25/200728-0', '2025-08-10', '2025-08-15', '2025-08-18', 1889.59, 1928.32)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('818d5ced-1f85-4d2d-aef9-6bb386b71bca', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000003', '25/200668-3', '2025-08-18', '2025-08-18', '2025-08-19', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('818d5ced-1f85-4d2d-aef9-6bb386b71bca', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000003', '25/200677-2', '2025-08-18', '2025-08-18', '2025-08-19', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('818d5ced-1f85-4d2d-aef9-6bb386b71bca', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000003', '25/200745-0', '2025-08-15', '2025-08-18', '2025-08-19', 709.5, 723.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4fdac4c8-e4a2-407a-8bd3-f0375bec5658', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000002', '25/200662-4', '2025-08-21', '2025-08-21', '2025-08-22', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4fdac4c8-e4a2-407a-8bd3-f0375bec5658', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000002', '25/200676-4', '2025-08-21', '2025-08-21', '2025-08-22', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c8cbc625-e8a2-4dbb-9d33-85662ecb089e', '888b75da-b434-4a48-a929-cfe422033b53', 'COB000001', '25/200846-5', '2025-09-10', '2025-08-26', '2025-08-27', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8647d834-545a-45f0-aaed-eb32980d55f2', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000001', '25/200223-8', '2025-09-05', '2025-08-28', '2025-08-29', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('623e032c-fd59-475d-8876-fd719c8e3b1a', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000005', '25/200233-5', '2025-09-05', '2025-08-29', '2025-09-01', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('623e032c-fd59-475d-8876-fd719c8e3b1a', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000005', '25/200690-0', '2025-08-05', '2025-08-29', '2025-09-01', 1518, 1552)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('623e032c-fd59-475d-8876-fd719c8e3b1a', '7be0ec1d-783d-4156-a5e6-7a9ce59c0d1d', 'COB000005', '25/200701-9', '2025-08-05', '2025-08-29', '2025-09-01', 537.5, 549.54)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('623e032c-fd59-475d-8876-fd719c8e3b1a', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000005', '25/200735-3', '2025-08-05', '2025-08-29', '2025-09-01', 537.5, 549.54)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('623e032c-fd59-475d-8876-fd719c8e3b1a', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000005', '25/200796-5', '2025-09-05', '2025-08-29', '2025-09-01', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f0523ddd-2498-45f6-acda-5e8fd242bc2d', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000001', '25/200841-4', '2025-09-05', '2025-09-01', '2025-09-02', 4554, 4554)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e7d972f1-70c4-4fdb-b63e-75f1e470f04a', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000003', '25/200741-8', '2025-08-18', '2025-09-02', '2025-09-03', 275.98, 281.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e7d972f1-70c4-4fdb-b63e-75f1e470f04a', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000003', '25/200801-5', '2025-09-05', '2025-09-02', '2025-09-03', 363.15, 363.15)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('e7d972f1-70c4-4fdb-b63e-75f1e470f04a', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000003', '25/200836-8', '2025-09-05', '2025-09-02', '2025-09-03', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cb2127c4-8694-45c0-bca5-df9ec8aac19c', '711b0c84-1365-494f-b877-7b5da7c996c3', 'COB000002', '25/200653-5', '2025-08-15', '2025-09-03', '2025-09-04', 300, 306.57)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cb2127c4-8694-45c0-bca5-df9ec8aac19c', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000002', '25/200814-7', '2025-09-05', '2025-09-03', '2025-09-04', 2276.86, 2276.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('48480636-ac82-4027-8c23-5c6753f081f3', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000005', '25/200762-0', '2025-09-05', '2025-09-04', '2025-09-05', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('48480636-ac82-4027-8c23-5c6753f081f3', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000005', '25/200807-4', '2025-09-05', '2025-09-04', '2025-09-05', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('48480636-ac82-4027-8c23-5c6753f081f3', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000005', '25/200816-3', '2025-09-05', '2025-09-04', '2025-09-05', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('48480636-ac82-4027-8c23-5c6753f081f3', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000005', '25/200817-1', '2025-09-05', '2025-09-04', '2025-09-05', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('48480636-ac82-4027-8c23-5c6753f081f3', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000005', '25/200825-2', '2025-09-05', '2025-09-04', '2025-09-05', 152.1, 152.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000021', '25/200759-0', '2025-09-05', '2025-09-05', '2025-09-08', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000021', '25/200760-4', '2025-09-05', '2025-09-05', '2025-09-08', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000021', '25/200761-2', '2025-09-05', '2025-09-05', '2025-09-08', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000021', '25/200771-0', '2025-09-05', '2025-09-05', '2025-09-08', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000021', '25/200778-7', '2025-09-05', '2025-09-05', '2025-09-08', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '8fe85a29-d159-43dd-8874-f85da9375e32', 'COB000021', '25/200779-5', '2025-09-05', '2025-09-05', '2025-09-08', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '8c91b37f-5418-4f56-8592-36ab257efe86', 'COB000021', '25/200790-6', '2025-09-05', '2025-09-05', '2025-09-08', 485.77, 485.77)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000021', '25/200792-2', '2025-09-05', '2025-09-05', '2025-09-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000021', '25/200793-0', '2025-09-05', '2025-09-05', '2025-09-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000021', '25/200794-9', '2025-09-05', '2025-09-05', '2025-09-08', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000021', '25/200815-5', '2025-09-05', '2025-09-05', '2025-09-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000021', '25/200820-1', '2025-09-05', '2025-09-05', '2025-09-08', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000021', '25/200824-4', '2025-09-05', '2025-09-05', '2025-09-08', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 'COB000021', '25/200837-6', '2025-09-05', '2025-09-05', '2025-09-08', 1001.95, 1001.95)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000021', '25/200838-4', '2025-09-05', '2025-09-05', '2025-09-08', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000021', '25/200840-6', '2025-09-05', '2025-09-05', '2025-09-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000021', '25/200842-2', '2025-09-05', '2025-09-05', '2025-09-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000021', '25/200845-7', '2025-09-05', '2025-09-05', '2025-09-08', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '76d31568-8388-4a98-a1de-10cb6d38dbc4', 'COB000021', '25/200850-3', '2025-09-05', '2025-09-05', '2025-09-08', 100, 100)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000021', '25/200852-0', '2025-09-05', '2025-09-05', '2025-09-08', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('055ad937-b4eb-4a6d-a6c0-d5fe1a41ec94', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000021', '25/200856-2', '2025-09-05', '2025-09-05', '2025-09-08', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('55479eb1-edf3-4a77-a962-5709f2865084', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000004', '25/200799-0', '2025-09-10', '2025-09-08', '2025-09-09', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('55479eb1-edf3-4a77-a962-5709f2865084', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000004', '25/200819-8', '2025-09-10', '2025-09-08', '2025-09-09', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('55479eb1-edf3-4a77-a962-5709f2865084', '04965477-8781-4e2a-bbe5-0be150daa8be', 'COB000004', '25/200821-0', '2025-09-10', '2025-09-08', '2025-09-09', 330, 330)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('55479eb1-edf3-4a77-a962-5709f2865084', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000004', '25/200847-3', '2025-09-05', '2025-09-08', '2025-09-09', 724.88, 739.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5bd8ceb5-603a-43d3-919f-12dc60bb5166', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000002', '25/200776-0', '2025-09-10', '2025-09-09', '2025-09-10', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5bd8ceb5-603a-43d3-919f-12dc60bb5166', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000002', '25/200851-1', '2025-09-09', '2025-09-09', '2025-09-10', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '985ee741-0314-422c-b91f-d20c6ab37ae3', 'COB000031', '25/200757-4', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000031', '25/200758-2', '2025-09-10', '2025-09-10', '2025-09-11', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000031', '25/200765-5', '2025-09-10', '2025-09-10', '2025-09-11', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000031', '25/200767-1', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000031', '25/200768-0', '2025-09-10', '2025-09-10', '2025-09-11', 5000, 5000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000031', '25/200773-6', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000031', '25/200774-4', '2025-09-10', '2025-09-10', '2025-09-11', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000031', '25/200777-9', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000031', '25/200782-5', '2025-09-10', '2025-09-10', '2025-09-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000031', '25/200783-3', '2025-09-10', '2025-09-10', '2025-09-11', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000031', '25/200784-1', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000031', '25/200785-0', '2025-09-10', '2025-09-10', '2025-09-11', 1525.86, 1525.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000031', '25/200786-8', '2025-09-10', '2025-09-10', '2025-09-11', 379.5, 379.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000031', '25/200787-6', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000031', '25/200788-4', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000031', '25/200795-7', '2025-09-10', '2025-09-10', '2025-09-11', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000031', '25/200797-3', '2025-09-10', '2025-09-10', '2025-09-11', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000031', '25/200798-1', '2025-09-10', '2025-09-10', '2025-09-11', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000031', '25/200805-8', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000031', '25/200808-2', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000031', '25/200811-2', '2025-09-10', '2025-09-10', '2025-09-11', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000031', '25/200822-8', '2025-09-10', '2025-09-10', '2025-09-11', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', 'd3a203cf-1e94-476a-8e44-12e4112755dc', 'COB000031', '25/200823-6', '2025-09-10', '2025-09-10', '2025-09-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000031', '25/200827-9', '2025-09-10', '2025-09-10', '2025-09-11', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000031', '25/200828-7', '2025-09-10', '2025-09-10', '2025-09-11', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000031', '25/200831-7', '2025-09-10', '2025-09-10', '2025-09-11', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 'COB000031', '25/200832-5', '2025-09-10', '2025-09-10', '2025-09-11', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000031', '25/200833-3', '2025-09-10', '2025-09-10', '2025-09-11', 574.96, 574.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000031', '25/200839-2', '2025-09-10', '2025-09-10', '2025-09-11', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000031', '25/200849-0', '2025-09-10', '2025-09-10', '2025-09-11', 2889.92, 2250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('6e680e82-ae3a-4828-8e2d-81ce8b46134b', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000031', '25/200854-6', '2025-09-10', '2025-09-10', '2025-09-11', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f60ee380-b43f-40c1-a7ab-7b9f60cbc8bf', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000002', '25/200810-4', '2025-09-10', '2025-09-11', '2025-09-12', 1518, 1548.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f60ee380-b43f-40c1-a7ab-7b9f60cbc8bf', '0bb2c8bc-69e4-468a-89c2-50021b724a21', 'COB000002', '25/200858-9', '2025-09-10', '2025-09-11', '2025-09-12', 759, 774.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('49c4bb5a-381a-4485-8afe-ab6ed9ec6aa2', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000007', '25/200764-7', '2025-09-15', '2025-09-15', '2025-09-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('49c4bb5a-381a-4485-8afe-ab6ed9ec6aa2', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000007', '25/200772-8', '2025-09-15', '2025-09-15', '2025-09-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('49c4bb5a-381a-4485-8afe-ab6ed9ec6aa2', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000007', '25/200781-7', '2025-09-15', '2025-09-15', '2025-09-16', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('49c4bb5a-381a-4485-8afe-ab6ed9ec6aa2', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000007', '25/200789-2', '2025-09-10', '2025-09-15', '2025-09-16', 577.85, 589.68)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('49c4bb5a-381a-4485-8afe-ab6ed9ec6aa2', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000007', '25/200818-0', '2025-09-15', '2025-09-15', '2025-09-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('49c4bb5a-381a-4485-8afe-ab6ed9ec6aa2', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000007', '25/200834-1', '2025-09-05', '2025-09-15', '2025-09-16', 322.5, 329.27)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('49c4bb5a-381a-4485-8afe-ab6ed9ec6aa2', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000007', '25/200848-1', '2025-09-15', '2025-09-15', '2025-09-16', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8707aafb-02b9-434e-96c2-332e2ac0c8f7', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000002', '25/200766-3', '2025-09-21', '2025-09-22', '2025-09-23', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('8707aafb-02b9-434e-96c2-332e2ac0c8f7', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000002', '25/200780-9', '2025-09-21', '2025-09-22', '2025-09-23', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ef1f67c5-a452-4e54-a0b5-87b7d41fb9cd', '711b0c84-1365-494f-b877-7b5da7c996c3', 'COB000001', '25/200756-6', '2025-09-15', '2025-09-24', '2025-09-25', 300, 306.27)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('06ebbfc6-19a7-4604-a799-92fdb9bcca89', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000002', '25/200234-3', '2025-10-05', '2025-09-29', '2025-09-30', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('06ebbfc6-19a7-4604-a799-92fdb9bcca89', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000002', '25/200859-7', '2025-10-05', '2025-09-29', '2025-09-30', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f65f249e-d52c-4078-94b1-6dd95cb08a0c', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000002', '25/200909-7', '2025-10-10', '2025-09-30', '2025-10-01', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f65f249e-d52c-4078-94b1-6dd95cb08a0c', '888b75da-b434-4a48-a929-cfe422033b53', 'COB000002', '25/200948-8', '2025-10-10', '2025-09-30', '2025-10-01', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f982223a-9013-40ec-bcfd-c8b931c4624f', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000001', '25/200844-9', '2025-09-15', '2025-10-01', '2025-10-02', 275.98, 281.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('97656af9-04c9-46b2-b2fd-9aae5f6b3973', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000001', '25/200938-0', '2025-10-05', '2025-10-02', '2025-10-03', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfd4964c-b17b-4452-a8c7-72ee70457a67', '8c91b37f-5418-4f56-8592-36ab257efe86', 'COB000002', '25/200893-7', '2025-10-05', '2025-10-03', '2025-10-06', 485.77, 485.77)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfd4964c-b17b-4452-a8c7-72ee70457a67', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000002', '25/200899-6', '2025-10-05', '2025-10-03', '2025-10-06', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000030', '25/200862-7', '2025-10-05', '2025-10-06', '2025-10-07', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000030', '25/200863-5', '2025-10-05', '2025-10-06', '2025-10-07', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000030', '25/200864-3', '2025-10-05', '2025-10-06', '2025-10-07', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000030', '25/200865-1', '2025-10-05', '2025-10-06', '2025-10-07', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000030', '25/200874-0', '2025-10-05', '2025-10-06', '2025-10-07', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000030', '25/200881-3', '2025-10-05', '2025-10-06', '2025-10-07', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '8fe85a29-d159-43dd-8874-f85da9375e32', 'COB000030', '25/200882-1', '2025-10-05', '2025-10-06', '2025-10-07', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000030', '25/200895-3', '2025-10-05', '2025-10-06', '2025-10-07', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000030', '25/200896-1', '2025-10-05', '2025-10-06', '2025-10-07', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000030', '25/200897-0', '2025-10-05', '2025-10-06', '2025-10-07', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000030', '25/200908-9', '2025-10-05', '2025-10-06', '2025-10-07', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000030', '25/200913-5', '2025-10-05', '2025-10-06', '2025-10-07', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000030', '25/200916-0', '2025-10-05', '2025-10-06', '2025-10-07', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000030', '25/200917-8', '2025-10-05', '2025-10-06', '2025-10-07', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000030', '25/200918-6', '2025-10-05', '2025-10-06', '2025-10-07', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000030', '25/200921-6', '2025-10-05', '2025-10-06', '2025-10-07', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000030', '25/200925-9', '2025-10-05', '2025-10-06', '2025-10-07', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000030', '25/200926-7', '2025-10-05', '2025-10-06', '2025-10-07', 152.1, 152.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000030', '25/200936-4', '2025-10-05', '2025-10-06', '2025-10-07', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 'COB000030', '25/200939-9', '2025-10-05', '2025-10-06', '2025-10-07', 1001.95, 1001.95)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000030', '25/200940-2', '2025-10-05', '2025-10-06', '2025-10-07', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000030', '25/200942-9', '2025-10-05', '2025-10-06', '2025-10-07', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000030', '25/200943-7', '2025-10-05', '2025-10-06', '2025-10-07', 4554, 4554)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000030', '25/200944-5', '2025-10-05', '2025-10-06', '2025-10-07', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000030', '25/200947-0', '2025-10-05', '2025-10-06', '2025-10-07', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000030', '25/200949-6', '2025-10-05', '2025-10-06', '2025-10-07', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '76d31568-8388-4a98-a1de-10cb6d38dbc4', 'COB000030', '25/200952-6', '2025-10-05', '2025-10-06', '2025-10-07', 100, 100)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000030', '25/200953-4', '2025-10-05', '2025-10-06', '2025-10-07', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000030', '25/200954-2', '2025-10-05', '2025-10-06', '2025-10-07', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f041fdef-fd55-4317-9e5a-8008dc42c0fb', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000030', '25/200958-5', '2025-10-05', '2025-10-06', '2025-10-07', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ff1d551b-1820-4a95-b2de-577501b53430', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000002', '25/200920-8', '2025-10-10', '2025-10-07', '2025-10-08', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ff1d551b-1820-4a95-b2de-577501b53430', '04965477-8781-4e2a-bbe5-0be150daa8be', 'COB000002', '25/200922-4', '2025-10-10', '2025-10-07', '2025-10-08', 330, 330)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4658cce0-5b09-4a8e-a14b-718bc0bd67c6', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000001', '25/200879-1', '2025-10-10', '2025-10-08', '2025-10-09', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1673ce6f-9498-42ad-9055-37301c9fee2a', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000003', '25/200868-6', '2025-10-10', '2025-10-09', '2025-10-10', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1673ce6f-9498-42ad-9055-37301c9fee2a', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000003', '25/200892-9', '2025-10-10', '2025-10-09', '2025-10-10', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1673ce6f-9498-42ad-9055-37301c9fee2a', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000003', '25/200902-0', '2025-10-10', '2025-10-09', '2025-10-10', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '985ee741-0314-422c-b91f-d20c6ab37ae3', 'COB000032', '25/200860-0', '2025-10-10', '2025-10-10', '2025-10-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000032', '25/200861-9', '2025-10-10', '2025-10-10', '2025-10-13', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000032', '25/200870-8', '2025-10-10', '2025-10-10', '2025-10-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'b5a1bb23-ef78-4fb7-8f5e-2c116963b059', 'COB000032', '25/200872-4', '2025-10-10', '2025-10-10', '2025-10-13', 977.45, 977.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 'COB000032', '25/200873-2', '2025-10-10', '2025-10-10', '2025-10-13', 977.45, 977.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000032', '25/200876-7', '2025-10-10', '2025-10-10', '2025-10-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000032', '25/200877-5', '2025-10-10', '2025-10-10', '2025-10-13', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000032', '25/200880-5', '2025-10-10', '2025-10-10', '2025-10-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000032', '25/200885-6', '2025-10-10', '2025-10-10', '2025-10-13', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000032', '25/200886-4', '2025-10-10', '2025-10-10', '2025-10-13', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000032', '25/200887-2', '2025-10-10', '2025-10-10', '2025-10-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000032', '25/200888-0', '2025-10-10', '2025-10-10', '2025-10-13', 1525.86, 1525.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000032', '25/200889-9', '2025-10-10', '2025-10-10', '2025-10-13', 379.5, 379.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000032', '25/200890-2', '2025-10-10', '2025-10-10', '2025-10-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000032', '25/200891-0', '2025-10-10', '2025-10-10', '2025-10-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '01247d35-327e-416f-b928-b85e64e8b070', 'COB000032', '25/200894-5', '2025-10-10', '2025-10-10', '2025-10-13', 977.45, 977.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000032', '25/200898-8', '2025-10-10', '2025-10-10', '2025-10-13', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000032', '25/200900-3', '2025-10-10', '2025-10-10', '2025-10-13', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000032', '25/200901-1', '2025-10-10', '2025-10-10', '2025-10-13', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 'COB000032', '25/200905-4', '2025-10-10', '2025-10-10', '2025-10-13', 977.45, 977.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000032', '25/200911-9', '2025-10-10', '2025-10-10', '2025-10-13', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000032', '25/200912-7', '2025-10-10', '2025-10-10', '2025-10-13', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000032', '25/200923-2', '2025-10-10', '2025-10-10', '2025-10-13', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'd3a203cf-1e94-476a-8e44-12e4112755dc', 'COB000032', '25/200924-0', '2025-10-10', '2025-10-10', '2025-10-13', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000032', '25/200928-3', '2025-10-10', '2025-10-10', '2025-10-13', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000032', '25/200929-1', '2025-10-10', '2025-10-10', '2025-10-13', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000032', '25/200933-0', '2025-10-10', '2025-10-10', '2025-10-13', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 'COB000032', '25/200934-8', '2025-10-10', '2025-10-10', '2025-10-13', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000032', '25/200935-6', '2025-10-10', '2025-10-10', '2025-10-13', 574.96, 574.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000032', '25/200941-0', '2025-10-10', '2025-10-10', '2025-10-13', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000032', '25/200951-8', '2025-10-10', '2025-10-10', '2025-10-13', 2250, 2250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('dfac59ea-eb1a-4427-a855-9b0f4884878b', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000032', '25/200956-9', '2025-10-10', '2025-10-10', '2025-10-13', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('9466d499-46df-48a4-abcb-58fd163eaccf', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000001', '25/200871-6', '2025-10-10', '2025-10-14', '2025-10-15', 5000, 5102)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b51b1089-79cf-47b5-affd-440c44c9b589', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000002', '25/200867-8', '2025-10-15', '2025-10-15', '2025-10-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b51b1089-79cf-47b5-affd-440c44c9b589', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000002', '25/200919-4', '2025-10-15', '2025-10-15', '2025-10-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('913d550b-2067-49d5-b8e1-9cdf7a365d0f', 'b4bbebaa-fe94-406c-a036-8baa71dc8a1b', 'COB000001', '25/200962-3', '2025-10-16', '2025-10-16', '2025-10-17', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5f620cbd-6bda-4602-8c7a-2e9b6bdf8c73', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000003', '25/200235-1', '2025-11-05', '2025-10-20', '2025-10-21', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5f620cbd-6bda-4602-8c7a-2e9b6bdf8c73', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000003', '25/200875-9', '2025-10-20', '2025-10-20', '2025-10-21', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5f620cbd-6bda-4602-8c7a-2e9b6bdf8c73', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000003', '25/200884-8', '2025-10-20', '2025-10-20', '2025-10-21', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4ef8ed47-9142-46d3-abf4-5672b6a7d1f3', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000002', '25/200869-4', '2025-10-21', '2025-10-21', '2025-10-22', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4ef8ed47-9142-46d3-abf4-5672b6a7d1f3', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000002', '25/200883-0', '2025-10-21', '2025-10-21', '2025-10-22', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3ea11711-d4a0-425f-a9ab-b7cc6e0a1185', '888b75da-b434-4a48-a929-cfe422033b53', 'COB000002', '25/201052-4', '2025-11-10', '2025-10-30', '2025-10-31', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3ea11711-d4a0-425f-a9ab-b7cc6e0a1185', '76d31568-8388-4a98-a1de-10cb6d38dbc4', 'COB000002', '25/201056-7', '2025-11-05', '2025-10-30', '2025-10-31', 100, 100)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fb0d7ae6-38b0-47f7-b7c2-356ef30f43f2', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000002', '25/201002-8', '2025-11-05', '2025-10-31', '2025-11-03', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fb0d7ae6-38b0-47f7-b7c2-356ef30f43f2', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000002', '25/201041-9', '2025-11-05', '2025-10-31', '2025-11-03', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1ae0f749-20c0-41c8-be2d-b3d175ed5677', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000002', '25/200946-1', '2025-10-20', '2025-11-04', '2025-11-05', 275.98, 281.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1ae0f749-20c0-41c8-be2d-b3d175ed5677', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000002', '25/201046-0', '2025-11-05', '2025-11-04', '2025-11-05', 4554, 4554)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000026', '25/200965-8', '2025-11-05', '2025-11-05', '2025-11-06', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000026', '25/200966-6', '2025-11-05', '2025-11-05', '2025-11-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000026', '25/200967-4', '2025-11-05', '2025-11-05', '2025-11-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000026', '25/200968-2', '2025-11-05', '2025-11-05', '2025-11-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000026', '25/200977-1', '2025-11-05', '2025-11-05', '2025-11-06', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000026', '25/200984-4', '2025-11-05', '2025-11-05', '2025-11-06', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '8fe85a29-d159-43dd-8874-f85da9375e32', 'COB000026', '25/200985-2', '2025-11-05', '2025-11-05', '2025-11-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '8c91b37f-5418-4f56-8592-36ab257efe86', 'COB000026', '25/200996-8', '2025-11-05', '2025-11-05', '2025-11-06', 485.77, 485.77)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000026', '25/200998-4', '2025-11-05', '2025-11-05', '2025-11-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000026', '25/200999-2', '2025-11-05', '2025-11-05', '2025-11-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000026', '25/201000-1', '2025-11-05', '2025-11-05', '2025-11-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000026', '25/201011-7', '2025-11-05', '2025-11-05', '2025-11-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000026', '25/201016-8', '2025-11-05', '2025-11-05', '2025-11-06', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000026', '25/201019-2', '2025-11-05', '2025-11-05', '2025-11-06', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000026', '25/201020-6', '2025-11-05', '2025-11-05', '2025-11-06', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000026', '25/201023-0', '2025-11-05', '2025-11-05', '2025-11-06', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000026', '25/201027-3', '2025-11-05', '2025-11-05', '2025-11-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000026', '25/201039-7', '2025-11-05', '2025-11-05', '2025-11-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 'COB000026', '25/201042-7', '2025-11-05', '2025-11-05', '2025-11-06', 1001.95, 1001.95)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000026', '25/201043-5', '2025-11-05', '2025-11-05', '2025-11-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000026', '25/201047-8', '2025-11-05', '2025-11-05', '2025-11-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000026', '25/201051-6', '2025-11-05', '2025-11-05', '2025-11-06', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000026', '25/201053-2', '2025-11-05', '2025-11-05', '2025-11-06', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000026', '25/201057-5', '2025-11-05', '2025-11-05', '2025-11-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000026', '25/201058-3', '2025-11-05', '2025-11-05', '2025-11-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('083b3229-0a1b-4d07-a567-996388357f15', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000026', '25/201062-1', '2025-11-05', '2025-11-05', '2025-11-06', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3ec5503d-c933-4dad-b6f4-fb1ce94deddf', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000002', '25/200982-8', '2025-11-10', '2025-11-07', '2025-11-10', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3ec5503d-c933-4dad-b6f4-fb1ce94deddf', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000002', '25/201005-2', '2025-11-10', '2025-11-07', '2025-11-10', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '985ee741-0314-422c-b91f-d20c6ab37ae3', 'COB000037', '25/200963-1', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000037', '25/200964-0', '2025-11-10', '2025-11-10', '2025-11-11', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000037', '25/200971-2', '2025-11-10', '2025-11-10', '2025-11-11', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000037', '25/200973-9', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000037', '25/200974-7', '2025-11-10', '2025-11-10', '2025-11-11', 5000, 5000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'b5a1bb23-ef78-4fb7-8f5e-2c116963b059', 'COB000037', '25/200975-5', '2025-11-10', '2025-11-10', '2025-11-11', 977.45, 977.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 'COB000037', '25/200976-3', '2025-11-10', '2025-11-10', '2025-11-11', 977.45, 977.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000037', '25/200979-8', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000037', '25/200980-1', '2025-11-10', '2025-11-10', '2025-11-11', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000037', '25/200983-6', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000037', '25/200988-7', '2025-11-10', '2025-11-10', '2025-11-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000037', '25/200989-5', '2025-11-10', '2025-11-10', '2025-11-11', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000037', '25/200990-9', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000037', '25/200993-3', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000037', '25/200994-1', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000037', '25/200995-0', '2025-11-10', '2025-11-10', '2025-11-11', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '01247d35-327e-416f-b928-b85e64e8b070', 'COB000037', '25/200997-6', '2025-11-10', '2025-11-10', '2025-11-11', 977.45, 977.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000037', '25/201001-0', '2025-11-10', '2025-11-10', '2025-11-11', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000037', '25/201003-6', '2025-11-10', '2025-11-10', '2025-11-11', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 'COB000037', '25/201008-7', '2025-11-10', '2025-11-10', '2025-11-11', 977.45, 977.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000037', '25/201009-5', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '1f759ac5-a12f-4791-a9e1-773945260670', 'COB000037', '25/201010-9', '2025-11-10', '2025-11-10', '2025-11-11', 4346.3, 4346.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000037', '25/201012-5', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000037', '25/201014-1', '2025-11-10', '2025-11-10', '2025-11-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000037', '25/201015-0', '2025-11-10', '2025-11-10', '2025-11-11', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '04965477-8781-4e2a-bbe5-0be150daa8be', 'COB000037', '25/201024-9', '2025-11-10', '2025-11-10', '2025-11-11', 330, 330)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000037', '25/201025-7', '2025-11-10', '2025-11-10', '2025-11-11', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'd3a203cf-1e94-476a-8e44-12e4112755dc', 'COB000037', '25/201026-5', '2025-11-10', '2025-11-10', '2025-11-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000037', '25/201030-3', '2025-11-10', '2025-11-10', '2025-11-11', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000037', '25/201031-1', '2025-11-10', '2025-11-10', '2025-11-11', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000037', '25/201032-0', '2025-11-10', '2025-11-10', '2025-11-11', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000037', '25/201035-4', '2025-11-10', '2025-11-10', '2025-11-11', 1889.59, 1889.59)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000037', '25/201036-2', '2025-11-10', '2025-11-10', '2025-11-11', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 'COB000037', '25/201037-0', '2025-11-10', '2025-11-10', '2025-11-11', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000037', '25/201044-3', '2025-11-10', '2025-11-10', '2025-11-11', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000037', '25/201055-9', '2025-11-10', '2025-11-10', '2025-11-11', 2250, 2250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cf4ad6e8-6e34-43f6-bc77-fecc4b5a173d', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000037', '25/201060-5', '2025-11-10', '2025-11-10', '2025-11-11', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c37b1903-ada4-47ac-b9f1-2a822980ecd4', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000001', '25/201038-9', '2025-11-10', '2025-11-11', '2025-11-12', 574.96, 586.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f608b50a-64c1-4a5f-90dc-ea574c2debca', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000003', '25/200236-0', '2025-12-05', '2025-11-28', '2025-12-01', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f608b50a-64c1-4a5f-90dc-ea574c2debca', 'd346239a-9c52-41f8-a740-ba6dd85baef4', 'COB000003', '25/201130-0', '2025-12-10', '2025-11-28', '2025-12-01', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f608b50a-64c1-4a5f-90dc-ea574c2debca', '888b75da-b434-4a48-a929-cfe422033b53', 'COB000003', '25/201152-0', '2025-12-10', '2025-11-28', '2025-12-01', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ceb41854-20e9-4ddd-90e6-2d1e4f925098', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000003', '25/201049-4', '2025-11-15', '2025-12-02', '2025-12-03', 275.98, 281.95)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ceb41854-20e9-4ddd-90e6-2d1e4f925098', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000003', '25/201103-2', '2025-12-05', '2025-12-02', '2025-12-03', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ceb41854-20e9-4ddd-90e6-2d1e4f925098', '04965477-8781-4e2a-bbe5-0be150daa8be', 'COB000003', '25/201125-3', '2025-12-10', '2025-12-02', '2025-12-03', 330, 330)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a820e763-b478-47dd-b4d5-77d0914e93f9', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000005', '25/201069-9', '2025-12-05', '2025-12-03', '2025-12-04', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a820e763-b478-47dd-b4d5-77d0914e93f9', '8c91b37f-5418-4f56-8592-36ab257efe86', 'COB000005', '25/201096-6', '2025-12-05', '2025-12-03', '2025-12-04', 485.77, 485.77)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a820e763-b478-47dd-b4d5-77d0914e93f9', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000005', '25/201120-2', '2025-12-05', '2025-12-03', '2025-12-04', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a820e763-b478-47dd-b4d5-77d0914e93f9', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000005', '25/201121-0', '2025-12-05', '2025-12-03', '2025-12-04', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a820e763-b478-47dd-b4d5-77d0914e93f9', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000005', '25/201140-7', '2025-12-05', '2025-12-03', '2025-12-04', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a4d42aa6-0550-48c9-aa73-9551c8a5c47d', '8d125b22-fa6d-4b86-bcc3-4795a60f2096', 'COB000002', '25/201070-2', '2025-12-05', '2025-12-04', '2025-12-05', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a4d42aa6-0550-48c9-aa73-9551c8a5c47d', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000002', '25/201147-4', '2025-12-05', '2025-12-04', '2025-12-05', 4554, 4554)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000013', '25/200991-7', '2025-11-10', '2025-12-05', '2025-12-08', 1525.86, 1560.18)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000013', '25/201084-2', '2025-12-05', '2025-12-05', '2025-12-08', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '7d6f13c4-deb7-4c6e-939d-a4ea682f538d', 'COB000013', '25/201097-4', '2025-12-05', '2025-12-05', '2025-12-08', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000013', '25/201099-0', '2025-12-05', '2025-12-05', '2025-12-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000013', '25/201100-8', '2025-12-05', '2025-12-05', '2025-12-08', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000013', '25/201112-1', '2025-12-05', '2025-12-05', '2025-12-08', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000013', '25/201119-9', '2025-12-05', '2025-12-05', '2025-12-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000013', '25/201128-8', '2025-12-05', '2025-12-05', '2025-12-08', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000013', '25/201153-9', '2025-12-05', '2025-12-05', '2025-12-08', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '76d31568-8388-4a98-a1de-10cb6d38dbc4', 'COB000013', '25/201156-3', '2025-12-05', '2025-12-05', '2025-12-08', 100, 100)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000013', '25/201157-1', '2025-12-05', '2025-12-05', '2025-12-08', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000013', '25/201158-0', '2025-12-05', '2025-12-05', '2025-12-08', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a2e16479-736d-495f-afe6-ee1851e7eb40', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000013', '25/201162-8', '2025-12-05', '2025-12-05', '2025-12-08', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('54dfe1e5-be33-4733-82a7-4ddf058f6a2a', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000002', '25/201072-9', '2025-12-10', '2025-12-08', '2025-12-09', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('54dfe1e5-be33-4733-82a7-4ddf058f6a2a', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000002', '25/201271-3', '2025-12-10', '2025-12-08', '2025-12-09', 900, 900)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fd2fdb2e-d586-48ba-b05d-e33b8fe19600', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000006', '25/201067-2', '2025-12-05', '2025-12-09', '2025-12-10', 537.5, 548.46)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fd2fdb2e-d586-48ba-b05d-e33b8fe19600', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000006', '25/201068-0', '2025-12-05', '2025-12-09', '2025-12-10', 537.5, 548.46)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fd2fdb2e-d586-48ba-b05d-e33b8fe19600', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000006', '25/201110-5', '2025-12-10', '2025-12-09', '2025-12-10', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fd2fdb2e-d586-48ba-b05d-e33b8fe19600', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000006', '25/201123-7', '2025-12-10', '2025-12-09', '2025-12-10', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fd2fdb2e-d586-48ba-b05d-e33b8fe19600', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000006', '25/201124-5', '2025-12-05', '2025-12-09', '2025-12-10', 603.75, 616.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fd2fdb2e-d586-48ba-b05d-e33b8fe19600', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000006', '25/201151-2', '2025-12-05', '2025-12-09', '2025-12-10', 334.97, 341.79)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '985ee741-0314-422c-b91f-d20c6ab37ae3', 'COB000031', '25/201064-8', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000031', '25/201065-6', '2025-12-10', '2025-12-10', '2025-12-11', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000031', '25/201074-5', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000031', '25/201075-3', '2025-12-10', '2025-12-10', '2025-12-11', 5000, 5000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000031', '25/201079-6', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000031', '25/201080-0', '2025-12-10', '2025-12-10', '2025-12-11', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000031', '25/201083-4', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000031', '25/201089-3', '2025-12-10', '2025-12-10', '2025-12-11', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000031', '25/201090-7', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000031', '25/201093-1', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000031', '25/201094-0', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000031', '25/201095-8', '2025-12-10', '2025-12-10', '2025-12-11', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000031', '25/201102-4', '2025-12-10', '2025-12-10', '2025-12-11', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000031', '25/201104-0', '2025-12-10', '2025-12-10', '2025-12-11', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000031', '25/201106-7', '2025-12-10', '2025-12-10', '2025-12-11', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '1f759ac5-a12f-4791-a9e1-773945260670', 'COB000031', '25/201111-3', '2025-12-10', '2025-12-10', '2025-12-11', 4346.3, 4346.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000031', '25/201113-0', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000031', '25/201115-6', '2025-12-10', '2025-12-10', '2025-12-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000031', '25/201116-4', '2025-12-10', '2025-12-10', '2025-12-11', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000031', '25/201126-1', '2025-12-10', '2025-12-10', '2025-12-11', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', 'd3a203cf-1e94-476a-8e44-12e4112755dc', 'COB000031', '25/201127-0', '2025-12-10', '2025-12-10', '2025-12-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000031', '25/201129-6', '2025-12-05', '2025-12-10', '2025-12-11', 152.1, 155.21)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000031', '25/201131-8', '2025-12-10', '2025-12-10', '2025-12-11', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000031', '25/201132-6', '2025-12-10', '2025-12-10', '2025-12-11', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000031', '25/201133-4', '2025-12-10', '2025-12-10', '2025-12-11', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000031', '25/201137-7', '2025-12-10', '2025-12-10', '2025-12-11', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b', 'COB000031', '25/201138-5', '2025-12-10', '2025-12-10', '2025-12-11', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000031', '25/201145-8', '2025-12-10', '2025-12-10', '2025-12-11', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000031', '25/201148-2', '2025-12-05', '2025-12-10', '2025-12-11', 759, 774.55)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000031', '25/201155-5', '2025-12-10', '2025-12-10', '2025-12-11', 2250, 2250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9f32ec5-3e6a-4d42-be2d-212ac795dd84', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000031', '25/201160-1', '2025-12-10', '2025-12-10', '2025-12-11', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cfc49e06-274e-4d38-bfc5-ba589194e171', 'b5a1bb23-ef78-4fb7-8f5e-2c116963b059', 'COB000006', '25/201076-1', '2025-12-10', '2025-12-11', '2025-12-12', 977.45, 997.08)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cfc49e06-274e-4d38-bfc5-ba589194e171', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 'COB000006', '25/201077-0', '2025-12-10', '2025-12-11', '2025-12-12', 977.45, 997.08)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cfc49e06-274e-4d38-bfc5-ba589194e171', '8fe85a29-d159-43dd-8874-f85da9375e32', 'COB000006', '25/201085-0', '2025-12-05', '2025-12-11', '2025-12-12', 1518, 1549.27)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cfc49e06-274e-4d38-bfc5-ba589194e171', '01247d35-327e-416f-b928-b85e64e8b070', 'COB000006', '25/201098-2', '2025-12-10', '2025-12-11', '2025-12-12', 977.45, 997.08)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cfc49e06-274e-4d38-bfc5-ba589194e171', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 'COB000006', '25/201109-1', '2025-12-10', '2025-12-11', '2025-12-12', 977.45, 997.08)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('cfc49e06-274e-4d38-bfc5-ba589194e171', 'ae6f5b9a-532b-4306-92cc-cb26950d5022', 'COB000006', '25/201143-1', '2025-12-05', '2025-12-11', '2025-12-12', 1001.95, 1022.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('86f7f7d7-db27-4485-a8be-653d8dce5614', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000004', '25/201071-0', '2025-12-15', '2025-12-15', '2025-12-16', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('86f7f7d7-db27-4485-a8be-653d8dce5614', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000004', '25/201154-7', '2025-12-15', '2025-12-15', '2025-12-16', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('86f7f7d7-db27-4485-a8be-653d8dce5614', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000004', '25/201209-8', '2025-12-20', '2025-12-15', '2025-12-16', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('86f7f7d7-db27-4485-a8be-653d8dce5614', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000004', '25/201272-1', '2025-12-20', '2025-12-15', '2025-12-16', 900, 900)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000009', '25/201139-3', '2025-12-10', '2025-12-16', '2025-12-17', 574.96, 586.79)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000009', '25/201179-2', '2025-12-20', '2025-12-16', '2025-12-17', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000009', '25/201188-1', '2025-12-20', '2025-12-16', '2025-12-17', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000009', '25/201206-3', '2025-12-20', '2025-12-16', '2025-12-17', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', 'd346239a-9c52-41f8-a740-ba6dd85baef4', 'COB000009', '25/201233-0', '2025-12-20', '2025-12-16', '2025-12-17', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', '888b75da-b434-4a48-a929-cfe422033b53', 'COB000009', '25/201257-8', '2025-12-20', '2025-12-16', '2025-12-17', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000009', '25/201273-0', '2025-12-16', '2025-12-16', '2025-12-17', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000009', '25/201274-8', '2025-12-16', '2025-12-16', '2025-12-17', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7ce69c61-932d-4646-86e0-edd3fc446835', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000009', '25/201275-6', '2025-12-16', '2025-12-16', '2025-12-17', 2987.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b341e911-4947-461b-a735-94376fdb0f1b', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000003', '25/200239-4', '2025-12-20', '2025-12-17', '2025-12-18', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b341e911-4947-461b-a735-94376fdb0f1b', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000003', '25/201171-7', '2025-12-20', '2025-12-17', '2025-12-18', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b341e911-4947-461b-a735-94376fdb0f1b', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000003', '25/201196-2', '2025-12-20', '2025-12-17', '2025-12-18', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000009', '25/201122-9', '2025-12-15', '2025-12-18', '2025-12-19', 375.73, 383.35)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000009', '25/201220-9', '2025-12-20', '2025-12-18', '2025-12-19', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000009', '25/201225-0', '2025-12-20', '2025-12-18', '2025-12-19', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '04965477-8781-4e2a-bbe5-0be150daa8be', 'COB000009', '25/201228-4', '2025-12-20', '2025-12-18', '2025-12-19', 330, 165)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000009', '25/201236-5', '2025-12-20', '2025-12-18', '2025-12-19', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000009', '25/201246-2', '2025-12-20', '2025-12-18', '2025-12-19', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000009', '25/201251-9', '2025-12-20', '2025-12-18', '2025-12-19', 4554, 4554)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000009', '25/201262-4', '2025-12-20', '2025-12-18', '2025-12-19', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('d37d66d3-3a50-4b44-986a-69483caa5d54', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000009', '25/201277-2', '2026-01-05', '2025-12-18', '2025-12-19', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000009', '25/201165-2', '2025-12-20', '2025-12-19', '2025-12-22', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000009', '25/201166-0', '2025-12-20', '2025-12-19', '2025-12-22', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000009', '25/201167-9', '2025-12-20', '2025-12-19', '2025-12-22', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000009', '25/201190-3', '2025-12-20', '2025-12-19', '2025-12-22', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000009', '25/201205-5', '2025-12-20', '2025-12-19', '2025-12-22', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', '1f759ac5-a12f-4791-a9e1-773945260670', 'COB000009', '25/201214-4', '2025-12-20', '2025-12-19', '2025-12-22', 4346.3, 4346.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000009', '25/201215-2', '2025-12-20', '2025-12-19', '2025-12-22', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000009', '25/201227-6', '2025-12-20', '2025-12-19', '2025-12-22', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('c2042545-bfef-472f-b494-65443117d1a1', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000009', '25/201256-0', '2025-12-20', '2025-12-19', '2025-12-22', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000035', '25/201073-7', '2025-12-21', '2025-12-22', '2025-12-23', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000035', '25/201086-9', '2025-12-21', '2025-12-22', '2025-12-23', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000035', '25/201164-4', '2025-12-20', '2025-12-22', '2025-12-23', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000035', '25/201170-9', '2025-12-20', '2025-12-22', '2025-12-23', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000035', '25/201173-3', '2025-12-20', '2025-12-22', '2025-12-23', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '35e4f21c-8d0e-435a-905d-95f0de3def28', 'COB000035', '25/201175-0', '2025-12-20', '2025-12-22', '2025-12-23', 5000, 5000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000035', '25/201180-6', '2025-12-20', '2025-12-22', '2025-12-23', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000035', '25/201181-4', '2025-12-20', '2025-12-22', '2025-12-23', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000035', '25/201184-9', '2025-12-20', '2025-12-22', '2025-12-23', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000035', '25/201185-7', '2025-12-20', '2025-12-22', '2025-12-23', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000035', '25/201189-0', '2025-12-20', '2025-12-22', '2025-12-23', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000035', '25/201194-6', '2025-12-20', '2025-12-22', '2025-12-23', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000035', '25/201195-4', '2025-12-20', '2025-12-22', '2025-12-23', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '7d6f13c4-deb7-4c6e-939d-a4ea682f538d', 'COB000035', '25/201198-9', '2025-12-20', '2025-12-22', '2025-12-23', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000035', '25/201202-0', '2025-12-20', '2025-12-22', '2025-12-23', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000035', '25/201203-9', '2025-12-20', '2025-12-22', '2025-12-23', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000035', '25/201213-6', '2025-12-20', '2025-12-22', '2025-12-23', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000035', '25/201216-0', '2025-12-20', '2025-12-22', '2025-12-23', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000035', '25/201218-7', '2025-12-20', '2025-12-22', '2025-12-23', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000035', '25/201223-3', '2025-12-20', '2025-12-22', '2025-12-23', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000035', '25/201224-1', '2025-12-20', '2025-12-22', '2025-12-23', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000035', '25/201229-2', '2025-12-20', '2025-12-22', '2025-12-23', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000035', '25/201234-9', '2025-12-20', '2025-12-22', '2025-12-23', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000035', '25/201235-7', '2025-12-20', '2025-12-22', '2025-12-23', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000035', '25/201237-3', '2025-12-20', '2025-12-22', '2025-12-23', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000035', '25/201241-1', '2025-12-20', '2025-12-22', '2025-12-23', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000035', '25/201243-8', '2025-12-20', '2025-12-22', '2025-12-23', 574.96, 574.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000035', '25/201244-6', '2025-12-20', '2025-12-22', '2025-12-23', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000035', '25/201249-7', '2025-12-20', '2025-12-22', '2025-12-23', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000035', '25/201252-7', '2025-12-20', '2025-12-22', '2025-12-23', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000035', '25/201258-6', '2025-12-22', '2025-12-22', '2025-12-23', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000035', '25/201259-4', '2025-12-20', '2025-12-22', '2025-12-23', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000035', '25/201260-8', '2025-12-20', '2025-12-22', '2025-12-23', 2250, 2250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '76d31568-8388-4a98-a1de-10cb6d38dbc4', 'COB000035', '25/201261-6', '2025-12-20', '2025-12-22', '2025-12-23', 100, 100)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('7837a0cc-f16e-4c51-8a75-b0645bdae9f4', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000035', '25/201267-5', '2025-12-20', '2025-12-22', '2025-12-23', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('27061a99-e5eb-4cb2-974e-95a560f0eab0', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000003', '25/201101-6', '2025-12-05', '2025-12-23', '2025-12-24', 1518, 1551.09)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('27061a99-e5eb-4cb2-974e-95a560f0eab0', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000003', '25/201144-0', '2025-12-05', '2025-12-23', '2025-12-24', 537.5, 549.21)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('27061a99-e5eb-4cb2-974e-95a560f0eab0', '199a1d9a-e92a-4170-b813-e9dff65196a5', 'COB000003', '25/201278-0', '2025-12-26', '2025-12-23', '2025-12-24', 10000, 10000)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('292a9bed-3d87-4d6f-a75b-102da74af6c1', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000001', '25/200237-8', '2026-01-05', '2025-12-29', '2025-12-30', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('57a2aeba-79e7-4507-9790-520c3795c617', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000002', '25/201315-9', '2026-01-05', '2025-12-30', '2025-12-31', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('57a2aeba-79e7-4507-9790-520c3795c617', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000002', '25/201352-3', '2026-01-05', '2025-12-30', '2025-12-31', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ea9a3dff-d43f-4d31-842c-1b7f0110bb47', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000005', '24/204549-0', '2025-01-06', '2025-01-02', '2025-01-03', 1412, 1412)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ea9a3dff-d43f-4d31-842c-1b7f0110bb47', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000005', '24/205250-0', '2025-01-02', '2025-01-02', '2025-01-03', 300, 300)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ea9a3dff-d43f-4d31-842c-1b7f0110bb47', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000005', '24/205316-6', '2025-01-02', '2025-01-02', '2025-01-03', 760, 760)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ea9a3dff-d43f-4d31-842c-1b7f0110bb47', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000005', '24/205358-1', '2025-01-05', '2025-01-02', '2025-01-03', 2029.78, 2029.78)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ea9a3dff-d43f-4d31-842c-1b7f0110bb47', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000005', '24/205369-7', '2025-01-05', '2025-01-02', '2025-01-03', 1412, 1412)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('506596a5-1951-455a-b709-b5d761baa368', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000007', '24/205318-2', '2025-01-05', '2025-01-03', '2025-01-06', 713.32, 713.32)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('506596a5-1951-455a-b709-b5d761baa368', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000007', '24/205319-0', '2025-01-05', '2025-01-03', '2025-01-06', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('506596a5-1951-455a-b709-b5d761baa368', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000007', '24/205320-4', '2025-01-05', '2025-01-03', '2025-01-06', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('506596a5-1951-455a-b709-b5d761baa368', '8d125b22-fa6d-4b86-bcc3-4795a60f2096', 'COB000007', '24/205322-0', '2025-01-07', '2025-01-03', '2025-01-06', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('506596a5-1951-455a-b709-b5d761baa368', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000007', '24/205380-8', '2025-01-05', '2025-01-03', '2025-01-06', 561.63, 561.63)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('506596a5-1951-455a-b709-b5d761baa368', '9fabf180-853d-424e-a6ee-1941e3eb8f78', 'COB000007', '24/205395-6', '2025-01-05', '2025-01-03', '2025-01-06', 540.5, 540.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('506596a5-1951-455a-b709-b5d761baa368', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000007', '24/205404-9', '2025-01-05', '2025-01-03', '2025-01-06', 311.6, 311.6)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000022', '24/205321-2', '2025-01-05', '2025-01-06', '2025-01-07', 1412, 1412)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000022', '24/205330-1', '2025-01-05', '2025-01-06', '2025-01-07', 962.76, 962.76)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000022', '24/205337-9', '2025-01-05', '2025-01-06', '2025-01-07', 561.61, 561.61)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000022', '24/205353-0', '2025-01-05', '2025-01-06', '2025-01-07', 300, 300)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000022', '24/205354-9', '2025-01-05', '2025-01-06', '2025-01-07', 300, 300)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000022', '24/205356-5', '2025-01-05', '2025-01-06', '2025-01-07', 1412, 1412)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', 'a9532f88-d365-452f-87db-133c22a3d5bd', 'COB000022', '24/205361-1', '2025-01-05', '2025-01-06', '2025-01-07', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000022', '24/205363-8', '2025-01-05', '2025-01-06', '2025-01-07', 337.81, 337.81)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '7be0ec1d-783d-4156-a5e6-7a9ce59c0d1d', 'COB000022', '24/205366-2', '2025-01-05', '2025-01-06', '2025-01-07', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000022', '24/205374-3', '2025-01-05', '2025-01-06', '2025-01-07', 895.92, 895.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000022', '24/205376-0', '2025-01-05', '2025-01-06', '2025-01-07', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000022', '24/205377-8', '2025-01-05', '2025-01-06', '2025-01-07', 1059.05, 1059.05)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000022', '24/205378-6', '2025-01-05', '2025-01-06', '2025-01-07', 2824.01, 2824.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000022', '24/205394-8', '2025-01-05', '2025-01-06', '2025-01-07', 300, 300)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000022', '24/205398-0', '2025-01-05', '2025-01-06', '2025-01-07', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000022', '24/205400-6', '2025-01-05', '2025-01-06', '2025-01-07', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '521c171a-0777-44a4-805b-b99475a7bab8', 'COB000022', '24/205401-4', '2025-01-05', '2025-01-06', '2025-01-07', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000022', '24/205405-7', '2025-01-05', '2025-01-06', '2025-01-07', 674.31, 674.31)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000022', '24/205408-1', '2025-01-05', '2025-01-06', '2025-01-07', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '22fc0f75-5924-4c5d-9db0-8d6bcc0a3553', 'COB000022', '24/205410-3', '2025-01-05', '2025-01-06', '2025-01-07', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '038eb393-b252-4a47-86c9-39599c0f09c8', 'COB000022', '24/205414-6', '2025-01-05', '2025-01-06', '2025-01-07', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f9fddb0d-6d73-4072-843d-e1a159cee3c8', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000022', '24/205418-9', '2025-01-05', '2025-01-06', '2025-01-07', 713.38, 713.38)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('71778d4f-35ad-4edb-b518-47e43ecd5da7', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000001', '24/205303-4', '2025-01-07', '2025-01-07', '2025-01-08', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1eaf59ec-e003-47e4-a1fe-04cce9b80696', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000005', '24/205278-0', '2024-12-20', '2025-01-08', '2025-01-09', 160.46, 163.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1eaf59ec-e003-47e4-a1fe-04cce9b80696', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000005', '24/205304-2', '2024-12-20', '2025-01-08', '2025-01-09', 160.46, 163.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1eaf59ec-e003-47e4-a1fe-04cce9b80696', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000005', '24/205335-2', '2025-01-10', '2025-01-08', '2025-01-09', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1eaf59ec-e003-47e4-a1fe-04cce9b80696', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000005', '24/205349-2', '2025-01-10', '2025-01-08', '2025-01-09', 537.55, 537.55)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('1eaf59ec-e003-47e4-a1fe-04cce9b80696', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000005', '24/205382-4', '2025-01-05', '2025-01-08', '2025-01-09', 160.46, 163.7)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a489aacd-7df8-41b6-a14e-76669ed84a18', '574cbdfa-4bde-4a8b-a582-c975c30783a9', 'COB000003', '24/205312-3', '2024-12-20', '2025-01-09', '2025-01-10', 150.72, 154.03)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a489aacd-7df8-41b6-a14e-76669ed84a18', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000003', '24/205324-7', '2025-01-10', '2025-01-09', '2025-01-10', 2160.74, 2160.74)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a489aacd-7df8-41b6-a14e-76669ed84a18', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000003', '24/205342-5', '2025-01-10', '2025-01-09', '2025-01-10', 593.29, 593.29)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '33b167c0-cf23-4b0c-b111-42085ce8bc69', 'COB000030', '24/205231-3', '2025-01-10', '2025-01-10', '2025-01-13', 855.76, 855.76)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000030', '24/205317-4', '2025-01-10', '2025-01-10', '2025-01-13', 11296.48, 11296.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '685657a9-adc3-4608-b234-8a884d5c25a3', 'COB000030', '24/205325-5', '2025-01-10', '2025-01-10', '2025-01-13', 1500, 1500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000030', '24/205326-3', '2025-01-10', '2025-01-10', '2025-01-13', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000030', '24/205332-8', '2025-01-10', '2025-01-10', '2025-01-13', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000030', '24/205333-6', '2025-01-10', '2025-01-10', '2025-01-13', 150.72, 150.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000030', '24/205336-0', '2025-01-10', '2025-01-10', '2025-01-13', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'abfc96dc-e28f-4ee9-83ea-5f52d1049f21', 'COB000030', '24/205339-5', '2025-01-10', '2025-01-10', '2025-01-13', 3500, 3500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000030', '24/205341-7', '2025-01-10', '2025-01-10', '2025-01-13', 1412, 1412)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000030', '24/205343-3', '2025-01-10', '2025-01-10', '2025-01-13', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000030', '24/205344-1', '2025-01-10', '2025-01-10', '2025-01-13', 1419.4, 1419.4)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000030', '24/205347-6', '2025-01-10', '2025-01-10', '2025-01-13', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000030', '24/205348-4', '2025-01-10', '2025-01-10', '2025-01-13', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000030', '24/205357-3', '2025-01-10', '2025-01-10', '2025-01-13', 895.92, 895.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000030', '24/205359-0', '2025-01-10', '2025-01-10', '2025-01-13', 439.13, 439.13)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000030', '24/205362-0', '2025-01-10', '2025-01-10', '2025-01-13', 353, 353)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'e9a47af5-5fa8-44e4-8058-da1429660260', 'COB000030', '24/205364-6', '2025-01-10', '2025-01-10', '2025-01-13', 513.46, 513.46)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000030', '24/205370-0', '2025-01-10', '2025-01-10', '2025-01-13', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000030', '24/205372-7', '2025-01-10', '2025-01-10', '2025-01-13', 1412, 1412)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000030', '24/205373-5', '2025-01-10', '2025-01-10', '2025-01-13', 647.5, 647.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000030', '24/205381-6', '2025-01-10', '2025-01-10', '2025-01-13', 1540.4, 1540.4)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000030', '24/205384-0', '2025-01-10', '2025-01-10', '2025-01-13', 800, 800)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000030', '24/205385-9', '2025-01-10', '2025-01-10', '2025-01-13', 116.51, 116.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000030', '24/205391-3', '2025-01-10', '2025-01-10', '2025-01-13', 714.03, 714.03)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000030', '24/205393-0', '2025-01-10', '2025-01-10', '2025-01-13', 534.85, 534.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000030', '24/205399-9', '2025-01-10', '2025-01-10', '2025-01-13', 320.91, 320.91)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000030', '24/205407-3', '2025-01-10', '2025-01-10', '2025-01-13', 2688.3, 2688.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', 'cca5abc2-a34f-4a8c-86ee-f48dab227a91', 'COB000030', '24/205412-0', '2025-01-10', '2025-01-10', '2025-01-13', 4244.67, 4244.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000030', '24/205413-8', '2025-01-10', '2025-01-10', '2025-01-13', 1604.67, 1604.67)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('88957a7a-8fca-4e4f-a9b5-8f57802afbcf', '57b8f542-53dd-4be4-8abd-4e94922a48d0', 'COB000030', '24/205416-2', '2025-01-10', '2025-01-10', '2025-01-13', 2824.01, 2824.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2a51cd70-a722-470b-bad9-f84a43f41151', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000005', '24/205272-0', '2025-01-14', '2025-01-14', '2025-01-15', 706, 706)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2a51cd70-a722-470b-bad9-f84a43f41151', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000005', '24/205367-0', '2025-01-10', '2025-01-14', '2025-01-15', 706, 720.4)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2a51cd70-a722-470b-bad9-f84a43f41151', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000005', '24/205375-1', '2025-01-14', '2025-01-14', '2025-01-15', 2118.01, 2118.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2a51cd70-a722-470b-bad9-f84a43f41151', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000005', '24/205387-5', '2025-01-10', '2025-01-14', '2025-01-15', 3308.58, 3376.07)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2a51cd70-a722-470b-bad9-f84a43f41151', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000005', '24/205403-0', '2025-01-15', '2025-01-14', '2025-01-15', 256.73, 256.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f27b9120-797c-47ed-83f4-876ae56f0513', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000007', '24/205301-8', '2025-01-14', '2025-01-15', '2025-01-16', 660, 673.26)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f27b9120-797c-47ed-83f4-876ae56f0513', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000007', '24/205323-9', '2025-01-15', '2025-01-15', '2025-01-16', 349.52, 349.52)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f27b9120-797c-47ed-83f4-876ae56f0513', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000007', '24/205331-0', '2025-01-15', '2025-01-15', '2025-01-16', 256.73, 256.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f27b9120-797c-47ed-83f4-876ae56f0513', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000007', '24/205340-9', '2025-01-15', '2025-01-15', '2025-01-16', 256.73, 256.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f27b9120-797c-47ed-83f4-876ae56f0513', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000007', '24/205379-4', '2025-01-15', '2025-01-15', '2025-01-16', 349.52, 349.52)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f27b9120-797c-47ed-83f4-876ae56f0513', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000007', '24/205388-3', '2025-01-10', '2025-01-15', '2025-01-16', 7060.02, 7204.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('f27b9120-797c-47ed-83f4-876ae56f0513', '22d50084-2673-4b08-ae73-bbbe9d87284f', 'COB000007', '25/200004-9', '2025-01-10', '2025-01-15', '2025-01-16', 1889.59, 1928.32)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5418952d-858a-434b-b827-b048a5ef6a24', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000002', '24/205383-2', '2025-01-05', '2025-01-16', '2025-01-17', 141.49, 144.46)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('5418952d-858a-434b-b827-b048a5ef6a24', '574cbdfa-4bde-4a8b-a582-c975c30783a9', 'COB000002', '24/205417-0', '2025-01-05', '2025-01-16', '2025-01-17', 150.72, 153.89)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a175a73b-5616-472c-bdbd-404805a80128', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000004', '24/205242-9', '2025-01-17', '2025-01-17', '2025-01-20', 353.01, 353.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a175a73b-5616-472c-bdbd-404805a80128', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000004', '24/205256-9', '2025-01-17', '2025-01-17', '2025-01-20', 353, 353)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a175a73b-5616-472c-bdbd-404805a80128', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000004', '24/205345-0', '2025-01-10', '2025-01-17', '2025-01-20', 353.01, 360.31)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('a175a73b-5616-472c-bdbd-404805a80128', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000004', '24/205360-3', '2025-01-10', '2025-01-17', '2025-01-20', 353, 360.3)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('634c18d3-61ce-4174-aad3-57bf68e22231', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000002', '24/205246-1', '2024-12-20', '2025-01-20', '2025-01-21', 537.55, 549.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('634c18d3-61ce-4174-aad3-57bf68e22231', '33b167c0-cf23-4b0c-b111-42085ce8bc69', 'COB000002', '24/205334-4', '2025-01-15', '2025-01-20', '2025-01-21', 855.76, 873.29)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3b13c213-5130-44a7-8c1b-d441c5fbf03f', 'a9532f88-d365-452f-87db-133c22a3d5bd', 'COB000005', '24/205150-3', '2024-12-05', '2025-01-22', '2025-01-23', 706, 723.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3b13c213-5130-44a7-8c1b-d441c5fbf03f', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 'COB000005', '24/205226-7', '2024-12-20', '2025-01-22', '2025-01-23', 909.25, 930.43)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3b13c213-5130-44a7-8c1b-d441c5fbf03f', 'a9532f88-d365-452f-87db-133c22a3d5bd', 'COB000005', '24/205257-7', '2024-12-20', '2025-01-22', '2025-01-23', 706, 722.44)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3b13c213-5130-44a7-8c1b-d441c5fbf03f', 'b5a1bb23-ef78-4fb7-8f5e-2c116963b059', 'COB000005', '24/205327-1', '2025-01-10', '2025-01-22', '2025-01-23', 909.25, 928.52)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3b13c213-5130-44a7-8c1b-d441c5fbf03f', '01247d35-327e-416f-b928-b85e64e8b070', 'COB000005', '24/205351-4', '2025-01-10', '2025-01-22', '2025-01-23', 909.25, 928.52)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2810aa6b-64fd-45cd-abb6-f9ca147e10cd', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000004', '24/205228-3', '2025-01-23', '2025-01-23', '2025-01-24', 256.73, 256.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2810aa6b-64fd-45cd-abb6-f9ca147e10cd', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000004', '24/205237-2', '2025-01-23', '2025-01-23', '2025-01-24', 256.73, 256.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2810aa6b-64fd-45cd-abb6-f9ca147e10cd', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000004', '24/205298-4', '2025-01-23', '2025-01-23', '2025-01-24', 256.73, 256.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('2810aa6b-64fd-45cd-abb6-f9ca147e10cd', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000004', '24/205406-5', '2025-01-15', '2025-01-23', '2025-01-24', 660, 673.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('3c83bdea-36e3-4a5e-a752-94cb0dead2f3', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000001', '24/205409-0', '2025-01-05', '2025-01-24', '2025-01-27', 160.46, 163.96)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('655fbca7-daf4-4cf9-8f72-ed68c3f97379', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000001', '25/200088-0', '2025-02-05', '2025-01-29', '2025-01-30', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('abf8086f-5b5e-44ec-8e49-8f691d92f56a', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000002', '25/200076-6', '2025-02-05', '2025-01-31', '2025-02-03', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('abf8086f-5b5e-44ec-8e49-8f691d92f56a', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000002', '25/200083-9', '2025-02-05', '2025-01-31', '2025-02-03', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 'COB000009', '24/205261-5', '2024-12-20', '2025-02-03', '2025-02-04', 909.25, 931.52)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 'COB000009', '24/205328-0', '2025-01-10', '2025-02-03', '2025-02-04', 909.25, 929.61)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 'COB000009', '24/205365-4', '2025-01-10', '2025-02-03', '2025-02-04', 909.25, 929.61)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', '0c8c3517-5f71-4907-b94c-74fdf0ee2b1c', 'COB000009', '25/200064-2', '2025-02-05', '2025-02-03', '2025-02-04', 2276.86, 2276.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000009', '25/200066-9', '2025-02-05', '2025-02-03', '2025-02-04', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000009', '25/200067-7', '2025-02-05', '2025-02-03', '2025-02-04', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', '8b2d76a3-b6fd-4a3b-be75-7699bdea74f9', 'COB000009', '25/200073-1', '2025-02-05', '2025-02-03', '2025-02-04', 152.1, 152.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000009', '25/200085-5', '2025-02-05', '2025-02-03', '2025-02-04', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('ece03b9e-4884-4219-a017-a5ce4040bdfa', '9fabf180-853d-424e-a6ee-1941e3eb8f78', 'COB000009', '25/200087-1', '2025-02-05', '2025-02-03', '2025-02-04', 581.04, 581.04)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', 'fa58a22a-634b-491a-b45a-eaeca3fc4184', 'COB000009', '25/200009-0', '2025-02-05', '2025-02-04', '2025-02-05', 766.82, 766.82)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', 'e170749f-0204-4857-ad1f-66933e0dbbfe', 'COB000009', '25/200010-3', '2025-02-05', '2025-02-04', '2025-02-05', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', '4a8d09b1-54be-4d9d-ad7d-e765c29608e4', 'COB000009', '25/200011-1', '2025-02-05', '2025-02-04', '2025-02-05', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', '91fc1d1f-4bc0-4f21-bdab-4a80c5ddcb91', 'COB000009', '25/200047-2', '2025-02-05', '2025-02-04', '2025-02-05', 2182.01, 2182.01)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', 'e8cbf5cd-de24-4dc5-838b-8327e81c9233', 'COB000009', '25/200052-9', '2025-02-05', '2025-02-04', '2025-02-05', 363.15, 363.15)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', 'b3862f55-e5cc-4665-ac2a-e9120ca5eee0', 'COB000009', '25/200070-7', '2025-02-05', '2025-02-04', '2025-02-05', 603.75, 603.75)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', '744c9872-be69-45f4-9c51-f60f581ac48c', 'COB000009', '25/200093-6', '2025-02-05', '2025-02-04', '2025-02-05', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', '532910cd-e4a6-4457-856d-49b732b7c4db', 'COB000009', '25/200098-7', '2025-02-05', '2025-02-04', '2025-02-05', 334.97, 334.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('73ea1f20-9d3b-4391-81f0-1b22733ac1a2', '5786cbef-d9d6-4f66-bd9d-039c7d520bc5', 'COB000009', '25/200112-6', '2025-02-10', '2025-02-04', '2025-02-05', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000019', '25/200019-7', '2025-02-05', '2025-02-05', '2025-02-06', 1034.97, 1034.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '233b8709-7103-4b95-a6c2-fdc5dc1562d8', 'COB000019', '25/200026-0', '2025-02-05', '2025-02-05', '2025-02-06', 603.73, 603.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '3bd17681-6880-476a-83a5-efdb2ad8f329', 'COB000019', '25/200042-1', '2025-02-05', '2025-02-05', '2025-02-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '9e424064-7d0d-46a2-9996-782599c51913', 'COB000019', '25/200043-0', '2025-02-05', '2025-02-05', '2025-02-06', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '5bc57657-5577-4f21-b3d0-9ad1c3666a62', 'COB000019', '25/200045-6', '2025-02-05', '2025-02-05', '2025-02-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '7be0ec1d-783d-4156-a5e6-7a9ce59c0d1d', 'COB000019', '25/200055-3', '2025-02-05', '2025-02-05', '2025-02-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '1d8445bf-725d-4a01-a9a4-6196d14fd45b', 'COB000019', '25/200058-8', '2025-02-05', '2025-02-05', '2025-02-06', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', 'd98a951d-e182-4486-aacc-aeae2c6e963d', 'COB000019', '25/200065-0', '2025-02-05', '2025-02-05', '2025-02-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '3c09ec0b-694b-49be-a55e-ee002f76e5c5', 'COB000019', '25/200072-3', '2025-02-05', '2025-02-05', '2025-02-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '692968c3-009b-4b9b-a044-d5215e278e6b', 'COB000019', '25/200090-1', '2025-02-05', '2025-02-05', '2025-02-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', 'f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09', 'COB000019', '25/200092-8', '2025-02-05', '2025-02-05', '2025-02-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', 'c3d76a06-a85e-4887-b53e-e3c01a5c7ece', 'COB000019', '25/200094-4', '2025-02-05', '2025-02-05', '2025-02-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '521c171a-0777-44a4-805b-b99475a7bab8', 'COB000019', '25/200095-2', '2025-02-05', '2025-02-05', '2025-02-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', 'ae99bfd8-e732-4a81-a0bf-5c7fa5f5fef0', 'COB000019', '25/200099-5', '2025-02-05', '2025-02-05', '2025-02-06', 724.88, 724.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '79f57242-39df-4fd5-a0b7-39a5e38f642a', 'COB000019', '25/200102-9', '2025-02-05', '2025-02-05', '2025-02-06', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '03e969d2-d4be-4972-bd0c-60b440612984', 'COB000019', '25/200103-7', '2025-02-05', '2025-02-05', '2025-02-06', 172.5, 172.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '22fc0f75-5924-4c5d-9db0-8d6bcc0a3553', 'COB000019', '25/200104-5', '2025-02-05', '2025-02-05', '2025-02-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '038eb393-b252-4a47-86c9-39599c0f09c8', 'COB000019', '25/200107-0', '2025-02-05', '2025-02-05', '2025-02-06', 537.5, 537.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b2d5fcb7-5e7c-4099-aced-143c7ece5e85', '4fcc8826-3cd6-402b-a619-328c622e0ea2', 'COB000019', '25/200111-8', '2025-02-05', '2025-02-05', '2025-02-06', 766.88, 766.88)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('b22adb87-ca6d-42eb-be32-54590d13f018', 'e52b3c94-37eb-4154-8bf8-0b5c35e4a9ea', 'COB000001', '25/200012-0', '2025-02-05', '2025-02-06', '2025-02-07', 1518, 1548.51)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '1818eda2-6bf8-4756-af26-24e103761562', 'COB000033', '25/200008-1', '2025-02-10', '2025-02-10', '2025-02-11', 12143.72, 12143.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '33faf6ea-f461-4223-9029-7183c6988987', 'COB000033', '25/200014-6', '2025-02-10', '2025-02-10', '2025-02-11', 2322.8, 2322.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '597a27ec-471b-40f0-bd66-432063b5676a', 'COB000033', '25/200016-2', '2025-02-10', '2025-02-10', '2025-02-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '6eb56959-eb7e-44d0-b3cd-92f898b798b3', 'COB000033', '25/200021-9', '2025-02-10', '2025-02-10', '2025-02-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'f7d613c4-3862-4e5a-a244-8ce68650d52a', 'COB000033', '25/200022-7', '2025-02-10', '2025-02-10', '2025-02-11', 162, 162)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '92e8e23a-a279-428f-9c74-8beb66ffa7af', 'COB000033', '25/200024-3', '2025-02-10', '2025-02-10', '2025-02-11', 301.41, 301.41)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '177369ad-808a-4633-8edc-42583d3ee833', 'COB000033', '25/200025-1', '2025-02-10', '2025-02-10', '2025-02-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'f1b01a43-38b8-4521-94cf-6a2b6087c80e', 'COB000033', '25/200030-8', '2025-02-10', '2025-02-10', '2025-02-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '18f183c1-3a25-4111-bb5d-4e988c2e1c3e', 'COB000033', '25/200031-6', '2025-02-10', '2025-02-10', '2025-02-11', 637.8, 637.8)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'a1674d59-970f-483a-bf51-c7425454f191', 'COB000033', '25/200032-4', '2025-02-10', '2025-02-10', '2025-02-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '5c1f28c9-212d-4038-ae1d-65ed06b0c617', 'COB000033', '25/200033-2', '2025-02-10', '2025-02-10', '2025-02-11', 1525.86, 1525.86)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'b7e50813-4cf2-4e39-8d63-faff187524be', 'COB000033', '25/200034-0', '2025-02-10', '2025-02-10', '2025-02-11', 379.5, 379.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '48fd6593-adec-447b-91db-9ad7847daaf5', 'COB000033', '25/200036-7', '2025-02-10', '2025-02-10', '2025-02-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8', 'COB000033', '25/200037-5', '2025-02-10', '2025-02-10', '2025-02-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '14336b6b-46b8-4169-a572-2db656b4c7a8', 'COB000033', '25/200038-3', '2025-02-10', '2025-02-10', '2025-02-11', 577.85, 577.85)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '8bc18c3e-7ad4-48ed-94d0-2639e9c0528b', 'COB000033', '25/200046-4', '2025-02-10', '2025-02-10', '2025-02-11', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e', 'COB000033', '25/200048-0', '2025-02-10', '2025-02-10', '2025-02-11', 472.06, 472.06)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '99ed45bb-c259-4748-b65b-35ef084631cd', 'COB000033', '25/200049-9', '2025-02-10', '2025-02-10', '2025-02-11', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '6500afb1-3c18-4bdd-abbc-fc509d79ab34', 'COB000033', '25/200051-0', '2025-02-10', '2025-02-10', '2025-02-11', 379.48, 379.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'e9a47af5-5fa8-44e4-8058-da1429660260', 'COB000033', '25/200053-7', '2025-02-10', '2025-02-10', '2025-02-11', 551.97, 551.97)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '6883c0f7-70f2-43f7-9b5a-e5c7548d3aab', 'COB000033', '25/200056-1', '2025-02-10', '2025-02-10', '2025-02-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'a18a8600-1d67-443f-b576-b77d253191a0', 'COB000033', '25/200059-6', '2025-02-10', '2025-02-10', '2025-02-11', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'ea06b1b8-077f-4d84-83dc-cd134f7a9032', 'COB000033', '25/200061-8', '2025-02-10', '2025-02-10', '2025-02-11', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '6ea8cafa-3780-4fe0-a77e-366ce406a4cf', 'COB000033', '25/200062-6', '2025-02-10', '2025-02-10', '2025-02-11', 500, 500)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'bb83f7ba-eeb4-442b-8fc9-eb8b3b8274b6', 'COB000033', '25/200069-3', '2025-02-10', '2025-02-10', '2025-02-11', 250, 250)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000033', '25/200071-5', '2025-02-10', '2025-02-10', '2025-02-11', 1655.93, 1655.93)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '42230d47-af5b-48c0-8290-ab5033883bad', 'COB000033', '25/200075-8', '2025-02-10', '2025-02-10', '2025-02-11', 125.25, 125.25)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '5523de4a-a0b2-4156-803d-0a7270e2bdf7', 'COB000033', '25/200077-4', '2025-02-10', '2025-02-10', '2025-02-11', 3556.72, 3556.72)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '42c749f3-4346-42ba-8c26-32f6288af855', 'COB000033', '25/200082-0', '2025-02-10', '2025-02-10', '2025-02-11', 767.58, 767.58)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'a4e9e69b-e69b-446f-a400-b5ee012620e1', 'COB000033', '25/200091-0', '2025-02-10', '2025-02-10', '2025-02-11', 344.98, 344.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'ccc7501b-bc1e-4431-8ff5-33f1be5506a7', 'COB000033', '25/200101-0', '2025-02-10', '2025-02-10', '2025-02-11', 2889.92, 2889.92)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', 'cca5abc2-a34f-4a8c-86ee-f48dab227a91', 'COB000033', '25/200105-3', '2025-02-10', '2025-02-10', '2025-02-11', 4563.02, 4563.02)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('78a8df46-0912-4250-9975-283c0c581f01', '3ac184eb-2f6e-4b4b-891c-a4a1c63b4767', 'COB000033', '25/200106-1', '2025-02-10', '2025-02-10', '2025-02-11', 1725, 1725)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fdc08cf5-4128-48ed-945c-6c65f9e1b2dc', '8d125b22-fa6d-4b86-bcc3-4795a60f2096', 'COB000002', '25/200003-0', '2025-02-11', '2025-02-11', '2025-02-12', 759, 759)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('fdc08cf5-4128-48ed-945c-6c65f9e1b2dc', '0e743d4e-7fa2-4a89-92a5-252b716fbdca', 'COB000002', '25/200074-0', '2025-02-11', '2025-02-11', '2025-02-12', 860, 860)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('bbd9b00b-af9d-4295-983e-0e8f22801f72', '183d2e36-cf1a-4708-a656-1750a39e7f51', 'COB000004', '25/200063-4', '2025-02-12', '2025-02-12', '2025-02-13', 963.1, 963.1)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('bbd9b00b-af9d-4295-983e-0e8f22801f72', '64da8dec-a081-4c5e-bc29-c73703638816', 'COB000004', '25/200084-7', '2025-02-10', '2025-02-12', '2025-02-13', 574.96, 586.56)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('bbd9b00b-af9d-4295-983e-0e8f22801f72', '943c4c68-45b8-414f-8dd3-097484aaa2ff', 'COB000004', '25/200114-2', '2025-02-25', '2025-02-12', '2025-02-13', 300, 300)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('bbd9b00b-af9d-4295-983e-0e8f22801f72', '5f7c0c62-ffa1-486f-a40d-e2d9183427d8', 'COB000004', '25/200115-0', '2025-02-25', '2025-02-12', '2025-02-13', 300, 300)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4220b345-9ac0-44b9-b74e-069dbec157d0', 'f3f6f424-ec32-4ef4-8e9a-2bcf911b6fb2', 'COB000006', '25/200013-8', '2025-02-15', '2025-02-17', '2025-02-18', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4220b345-9ac0-44b9-b74e-069dbec157d0', 'dfc1df26-e264-4fec-b427-effcda2e6dd4', 'COB000006', '25/200020-0', '2025-02-15', '2025-02-17', '2025-02-18', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4220b345-9ac0-44b9-b74e-069dbec157d0', 'd3d69d2a-061c-4910-8639-2bdc6560fde4', 'COB000006', '25/200029-4', '2025-02-15', '2025-02-17', '2025-02-18', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4220b345-9ac0-44b9-b74e-069dbec157d0', '1a9a9308-1b0c-4fdb-8a3e-b04651e4fc90', 'COB000006', '25/200068-5', '2025-02-15', '2025-02-17', '2025-02-18', 375.73, 375.73)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4220b345-9ac0-44b9-b74e-069dbec157d0', '259892f5-f2f4-4004-9861-2f8177871575', 'COB000006', '25/200097-9', '2025-02-15', '2025-02-17', '2025-02-18', 275.98, 275.98)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('4220b345-9ac0-44b9-b74e-069dbec157d0', '050d3d74-79b5-4709-b20c-bdf9b5354519', 'COB000006', '25/200100-2', '2025-02-15', '2025-02-17', '2025-02-18', 709.5, 709.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('022974b3-62b9-4d4b-852f-f8e786c5cf65', '574cbdfa-4bde-4a8b-a582-c975c30783a9', 'COB000001', '25/200110-0', '2025-02-05', '2025-02-18', '2025-02-19', 162, 165.45)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('05c1b04c-87e6-4f44-8daf-c2298c7dc805', 'b5a1bb23-ef78-4fb7-8f5e-2c116963b059', 'COB000005', '25/200017-0', '2025-02-10', '2025-02-26', '2025-02-27', 977.45, 998.55)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('05c1b04c-87e6-4f44-8daf-c2298c7dc805', 'ea9411d2-5bc3-4bdb-abef-5541dd634983', 'COB000005', '25/200018-9', '2025-02-10', '2025-02-26', '2025-02-27', 977.45, 998.55)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('05c1b04c-87e6-4f44-8daf-c2298c7dc805', '01247d35-327e-416f-b928-b85e64e8b070', 'COB000005', '25/200040-5', '2025-02-10', '2025-02-26', '2025-02-27', 977.45, 998.55)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('05c1b04c-87e6-4f44-8daf-c2298c7dc805', '96c05bb8-2009-464b-a1c3-cfbdb22b8829', 'COB000005', '25/200054-5', '2025-02-10', '2025-02-26', '2025-02-27', 977.45, 998.55)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('05c1b04c-87e6-4f44-8daf-c2298c7dc805', '18a91e2f-27e4-4478-bb28-021d6d9789ef', 'COB000005', '25/200113-4', '2025-02-05', '2025-02-26', '2025-02-27', 1518, 1551.54)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('010a0408-6904-41c0-a577-0327c002782d', '33b167c0-cf23-4b0c-b111-42085ce8bc69', 'COB000008', '25/200023-5', '2025-02-15', '2025-02-27', '2025-02-28', 919.95, 939.44)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('010a0408-6904-41c0-a577-0327c002782d', 'a8066e49-0a12-4f67-bd71-b7f2fce055a5', 'COB000008', '25/200178-9', '2025-03-05', '2025-02-27', '2025-02-28', 1138.48, 1138.48)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('010a0408-6904-41c0-a577-0327c002782d', 'ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298', 'COB000008', '25/200179-7', '2025-03-05', '2025-02-27', '2025-02-28', 3036, 3036)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('010a0408-6904-41c0-a577-0327c002782d', '6869b050-94ca-428e-83f1-36a81e613ba4', 'COB000008', '25/200188-6', '2025-03-05', '2025-02-27', '2025-02-28', 2897.9, 2897.9)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('010a0408-6904-41c0-a577-0327c002782d', '8545268d-d93e-42ea-99c0-4110f22f6929', 'COB000008', '25/200193-2', '2025-03-05', '2025-02-27', '2025-02-28', 2194.11, 2194.11)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('010a0408-6904-41c0-a577-0327c002782d', '61346d91-1fd4-41bf-9567-bab696f9475e', 'COB000008', '25/200195-9', '2025-03-05', '2025-02-27', '2025-02-28', 322.5, 322.5)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('010a0408-6904-41c0-a577-0327c002782d', '0ca8e050-0c11-4124-865e-42d8380354ad', 'COB000008', '25/200197-5', '2025-03-05', '2025-02-27', '2025-02-28', 1518, 1518)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;
INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('010a0408-6904-41c0-a577-0327c002782d', '76d31568-8388-4a98-a1de-10cb6d38dbc4', 'COB000008', '25/200240-8', '2025-03-05', '2025-02-27', '2025-02-28', 100, 100)
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;

-- 3. Atualizar bank_transactions com flag de múltiplos pagamentos
UPDATE bank_transactions bt
SET has_multiple_matches = true
WHERE id IN (
  SELECT DISTINCT bank_transaction_id 
  FROM boleto_payments 
  WHERE bank_transaction_id IS NOT NULL
);

-- 4. Verificar resultado
SELECT 
  bt.transaction_date,
  bt.description,
  bt.amount AS valor_banco,
  COUNT(bp.id) AS qtd_boletos,
  SUM(bp.valor_liquidado) AS soma_boletos
FROM bank_transactions bt
JOIN boleto_payments bp ON bp.bank_transaction_id = bt.id
GROUP BY bt.id, bt.transaction_date, bt.description, bt.amount
ORDER BY bt.transaction_date
LIMIT 20;
