-- Add missing tenant_id triggers for tables that have tenant_id column
-- This ensures tenant_id is automatically set on INSERT for multi-tenant isolation

-- Function already exists: fn_auto_set_tenant_id()
-- We just need to create the triggers for tables that don't have them

-- Use DO block to safely create triggers only for existing tables
DO $$
DECLARE
    tables_to_trigger TEXT[] := ARRAY[
        'accounting_office',
        'accounting_periods',
        'bank_accounts',
        'cash_flow_projections',
        'chart_of_accounts',
        'client_contacts',
        'client_contracts',
        'company_partners',
        'cost_centers',
        'debt_confessions',
        'economic_groups',
        'employees',
        'expense_categories',
        'expenses',
        'file_processing_queue',
        'minimum_wage_history',
        'negotiation_installments',
        'notifications_log',
        'recurring_expenses',
        'system_users',
        'tax_obligations',
        'user_roles'
    ];
    tbl TEXT;
    trigger_name TEXT;
BEGIN
    FOREACH tbl IN ARRAY tables_to_trigger
    LOOP
        trigger_name := 'trg_set_tenant_' || tbl;

        -- Check if table exists and has tenant_id column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = tbl
            AND column_name = 'tenant_id'
        ) THEN
            -- Drop existing trigger if exists, then create new one
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, tbl);
            EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_auto_set_tenant_id()', trigger_name, tbl);
            RAISE NOTICE 'Created trigger % on table %', trigger_name, tbl;
        ELSE
            RAISE NOTICE 'Skipping table % - does not exist or no tenant_id column', tbl;
        END IF;
    END LOOP;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.fn_auto_set_tenant_id() IS
  'Trigger function that automatically sets tenant_id on INSERT if not provided. Uses get_my_tenant_id() to get the current user tenant.';
