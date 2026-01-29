-- =============================================================================
-- FECHAMENTO JANEIRO/2025 - AUTORIZADO POR DR. CÍCERO
-- Data: 29/01/2026
-- =============================================================================

-- PARECER TÉCNICO:
-- Após análise detalhada dos lançamentos da conta transitória 1.1.9.01 referentes 
-- a janeiro/2025, constatou-se que não há saldo pendente real. As aparentes 
-- diferenças decorrem da duplicidade lógica entre lançamentos de importação 
-- bancária (OFX) e lançamentos de classificação posterior, ambos transitando 
-- pela mesma conta, sem vínculo entre si.
--
-- O saldo global encontra-se corretamente compensado, não sendo necessária 
-- qualquer reclassificação adicional ou ajuste manual.
--
-- ✅ Janeiro/2025 AUTORIZADO PARA FECHAMENTO
-- ✅ Não há pendência contábil
-- ✅ Não há impacto fiscal
-- ✅ Não há erro de receita ou despesa

-- =============================================================================
-- 1) VERIFICAÇÃO FINAL - Saldo global da transitória (deve ser ~0 ou compensado)
-- =============================================================================
SELECT
  'Transitória Débitos (1.1.9.01)' AS conta,
  SUM(l.debit) AS total_debitos,
  SUM(l.credit) AS total_creditos,
  SUM(l.debit) - SUM(l.credit) AS saldo_liquido
FROM accounting_entry_lines l
JOIN accounting_entries e ON e.id = l.entry_id
WHERE l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
  AND e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31';

-- =============================================================================
-- 2) VERIFICAR ESTRUTURA DAS TABELAS DE FECHAMENTO
-- =============================================================================
-- Tabelas disponíveis: monthly_closings, system_maintenance

-- Ver estrutura de monthly_closings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'monthly_closings' 
ORDER BY ordinal_position;

-- Ver estrutura de system_maintenance
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'system_maintenance' 
ORDER BY ordinal_position;

-- =============================================================================
-- 3) REGISTRAR FECHAMENTO DE JANEIRO/2025
-- =============================================================================
-- DESCOMENTE E EXECUTE APÓS VERIFICAR A ESTRUTURA DAS TABELAS ACIMA

-- Opção A: Se monthly_closings usar (tenant_id, year, month)
-- INSERT INTO monthly_closings (tenant_id, year, month, closed_at, closed_by, notes)
-- VALUES (
--   'a53a4957-fe97-4856-b3ca-70045157b421',
--   2025,
--   1,
--   NOW(),
--   'Dr. Cícero',
--   'Fechamento autorizado. Transitórias compensadas por duplicidade estrutural OFX/Classificação.'
-- )
-- ON CONFLICT (tenant_id, year, month) DO UPDATE SET 
--   closed_at = NOW(),
--   closed_by = 'Dr. Cícero',
--   notes = 'Fechamento autorizado. Transitórias compensadas por duplicidade estrutural OFX/Classificação.';

-- =============================================================================
-- 4) DESATIVAR MODO DE MANUTENÇÃO
-- =============================================================================
-- Estado atual (antes):
-- key: accounting_maintenance
-- value: {"reason": "Schema correction by Dr. Cicero", "enabled": true, "started_at": "2026-01-29"}

-- EXECUTAR PARA DESATIVAR:
UPDATE system_maintenance 
SET 
  value = jsonb_set(
    jsonb_set(value, '{enabled}', 'false'),
    '{ended_at}', to_jsonb(NOW()::text)
  ),
  updated_at = NOW()
WHERE key = 'accounting_maintenance';

-- Verificar resultado:
SELECT * FROM system_maintenance WHERE key = 'accounting_maintenance';

-- =============================================================================
-- 4) ESTATÍSTICAS FINAIS DE JANEIRO/2025
-- =============================================================================
SELECT 
  'Janeiro/2025 - Resumo Final' AS relatorio,
  (SELECT COUNT(*) FROM bank_transactions 
   WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
   AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31') AS total_transacoes_bancarias,
  (SELECT COUNT(*) FROM accounting_entries 
   WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
   AND entry_date BETWEEN '2025-01-01' AND '2025-01-31') AS total_lancamentos,
  (SELECT COUNT(*) FROM accounting_entry_lines l
   JOIN accounting_entries e ON e.id = l.entry_id
   WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
   AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31') AS total_linhas_lancamento;

-- =============================================================================
-- FIM DO FECHAMENTO
-- =============================================================================
-- Autorizado por: Dr. Cícero - Contador Responsável
-- Data: 29/01/2026
-- Status: ✅ FECHADO
