-- Create bank_accounts table for bank account management
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  agency TEXT,
  account_number TEXT,
  account_type TEXT DEFAULT 'checking',
  current_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bank_imports table for tracking bank statement imports
CREATE TABLE IF NOT EXISTS public.bank_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  import_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE,
  period_end DATE,
  total_transactions INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_accounts
CREATE POLICY "Users can view bank accounts"
ON public.bank_accounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert bank accounts"
ON public.bank_accounts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update bank accounts"
ON public.bank_accounts FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Users can delete bank accounts"
ON public.bank_accounts FOR DELETE
TO authenticated
USING (true);

-- RLS Policies for bank_imports
CREATE POLICY "Users can view bank imports"
ON public.bank_imports FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert bank imports"
ON public.bank_imports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update bank imports"
ON public.bank_imports FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Users can delete bank imports"
ON public.bank_imports FOR DELETE
TO authenticated
USING (true);

-- Add indexes
CREATE INDEX idx_bank_accounts_is_active ON public.bank_accounts(is_active);
CREATE INDEX idx_bank_imports_bank_account_id ON public.bank_imports(bank_account_id);
CREATE INDEX idx_bank_imports_status ON public.bank_imports(status);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
