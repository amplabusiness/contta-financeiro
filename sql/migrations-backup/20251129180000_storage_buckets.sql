-- =====================================================
-- CONFIGURAÇÃO DE STORAGE PARA DOCUMENTOS
-- =====================================================

-- Criar bucket para contratos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false, -- Privado
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para distratos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'distracts',
  'distracts',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para documentos gerais
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- POLÍTICAS DE ACESSO AO STORAGE
-- =====================================================

-- Políticas para bucket contracts
CREATE POLICY "Authenticated users can read contracts" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can upload contracts" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Service role full access to contracts" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'contracts')
  WITH CHECK (bucket_id = 'contracts');

-- Políticas para bucket distracts
CREATE POLICY "Authenticated users can read distracts" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'distracts');

CREATE POLICY "Authenticated users can upload distracts" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'distracts');

CREATE POLICY "Service role full access to distracts" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'distracts')
  WITH CHECK (bucket_id = 'distracts');

-- Políticas para bucket documents
CREATE POLICY "Authenticated users can read documents" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Service role full access to documents" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- =====================================================
-- TABELA DE DOCUMENTOS ARMAZENADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS stored_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'contract', 'distract', 'invoice', 'expense'
  entity_id UUID NOT NULL,
  client_id UUID REFERENCES clients(id),

  -- Dados do arquivo
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'docx', 'png', etc
  file_size INTEGER,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,

  -- Metadados
  document_type TEXT, -- 'original', 'signed', 'attachment'
  description TEXT,

  -- Geração
  ai_generated BOOLEAN DEFAULT false,
  generation_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stored_documents_entity ON stored_documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_stored_documents_client ON stored_documents(client_id);

-- RLS
ALTER TABLE stored_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access stored_documents" ON stored_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON stored_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);
