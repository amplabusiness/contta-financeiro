-- ================================================
-- FIX: Ajustar RLS das tabelas de grupos econômicos
-- Permitir acesso público às tabelas economic_groups e economic_group_members
-- ================================================

-- 1. Remover políticas RLS antigas de economic_groups
DROP POLICY IF EXISTS "Admins and accountants can view economic groups" ON economic_groups;
DROP POLICY IF EXISTS "Admins and accountants can create economic groups" ON economic_groups;
DROP POLICY IF EXISTS "Admins and accountants can update economic groups" ON economic_groups;
DROP POLICY IF EXISTS "Admins can delete economic groups" ON economic_groups;

-- 2. Remover políticas RLS antigas de economic_group_members
DROP POLICY IF EXISTS "Admins and accountants can view group members" ON economic_group_members;
DROP POLICY IF EXISTS "Admins and accountants can create group members" ON economic_group_members;
DROP POLICY IF EXISTS "Admins and accountants can update group members" ON economic_group_members;
DROP POLICY IF EXISTS "Admins can delete group members" ON economic_group_members;

-- 3. Criar políticas públicas para economic_groups
CREATE POLICY "Allow public read access to economic_groups"
ON economic_groups FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to economic_groups"
ON economic_groups FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to economic_groups"
ON economic_groups FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete to economic_groups"
ON economic_groups FOR DELETE
USING (true);

-- 4. Criar políticas públicas para economic_group_members
CREATE POLICY "Allow public read access to economic_group_members"
ON economic_group_members FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to economic_group_members"
ON economic_group_members FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to economic_group_members"
ON economic_group_members FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete to economic_group_members"
ON economic_group_members FOR DELETE
USING (true);

-- 5. Permitir created_by como NULL (para inserções públicas)
ALTER TABLE economic_groups ALTER COLUMN created_by DROP NOT NULL;
