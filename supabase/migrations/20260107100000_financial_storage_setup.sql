-- =====================================================
-- STORAGE SETUP FOR FINANCIAL IMPORTS (ELT ARCHITECTURE)
-- =====================================================

-- 1. Create Buckets
-- Bucket for Bank Statements (OFX, CSV)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financial-statements',
  'financial-statements',
  false,
  20971520, -- 20MB
  ARRAY['text/csv', 'application/x-ofx', 'text/plain', 'application/vnd.ms-excel']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Bucket for Client Receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-receipts',
  'client-receipts',
  false,
  52428800, -- 50MB
  ARRAY['text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
ON CONFLICT (id) DO NOTHING;


-- 2. Create Tracking Table for Imports
CREATE TABLE IF NOT EXISTS public.import_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'OFX', 'CSV_EXTRATO', 'CSV_CLIENTES'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    uploaded_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMPTZ,
    error_log TEXT,
    processing_metadata JSONB DEFAULT '{}'::jsonb, -- Store details like target_bank_account_id
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies for Storage
-- Financial Statements Policies
DROP POLICY IF EXISTS "Authenticated users can read financial-statements" ON storage.objects;
CREATE POLICY "Authenticated users can read financial-statements" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'financial-statements');

DROP POLICY IF EXISTS "Authenticated users can upload financial-statements" ON storage.objects;
CREATE POLICY "Authenticated users can upload financial-statements" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'financial-statements');

DROP POLICY IF EXISTS "Authenticated users can update financial-statements" ON storage.objects;
CREATE POLICY "Authenticated users can update financial-statements" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'financial-statements');

-- Client Receipts Policies
DROP POLICY IF EXISTS "Authenticated users can read client-receipts" ON storage.objects;
CREATE POLICY "Authenticated users can read client-receipts" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'client-receipts');

DROP POLICY IF EXISTS "Authenticated users can upload client-receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload client-receipts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-receipts');

-- 4. RLS Policies for Tracking Table
ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own imports or admins" ON public.import_files;
CREATE POLICY "Users can view their own imports or admins" ON public.import_files
    FOR SELECT TO authenticated
    USING (true); -- Relaxed for now to allow team visibility, or restrict to auth.uid() = uploaded_by

DROP POLICY IF EXISTS "Users can insert import logs" ON public.import_files;
CREATE POLICY "Users can insert import logs" ON public.import_files
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "System/Users can update import logs" ON public.import_files;
CREATE POLICY "System/Users can update import logs" ON public.import_files
    FOR UPDATE TO authenticated
    USING (true);

-- 5. Trigger for updated_at
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

DROP TRIGGER IF EXISTS handle_updated_at_import_files ON public.import_files;
CREATE TRIGGER handle_updated_at_import_files
    BEFORE UPDATE ON public.import_files
    FOR EACH ROW
    EXECUTE PROCEDURE extensions.moddatetime(updated_at);
