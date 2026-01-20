-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles (users can view their own roles, admins can manage all)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Create has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Update RLS policies for clients table
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;

CREATE POLICY "Admins and accountants can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can view clients"
  ON public.clients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can update clients"
  ON public.clients FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for invoices table
DROP POLICY IF EXISTS "Authenticated users can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view invoices for their clients" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices for their clients" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices for their clients" ON public.invoices;

CREATE POLICY "Admins and accountants can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can view invoices"
  ON public.invoices FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can update invoices"
  ON public.invoices FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for expenses table
DROP POLICY IF EXISTS "Authenticated users can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;

CREATE POLICY "Admins and accountants can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can view expenses"
  ON public.expenses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can update expenses"
  ON public.expenses FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete expenses"
  ON public.expenses FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for client_enrichment table
DROP POLICY IF EXISTS "Users can create enrichment for their clients" ON public.client_enrichment;
DROP POLICY IF EXISTS "Users can view enrichment for their clients" ON public.client_enrichment;
DROP POLICY IF EXISTS "Users can update enrichment for their clients" ON public.client_enrichment;
DROP POLICY IF EXISTS "Users can insert enrichment data for their clients" ON public.client_enrichment;
DROP POLICY IF EXISTS "Users can view enrichment data for their clients" ON public.client_enrichment;
DROP POLICY IF EXISTS "Users can update enrichment data for their clients" ON public.client_enrichment;

CREATE POLICY "Admins and accountants can view client enrichment"
  ON public.client_enrichment FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can insert client enrichment"
  ON public.client_enrichment FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update client enrichment"
  ON public.client_enrichment FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

-- Update RLS policies for client_payers table
DROP POLICY IF EXISTS "Authenticated users can create client payers" ON public.client_payers;
DROP POLICY IF EXISTS "Users can view payers for their clients" ON public.client_payers;
DROP POLICY IF EXISTS "Users can update payers for their clients" ON public.client_payers;
DROP POLICY IF EXISTS "Users can delete payers for their clients" ON public.client_payers;
DROP POLICY IF EXISTS "Users can insert payers for their clients" ON public.client_payers;
DROP POLICY IF EXISTS "Users can view payers for their clients only" ON public.client_payers;
DROP POLICY IF EXISTS "Users can update payers for their clients only" ON public.client_payers;
DROP POLICY IF EXISTS "Users can delete payers for their clients only" ON public.client_payers;

CREATE POLICY "Admins and accountants can view client payers"
  ON public.client_payers FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can insert client payers"
  ON public.client_payers FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update client payers"
  ON public.client_payers FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete client payers"
  ON public.client_payers FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for accounting_entries table
DROP POLICY IF EXISTS "Authenticated users can create entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can view their own accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can update their own accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can delete their own accounting entries" ON public.accounting_entries;

CREATE POLICY "Admins and accountants can create entries"
  ON public.accounting_entries FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can view entries"
  ON public.accounting_entries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can update entries"
  ON public.accounting_entries FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete entries"
  ON public.accounting_entries FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for accounting_entry_lines table
DROP POLICY IF EXISTS "Users can create entry lines for their entries" ON public.accounting_entry_lines;
DROP POLICY IF EXISTS "Users can view their own accounting entry lines" ON public.accounting_entry_lines;
DROP POLICY IF EXISTS "Users can update their own accounting entry lines" ON public.accounting_entry_lines;
DROP POLICY IF EXISTS "Users can delete their own accounting entry lines" ON public.accounting_entry_lines;

CREATE POLICY "Admins and accountants can view entry lines"
  ON public.accounting_entry_lines FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can insert entry lines"
  ON public.accounting_entry_lines FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update entry lines"
  ON public.accounting_entry_lines FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete entry lines"
  ON public.accounting_entry_lines FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for accounts_payable table
DROP POLICY IF EXISTS "Users can create accounts payable" ON public.accounts_payable;
DROP POLICY IF EXISTS "Users can view their own accounts payable" ON public.accounts_payable;
DROP POLICY IF EXISTS "Users can update their own accounts payable" ON public.accounts_payable;
DROP POLICY IF EXISTS "Users can delete their own accounts payable" ON public.accounts_payable;

