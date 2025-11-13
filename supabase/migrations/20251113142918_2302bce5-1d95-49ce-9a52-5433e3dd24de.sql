-- Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  audit_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  entity_type TEXT NOT NULL,
  entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT
);

-- Índices para melhor performance
CREATE INDEX idx_audit_logs_created_by ON public.audit_logs(created_by);
CREATE INDEX idx_audit_logs_audit_type ON public.audit_logs(audit_type);
CREATE INDEX idx_audit_logs_severity ON public.audit_logs(severity);
CREATE INDEX idx_audit_logs_resolved ON public.audit_logs(resolved);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update audit logs"
ON public.audit_logs
FOR UPDATE
TO authenticated
USING (true);

-- Adicionar comentários
COMMENT ON TABLE public.audit_logs IS 'Registro de auditoria para eventos importantes do sistema';
COMMENT ON COLUMN public.audit_logs.audit_type IS 'Tipo de auditoria: boleto_baixado, payment_mismatch, etc';
COMMENT ON COLUMN public.audit_logs.severity IS 'Severidade: info, warning, error, critical';
COMMENT ON COLUMN public.audit_logs.entity_type IS 'Tipo de entidade: invoice, expense, client, etc';
COMMENT ON COLUMN public.audit_logs.resolved IS 'Se o alerta foi resolvido ou não';