-- Criar tabela de contas a pagar
CREATE TABLE public.accounts_payable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  supplier_document TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'cancelled')),
  category TEXT NOT NULL,
  payment_method TEXT,
  bank_account TEXT,
  document_number TEXT,
  notes TEXT,
  ai_analysis JSONB,
  ai_fraud_score NUMERIC CHECK (ai_fraud_score >= 0 AND ai_fraud_score <= 100),
  ai_fraud_reasons TEXT[],
  ai_recommendations TEXT[],
  approval_status TEXT DEFAULT 'pending_review' CHECK (approval_status IN ('pending_review', 'approved', 'rejected', 'flagged')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own accounts payable"
  ON public.accounts_payable
  FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create accounts payable"
  ON public.accounts_payable
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own accounts payable"
  ON public.accounts_payable
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own accounts payable"
  ON public.accounts_payable
  FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_accounts_payable_updated_at
  BEFORE UPDATE ON public.accounts_payable
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_accounts_payable_created_by ON public.accounts_payable(created_by);
CREATE INDEX idx_accounts_payable_status ON public.accounts_payable(status);
CREATE INDEX idx_accounts_payable_due_date ON public.accounts_payable(due_date);
CREATE INDEX idx_accounts_payable_fraud_score ON public.accounts_payable(ai_fraud_score);