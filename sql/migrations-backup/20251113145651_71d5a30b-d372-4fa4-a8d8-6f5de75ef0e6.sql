-- Remover constraint antiga e criar nova com todos os tipos contábeis
ALTER TABLE public.chart_of_accounts 
DROP CONSTRAINT IF EXISTS chart_of_accounts_type_check;

-- Adicionar nova constraint com todos os tipos
ALTER TABLE public.chart_of_accounts 
ADD CONSTRAINT chart_of_accounts_type_check 
CHECK (type = ANY (ARRAY['ativo'::text, 'passivo'::text, 'receita'::text, 'despesa'::text]));