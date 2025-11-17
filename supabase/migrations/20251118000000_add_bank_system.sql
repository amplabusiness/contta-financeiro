-- Migration: Add Bank Account System with OFX Import Support
-- Sistema de controle bancário para conciliação

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bank_code TEXT, -- Código do banco (ex: 748 para Sicredi)
  bank_name TEXT, -- Nome do banco
  agency TEXT,
  account_number TEXT,
  account_type TEXT CHECK (account_type IN ('checking', 'savings', 'investment')),
  initial_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bank_transactions table
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  document_number TEXT,
  balance_after DECIMAL(10,2),

  -- OFX specific fields
  fitid TEXT, -- Financial Institution Transaction ID (único por banco)
  check_number TEXT,
  memo TEXT,

  -- Reconciliation
  is_reconciled BOOLEAN NOT NULL DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),

  -- Import tracking
  import_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bank_imports table (histórico de importações)
CREATE TABLE IF NOT EXISTS public.bank_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  import_date TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- OFX metadata
  start_date DATE,
  end_date DATE,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_debits DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_credits DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Import status
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed', 'duplicated')),
  error_message TEXT,
  duplicated_transactions INTEGER DEFAULT 0,
  new_transactions INTEGER DEFAULT 0,

  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_id ON public.bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON public.bank_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_fitid ON public.bank_transactions(fitid);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciled ON public.bank_transactions(is_reconciled);
CREATE INDEX IF NOT EXISTS idx_bank_imports_account_id ON public.bank_imports(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_imports_date ON public.bank_imports(import_date DESC);

-- Unique constraint for FITID per bank account (evitar duplicatas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_fitid_unique
ON public.bank_transactions(bank_account_id, fitid)
WHERE fitid IS NOT NULL;

-- Add comments
COMMENT ON TABLE public.bank_accounts IS 'Contas bancárias da empresa';
COMMENT ON TABLE public.bank_transactions IS 'Transações bancárias importadas de OFX ou manuais';
COMMENT ON TABLE public.bank_imports IS 'Histórico de importações de arquivos OFX';

COMMENT ON COLUMN public.bank_transactions.fitid IS 'ID único da transação no banco (para evitar duplicatas)';
COMMENT ON COLUMN public.bank_transactions.is_reconciled IS 'Indica se a transação foi conciliada com lançamentos contábeis';
COMMENT ON COLUMN public.bank_imports.duplicated_transactions IS 'Número de transações que já existiam';
COMMENT ON COLUMN public.bank_imports.new_transactions IS 'Número de transações novas importadas';

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_imports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view bank accounts"
  ON public.bank_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert bank accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update bank accounts"
  ON public.bank_accounts FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete bank accounts"
  ON public.bank_accounts FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view bank transactions"
  ON public.bank_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert bank transactions"
  ON public.bank_transactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update bank transactions"
  ON public.bank_transactions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete bank transactions"
  ON public.bank_transactions FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view bank imports"
  ON public.bank_imports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert bank imports"
  ON public.bank_imports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to update bank account balance
CREATE OR REPLACE FUNCTION update_bank_account_balance(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_initial_balance DECIMAL(10,2);
  v_transactions_sum DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
BEGIN
  -- Get initial balance
  SELECT initial_balance INTO v_initial_balance
  FROM bank_accounts
  WHERE id = p_account_id;

  -- Calculate sum of transactions (credits - debits)
  SELECT COALESCE(
    SUM(CASE
      WHEN transaction_type = 'credit' THEN amount
      WHEN transaction_type = 'debit' THEN -amount
      ELSE 0
    END),
    0
  )
  INTO v_transactions_sum
  FROM bank_transactions
  WHERE bank_account_id = p_account_id;

  -- Calculate new balance
  v_new_balance := v_initial_balance + v_transactions_sum;

  -- Update account
  UPDATE bank_accounts
  SET current_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;

COMMENT ON FUNCTION update_bank_account_balance IS 'Atualiza o saldo atual de uma conta bancária baseado nas transações';

-- Trigger to update balance after transaction insert/update/delete
CREATE OR REPLACE FUNCTION trigger_update_bank_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_bank_account_balance(OLD.bank_account_id);
    RETURN OLD;
  ELSE
    PERFORM update_bank_account_balance(NEW.bank_account_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER bank_transaction_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION trigger_update_bank_balance();
