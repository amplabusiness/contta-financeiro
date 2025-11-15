-- Criar tabela para templates de mensagens de cobrança
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios templates"
  ON public.message_templates FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Usuários podem criar seus próprios templates"
  ON public.message_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Usuários podem atualizar seus próprios templates"
  ON public.message_templates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Usuários podem deletar seus próprios templates"
  ON public.message_templates FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();