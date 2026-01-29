-- FECHAMENTO 01/2025 — REPROCESSAR LANÇAMENTOS (BANK_TRANSACTION + HONORARIOS)
-- Dr. Cícero: relançar corretamente após estorno

SET session_replication_role = 'replica';

-- =========================
-- 1) REPROCESSAR HONORÁRIOS
-- =========================

WITH target_codes(internal_code) AS (
  VALUES
    ('bank_transaction:20250121:5e20d219be22'),
    ('bank_transaction:20250107:c9482b6fcd13'),
    ('bank_transaction:20250108:2e899c93d7c3'),
    ('bank_transaction:20250113:2b640c26b866'),
    ('bank_transaction:20250127:cba6265d8f3c'),
    ('bank_transaction:20250107:5375a5229241'),
    ('bank_transaction:20250102:e80a2722b21f'),
    ('hon_b014406f-6497-49b2-bf03-483353ae99a0_2025-01'),
    ('bank_transaction:20250116:bfe84a8974c4'),
    ('bank_transaction:20250106:f650bc2c830a'),
    ('bank_transaction:20250103:7fcab8783b4c'),
    ('bank_transaction:20250110:19a193578462'),
    ('hon_22d50084-2673-4b08-ae73-bbbe9d87284f_2025-01'),
    ('bank_transaction:20250115:e84bac21d81b'),
    ('bank_transaction:20250114:c9a2ec0c931e'),
    ('bank_transaction:20250110:9aaa67cf37d8'),
    ('bank_transaction:20250110:51d2acd809e3'),
    ('bank_transaction:20250103:3e006fc52e61'),
    ('bank_transaction:20250113:611a1998d1de'),
    ('bank_transaction:20250110:bce7ef6ac395'),
    ('bank_transaction:20250115:8ad04684ad72'),
    ('hon_cca5abc2-a34f-4a8c-86ee-f48dab227a91_2025-01'),
    ('hon_1f759ac5-a12f-4791-a9e1-773945260670_2025-01'),
    ('bank_transaction:20250110:c65c4711b5f1'),
    ('hon_7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b_2025-01'),
    ('bank_transaction:20250123:c22b795178ab'),
    ('bank_transaction:20250122:50a277085cb1'),
    ('bank_transaction:20250128:238af1669b12'),
    ('bank_transaction:20250131:e6ca317420a4'),
    ('bank_transaction:20250106:627e585fe9b2'),
    ('bank_transaction:20250106:413fed71368f'),
    ('bank_transaction:20250110:33bf8f2bda28'),
    ('hon_abfc96dc-e28f-4ee9-83ea-5f52d1049f21_2025-01'),
    ('bank_transaction:20250110:091f605e4726'),
    ('bank_transaction:20250115:2f521b679038'),
    ('hon_744c9872-be69-45f4-9c51-f60f581ac48c_2025-01'),
    ('hon_ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298_2025-01'),
    ('bank_transaction:20250110:ae3961166c6c'),
    ('bank_transaction:20250129:ab2945c9bbb7'),
    ('bank_transaction:20250115:3329c1fdf397'),
    ('hon_33faf6ea-f461-4223-9029-7183c6988987_2025-01'),
    ('bank_transaction:20250110:0f83fafb978c'),
    ('bank_transaction:20250115:6d0e9da4a13a'),
    ('hon_8545268d-d93e-42ea-99c0-4110f22f6929_2025-01'),
    ('bank_transaction:20250116:20a97076064f'),
    ('bank_transaction:20250108:3da43465b4ae'),
    ('hon_3ac184eb-2f6e-4b4b-891c-a4a1c63b4767_2025-01'),
    ('bank_transaction:20250128:2fa4b2916d1e'),
    ('bank_transaction:20250109:f432024c2388'),
    ('hon_41f72a96-f012-48b1-92d9-1587625973d0_2025-01'),
    ('bank_transaction:20250110:ae9da7cd46ef'),
    ('bank_transaction:20250110:9931db142ff6'),
    ('hon_5c1f28c9-212d-4038-ae1d-65ed06b0c617_2025-01'),
    ('hon_5bc57657-5577-4f21-b3d0-9ad1c3666a62_2025-01'),
    ('hon_1d8445bf-725d-4a01-a9a4-6196d14fd45b_2025-01'),
    ('bank_transaction:20250110:2549c3e56e19'),
    ('hon_8fe85a29-d159-43dd-8874-f85da9375e32_2025-01'),
    ('bank_transaction:20250130:b65fed85cc6c'),
    ('hon_18a91e2f-27e4-4478-bb28-021d6d9789ef_2025-01'),
    ('hon_f1b01a43-38b8-4521-94cf-6a2b6087c80e_2025-01'),
    ('bank_transaction:20250115:b3b936e59a0d'),
    ('bank_transaction:20250114:01629e219c3c'),
    ('hon_685657a9-adc3-4608-b234-8a884d5c25a3_2025-01'),
    ('bank_transaction:20250115:bb249a878245'),
    ('bank_transaction:20250110:e73647f28948'),
    ('bank_transaction:20250124:f9237102922b'),
    ('bank_transaction:20250120:a86ca396f8e5'),
    ('bank_transaction:20250121:1b57e7d90d57'),
    ('bank_transaction:20250106:e25d3de55cdb'),
    ('bank_transaction:20250115:28f06f0dc083'),
    ('bank_transaction:20250109:542a51fe8aa1'),
    ('bank_transaction:20250115:fa858120f70f'),
    ('bank_transaction:20250115:57a958146b9e'),
    ('hon_a8066e49-0a12-4f67-bd71-b7f2fce055a5_2025-01'),
    ('bank_transaction:20250115:3bcdcceb8c3f'),
    ('hon_ae6f5b9a-532b-4306-92cc-cb26950d5022_2025-01'),
    ('bank_transaction:20250130:b8e737e56dca'),
    ('hon_01247d35-327e-416f-b928-b85e64e8b070_2025-01'),
    ('hon_96c05bb8-2009-464b-a1c3-cfbdb22b8829_2025-01'),
    ('hon_8bc18c3e-7ad4-48ed-94d0-2639e9c0528b_2025-01'),
    ('hon_183d2e36-cf1a-4708-a656-1750a39e7f51_2025-01'),
    ('bank_transaction:20250115:45868d7e3d86'),
    ('hon_33b167c0-cf23-4b0c-b111-42085ce8bc69_2025-01'),
    ('hon_92e8e23a-a279-428f-9c74-8beb66ffa7af_2025-01'),
    ('bank_transaction:20250110:6a4fde9a2dc9'),
    ('bank_transaction:20250115:d0e93fe12f79'),
    ('bank_transaction:20250110:3c4dd994f179'),
    ('bank_transaction:20250115:1a7ef7f6f495'),
    ('hon_42c749f3-4346-42ba-8c26-32f6288af855_2025-01'),
    ('hon_0105c761-a740-49c5-a487-71a3123f6296_2025-01'),
    ('hon_fa58a22a-634b-491a-b45a-eaeca3fc4184_2025-01'),
    ('bank_transaction:20250110:37a6959fdbe4'),
    ('hon_86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8_2025-01'),
    ('hon_8d125b22-fa6d-4b86-bcc3-4795a60f2096_2025-01'),
    ('hon_f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09_2025-01'),
    ('hon_6883c0f7-70f2-43f7-9b5a-e5c7548d3aab_2025-01'),
    ('hon_597a27ec-471b-40f0-bd66-432063b5676a_2025-01'),
    ('hon_c3d76a06-a85e-4887-b53e-e3c01a5c7ece_2025-01'),
    ('hon_48fd6593-adec-447b-91db-9ad7847daaf5_2025-01'),
    ('hon_d3a203cf-1e94-476a-8e44-12e4112755dc_2025-01')
),
unbalanced AS (
  SELECT
    e.id,
    e.tenant_id,
    e.entry_date,
    e.description,
    e.reference_type,
    e.reference_id,
    SUM(l.debit) AS total_debit,
    SUM(l.credit) AS total_credit
  FROM accounting_entries e
  JOIN accounting_entry_lines l ON l.entry_id = e.id
  WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
    AND e.source_type = 'honorarios'
    AND e.internal_code IN (SELECT internal_code FROM target_codes)
  GROUP BY e.id
  HAVING ABS(SUM(l.debit) - SUM(l.credit)) > 0.01
),
base AS (
  SELECT
    u.id,
    u.tenant_id,
    u.entry_date,
    u.description,
    u.reference_type,
    u.reference_id,
    GREATEST(u.total_debit, u.total_credit) AS amount,
    COALESCE(
      MAX(CASE WHEN c.code LIKE '1.1.2.01.%' THEN l.account_id::text END)::uuid,
      MAX(l.account_id::text)::uuid
    ) AS debit_account_id
  FROM unbalanced u
  JOIN accounting_entry_lines l ON l.entry_id = u.id
  LEFT JOIN chart_of_accounts c ON c.id = l.account_id
  GROUP BY u.id, u.tenant_id, u.entry_date, u.description, u.reference_type, u.reference_id, u.total_debit, u.total_credit
),
revenue AS (
  SELECT id AS revenue_account_id
  FROM chart_of_accounts
  WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND (code = '3.1.1.01' OR code LIKE '3.1.1.01%')
  ORDER BY CASE WHEN code = '3.1.1.01' THEN 0 ELSE 1 END
  LIMIT 1
),
guard AS (
  SELECT 1 FROM revenue
),
inserted AS (
  INSERT INTO accounting_entries (
    id,
    tenant_id,
    entry_date,
    competence_date,
    description,
    internal_code,
    source_type,
    entry_type,
    reference_type,
    reference_id,
    total_debit,
    total_credit,
    balanced,
    created_at
  )
  SELECT
    gen_random_uuid(),
    b.tenant_id,
    b.entry_date,
    b.entry_date,
    'REPROCESSADO ' || COALESCE(b.description, b.id::text),
    'REPROC_HON_' || b.id::text,
    'honorarios',
    'receita_honorarios',
    b.reference_type,
    CASE WHEN b.reference_id::text ~ '^[0-9a-fA-F-]{36}$' THEN b.reference_id::uuid ELSE NULL END,
    b.amount,
    b.amount,
    true,
    NOW()
  FROM base b
  CROSS JOIN guard g
  WHERE NOT EXISTS (
    SELECT 1 FROM accounting_entries e2
    WHERE e2.internal_code = 'REPROC_HON_' || b.id::text
      AND e2.tenant_id = b.tenant_id
  )
  RETURNING id, internal_code, tenant_id
)
INSERT INTO accounting_entry_lines (
  id,
  tenant_id,
  entry_id,
  account_id,
  debit,
  credit,
  description,
  created_at
)
SELECT
  gen_random_uuid(),
  i.tenant_id,
  i.id,
  b.debit_account_id,
  b.amount,
  0,
  'D - Cliente (reprocessado)',
  NOW()
