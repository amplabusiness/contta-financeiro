-- Add UPDATE policy for tenants table
-- Allows authenticated users to update their own tenant (for onboarding completion)

-- Create policy to allow tenant admins to update their tenant
CREATE POLICY "tenant_admin_update_own_tenant" ON "public"."tenants"
FOR UPDATE TO "authenticated"
USING (
    "id" IN (
        SELECT "tenant_users"."tenant_id"
        FROM "public"."tenant_users"
        WHERE "tenant_users"."user_id" = auth.uid()
        AND "tenant_users"."is_active" = true
    )
)
WITH CHECK (
    "id" IN (
        SELECT "tenant_users"."tenant_id"
        FROM "public"."tenant_users"
        WHERE "tenant_users"."user_id" = auth.uid()
        AND "tenant_users"."is_active" = true
    )
);

-- Add comment for documentation
COMMENT ON POLICY "tenant_admin_update_own_tenant" ON "public"."tenants" IS
    'Permite que usuários autenticados atualizem seu próprio tenant (ex: marcar onboarding como completo)';
