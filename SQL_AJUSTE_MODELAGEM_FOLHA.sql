-- ════════════════════════════════════════════════════════════════════════════════
-- DR. CÍCERO — AJUSTE MODELAGEM CONTÁBIL FOLHA FEV/2025
-- Modelo profissional com separação completa dos passivos
-- ════════════════════════════════════════════════════════════════════════════════

-- PASSO 1: Criar conta 2.1.2.09 - Outros Descontos a Recolher
INSERT INTO chart_of_accounts (
  id, tenant_id, code, name, type, account_type, is_analytical, is_active, parent_id
) VALUES (
  'f2c09000-0000-0000-0000-000000000001',
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2.1.2.09',
  'Outros Descontos a Recolher',
  'PASSIVO',
  'PASSIVO_CIRCULANTE',
  true,
  true,
  (SELECT id FROM chart_of_accounts WHERE code = '2.1.2' AND tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421')
);

-- PASSO 2: Desabilitar triggers
ALTER TABLE accounting_entry_lines DISABLE TRIGGER trg_set_tenant_accounting_entry_lines;

-- PASSO 3: Ajustar a linha de Salários a Pagar para o valor líquido correto
UPDATE accounting_entry_lines 
SET credit = 23987.51,
    description = 'Salários líquidos a pagar - Fev/2025'
WHERE id = 'f1b00001-0000-0000-0000-000000000002'
  AND tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';

-- PASSO 4: Adicionar linha de IRRF na apropriação (já está no lançamento separado, mas aqui faz mais sentido contabilmente)
-- Como já existe lançamento separado de IRRF, vamos adicionar a linha de Outros Descontos

-- PASSO 5: Adicionar linha de Outros Descontos a Recolher
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'f1b00001-0000-0000-0000-000000000008',
  'a53a4957-fe97-4856-b3ca-70045157b421',
  'f1a00001-0000-0000-0000-000000000001',
  'f2c09000-0000-0000-0000-000000000001',  -- 2.1.2.09 Outros Descontos
  0,
  19735.90,
  'VT, VA, empréstimos consignados - Fev/2025'
);

-- PASSO 6: Reabilitar triggers
ALTER TABLE accounting_entry_lines ENABLE TRIGGER trg_set_tenant_accounting_entry_lines;

-- PASSO 7: Verificar balanceamento
SELECT 
  e.internal_code,
  e.description,
  SUM(l.debit) as total_debito,
  SUM(l.credit) as total_credito,
  CASE WHEN ABS(SUM(l.debit) - SUM(l.credit)) < 0.01 THEN '✓ BALANCEADO' ELSE '✗ ERRO' END as status
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.internal_code LIKE 'FOLHA_202502_%'
GROUP BY e.id, e.internal_code, e.description
ORDER BY e.internal_code;

-- PASSO 8: Verificar detalhamento da apropriação
SELECT 
  c.code,
  c.name,
  l.debit,
  l.credit,
  l.description
FROM accounting_entry_lines l
JOIN chart_of_accounts c ON c.id = l.account_id
WHERE l.entry_id = 'f1a00001-0000-0000-0000-000000000001'
ORDER BY l.debit DESC, l.credit DESC;