FROM inserted i
JOIN base b ON ('REPROC_HON_' || b.id::text) = i.internal_code

UNION ALL

SELECT
  gen_random_uuid(),
  i.tenant_id,
  i.id,
  r.revenue_account_id,
  0,
  b.amount,
  'C - Receita Honorários (reprocessado)',
  NOW()
FROM inserted i
JOIN base b ON ('REPROC_HON_' || b.id::text) = i.internal_code
CROSS JOIN revenue r;

-- ===============================
-- 2) REPROCESSAR BANK TRANSACTION
-- ===============================

WITH target_codes(internal_code) AS (
  VALUES
    ('bank_transaction:20250121:5e20d219be22'),
    ('bank_transaction:20250107:c9482b6fcd13'),
    ('bank_transaction:20250108:2e899c93d7c3'),
    ('bank_transaction:20250113:2b640c26b866'),
    ('bank_transaction:20250127:cba6265d8f3c'),
    ('bank_transaction:20250107:5375a5229241'),
    ('bank_transaction:20250102:e80a2722b21f'),
    ('hon_b014406f-6497-49b2-bf03-483353ae99a0_2025-01'),
    ('bank_transaction:20250116:bfe84a8974c4'),
    ('bank_transaction:20250106:f650bc2c830a'),
    ('bank_transaction:20250103:7fcab8783b4c'),
    ('bank_transaction:20250110:19a193578462'),
    ('hon_22d50084-2673-4b08-ae73-bbbe9d87284f_2025-01'),
    ('bank_transaction:20250115:e84bac21d81b'),
    ('bank_transaction:20250114:c9a2ec0c931e'),
    ('bank_transaction:20250110:9aaa67cf37d8'),
    ('bank_transaction:20250110:51d2acd809e3'),
    ('bank_transaction:20250103:3e006fc52e61'),
    ('bank_transaction:20250113:611a1998d1de'),
    ('bank_transaction:20250110:bce7ef6ac395'),
    ('bank_transaction:20250115:8ad04684ad72'),
    ('hon_cca5abc2-a34f-4a8c-86ee-f48dab227a91_2025-01'),
    ('hon_1f759ac5-a12f-4791-a9e1-773945260670_2025-01'),
    ('bank_transaction:20250110:c65c4711b5f1'),
    ('hon_7b1cafa1-6cfb-45c6-9bb7-c3cad5451f0b_2025-01'),
    ('bank_transaction:20250123:c22b795178ab'),
    ('bank_transaction:20250122:50a277085cb1'),
    ('bank_transaction:20250128:238af1669b12'),
    ('bank_transaction:20250131:e6ca317420a4'),
    ('bank_transaction:20250106:627e585fe9b2'),
    ('bank_transaction:20250106:413fed71368f'),
    ('bank_transaction:20250110:33bf8f2bda28'),
    ('hon_abfc96dc-e28f-4ee9-83ea-5f52d1049f21_2025-01'),
    ('bank_transaction:20250110:091f605e4726'),
    ('bank_transaction:20250115:2f521b679038'),
    ('hon_744c9872-be69-45f4-9c51-f60f581ac48c_2025-01'),
    ('hon_ae96ded5-e2dc-42c2-bdb1-4e3c5e0c2298_2025-01'),
    ('bank_transaction:20250110:ae3961166c6c'),
    ('bank_transaction:20250129:ab2945c9bbb7'),
    ('bank_transaction:20250115:3329c1fdf397'),
    ('hon_33faf6ea-f461-4223-9029-7183c6988987_2025-01'),
    ('bank_transaction:20250110:0f83fafb978c'),
    ('bank_transaction:20250115:6d0e9da4a13a'),
    ('hon_8545268d-d93e-42ea-99c0-4110f22f6929_2025-01'),
    ('bank_transaction:20250116:20a97076064f'),
    ('bank_transaction:20250108:3da43465b4ae'),
    ('hon_3ac184eb-2f6e-4b4b-891c-a4a1c63b4767_2025-01'),
    ('bank_transaction:20250128:2fa4b2916d1e'),
    ('bank_transaction:20250109:f432024c2388'),
    ('hon_41f72a96-f012-48b1-92d9-1587625973d0_2025-01'),
    ('bank_transaction:20250110:ae9da7cd46ef'),
    ('bank_transaction:20250110:9931db142ff6'),
    ('hon_5c1f28c9-212d-4038-ae1d-65ed06b0c617_2025-01'),
    ('hon_5bc57657-5577-4f21-b3d0-9ad1c3666a62_2025-01'),
    ('hon_1d8445bf-725d-4a01-a9a4-6196d14fd45b_2025-01'),
    ('bank_transaction:20250110:2549c3e56e19'),
    ('hon_8fe85a29-d159-43dd-8874-f85da9375e32_2025-01'),
    ('bank_transaction:20250130:b65fed85cc6c'),
    ('hon_18a91e2f-27e4-4478-bb28-021d6d9789ef_2025-01'),
    ('hon_f1b01a43-38b8-4521-94cf-6a2b6087c80e_2025-01'),
    ('bank_transaction:20250115:b3b936e59a0d'),
    ('bank_transaction:20250114:01629e219c3c'),
    ('hon_685657a9-adc3-4608-b234-8a884d5c25a3_2025-01'),
    ('bank_transaction:20250115:bb249a878245'),
    ('bank_transaction:20250110:e73647f28948'),
    ('bank_transaction:20250124:f9237102922b'),
    ('bank_transaction:20250120:a86ca396f8e5'),
    ('bank_transaction:20250121:1b57e7d90d57'),
    ('bank_transaction:20250106:e25d3de55cdb'),
    ('bank_transaction:20250115:28f06f0dc083'),
    ('bank_transaction:20250109:542a51fe8aa1'),
    ('bank_transaction:20250115:fa858120f70f'),
    ('bank_transaction:20250115:57a958146b9e'),
    ('hon_a8066e49-0a12-4f67-bd71-b7f2fce055a5_2025-01'),
    ('bank_transaction:20250115:3bcdcceb8c3f'),
    ('hon_ae6f5b9a-532b-4306-92cc-cb26950d5022_2025-01'),
    ('bank_transaction:20250130:b8e737e56dca'),
    ('hon_01247d35-327e-416f-b928-b85e64e8b070_2025-01'),
    ('hon_96c05bb8-2009-464b-a1c3-cfbdb22b8829_2025-01'),
    ('hon_8bc18c3e-7ad4-48ed-94d0-2639e9c0528b_2025-01'),
    ('hon_183d2e36-cf1a-4708-a656-1750a39e7f51_2025-01'),
    ('bank_transaction:20250115:45868d7e3d86'),
    ('hon_33b167c0-cf23-4b0c-b111-42085ce8bc69_2025-01'),
    ('hon_92e8e23a-a279-428f-9c74-8beb66ffa7af_2025-01'),
    ('bank_transaction:20250110:6a4fde9a2dc9'),
    ('bank_transaction:20250115:d0e93fe12f79'),
    ('bank_transaction:20250110:3c4dd994f179'),
    ('bank_transaction:20250115:1a7ef7f6f495'),
    ('hon_42c749f3-4346-42ba-8c26-32f6288af855_2025-01'),
    ('hon_0105c761-a740-49c5-a487-71a3123f6296_2025-01'),
    ('hon_fa58a22a-634b-491a-b45a-eaeca3fc4184_2025-01'),
    ('bank_transaction:20250110:37a6959fdbe4'),
    ('hon_86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8_2025-01'),
    ('hon_8d125b22-fa6d-4b86-bcc3-4795a60f2096_2025-01'),
    ('hon_f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09_2025-01'),
    ('hon_6883c0f7-70f2-43f7-9b5a-e5c7548d3aab_2025-01'),
    ('hon_597a27ec-471b-40f0-bd66-432063b5676a_2025-01'),
    ('hon_c3d76a06-a85e-4887-b53e-e3c01a5c7ece_2025-01'),
    ('hon_48fd6593-adec-447b-91db-9ad7847daaf5_2025-01'),
    ('hon_d3a203cf-1e94-476a-8e44-12e4112755dc_2025-01')
),
unbalanced AS (
  SELECT
    e.id,
    e.tenant_id,
    e.entry_date,
    e.description,
    e.reference_type,
    e.reference_id,
    SUM(l.debit) AS total_debit,
    SUM(l.credit) AS total_credit
  FROM accounting_entries e
  JOIN accounting_entry_lines l ON l.entry_id = e.id
  WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
    AND e.source_type = 'bank_transaction'
    AND e.internal_code IN (SELECT internal_code FROM target_codes)
  GROUP BY e.id
  HAVING ABS(SUM(l.debit) - SUM(l.credit)) > 0.01
),
lookup AS (
  SELECT
    u.*,
    bt.id AS bank_transaction_id,
    bt.transaction_date,
    bt.amount AS bank_amount,
    bt.description AS bank_description,
    bt.bank_account_id
  FROM unbalanced u
  LEFT JOIN bank_transactions bt
    ON bt.tenant_id = u.tenant_id
   AND (bt.id::text = u.reference_id::text OR bt.fitid = u.reference_id::text)
),
bank_account AS (
  SELECT
    l.id,
    ca.id AS bank_account_id
  FROM lookup l
  LEFT JOIN chart_of_accounts ca
    ON ca.code = '1.1.1.05' AND ca.tenant_id = l.tenant_id
),
base AS (
  SELECT
    l.id,
    l.tenant_id,
    COALESCE(l.transaction_date, l.entry_date) AS entry_date,
    COALESCE(l.bank_description, l.description) AS description,
    l.reference_type,
    l.reference_id,
    COALESCE(ABS(l.bank_amount), GREATEST(l.total_debit, l.total_credit)) AS amount,
    CASE
      WHEN l.bank_amount IS NOT NULL THEN (l.bank_amount > 0)
      ELSE (l.total_credit > l.total_debit)
    END AS is_credit,
    b.bank_account_id,
    COALESCE(
      MAX(CASE WHEN a.account_id <> b.bank_account_id THEN a.account_id::text END)::uuid,
      (SELECT id FROM chart_of_accounts
       WHERE tenant_id = l.tenant_id AND code = '1.1.9.99'
       LIMIT 1)
    ) AS counterpart_account_id
  FROM lookup l
  JOIN bank_account b ON b.id = l.id
  JOIN accounting_entry_lines a ON a.entry_id = l.id
  GROUP BY l.id, l.tenant_id, l.transaction_date, l.entry_date, l.bank_description, l.description,
           l.reference_type, l.reference_id, l.bank_amount, l.total_debit, l.total_credit, b.bank_account_id
),
inserted AS (
  INSERT INTO accounting_entries (
    id,
    tenant_id,
    entry_date,
    competence_date,
    description,
    internal_code,
    source_type,
    entry_type,
    reference_type,
    reference_id,
    total_debit,
    total_credit,
    balanced,
    created_at
  )
  SELECT
    gen_random_uuid(),
    b.tenant_id,
    b.entry_date,
    b.entry_date,
    'REPROCESSADO ' || COALESCE(b.description, b.id::text),
    'REPROC_BANK_' || b.id::text,
    'bank_transaction',
    CASE WHEN b.is_credit THEN 'recebimento' ELSE 'pagamento_despesa' END,
    b.reference_type,
    CASE WHEN b.reference_id::text ~ '^[0-9a-fA-F-]{36}$' THEN b.reference_id::uuid ELSE NULL END,
    b.amount,
    b.amount,
    true,
    NOW()
  FROM base b
  WHERE NOT EXISTS (
    SELECT 1 FROM accounting_entries e2
    WHERE e2.internal_code = 'REPROC_BANK_' || b.id::text
      AND e2.tenant_id = b.tenant_id
  )
  RETURNING id, internal_code, tenant_id
)
INSERT INTO accounting_entry_lines (
  id,
  tenant_id,
  entry_id,
  account_id,
  debit,
  credit,
  description,
  created_at
)
SELECT
  gen_random_uuid(),
  i.tenant_id,
  i.id,
  CASE WHEN b.is_credit THEN b.bank_account_id ELSE b.counterpart_account_id END,
  b.amount,
  0,
  'D - ' || CASE WHEN b.is_credit THEN 'Banco' ELSE 'Contrapartida' END,
  NOW()
FROM inserted i
JOIN base b ON ('REPROC_BANK_' || b.id::text) = i.internal_code

UNION ALL

SELECT
  gen_random_uuid(),
  i.tenant_id,
  i.id,
  CASE WHEN b.is_credit THEN b.counterpart_account_id ELSE b.bank_account_id END,
  0,
  b.amount,
  'C - ' || CASE WHEN b.is_credit THEN 'Contrapartida' ELSE 'Banco' END,
  NOW()
FROM inserted i
JOIN base b ON ('REPROC_BANK_' || b.id::text) = i.internal_code;

SET session_replication_role = 'origin';
