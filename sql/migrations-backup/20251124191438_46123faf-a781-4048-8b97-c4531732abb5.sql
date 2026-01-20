-- Add RLS policies for storage buckets to restrict file access

-- Policy: Users can only view files they uploaded or if they are admins
CREATE POLICY "Users can view their own bank statements or admins can view all"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'bank-statements' AND
  (auth.uid() = owner OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users can view their own boleto reports or admins can view all"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'boleto-reports' AND
  (auth.uid() = owner OR has_role(auth.uid(), 'admin'))
);

-- Policy: Authenticated users can upload files to both buckets
CREATE POLICY "Authenticated users can upload bank statements"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bank-statements' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can upload boleto reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'boleto-reports' AND
  auth.role() = 'authenticated'
);

-- Policy: Users can update their own files or admins can update all
CREATE POLICY "Users can update their own bank statements"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'bank-statements' AND
  (auth.uid() = owner OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users can update their own boleto reports"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'boleto-reports' AND
  (auth.uid() = owner OR has_role(auth.uid(), 'admin'))
);

-- Policy: Users can delete their own files or admins can delete all
CREATE POLICY "Users can delete their own bank statements"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bank-statements' AND
  (auth.uid() = owner OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users can delete their own boleto reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'boleto-reports' AND
  (auth.uid() = owner OR has_role(auth.uid(), 'admin'))
);