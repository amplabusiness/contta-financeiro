-- Fix critical RLS security vulnerabilities
-- All policies should restrict access to records owned by the current user

-- ============================================
-- 1. FIX CLIENTS TABLE - Most Critical
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;

CREATE POLICY "Users can view their own clients"
ON clients FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;

CREATE POLICY "Users can update their own clients"
ON clients FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;

CREATE POLICY "Users can delete their own clients"
ON clients FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 2. FIX CLIENT_ENRICHMENT TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view client enrichment" ON client_enrichment;

CREATE POLICY "Users can view enrichment for their clients"
ON client_enrichment FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_enrichment.client_id 
    AND clients.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update client enrichment" ON client_enrichment;

CREATE POLICY "Users can update enrichment for their clients"
ON client_enrichment FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_enrichment.client_id 
    AND clients.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can create client enrichment" ON client_enrichment;

CREATE POLICY "Users can create enrichment for their clients"
ON client_enrichment FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_enrichment.client_id 
    AND clients.created_by = auth.uid()
  )
);

-- ============================================
-- 3. FIX CLIENT_PAYERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view client payers" ON client_payers;

CREATE POLICY "Users can view payers for their clients only"
ON client_payers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_payers.client_id 
    AND clients.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update client payers" ON client_payers;

CREATE POLICY "Users can update payers for their clients only"
ON client_payers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_payers.client_id 
    AND clients.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete client payers" ON client_payers;

CREATE POLICY "Users can delete payers for their clients only"
ON client_payers FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_payers.client_id 
    AND clients.created_by = auth.uid()
  )
);

-- ============================================
-- 4. FIX INVOICES TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;

CREATE POLICY "Users can view invoices for their clients"
ON invoices FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = invoices.client_id 
    AND clients.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;

CREATE POLICY "Users can update invoices for their clients"
ON invoices FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = invoices.client_id 
    AND clients.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;

CREATE POLICY "Users can delete invoices for their clients"
ON invoices FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = invoices.client_id 
    AND clients.created_by = auth.uid()
  )
);

-- ============================================
-- 5. FIX EXPENSES TABLE  
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;

CREATE POLICY "Users can view their own expenses"
ON expenses FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;

CREATE POLICY "Users can update their own expenses"
ON expenses FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;

CREATE POLICY "Users can delete their own expenses"
ON expenses FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 6. FIX CLIENT_LEDGER TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view client ledger" ON client_ledger;

CREATE POLICY "Users can view ledger for their clients"
ON client_ledger FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_ledger.client_id 
    AND clients.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update client ledger" ON client_ledger;

CREATE POLICY "Users can update ledger for their clients"
ON client_ledger FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_ledger.client_id 
    AND clients.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete client ledger" ON client_ledger;

CREATE POLICY "Users can delete ledger for their clients"
ON client_ledger FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = client_ledger.client_id 
    AND clients.created_by = auth.uid()
  )
);

-- ============================================
-- 7. FIX BANK_TRANSACTIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view bank transactions" ON bank_transactions;

CREATE POLICY "Users can view their own bank transactions"
ON bank_transactions FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update bank transactions" ON bank_transactions;

CREATE POLICY "Users can update their own bank transactions"
ON bank_transactions FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete bank transactions" ON bank_transactions;

CREATE POLICY "Users can delete their own bank transactions"
ON bank_transactions FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 8. FIX BANK_TRANSACTION_MATCHES TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view matches" ON bank_transaction_matches;

CREATE POLICY "Users can view their own transaction matches"
ON bank_transaction_matches FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update matches" ON bank_transaction_matches;

CREATE POLICY "Users can update their own transaction matches"
ON bank_transaction_matches FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete matches" ON bank_transaction_matches;

CREATE POLICY "Users can delete their own transaction matches"
ON bank_transaction_matches FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 9. FIX CHART_OF_ACCOUNTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view chart of accounts" ON chart_of_accounts;

CREATE POLICY "Users can view their own chart of accounts"
ON chart_of_accounts FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update chart of accounts" ON chart_of_accounts;

CREATE POLICY "Users can update their own chart of accounts"
ON chart_of_accounts FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete chart of accounts" ON chart_of_accounts;

CREATE POLICY "Users can delete their own chart of accounts"
ON chart_of_accounts FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 10. FIX ACCOUNTING_ENTRIES TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view entries" ON accounting_entries;

CREATE POLICY "Users can view their own accounting entries"
ON accounting_entries FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update entries" ON accounting_entries;

CREATE POLICY "Users can update their own accounting entries"
ON accounting_entries FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete entries" ON accounting_entries;

CREATE POLICY "Users can delete their own accounting entries"
ON accounting_entries FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 11. FIX ACCOUNTING_ENTRY_LINES TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view entry lines" ON accounting_entry_lines;

CREATE POLICY "Users can view their own accounting entry lines"
ON accounting_entry_lines FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM accounting_entries 
    WHERE accounting_entries.id = accounting_entry_lines.entry_id 
    AND accounting_entries.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can update entry lines" ON accounting_entry_lines;

CREATE POLICY "Users can update their own accounting entry lines"
ON accounting_entry_lines FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM accounting_entries 
    WHERE accounting_entries.id = accounting_entry_lines.entry_id 
    AND accounting_entries.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete entry lines" ON accounting_entry_lines;

CREATE POLICY "Users can delete their own accounting entry lines"
ON accounting_entry_lines FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM accounting_entries 
    WHERE accounting_entries.id = accounting_entry_lines.entry_id 
    AND accounting_entries.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can create entry lines" ON accounting_entry_lines;

CREATE POLICY "Users can create entry lines for their entries"
ON accounting_entry_lines FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM accounting_entries 
    WHERE accounting_entries.id = accounting_entry_lines.entry_id 
    AND accounting_entries.created_by = auth.uid()
  )
);

-- ============================================
-- 12. FIX RECONCILIATION_RULES TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view reconciliation rules" ON reconciliation_rules;

CREATE POLICY "Users can view their own reconciliation rules"
ON reconciliation_rules FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update reconciliation rules" ON reconciliation_rules;

CREATE POLICY "Users can update their own reconciliation rules"
ON reconciliation_rules FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete reconciliation rules" ON reconciliation_rules;

CREATE POLICY "Users can delete their own reconciliation rules"
ON reconciliation_rules FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 13. FIX REVENUE_TYPES TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view revenue types" ON revenue_types;

CREATE POLICY "Users can view their own revenue types"
ON revenue_types FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update revenue types" ON revenue_types;

CREATE POLICY "Users can update their own revenue types"
ON revenue_types FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete revenue types" ON revenue_types;

CREATE POLICY "Users can delete their own revenue types"
ON revenue_types FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 14. FIX AUDIT_LOGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;

CREATE POLICY "Users can view their own audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update audit logs" ON audit_logs;

CREATE POLICY "Users can update their own audit logs"
ON audit_logs FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

-- ============================================
-- 15. FIX ENRICHMENT_LOGS TABLE
-- ============================================

-- Garantir que a tabela exista antes de ajustar as políticas
CREATE TABLE IF NOT EXISTS enrichment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  message TEXT,
  metadata JSONB
);
ALTER TABLE enrichment_logs ADD COLUMN IF NOT EXISTS created_by UUID;

DROP POLICY IF EXISTS "Authenticated users can view enrichment logs" ON enrichment_logs;

CREATE POLICY "Users can view their own enrichment logs"
ON enrichment_logs FOR SELECT
TO authenticated
USING (auth.uid() = created_by OR created_by IS NULL);
