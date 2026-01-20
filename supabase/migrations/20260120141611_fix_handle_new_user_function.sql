-- Fix handle_new_user function to include full_name in profiles insert
-- The profiles table requires full_name NOT NULL

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
    new_tenant_id UUID;
    company_name TEXT;
    user_full_name TEXT;
BEGIN
    -- 1. Define nomes (usa metadados ou fallback para email)
    company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Empresa de ' || NEW.email);
    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

    -- 2. Cria a Empresa (Tenant)
    INSERT INTO public.tenants (name, slug, created_at, updated_at)
    VALUES (
        company_name,
        lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || floor(random() * 1000)::text,
        now(),
        now()
    )
    RETURNING id INTO new_tenant_id;

    -- 3. Vincula na tabela tenant_users (Permissao SaaS)
    INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
    VALUES (new_tenant_id, NEW.id, 'admin', true);

    -- 4. Cria o Perfil Publico (incluindo full_name que e NOT NULL)
    INSERT INTO public.profiles (id, email, full_name, tenant_id)
    VALUES (NEW.id, NEW.email, user_full_name, new_tenant_id)
    ON CONFLICT (id) DO UPDATE SET tenant_id = new_tenant_id, full_name = user_full_name;

    -- 5. Preenche user_roles (Legado/Compatibilidade)
    INSERT INTO public.user_roles (user_id, role, tenant_id, created_by)
    VALUES (NEW.id, 'admin', new_tenant_id, NEW.id)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Erro no cadastro: %', SQLERRM;
    RETURN NEW; -- Permite que o usuario seja criado mesmo se o trigger falhar
END;
$$;
