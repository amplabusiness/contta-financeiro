-- Criar tabela de lançamentos contábeis
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL, -- 'manual', 'provisioning', 'payment', 'invoice'
  description TEXT NOT NULL,
  document_number TEXT,
  reference_type TEXT, -- 'expense', 'invoice', 'bank_transaction'
  reference_id UUID,
  total_debit NUMERIC NOT NULL DEFAULT 0,
  total_credit NUMERIC NOT NULL DEFAULT 0,
  balanced BOOLEAN NOT NULL DEFAULT true,
  notes TEXT
);

ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS entry_date DATE;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS entry_type TEXT;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS total_debit NUMERIC DEFAULT 0;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS total_credit NUMERIC DEFAULT 0;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS balanced BOOLEAN DEFAULT true;
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS notes TEXT;

-- Criar tabela de itens de lançamento (débitos e créditos)
CREATE TABLE IF NOT EXISTS public.accounting_entry_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  entry_id UUID NOT NULL REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  description TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON public.accounting_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_type ON public.accounting_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_reference ON public.accounting_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_lines_entry ON public.accounting_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_lines_account ON public.accounting_entry_lines(account_id);

-- Habilitar RLS
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry_lines ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para accounting_entries
CREATE POLICY "Authenticated users can view entries"
ON public.accounting_entries
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create entries"
ON public.accounting_entries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update entries"
ON public.accounting_entries
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete entries"
ON public.accounting_entries
FOR DELETE
TO authenticated
USING (true);

-- Políticas RLS para accounting_entry_lines
CREATE POLICY "Authenticated users can view entry lines"
ON public.accounting_entry_lines
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create entry lines"
ON public.accounting_entry_lines
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update entry lines"
ON public.accounting_entry_lines
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete entry lines"
ON public.accounting_entry_lines
FOR DELETE
TO authenticated
USING (true);

-- Função para verificar balanceamento do lançamento
CREATE OR REPLACE FUNCTION public.check_entry_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_debits NUMERIC;
  total_credits NUMERIC;
BEGIN
  -- Calcular totais
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM accounting_entry_lines
  WHERE entry_id = NEW.entry_id;

  -- Atualizar o cabeçalho do lançamento
  UPDATE accounting_entries
  SET 
    total_debit = total_debits,
    total_credit = total_credits,
    balanced = (total_debits = total_credits)
  WHERE id = NEW.entry_id;

  RETURN NEW;
END;
$$;

-- Trigger para verificar balanceamento após insert/update/delete
CREATE TRIGGER check_balance_after_line_change
AFTER INSERT OR UPDATE OR DELETE ON public.accounting_entry_lines
FOR EACH ROW
EXECUTE FUNCTION public.check_entry_balance();

-- Adicionar campo para indicar se conta é sintética ou analítica
ALTER TABLE public.chart_of_accounts 
ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT false;

-- Comentários
COMMENT ON TABLE public.accounting_entries IS 'Cabeçalho dos lançamentos contábeis';
COMMENT ON TABLE public.accounting_entry_lines IS 'Linhas de débito e crédito dos lançamentos contábeis';
COMMENT ON COLUMN public.chart_of_accounts.is_synthetic IS 'Contas sintéticas recebem somatórios, analíticas recebem lançamentos diretos';