CREATE POLICY "Admins and accountants can view accounts payable"
  ON public.accounts_payable FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create accounts payable"
  ON public.accounts_payable FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update accounts payable"
  ON public.accounts_payable FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete accounts payable"
  ON public.accounts_payable FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for bank_transactions table
DROP POLICY IF EXISTS "Authenticated users can create bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can view their own bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can update their own bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can delete their own bank transactions" ON public.bank_transactions;

CREATE POLICY "Admins and accountants can view bank transactions"
  ON public.bank_transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create bank transactions"
  ON public.bank_transactions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update bank transactions"
  ON public.bank_transactions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete bank transactions"
  ON public.bank_transactions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for bank_balance table
DROP POLICY IF EXISTS "Users can create bank balances" ON public.bank_balance;
DROP POLICY IF EXISTS "Users can view their own bank balances" ON public.bank_balance;
DROP POLICY IF EXISTS "Users can update their own bank balances" ON public.bank_balance;
DROP POLICY IF EXISTS "Users can delete their own bank balances" ON public.bank_balance;

CREATE POLICY "Admins and accountants can view bank balances"
  ON public.bank_balance FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create bank balances"
  ON public.bank_balance FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update bank balances"
  ON public.bank_balance FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete bank balances"
  ON public.bank_balance FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for chart_of_accounts table
DROP POLICY IF EXISTS "Authenticated users can create chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can view their own chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can update their own chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can delete their own chart of accounts" ON public.chart_of_accounts;

CREATE POLICY "Admins and accountants can view chart of accounts"
  ON public.chart_of_accounts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create chart of accounts"
  ON public.chart_of_accounts FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update chart of accounts"
  ON public.chart_of_accounts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete chart of accounts"
  ON public.chart_of_accounts FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for cash_flow_transactions table
DROP POLICY IF EXISTS "Users can create cash flow transactions" ON public.cash_flow_transactions;
DROP POLICY IF EXISTS "Users can view their own cash flow transactions" ON public.cash_flow_transactions;
DROP POLICY IF EXISTS "Users can update their own cash flow transactions" ON public.cash_flow_transactions;
DROP POLICY IF EXISTS "Users can delete their own cash flow transactions" ON public.cash_flow_transactions;

CREATE POLICY "Admins and accountants can view cash flow transactions"
  ON public.cash_flow_transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create cash flow transactions"
  ON public.cash_flow_transactions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update cash flow transactions"
  ON public.cash_flow_transactions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete cash flow transactions"
  ON public.cash_flow_transactions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for client_ledger table
DROP POLICY IF EXISTS "Authenticated users can create client ledger" ON public.client_ledger;
DROP POLICY IF EXISTS "Users can view ledger for their clients" ON public.client_ledger;
DROP POLICY IF EXISTS "Users can update ledger for their clients" ON public.client_ledger;
DROP POLICY IF EXISTS "Users can delete ledger for their clients" ON public.client_ledger;

CREATE POLICY "Admins and accountants can view client ledger"
  ON public.client_ledger FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create client ledger"
  ON public.client_ledger FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update client ledger"
  ON public.client_ledger FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete client ledger"
  ON public.client_ledger FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for client_partners table
DROP POLICY IF EXISTS "Users can create partners for their clients" ON public.client_partners;
DROP POLICY IF EXISTS "Users can view partners for their clients" ON public.client_partners;
DROP POLICY IF EXISTS "Users can update partners for their clients" ON public.client_partners;
DROP POLICY IF EXISTS "Users can delete partners for their clients" ON public.client_partners;

CREATE POLICY "Admins and accountants can view client partners"
  ON public.client_partners FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create client partners"
  ON public.client_partners FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update client partners"
  ON public.client_partners FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete client partners"
  ON public.client_partners FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for collection_work_orders table
DROP POLICY IF EXISTS "Users can create work orders" ON public.collection_work_orders;
DROP POLICY IF EXISTS "Users can view their own work orders" ON public.collection_work_orders;
DROP POLICY IF EXISTS "Users can update their own work orders" ON public.collection_work_orders;
DROP POLICY IF EXISTS "Users can delete their own work orders" ON public.collection_work_orders;

