-- ============================================================================
-- DESABILITAR RLS EM TABELAS DE BACKUP HISTÓRICO
-- ============================================================================
-- Aprovado por: Dr. Cícero - Contador Responsável
-- Data: 31/01/2026
-- 
-- Justificativa Técnica:
-- "As tabelas de backup histórico não fazem parte do runtime operacional 
-- (API/Frontend/Jobs). O RLS foi desabilitado por não haver acesso via API 
-- ou frontend, não caracterizando risco de segurança. Preserva-se a evidência 
-- histórica para compliance e perícia."
-- ============================================================================

-- Desabilitar RLS nas tabelas de backup da auditoria de Janeiro/2025
ALTER TABLE public.bkp_20260106_accounting_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_accounting_entry_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_bank_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_chart_of_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_20260106_suppliers DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICAR RESULTADO
-- ============================================================================

SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN '⚠️ RLS Ativo' ELSE '✅ RLS Desabilitado' END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'bkp_%'
ORDER BY tablename;

-- ============================================================================
-- PARECER TÉCNICO (para registro)
-- ============================================================================
-- 
-- PROTOCOLO: AUD-202501-ML1AZROS
-- AÇÃO: Desabilitação de RLS em tabelas de backup
-- MOTIVO: Tabelas históricas de auditoria, sem acesso via API/Frontend
-- APROVADO POR: Dr. Cícero - Contador Responsável
-- DATA: 31/01/2026
--
-- As mensagens INFO remanescentes no Security Advisor referem-se 
-- exclusivamente a tabelas de backup histórico, fora do escopo operacional
-- do sistema. O RLS foi desabilitado por não haver acesso via API ou 
-- frontend, não caracterizando risco de segurança.
--
-- ============================================================================
