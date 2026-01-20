-- Criar tabela de saldo bancário
CREATE TABLE public.bank_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_number TEXT,
  bank_name TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'investment')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.bank_balance ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own bank balances"
  ON public.bank_balance
  FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create bank balances"
  ON public.bank_balance
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own bank balances"
  ON public.bank_balance
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own bank balances"
  ON public.bank_balance
  FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_bank_balance_updated_at
  BEFORE UPDATE ON public.bank_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_bank_balance_created_by ON public.bank_balance(created_by);
CREATE INDEX idx_bank_balance_is_active ON public.bank_balance(is_active);
CREATE INDEX idx_bank_balance_balance_date ON public.bank_balance(balance_date);

-- Criar tabela de transações de fluxo de caixa
CREATE TABLE public.cash_flow_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('inflow', 'outflow')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'projected' CHECK (status IN ('projected', 'confirmed', 'cancelled')),
  reference_type TEXT CHECK (reference_type IN ('invoice', 'expense', 'account_payable', 'manual')),
  reference_id UUID,
  bank_account_id UUID REFERENCES public.bank_balance(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cash_flow_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own cash flow transactions"
  ON public.cash_flow_transactions
  FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create cash flow transactions"
  ON public.cash_flow_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own cash flow transactions"
  ON public.cash_flow_transactions
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own cash flow transactions"
  ON public.cash_flow_transactions
  FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_cash_flow_transactions_updated_at
  BEFORE UPDATE ON public.cash_flow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_cash_flow_transactions_created_by ON public.cash_flow_transactions(created_by);
CREATE INDEX idx_cash_flow_transactions_date ON public.cash_flow_transactions(transaction_date);
CREATE INDEX idx_cash_flow_transactions_type ON public.cash_flow_transactions(transaction_type);
CREATE INDEX idx_cash_flow_transactions_status ON public.cash_flow_transactions(status);