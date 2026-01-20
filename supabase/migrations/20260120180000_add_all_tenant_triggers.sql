-- Add tenant_id triggers for ALL tables that have tenant_id column
-- This ensures tenant_id is automatically set on INSERT for multi-tenant isolation

-- This script dynamically finds all tables with tenant_id column and creates triggers

DO $$
DECLARE
    rec RECORD;
    trigger_name TEXT;
BEGIN
    -- Find all tables with tenant_id column in the public schema
    FOR rec IN
        SELECT DISTINCT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.table_schema = 'public'
        AND c.column_name = 'tenant_id'
        AND t.table_type = 'BASE TABLE'
        -- Exclude tables that should NOT have auto-tenant_id (like tenants itself, tenant_users, etc)
        AND c.table_name NOT IN ('tenants', 'tenant_users', 'tenant_features', 'profiles')
        ORDER BY c.table_name
    LOOP
        trigger_name := 'trg_set_tenant_' || rec.table_name;

        -- Drop existing trigger if exists (to avoid conflicts)
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, rec.table_name);
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors
            NULL;
        END;

        -- Create new trigger
        BEGIN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_auto_set_tenant_id()',
                trigger_name, rec.table_name
            );
            RAISE NOTICE 'Created trigger % on table %', trigger_name, rec.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to create trigger % on table %: %', trigger_name, rec.table_name, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- Also ensure the fn_auto_set_tenant_id function handles the case where get_my_tenant_id returns NULL gracefully
CREATE OR REPLACE FUNCTION "public"."fn_auto_set_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Se o tenant_id não foi enviado (está vazio), preenche com o ID do usuário logado
    IF NEW.tenant_id IS NULL THEN
        v_tenant_id := public.get_my_tenant_id();

        -- Se não conseguiu obter tenant_id, lança erro explicativo
        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Não foi possível determinar o tenant_id. Usuário pode não estar autenticado ou não vinculado a um tenant.';
        END IF;

        NEW.tenant_id := v_tenant_id;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_auto_set_tenant_id() IS
    'Trigger function that automatically sets tenant_id on INSERT if not provided. Uses get_my_tenant_id() to get the current user tenant. Raises an error if tenant cannot be determined.';
