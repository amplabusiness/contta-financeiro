-- Criar tabela de transações bancárias
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit')),
  category TEXT,
  bank_reference TEXT,
  imported_from TEXT,
  matched BOOLEAN NOT NULL DEFAULT false,
  matched_expense_id UUID REFERENCES public.expenses(id),
  matched_invoice_id UUID REFERENCES public.invoices(id),
  ai_confidence NUMERIC,
  ai_suggestion TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Criar tabela de razão do cliente (conta corrente)
CREATE TABLE public.client_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  balance NUMERIC NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Criar tabela de configuração de conciliação
CREATE TABLE public.reconciliation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('expense', 'revenue', 'client_payment')),
  target_category TEXT,
  target_account_id UUID REFERENCES public.chart_of_accounts(id),
  auto_match BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_rules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para bank_transactions
CREATE POLICY "Authenticated users can view bank transactions"
ON public.bank_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create bank transactions"
ON public.bank_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update bank transactions"
ON public.bank_transactions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete bank transactions"
ON public.bank_transactions FOR DELETE TO authenticated USING (true);

-- Políticas RLS para client_ledger
CREATE POLICY "Authenticated users can view client ledger"
ON public.client_ledger FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create client ledger"
ON public.client_ledger FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update client ledger"
ON public.client_ledger FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete client ledger"
ON public.client_ledger FOR DELETE TO authenticated USING (true);

-- Políticas RLS para reconciliation_rules
CREATE POLICY "Authenticated users can view reconciliation rules"
ON public.reconciliation_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create reconciliation rules"
ON public.reconciliation_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update reconciliation rules"
ON public.reconciliation_rules FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete reconciliation rules"
ON public.reconciliation_rules FOR DELETE TO authenticated USING (true);

-- Índices para performance
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_matched ON public.bank_transactions(matched);
CREATE INDEX idx_client_ledger_client ON public.client_ledger(client_id);
CREATE INDEX idx_client_ledger_date ON public.client_ledger(transaction_date);

-- Inserir regras de conciliação padrão
INSERT INTO public.reconciliation_rules (rule_name, pattern, rule_type, auto_match, priority, created_by)
SELECT 'Pagamento de Honorário', 'honorario|honorários|mensalidade', 'revenue', true, 10, id FROM auth.users LIMIT 1;

INSERT INTO public.reconciliation_rules (rule_name, pattern, rule_type, target_category, auto_match, priority, created_by)
SELECT 'Energia Elétrica', 'energia|luz|cemig|copel|enel', 'expense', 'Contas Fixas', true, 8, id FROM auth.users LIMIT 1;

INSERT INTO public.reconciliation_rules (rule_name, pattern, rule_type, target_category, auto_match, priority, created_by)
SELECT 'Aluguel', 'aluguel|locação', 'expense', 'Contas Fixas', true, 9, id FROM auth.users LIMIT 1;