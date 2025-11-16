-- Criar tabela para relatórios de boletos
CREATE TABLE IF NOT EXISTS boleto_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'XLS',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_boletos INTEGER NOT NULL DEFAULT 0,
  total_emitidos NUMERIC(15,2) DEFAULT 0,
  total_pagos NUMERIC(15,2) DEFAULT 0,
  total_pendentes NUMERIC(15,2) DEFAULT 0,
  entries_created INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  processing_log JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  CONSTRAINT boleto_reports_status_check CHECK (status IN ('PROCESSING', 'COMPLETED', 'ERROR'))
);

-- Criar tabela para itens do relatório
CREATE TABLE IF NOT EXISTS boleto_report_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES boleto_reports(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  invoice_id UUID REFERENCES invoices(id),
  boleto_number TEXT NOT NULL,
  pagador TEXT NOT NULL,
  competence TEXT NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  amount NUMERIC(15,2) NOT NULL,
  liquidation_amount NUMERIC(15,2),
  status TEXT NOT NULL,
  provisioned BOOLEAN DEFAULT false,
  settled BOOLEAN DEFAULT false,
  provision_entry_id UUID REFERENCES accounting_entries(id),
  settlement_entry_id UUID REFERENCES accounting_entries(id),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_boleto_reports_period ON boleto_reports(period_start, period_end);
CREATE INDEX idx_boleto_reports_created_at ON boleto_reports(created_at DESC);
CREATE INDEX idx_boleto_report_items_report_id ON boleto_report_items(report_id);
CREATE INDEX idx_boleto_report_items_client_id ON boleto_report_items(client_id);
CREATE INDEX idx_boleto_report_items_invoice_id ON boleto_report_items(invoice_id);

-- RLS Policies
ALTER TABLE boleto_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE boleto_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and accountants can view boleto reports"
  ON boleto_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins and accountants can create boleto reports"
  ON boleto_reports FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins and accountants can update boleto reports"
  ON boleto_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins can delete boleto reports"
  ON boleto_reports FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and accountants can view boleto report items"
  ON boleto_report_items FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins and accountants can create boleto report items"
  ON boleto_report_items FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins and accountants can update boleto report items"
  ON boleto_report_items FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins can delete boleto report items"
  ON boleto_report_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));