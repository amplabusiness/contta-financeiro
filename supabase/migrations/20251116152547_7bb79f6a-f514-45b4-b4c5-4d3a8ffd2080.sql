-- Create storage buckets for automated file processing
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('boleto-reports', 'boleto-reports', false),
  ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for boleto-reports bucket
CREATE POLICY "Authenticated users can upload boleto reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'boleto-reports');

CREATE POLICY "Authenticated users can view boleto reports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'boleto-reports');

CREATE POLICY "Service role can manage boleto reports"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'boleto-reports');

-- RLS policies for bank-statements bucket
CREATE POLICY "Authenticated users can upload bank statements"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bank-statements');

CREATE POLICY "Authenticated users can view bank statements"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bank-statements');

CREATE POLICY "Service role can manage bank statements"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'bank-statements');

-- Create table to track file processing status
CREATE TABLE IF NOT EXISTS file_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('boleto_report', 'bank_statement')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  processing_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE file_processing_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for file_processing_queue
CREATE POLICY "Authenticated users can view their own queue items"
ON file_processing_queue FOR SELECT
TO authenticated
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert queue items"
ON file_processing_queue FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Service role can manage queue"
ON file_processing_queue FOR ALL
TO service_role
USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_file_processing_queue_status ON file_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_file_processing_queue_uploaded_at ON file_processing_queue(uploaded_at);