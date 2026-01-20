-- Criar tabela de plano de contas
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Habilitar RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view chart of accounts"
ON public.chart_of_accounts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create chart of accounts"
ON public.chart_of_accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update chart of accounts"
ON public.chart_of_accounts
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete chart of accounts"
ON public.chart_of_accounts
FOR DELETE
TO authenticated
USING (true);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_chart_of_accounts_updated_at ON public.chart_of_accounts;
CREATE TRIGGER update_chart_of_accounts_updated_at
BEFORE UPDATE ON public.chart_of_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inser??o de plano de contas removida para evitar conflitos com schema existente

-- Adicionar campo de conta contábil na tabela de despesas
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id);
