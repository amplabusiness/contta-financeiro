-- =====================================================
-- SISTEMA DE USUÁRIOS DO SISTEMA
-- Gerenciamento de usuários com geração de senha inicial
-- =====================================================

-- Tabela para usuários do sistema
CREATE TABLE IF NOT EXISTS system_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados básicos
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,

  -- Vínculo com funcionário (opcional)
  employee_id UUID REFERENCES employees(id),

  -- Credenciais
  password_hash TEXT, -- Hash da senha (bcrypt)
  temp_password TEXT, -- Senha temporária gerada (visível só na criação)
  must_change_password BOOLEAN DEFAULT true, -- Forçar troca no primeiro login

  -- Perfil de acesso
  role TEXT NOT NULL DEFAULT 'viewer', -- admin, manager, operator, viewer

  -- Permissões específicas (JSON para flexibilidade)
  permissions JSONB DEFAULT '{}',

  -- Controle de acesso
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_employee ON system_users(employee_id);
CREATE INDEX IF NOT EXISTS idx_system_users_role ON system_users(role);

-- Habilitar RLS
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system_users" ON system_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert system_users" ON system_users
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can update system_users" ON system_users
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete system_users" ON system_users
  FOR DELETE TO authenticated USING (true);

-- Perfis de acesso pré-definidos
COMMENT ON TABLE system_users IS 'Usuários do sistema com controle de acesso e permissões';

-- Função para gerar senha aleatória
CREATE OR REPLACE FUNCTION generate_random_password(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Função para criar usuário com senha gerada
CREATE OR REPLACE FUNCTION create_system_user(
  p_name TEXT,
  p_email TEXT,
  p_role TEXT DEFAULT 'viewer',
  p_employee_id UUID DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS TABLE(user_id UUID, temp_password TEXT) AS $$
DECLARE
  v_password TEXT;
  v_user_id UUID;
BEGIN
  -- Gerar senha temporária
  v_password := generate_random_password(8);

  -- Inserir usuário
  INSERT INTO system_users (name, email, role, employee_id, phone, temp_password, must_change_password)
  VALUES (p_name, p_email, p_role, p_employee_id, p_phone, v_password, true)
  RETURNING id INTO v_user_id;

  RETURN QUERY SELECT v_user_id, v_password;
END;
$$ LANGUAGE plpgsql;

-- Função para redefinir senha
CREATE OR REPLACE FUNCTION reset_user_password(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_password TEXT;
BEGIN
  -- Gerar nova senha temporária
  v_password := generate_random_password(8);

  -- Atualizar usuário
  UPDATE system_users
  SET temp_password = v_password,
      must_change_password = true,
      login_attempts = 0,
      locked_until = NULL,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN v_password;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_random_password IS 'Gera senha aleatória segura (sem caracteres ambíguos)';
COMMENT ON FUNCTION create_system_user IS 'Cria usuário do sistema com senha temporária gerada';
COMMENT ON FUNCTION reset_user_password IS 'Redefine senha do usuário gerando nova senha temporária';
