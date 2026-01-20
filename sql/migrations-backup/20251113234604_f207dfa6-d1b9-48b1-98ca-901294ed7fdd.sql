-- Tabela para relacionar clientes com seus pagadores (sócios, representantes, etc)
CREATE TABLE IF NOT EXISTS public.client_payers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payer_name TEXT NOT NULL,
  payer_document TEXT, -- CPF ou CNPJ do pagador
  relationship TEXT, -- 'socio', 'representante', 'responsavel', etc
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar dados enriquecidos das empresas da Receita Federal
CREATE TABLE IF NOT EXISTS public.client_enrichment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  cnpj TEXT NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  porte TEXT,
  natureza_juridica TEXT,
  situacao TEXT,
  data_abertura DATE,
  capital_social NUMERIC,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  municipio TEXT,
  uf TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  atividade_principal JSONB,
  atividades_secundarias JSONB,
  socios JSONB, -- Array com dados dos sócios
  qsa JSONB, -- Quadro societário completo
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_source TEXT NOT NULL DEFAULT 'brasilapi',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_enrichment ENABLE ROW LEVEL SECURITY;

-- Policies para client_payers
CREATE POLICY "Authenticated users can view client payers"
ON public.client_payers FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create client payers"
ON public.client_payers FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update client payers"
ON public.client_payers FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete client payers"
ON public.client_payers FOR DELETE
USING (true);

-- Policies para client_enrichment
CREATE POLICY "Authenticated users can view client enrichment"
ON public.client_enrichment FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create client enrichment"
ON public.client_enrichment FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client enrichment"
ON public.client_enrichment FOR UPDATE
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_payers_updated_at
BEFORE UPDATE ON public.client_payers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_client_payers_client_id ON public.client_payers(client_id);
CREATE INDEX idx_client_payers_document ON public.client_payers(payer_document);
CREATE INDEX idx_client_payers_name ON public.client_payers USING gin(to_tsvector('portuguese', payer_name));
CREATE INDEX idx_client_enrichment_client_id ON public.client_enrichment(client_id);
CREATE INDEX idx_client_enrichment_cnpj ON public.client_enrichment(cnpj);