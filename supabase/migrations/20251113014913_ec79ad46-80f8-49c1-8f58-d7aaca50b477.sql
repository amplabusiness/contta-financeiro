-- Criar tabela para armazenar matches múltiplos de transações bancárias
CREATE TABLE public.bank_transaction_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  confidence NUMERIC,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.bank_transaction_matches ENABLE ROW LEVEL SECURITY;

-- Criar políticas
CREATE POLICY "Authenticated users can view matches"
  ON public.bank_transaction_matches
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create matches"
  ON public.bank_transaction_matches
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update matches"
  ON public.bank_transaction_matches
  FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete matches"
  ON public.bank_transaction_matches
  FOR DELETE
  USING (true);

-- Adicionar campo para indicar se transação tem múltiplos matches
ALTER TABLE public.bank_transactions
ADD COLUMN has_multiple_matches BOOLEAN NOT NULL DEFAULT false;

-- Criar índices
CREATE INDEX idx_bank_transaction_matches_transaction_id ON public.bank_transaction_matches(bank_transaction_id);
CREATE INDEX idx_bank_transaction_matches_invoice_id ON public.bank_transaction_matches(invoice_id);
CREATE INDEX idx_bank_transaction_matches_client_id ON public.bank_transaction_matches(client_id);