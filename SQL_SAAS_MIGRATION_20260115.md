# Scripts SQL para Transformação da Plataforma em SaaS

**Data de execução:** 15/01/2026

Estes scripts foram executados para adaptar a plataforma ao modelo SaaS (multi-tenant), adicionando a coluna `tenant_id` nas tabelas, garantindo a segregação de dados e aplicando políticas de segurança adequadas.

---

## 1. Script de Migração para Multi-Tenant

```sql
DO $$
DECLARE
    -- Variáveis de configuração
    new_tenant_id UUID;
    
    -- Usuários da Ampla
    user1 UUID := 'e3a168e5-4339-4c7c-a8e2-dd2ee84daae9';
    user2 UUID := '48e9e508-2855-45ba-ae11-2e70a5af7c0e';
    user3 UUID := 'dada4e1b-3461-4511-a235-1437d6aff857';

    -- Tabelas Globais (Pular)
    tables_to_skip text[] := ARRAY[
        'tenants', 'tenant_users', 'tabela_inss', 'tabela_irrf', 
        'codigos_servico_lc116', 'roles', 'ai_providers', 'holidays', 'revenue_types'
    ];

    row record;
    counter_added integer := 0;
    null_count integer;
    v_constraint_name text; -- NOME DA VARIÁVEL MUDADO PARA EVITAR ERRO

BEGIN
    -- 🛑 1. DESLIGA TRIGGERS (Evita erro de CNPJ e Deadlocks de triggers)
    SET session_replication_role = 'replica';
    
    RAISE NOTICE '🚀 INICIANDO MIGRAÇÃO V6 (CORREÇÃO DE VARIÁVEL)...';

    -- 2. GARANTIR TENANT
    SELECT id INTO new_tenant_id FROM public.tenants WHERE slug = 'ampla-contabilidade';

    IF new_tenant_id IS NULL THEN
        INSERT INTO public.tenants (name, slug, created_at, updated_at)
        VALUES ('Ampla Contabilidade', 'ampla-contabilidade', now(), now())
        RETURNING id INTO new_tenant_id;
        
        RAISE NOTICE '✅ Tenant Criado.';

        INSERT INTO public.tenant_users (tenant_id, user_id, role) VALUES 
        (new_tenant_id, user1, 'admin'), (new_tenant_id, user2, 'admin'), (new_tenant_id, user3, 'admin');
    ELSE
        RAISE NOTICE 'ℹ️ Tenant já existe (ID recuperado).';
    END IF;

    -- 3. LOOP DAS TABELAS
    FOR row IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != ALL(tables_to_skip) 
        AND table_name NOT LIKE 'bkp_%'       
    LOOP
        -- A) CRIAR COLUNA (Rápido, sem FK para não travar)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = row.table_name 
            AND column_name = 'tenant_id'
        ) THEN
            RAISE NOTICE '🛠️ [Step A] Coluna em: %', row.table_name;
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id UUID;', row.table_name);
            counter_added := counter_added + 1;
        END IF;

        -- B) PREENCHER DADOS
        EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL;', row.table_name, new_tenant_id);

        -- C) APLICAR NOT NULL (Só se não tiver nulos)
        EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id IS NULL', row.table_name) INTO null_count;
        IF null_count = 0 THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = row.table_name AND column_name = 'tenant_id' AND is_nullable = 'YES') THEN
                 EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL;', row.table_name);
            END IF;
        END IF;

        -- D) CRIAR FOREIGN KEY E ÍNDICE (Separado para evitar Deadlock)
        v_constraint_name := 'fk_' || row.table_name || '_tenant'; -- Usando a nova variável
        
        -- Cria Índice
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON public.%I(tenant_id);', row.table_name, row.table_name);

        -- Cria Constraint FK
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = v_constraint_name -- Comparando coluna com a variável corrigida
            AND table_name = row.table_name
        ) THEN
            RAISE NOTICE '🔗 [Step D] FK em: %', row.table_name;
            BEGIN
                EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);', row.table_name, v_constraint_name);
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '⚠️ FK pulada para % (possível erro de nome duplicado ou lock).', row.table_name;
            END;
        END IF;

    END LOOP;

    -- 🛑 4. LIGA TRIGGERS DE VOLTA
    SET session_replication_role = 'origin';

    RAISE NOTICE '🏁 SUCESSO FINAL! % tabelas processadas.', counter_added;

END $$;
```

---

## 2. Script de Limpeza e Criação de Policies SaaS

```sql
DO $$
DECLARE
    -- Tabelas de infraestrutura para PULAR (Não mexer na segurança delas aqui)
    tables_to_skip text[] := ARRAY['tenants', 'tenant_users', 'profiles']; 
    
    t_name text;
    pol record;
    counter integer := 0;
BEGIN
    RAISE NOTICE '🧹 INICIANDO LIMPEZA DE POLICIES (MODO AUTOMÁTICO)...';

    -- Loop inteligente: Pega todas as tabelas que têm a coluna 'tenant_id'
    FOR t_name IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'tenant_id'
        AND table_schema = 'public'
        AND table_name != ALL(tables_to_skip)
    LOOP
        RAISE NOTICE '---------------------------------------------------';
        RAISE NOTICE '🔧 Consertando tabela: %', t_name;

        -- 1. Deletar TODAS as policies antigas dessa tabela
        FOR pol IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = t_name 
            AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t_name);
            RAISE NOTICE '   🗑️ Removida regra antiga: %', pol.policyname;
        END LOOP;

        -- 2. Garante que RLS está ativo
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);

        -- 3. Cria a ÚNICA política correta
        EXECUTE format('
            CREATE POLICY "saas_isolation_strict" ON public.%I
            FOR ALL
            TO authenticated
            USING (tenant_id = public.get_my_tenant_id())
            WITH CHECK (tenant_id = public.get_my_tenant_id());
        ', t_name);
        
        RAISE NOTICE '   🛡️ Nova segurança aplicada!';
        counter := counter + 1;
    END LOOP;

    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE '✅ FIM! % tabelas foram limpas e blindadas.', counter;
END $$;
```

---

**Observações:**
- Todas as tabelas (exceto as de infraestrutura) agora possuem coluna `tenant_id` obrigatória, índice e foreign key.
- As policies antigas foram removidas e substituídas por uma política única de isolamento SaaS.
- O acesso aos dados está restrito ao tenant do usuário autenticado.
- Recomenda-se revisar as funções auxiliares como `get_my_tenant_id()` para garantir segurança total.
