-- Criar tabela de tipos de receita
CREATE TABLE public.revenue_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('fixed', 'minimum_wage', 'percentage', 'custom')),
  value NUMERIC,
  multiplier NUMERIC,
  percentage NUMERIC,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.revenue_types ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view revenue types"
ON public.revenue_types
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create revenue types"
ON public.revenue_types
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update revenue types"
ON public.revenue_types
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete revenue types"
ON public.revenue_types
FOR DELETE
TO authenticated
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_revenue_types_updated_at
BEFORE UPDATE ON public.revenue_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir tipos de receita padrão
INSERT INTO public.revenue_types (name, calculation_type, multiplier, description, created_by)
SELECT 'Honorário Mensal 1.5x Salário Mínimo', 'minimum_wage', 1.5, 'Honorário calculado com base em 1.5x o salário mínimo', id FROM auth.users LIMIT 1;

INSERT INTO public.revenue_types (name, calculation_type, multiplier, description, created_by)
SELECT 'Honorário Mensal 2x Salário Mínimo', 'minimum_wage', 2.0, 'Honorário calculado com base em 2x o salário mínimo', id FROM auth.users LIMIT 1;

INSERT INTO public.revenue_types (name, calculation_type, percentage, description, created_by)
SELECT 'Honorário 2.87% Faturamento', 'percentage', 2.87, 'Honorário de 2.87% sobre o faturamento do cliente', id FROM auth.users LIMIT 1;

INSERT INTO public.revenue_types (name, calculation_type, value, description, created_by)
SELECT 'Abertura de Empresa', 'fixed', 1500.00, 'Honorário fixo para abertura de empresa', id FROM auth.users LIMIT 1;

INSERT INTO public.revenue_types (name, calculation_type, value, description, created_by)
SELECT 'Alteração Contratual', 'fixed', 800.00, 'Honorário fixo para alteração contratual', id FROM auth.users LIMIT 1;

INSERT INTO public.revenue_types (name, calculation_type, value, description, created_by)
SELECT 'Confecção IRPF', 'fixed', 300.00, 'Honorário para confecção de declaração de IRPF', id FROM auth.users LIMIT 1;

-- Adicionar campos na tabela de invoices
ALTER TABLE public.invoices ADD COLUMN revenue_type_id UUID REFERENCES public.revenue_types(id);
ALTER TABLE public.invoices ADD COLUMN calculation_base NUMERIC;
ALTER TABLE public.invoices ADD COLUMN calculated_amount NUMERIC;