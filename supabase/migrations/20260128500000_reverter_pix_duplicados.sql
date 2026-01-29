-- Migration: Reverter PIX duplicados de Janeiro/2025
-- Data: 2026-01-28
-- Motivo: Os PIX já foram classificados pelo Dr. Cícero. A conta transitória
--         deveria estar zerada. Os lançamentos PIX_CLASS_* duplicaram classificações existentes.

-- Desabilitar RLS para esta operação
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_count INTEGER;
  v_total NUMERIC;
BEGIN
  RAISE NOTICE '=== REVERTENDO PIX DUPLICADOS ===';

  -- Contar lançamentos a deletar
  SELECT COUNT(*), COALESCE(SUM(total_debit), 0)
  INTO v_count, v_total
  FROM accounting_entries
  WHERE tenant_id = v_tenant_id
    AND internal_code LIKE 'PIX_CLASS_%';

  RAISE NOTICE 'Lançamentos encontrados: %', v_count;
  RAISE NOTICE 'Total a reverter: R$ %', v_total;

  -- Deletar as linhas primeiro (FK)
  DELETE FROM accounting_entry_lines
  WHERE entry_id IN (
    SELECT id FROM accounting_entries
    WHERE tenant_id = v_tenant_id
      AND internal_code LIKE 'PIX_CLASS_%'
  );

  RAISE NOTICE 'Lines deletadas';

  -- Deletar os entries
  DELETE FROM accounting_entries
  WHERE tenant_id = v_tenant_id
    AND internal_code LIKE 'PIX_CLASS_%';

  RAISE NOTICE 'Entries deletadas';
  RAISE NOTICE '=== REVERSÃO CONCLUÍDA ===';
  RAISE NOTICE 'Total revertido: R$ %', v_total;
END $$;

-- Restaurar RLS
SET session_replication_role = 'origin';
