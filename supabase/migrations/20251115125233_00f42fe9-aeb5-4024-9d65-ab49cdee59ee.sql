-- Fix RLS policies for client_enrichment and client_payers
-- These tables contain sensitive PII and must be protected

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own enrichment data" ON client_enrichment;
DROP POLICY IF EXISTS "Users can insert their own enrichment data" ON client_enrichment;
DROP POLICY IF EXISTS "Users can update their own enrichment data" ON client_enrichment;
DROP POLICY IF EXISTS "Users can view their own payer data" ON client_payers;
DROP POLICY IF EXISTS "Users can manage their own payer data" ON client_payers;

-- CLIENT_ENRICHMENT: Only allow access to enrichment data for clients the user owns
CREATE POLICY "Users can view enrichment data for their clients"
ON client_enrichment FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_enrichment.client_id 
    AND clients.created_by = auth.uid()
  )
);

CREATE POLICY "Users can insert enrichment data for their clients"
ON client_enrichment FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_enrichment.client_id 
    AND clients.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update enrichment data for their clients"
ON client_enrichment FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_enrichment.client_id 
    AND clients.created_by = auth.uid()
  )
);

-- CLIENT_PAYERS: Only allow access to payer data for clients the user owns
CREATE POLICY "Users can view payers for their clients"
ON client_payers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_payers.client_id 
    AND clients.created_by = auth.uid()
  )
);

CREATE POLICY "Users can insert payers for their clients"
ON client_payers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_payers.client_id 
    AND clients.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update payers for their clients"
ON client_payers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_payers.client_id 
    AND clients.created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete payers for their clients"
ON client_payers FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_payers.client_id 
    AND clients.created_by = auth.uid()
  )
);