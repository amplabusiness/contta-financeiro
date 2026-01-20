-- =====================================================
-- PERMISSÕES DE USUÁRIO POR ESCRITÓRIO (MULTI-TENANT)
-- Cada usuário pode ter acesso a um ou mais escritórios
-- =====================================================

-- Tabela de vínculo usuário-escritório
CREATE TABLE IF NOT EXISTS user_office_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES accounting_office(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'manager', 'user', 'viewer'
  is_default BOOLEAN DEFAULT false, -- Escritório padrão ao logar
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Um usuário só pode ter um vínculo por escritório
  UNIQUE(user_id, office_id)
);

-- Habilitar RLS
ALTER TABLE user_office_access ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view their own office access" ON user_office_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage office access" ON user_office_access
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_office_access uoa
      WHERE uoa.user_id = auth.uid()
      AND uoa.office_id = user_office_access.office_id
      AND uoa.role = 'admin'
    )
  );

-- Função para obter escritórios do usuário logado
CREATE OR REPLACE FUNCTION get_user_offices()
RETURNS TABLE (
  office_id UUID,
  office_name TEXT,
  role TEXT,
  is_default BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ao.id as office_id,
    COALESCE(ao.nome_fantasia, ao.razao_social) as office_name,
    uoa.role,
    uoa.is_default
  FROM user_office_access uoa
  JOIN accounting_office ao ON ao.id = uoa.office_id
  WHERE uoa.user_id = auth.uid()
  AND ao.is_active = true
  ORDER BY uoa.is_default DESC, ao.nome_fantasia;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se o usuário tem acesso a um escritório específico
CREATE OR REPLACE FUNCTION user_has_office_access(p_office_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_office_access
    WHERE user_id = auth.uid()
    AND office_id = p_office_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar acesso automático ao primeiro usuário (admin) para todos os escritórios existentes
-- Isso é útil para migração - depois pode ser ajustado manualmente
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Pegar o primeiro usuário do sistema
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  -- Se existe um usuário, dar acesso admin a todos os escritórios
  IF first_user_id IS NOT NULL THEN
    INSERT INTO user_office_access (user_id, office_id, role, is_default)
    SELECT
      first_user_id,
      ao.id,
      'admin',
      (ROW_NUMBER() OVER (ORDER BY ao.created_at)) = 1 -- Primeiro é o default
    FROM accounting_office ao
    WHERE ao.is_active = true
    ON CONFLICT (user_id, office_id) DO NOTHING;
  END IF;
END
$$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_office_access_user ON user_office_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_office_access_office ON user_office_access(office_id);

COMMENT ON TABLE user_office_access IS 'Controle de acesso de usuários aos escritórios contábeis (multi-tenant)';
COMMENT ON COLUMN user_office_access.role IS 'Papel do usuário: admin (tudo), manager (gerencia), user (opera), viewer (apenas visualiza)';
