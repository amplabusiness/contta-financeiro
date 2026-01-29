-- =============================================================================
-- LIMPEZA AUTORIZADA - Dr. Cícero
-- Data: 2026-01-29
-- =============================================================================
-- Este script deve ser executado no SQL Editor do Supabase Dashboard
-- =============================================================================

-- PASSO 0: LISTAR TRIGGERS DA TABELA (para diagnóstico)
SELECT tgname as trigger_name, tgenabled as enabled
FROM pg_trigger 
WHERE tgrelid = 'accounting_entries'::regclass
AND NOT tgisinternal;  -- Exclui triggers de sistema

-- PASSO 0B: DESABILITAR TRIGGERS DE USUÁRIO TEMPORARIAMENTE
-- (USER = apenas triggers criados pelo usuário, não sistema/constraints)
ALTER TABLE accounting_entries DISABLE TRIGGER USER;

-- PASSO 1: Verificar órfãos antes de deletar
SELECT 
    'ANTES DA LIMPEZA' as fase,
    (SELECT COUNT(*) FROM accounting_entries WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421') as total_entries,
    (SELECT COUNT(*) FROM accounting_entry_lines WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421') as total_lines,
    (
        SELECT COUNT(*) FROM accounting_entries e
        WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
        AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines l WHERE l.entry_id = e.id)
    ) as orphan_entries;

-- PASSO 2: DELETAR ENTRIES ÓRFÃOS
-- (Entries sem linhas, com mais de 1 hora de criação)
DELETE FROM accounting_entries e
WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND NOT EXISTS (
    SELECT 1 FROM accounting_entry_lines l WHERE l.entry_id = e.id
)
AND e.created_at < NOW() - INTERVAL '1 hour';

-- PASSO 3: PREENCHER INTERNAL_CODES FALTANTES
-- Formato: LEGACY:YYYYMMDD:uuid8
UPDATE accounting_entries
SET internal_code = 
    COALESCE(
        UPPER(COALESCE(source_type, reference_type, entry_type, 'LEGACY')),
        'LEGACY'
    ) 
    || ':' 
    || TO_CHAR(COALESCE(entry_date, created_at::date), 'YYYYMMDD') 
    || ':' 
    || SUBSTRING(id::text, 1, 8)
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
AND (internal_code IS NULL OR internal_code = '');

-- PASSO 4: Verificar resultado após limpeza
SELECT 
    'DEPOIS DA LIMPEZA' as fase,
    (SELECT COUNT(*) FROM accounting_entries WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421') as total_entries,
    (SELECT COUNT(*) FROM accounting_entry_lines WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421') as total_lines,
    (
        SELECT COUNT(*) FROM accounting_entries e
        WHERE e.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
        AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines l WHERE l.entry_id = e.id)
    ) as orphan_entries,
    (
        SELECT COUNT(*) FROM accounting_entries
        WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
        AND (internal_code IS NULL OR internal_code = '')
    ) as missing_internal_code;

-- PASSO 5: Verificar integridade via RPC
SELECT rpc_check_accounting_integrity('a53a4957-fe97-4856-b3ca-70045157b421'::uuid);

-- PASSO 6: Verificar saldo das transitórias
SELECT * FROM vw_transitory_balances;

-- PASSO 7: REABILITAR TRIGGERS DE USUÁRIO (OBRIGATÓRIO!)
-- ⚠️ NÃO ESQUEÇA ESTE PASSO!
ALTER TABLE accounting_entries ENABLE TRIGGER USER;

-- CONFIRMAR
SELECT 'LIMPEZA CONCLUÍDA COM SUCESSO - Dr. Cícero' as status,
       'Todos os triggers REATIVADOS' as seguranca;
