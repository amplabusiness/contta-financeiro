-- Adicionar campo de cor na tabela economic_groups
ALTER TABLE economic_groups ADD COLUMN IF NOT EXISTS group_color TEXT;