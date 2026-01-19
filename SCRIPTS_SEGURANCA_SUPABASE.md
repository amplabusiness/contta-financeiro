# Scripts de Segurança Executados no Supabase SQL Editor

Este documento lista os scripts SQL que foram executados no editor do Supabase com o objetivo de aumentar a segurança do banco de dados.

---

## 1. Corrige a view de balanços de clientes
```sql
ALTER VIEW public.mv_client_balances SET (security_invoker = true);
```

## 2. Corrige a view de resumo padrão
```sql
ALTER VIEW public.mv_default_summary SET (security_invoker = true);
```

## 3. Corrige o "Function Search Path Mutable"
```sql
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Loop por todas as funções no esquema 'public' que não são do sistema
    FOR r IN
        SELECT p.oid::regprocedure as function_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        -- Executa o comando para fixar o search_path em 'public' e 'extensions'
        -- 'extensions' é adicionado caso você use plugins lá dentro.
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp;', r.function_signature);
    END LOOP;
END;
$$;
```

## 4. Remove acesso público (trata as views como tabelas para fins de permissão)
```sql
REVOKE ALL ON TABLE public.account_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_dashboard_kpis FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_dre_monthly FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_cash_flow FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_coa_balances FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_trial_balance FROM anon, authenticated;
```

## 5. Corrige "Extension in Public" (pg_net)
```sql
BEGIN;

-- 1. Garante que a pasta 'extensions' existe
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Remove a extensão da pasta errada (public)
-- Se houver erro de dependência aqui, pare e me avise.
DROP EXTENSION IF EXISTS pg_net;

-- 3. Instala novamente na pasta certa
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- 4. Garante as permissões de uso
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

COMMIT;
```

---

**Observação:** Todos os scripts acima foram aplicados para reforçar a segurança e o controle de acesso do banco de dados Supabase.