CREATE POLICY "Admins and accountants can view work orders"
  ON public.collection_work_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create work orders"
  ON public.collection_work_orders FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update work orders"
  ON public.collection_work_orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete work orders"
  ON public.collection_work_orders FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for collection_work_order_logs table
DROP POLICY IF EXISTS "Users can create logs for their work orders" ON public.collection_work_order_logs;
DROP POLICY IF EXISTS "Users can view logs for their work orders" ON public.collection_work_order_logs;
DROP POLICY IF EXISTS "Users can update logs for their work orders" ON public.collection_work_order_logs;
DROP POLICY IF EXISTS "Users can delete logs for their work orders" ON public.collection_work_order_logs;

CREATE POLICY "Admins and accountants can view work order logs"
  ON public.collection_work_order_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create work order logs"
  ON public.collection_work_order_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update work order logs"
  ON public.collection_work_order_logs FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete work order logs"
  ON public.collection_work_order_logs FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for audit_logs table
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can update their own audit logs" ON public.audit_logs;

CREATE POLICY "Admins and accountants can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can update audit logs"
  ON public.audit_logs FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for bank_transaction_matches table
DROP POLICY IF EXISTS "Authenticated users can create matches" ON public.bank_transaction_matches;
DROP POLICY IF EXISTS "Users can view their own transaction matches" ON public.bank_transaction_matches;
DROP POLICY IF EXISTS "Users can update their own transaction matches" ON public.bank_transaction_matches;
DROP POLICY IF EXISTS "Users can delete their own transaction matches" ON public.bank_transaction_matches;

CREATE POLICY "Admins and accountants can view transaction matches"
  ON public.bank_transaction_matches FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create transaction matches"
  ON public.bank_transaction_matches FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update transaction matches"
  ON public.bank_transaction_matches FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete transaction matches"
  ON public.bank_transaction_matches FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for reconciliation_rules table
DROP POLICY IF EXISTS "Authenticated users can create reconciliation rules" ON public.reconciliation_rules;
DROP POLICY IF EXISTS "Users can view their own reconciliation rules" ON public.reconciliation_rules;
DROP POLICY IF EXISTS "Users can update their own reconciliation rules" ON public.reconciliation_rules;
DROP POLICY IF EXISTS "Users can delete their own reconciliation rules" ON public.reconciliation_rules;

CREATE POLICY "Admins and accountants can view reconciliation rules"
  ON public.reconciliation_rules FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create reconciliation rules"
  ON public.reconciliation_rules FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update reconciliation rules"
  ON public.reconciliation_rules FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete reconciliation rules"
  ON public.reconciliation_rules FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for revenue_types table
DROP POLICY IF EXISTS "Authenticated users can create revenue types" ON public.revenue_types;
DROP POLICY IF EXISTS "Users can view their own revenue types" ON public.revenue_types;
DROP POLICY IF EXISTS "Users can update their own revenue types" ON public.revenue_types;
DROP POLICY IF EXISTS "Users can delete their own revenue types" ON public.revenue_types;

CREATE POLICY "Admins and accountants can view revenue types"
  ON public.revenue_types FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create revenue types"
  ON public.revenue_types FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update revenue types"
  ON public.revenue_types FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete revenue types"
  ON public.revenue_types FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for message_templates table
DROP POLICY IF EXISTS "Usuários podem criar seus próprios templates" ON public.message_templates;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios templates" ON public.message_templates;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios templates" ON public.message_templates;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios templates" ON public.message_templates;

CREATE POLICY "Admins and accountants can view message templates"
  ON public.message_templates FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create message templates"
  ON public.message_templates FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins and accountants can update message templates"
  ON public.message_templates FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Admins can delete message templates"
  ON public.message_templates FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for enrichment_logs table
DROP POLICY IF EXISTS "Authenticated users can create enrichment logs" ON public.enrichment_logs;
DROP POLICY IF EXISTS "Users can view their own enrichment logs" ON public.enrichment_logs;

CREATE POLICY "Admins and accountants can view enrichment logs"
  ON public.enrichment_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant') OR public.has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins and accountants can create enrichment logs"
  ON public.enrichment_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));