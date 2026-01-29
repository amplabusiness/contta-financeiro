-- =============================================================================
-- MODELO DE APROVAÇÃO DO DR. CÍCERO (DRAFT → APPROVED → CLOSED / INVALIDATED)
-- =============================================================================

-- 1) Evolução da tabela accounting_closures
ALTER TABLE accounting_closures
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalidated_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounting_closures_status_check'
  ) THEN
    ALTER TABLE accounting_closures
      ADD CONSTRAINT accounting_closures_status_check
      CHECK (status IN ('DRAFT', 'APPROVED', 'CLOSED', 'INVALIDATED'));
  END IF;
END $$;

-- 2) Funções de apoio
CREATE OR REPLACE FUNCTION fn_invalidate_closure(
  p_tenant_id uuid,
  p_year int,
  p_month int,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM accounting_closures
  WHERE tenant_id = p_tenant_id
    AND year = p_year
    AND month = p_month
    AND status = 'APPROVED'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE accounting_closures
    SET status = 'INVALIDATED',
        invalidated_at = now(),
        invalidated_reason = p_reason
    WHERE id = v_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_invalidate_all_approved(
  p_tenant_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE accounting_closures
  SET status = 'INVALIDATED',
      invalidated_at = now(),
      invalidated_reason = p_reason
  WHERE tenant_id = p_tenant_id
    AND status = 'APPROVED';
END $$;

CREATE OR REPLACE FUNCTION fn_check_closure_for_change(
  p_tenant_id uuid,
  p_date date,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_year int;
  v_month int;
BEGIN
  IF p_tenant_id IS NULL OR p_date IS NULL THEN
    RETURN;
  END IF;

  v_year := EXTRACT(YEAR FROM p_date);
  v_month := EXTRACT(MONTH FROM p_date);

  -- Se período já está CLOSED, bloquear
  IF EXISTS (
    SELECT 1 FROM accounting_closures
    WHERE tenant_id = p_tenant_id
      AND year = v_year
      AND month = v_month
      AND status = 'CLOSED'
  ) THEN
    RAISE EXCEPTION 'Período fechado (%/%). Reabertura exige novo ciclo contábil.', v_month, v_year;
  END IF;

  -- Se estava APPROVED, invalidar
  PERFORM fn_invalidate_closure(p_tenant_id, v_year, v_month, p_reason);
END $$;

CREATE OR REPLACE FUNCTION approve_closure(
  p_closure_id uuid,
  p_current_input_hash text,
  p_approved_by uuid
) RETURNS accounting_closures
LANGUAGE plpgsql
AS $$
DECLARE
  v_row accounting_closures;
  v_authorized boolean;
BEGIN
  SELECT * INTO v_row FROM accounting_closures WHERE id = p_closure_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Parecer não encontrado';
  END IF;

  v_authorized := COALESCE((v_row.decision->>'authorized')::boolean, false);
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Parecer não autorizado pelo Dr. Cícero';
  END IF;

  IF v_row.input_hash <> p_current_input_hash THEN
    RAISE EXCEPTION 'Hash inválido: dados mudaram após o parecer';
  END IF;

  UPDATE accounting_closures
  SET status = 'APPROVED',
      approved_at = now(),
      approved_by = p_approved_by
  WHERE id = p_closure_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION close_month_guarded(
  p_tenant_id uuid,
  p_year int,
  p_month int,
  p_user_id uuid,
  p_notes text,
  p_input_hash text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_closing_id uuid;
  v_approved_id uuid;
BEGIN
  SELECT id INTO v_approved_id
  FROM accounting_closures
  WHERE tenant_id = p_tenant_id
    AND year = p_year
    AND month = p_month
    AND status = 'APPROVED'
    AND input_hash = p_input_hash
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_approved_id IS NULL THEN
    RAISE EXCEPTION 'Fechamento negado: não existe parecer APPROVED válido para o hash atual';
  END IF;

  -- Executa fechamento padrão
  v_closing_id := close_month(p_year, p_month, p_user_id, p_notes);

  -- Marca parecer como CLOSED
  UPDATE accounting_closures
  SET status = 'CLOSED',
      closed_at = now()
  WHERE id = v_approved_id;

  RETURN v_closing_id;
END $$;

-- 3) Triggers: invalidar APPROVED / bloquear CLOSED
CREATE OR REPLACE FUNCTION trg_accounting_entries_closure_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM fn_check_closure_for_change(OLD.tenant_id, OLD.entry_date, 'Alteração em accounting_entries');
    RETURN OLD;
  END IF;

  PERFORM fn_check_closure_for_change(NEW.tenant_id, NEW.entry_date, 'Alteração em accounting_entries');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_accounting_entries_closure_guard ON accounting_entries;
CREATE TRIGGER trg_accounting_entries_closure_guard
  BEFORE INSERT OR UPDATE OR DELETE ON accounting_entries
  FOR EACH ROW EXECUTE FUNCTION trg_accounting_entries_closure_guard();

CREATE OR REPLACE FUNCTION trg_accounting_entry_lines_closure_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_date date;
  v_tenant_id uuid;
  v_entry_id uuid;
BEGIN
  v_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);
  IF v_entry_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT entry_date, tenant_id INTO v_entry_date, v_tenant_id
  FROM accounting_entries
  WHERE id = v_entry_id;

  IF v_entry_date IS NOT NULL AND v_tenant_id IS NOT NULL THEN
    PERFORM fn_check_closure_for_change(v_tenant_id, v_entry_date, 'Alteração em accounting_entry_lines');
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_accounting_entry_lines_closure_guard ON accounting_entry_lines;
CREATE TRIGGER trg_accounting_entry_lines_closure_guard
  BEFORE INSERT OR UPDATE OR DELETE ON accounting_entry_lines
  FOR EACH ROW EXECUTE FUNCTION trg_accounting_entry_lines_closure_guard();

CREATE OR REPLACE FUNCTION trg_bank_transactions_closure_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM fn_check_closure_for_change(OLD.tenant_id, OLD.transaction_date, 'Alteração em bank_transactions');
    RETURN OLD;
  END IF;

  PERFORM fn_check_closure_for_change(NEW.tenant_id, NEW.transaction_date, 'Alteração em bank_transactions');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bank_transactions_closure_guard ON bank_transactions;
CREATE TRIGGER trg_bank_transactions_closure_guard
  BEFORE INSERT OR UPDATE OR DELETE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION trg_bank_transactions_closure_guard();

CREATE OR REPLACE FUNCTION trg_chart_of_accounts_invalidate_approved()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  IF v_tenant_id IS NOT NULL THEN
    PERFORM fn_invalidate_all_approved(v_tenant_id, 'Plano de contas alterado');
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_chart_of_accounts_invalidate_approved ON chart_of_accounts;
CREATE TRIGGER trg_chart_of_accounts_invalidate_approved
  BEFORE INSERT OR UPDATE OR DELETE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION trg_chart_of_accounts_invalidate_approved();
