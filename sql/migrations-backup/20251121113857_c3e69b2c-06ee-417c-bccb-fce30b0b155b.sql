-- =====================================================
-- Adicionar RLS Policies para Storage Buckets
-- =====================================================

-- Políticas para bucket 'bank-statements'
CREATE POLICY "Users can view own bank statements"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bank-statements' AND
  (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users can upload bank statements"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bank-statements' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own bank statements"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'bank-statements' AND
  (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users can delete own bank statements"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bank-statements' AND
  (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
);

-- Políticas para bucket 'boleto-reports'
CREATE POLICY "Users can view own boleto reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'boleto-reports' AND
  (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users can upload boleto reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'boleto-reports' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own boleto reports"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'boleto-reports' AND
  (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users can delete own boleto reports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'boleto-reports' AND
  (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
);