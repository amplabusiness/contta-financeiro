-- Criar tabela de plano de contas
CREATE TABLE public.chart_of_accounts (
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
CREATE TRIGGER update_chart_of_accounts_updated_at
BEFORE UPDATE ON public.chart_of_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir plano de contas padrão para despesas
INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by) 
SELECT '1', 'DESPESAS OPERACIONAIS', 'despesa', NULL, id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.1', 'Despesas Administrativas', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.1.01', 'Aluguel', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.1.02', 'Água', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.1.03', 'Luz', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.1.04', 'Telefone/Internet', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.1.05', 'Material de Escritório', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.1.06', 'Material de Limpeza', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.2', 'Despesas com Pessoal', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.2.01', 'Salários', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.2'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.2.02', 'Encargos Sociais', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.2'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.2.03', 'Vale Transporte', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.2'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.2.04', 'Vale Alimentação', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.2'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.3', 'Despesas Tributárias', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.3.01', 'Impostos Federais', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.3'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.3.02', 'Impostos Estaduais', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.3'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.3.03', 'Impostos Municipais', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.3'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.4', 'Despesas Financeiras', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.4.01', 'Juros', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.4'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.4.02', 'Tarifas Bancárias', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1.4'), id FROM auth.users LIMIT 1;

INSERT INTO public.chart_of_accounts (code, name, type, parent_id, created_by)
SELECT '1.5', 'Outras Despesas', 'despesa', (SELECT id FROM public.chart_of_accounts WHERE code = '1'), id FROM auth.users LIMIT 1;

-- Adicionar campo de conta contábil na tabela de despesas
ALTER TABLE public.expenses ADD COLUMN account_id UUID REFERENCES public.chart_of_accounts(id);