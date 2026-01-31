-- ============================================================================
-- CORRIGIR SEARCH_PATH EM TODAS AS FUNÇÕES (DINÂMICO)
-- ============================================================================
-- Este script descobre automaticamente as assinaturas corretas das funções
-- e aplica search_path = public para prevenir SQL injection
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    alter_sql TEXT;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Loop por todas as funções do schema public que não têm search_path definido
    FOR func_record IN
        SELECT 
            p.oid,
            p.proname as func_name,
            pg_catalog.pg_get_function_identity_arguments(p.oid) as func_args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)))
        ORDER BY p.proname
    LOOP
        -- Construir o comando ALTER FUNCTION com a assinatura correta
        alter_sql := format(
            'ALTER FUNCTION public.%I(%s) SET search_path = public',
            func_record.func_name,
            func_record.func_args
        );
        
        BEGIN
            EXECUTE alter_sql;
            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING 'Erro ao alterar função %: %', func_record.func_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'RESULTADO: % funções corrigidas, % erros', success_count, error_count;
    RAISE NOTICE '==============================================';
END $$;

-- ============================================================================
-- VERIFICAR RESULTADO
-- ============================================================================

SELECT 
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN p.proconfig IS NULL THEN '❌ NOT SET'
        WHEN 'search_path=public' = ANY(p.proconfig) THEN '✅ OK'
        ELSE '⚠️ ' || array_to_string(p.proconfig, ', ')
    END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY 
    CASE WHEN p.proconfig IS NULL THEN 0 
         WHEN 'search_path=public' = ANY(p.proconfig) THEN 2
         ELSE 1 END,
    p.proname;
