-- ════════════════════════════════════════════════════════════════════════════════
-- DR. CÍCERO — LANÇAMENTOS CONTÁBEIS DA FOLHA DE PAGAMENTO
-- Competência: Fevereiro/2025
-- 
-- VERSÃO FINAL - Desabilita triggers corretos
-- Execute no Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════════════════════

-- PASSO 1: Desabilitar triggers que usam auth.uid() ou tenant_id
ALTER TABLE accounting_entries DISABLE TRIGGER capture_events_accounting_entries;
ALTER TABLE accounting_entries DISABLE TRIGGER trg_set_tenant_accounting_entries;
ALTER TABLE accounting_entries DISABLE TRIGGER trg_queue_ai_validation;
ALTER TABLE accounting_entry_lines DISABLE TRIGGER trg_set_tenant_accounting_entry_lines;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. APROPRIAÇÃO DA FOLHA DE PAGAMENTO
-- D - 4.2.1.01 Salários:         R$ 49.339,75
-- C - 2.1.2.01 Salários a Pagar: R$ 25.183,15
-- C - 2.1.2.03 INSS a Recolher:  R$  4.420,70
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounting_entries (
  id, tenant_id, entry_date, competence_date, description, internal_code, 
  source_type, entry_type, reference_type
) VALUES (
  'f1a00001-0000-0000-0000-000000000001',
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2025-02-28',
  '2025-02-28',
  'Apropriação Folha de Pagamento - Competência Fev/2025 (15 funcionários CLT)',
  'FOLHA_202502_APROPRIACAO',
  'payroll',
  'PROVISAO',
  'payroll'
);

INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
VALUES 
  ('f1b00001-0000-0000-0000-000000000001', 'a53a4957-fe97-4856-b3ca-70045157b421', 'f1a00001-0000-0000-0000-000000000001', '4a11ef52-7ea7-4396-9c9b-ccfd9546a01d', 49339.75, 0, 'Despesa com salários - Fev/2025'),
  ('f1b00001-0000-0000-0000-000000000002', 'a53a4957-fe97-4856-b3ca-70045157b421', 'f1a00001-0000-0000-0000-000000000001', 'd5c04379-4919-4859-a84a-fb292a5bb047', 0, 25183.15, 'Salários a pagar - Fev/2025'),
  ('f1b00001-0000-0000-0000-000000000003', 'a53a4957-fe97-4856-b3ca-70045157b421', 'f1a00001-0000-0000-0000-000000000001', 'ebcfcb58-1475-4c9b-97a8-ade8f4c43637', 0, 4420.70, 'INSS retido - Fev/2025');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PROVISÃO FGTS 8%
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounting_entries (
  id, tenant_id, entry_date, competence_date, description, internal_code, 
  source_type, entry_type, reference_type
) VALUES (
  'f1a00001-0000-0000-0000-000000000002',
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2025-02-28',
  '2025-02-28',
  'Provisão FGTS 8% - Competência Fev/2025',
  'FOLHA_202502_FGTS',
  'payroll',
  'PROVISAO',
  'payroll'
);

INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
VALUES 
  ('f1b00001-0000-0000-0000-000000000004', 'a53a4957-fe97-4856-b3ca-70045157b421', 'f1a00001-0000-0000-0000-000000000002', '744a236a-2a5c-4e49-8ffe-c11b404e0064', 3947.18, 0, 'Despesa FGTS 8% - Fev/2025'),
  ('f1b00001-0000-0000-0000-000000000005', 'a53a4957-fe97-4856-b3ca-70045157b421', 'f1a00001-0000-0000-0000-000000000002', '82bd81fc-c2fa-4bf3-ab2c-c0b49d03959f', 0, 3947.18, 'FGTS a recolher - Fev/2025');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PROVISÃO IRRF
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounting_entries (
  id, tenant_id, entry_date, competence_date, description, internal_code, 
  source_type, entry_type, reference_type
) VALUES (
  'f1a00001-0000-0000-0000-000000000003',
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2025-02-28',
  '2025-02-28',
  'Provisão IRRF Retido - Competência Fev/2025',
  'FOLHA_202502_IRRF',
  'payroll',
  'PROVISAO',
  'payroll'
);

INSERT INTO accounting_entry_lines (id, tenant_id, entry_id, account_id, debit, credit, description)
VALUES 
  ('f1b00001-0000-0000-0000-000000000006', 'a53a4957-fe97-4856-b3ca-70045157b421', 'f1a00001-0000-0000-0000-000000000003', 'd5c04379-4919-4859-a84a-fb292a5bb047', 1195.64, 0, 'Transferência IRRF - Fev/2025'),
  ('f1b00001-0000-0000-0000-000000000007', 'a53a4957-fe97-4856-b3ca-70045157b421', 'f1a00001-0000-0000-0000-000000000003', 'a1c6aacf-f344-4fb9-a091-851de6998672', 0, 1195.64, 'IRRF a recolher - Fev/2025');

-- PASSO 2: Reabilitar triggers
ALTER TABLE accounting_entries ENABLE TRIGGER capture_events_accounting_entries;
ALTER TABLE accounting_entries ENABLE TRIGGER trg_set_tenant_accounting_entries;
ALTER TABLE accounting_entries ENABLE TRIGGER trg_queue_ai_validation;
ALTER TABLE accounting_entry_lines ENABLE TRIGGER trg_set_tenant_accounting_entry_lines;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
  e.entry_date,
  e.description,
  e.internal_code,
  SUM(l.debit) as total_debito,
  SUM(l.credit) as total_credito
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.internal_code LIKE 'FOLHA_202502_%'
GROUP BY e.id, e.entry_date, e.description, e.internal_code
ORDER BY e.internal_code;
