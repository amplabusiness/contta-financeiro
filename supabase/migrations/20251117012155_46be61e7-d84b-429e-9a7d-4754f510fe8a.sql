-- Migration: Add Barter/Trade Exchange Client Support
-- Clients who exchange services instead of monetary payment

-- Add barter fields to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_barter BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS barter_monthly_credit DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS barter_description TEXT,
ADD COLUMN IF NOT EXISTS barter_start_date DATE;

-- Add comments
COMMENT ON COLUMN clients.is_barter IS 'Indica se o cliente está em regime de permuta/escambo';
COMMENT ON COLUMN clients.barter_monthly_credit IS 'Valor mensal de crédito gerado pela permuta (ex: 1 salário mínimo)';
COMMENT ON COLUMN clients.barter_description IS 'Descrição dos serviços permutados (ex: Serviços de salão de beleza)';
COMMENT ON COLUMN clients.barter_start_date IS 'Data de início do acordo de permuta';

-- Create barter_credits table to track credit movements
CREATE TABLE IF NOT EXISTS public.barter_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference_date DATE NOT NULL,
  competence TEXT, -- Format: MM/YYYY
  balance_before DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_after DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_barter_credits_client_id ON public.barter_credits(client_id);
CREATE INDEX IF NOT EXISTS idx_barter_credits_reference_date ON public.barter_credits(reference_date DESC);
CREATE INDEX IF NOT EXISTS idx_barter_credits_competence ON public.barter_credits(competence);
CREATE INDEX IF NOT EXISTS idx_clients_barter ON public.clients(is_barter) WHERE is_barter = true;

-- Add comments
COMMENT ON TABLE public.barter_credits IS 'Movimentações de créditos de permuta dos clientes';
COMMENT ON COLUMN public.barter_credits.type IS 'Tipo de movimentação: credit (crédito mensal) ou debit (consumo de serviços)';
COMMENT ON COLUMN public.barter_credits.amount IS 'Valor da movimentação';
COMMENT ON COLUMN public.barter_credits.description IS 'Descrição da movimentação';
COMMENT ON COLUMN public.barter_credits.reference_date IS 'Data de referência da movimentação';
COMMENT ON COLUMN public.barter_credits.competence IS 'Competência da movimentação (MM/YYYY)';
COMMENT ON COLUMN public.barter_credits.balance_before IS 'Saldo antes da movimentação';
COMMENT ON COLUMN public.barter_credits.balance_after IS 'Saldo após a movimentação';

-- Enable RLS
ALTER TABLE public.barter_credits ENABLE ROW LEVEL SECURITY;

-- Create policies for barter_credits
CREATE POLICY "Users can view barter credits"
  ON public.barter_credits FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert barter credits"
  ON public.barter_credits FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update barter credits"
  ON public.barter_credits FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete barter credits"
  ON public.barter_credits FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Create function to calculate current balance
CREATE OR REPLACE FUNCTION get_barter_balance(p_client_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance DECIMAL(10,2);
BEGIN
  SELECT COALESCE(
    SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END),
    0
  )
  INTO v_balance
  FROM barter_credits
  WHERE client_id = p_client_id;

  RETURN v_balance;
END;
$$;

COMMENT ON FUNCTION get_barter_balance IS 'Calcula o saldo atual de créditos de permuta de um cliente';

-- Create function to add barter credit
CREATE OR REPLACE FUNCTION add_barter_credit(
  p_client_id UUID,
  p_type TEXT,
  p_amount DECIMAL(10,2),
  p_description TEXT,
  p_reference_date DATE,
  p_competence TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_balance_before DECIMAL(10,2);
  v_balance_after DECIMAL(10,2);
BEGIN
  -- Get current balance
  v_balance_before := get_barter_balance(p_client_id);

  -- Calculate new balance
  IF p_type = 'credit' THEN
    v_balance_after := v_balance_before + p_amount;
  ELSE
    v_balance_after := v_balance_before - p_amount;
  END IF;

  -- Insert movement
  INSERT INTO barter_credits (
    client_id,
    type,
    amount,
    description,
    reference_date,
    competence,
    balance_before,
    balance_after,
    created_by
  ) VALUES (
    p_client_id,
    p_type,
    p_amount,
    p_description,
    p_reference_date,
    p_competence,
    v_balance_before,
    v_balance_after,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION add_barter_credit IS 'Adiciona uma movimentação de crédito de permuta e calcula saldos';