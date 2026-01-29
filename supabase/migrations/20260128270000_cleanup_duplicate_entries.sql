-- =====================================================
-- Migration: Remover duplicações entre items e lines
-- Data: 28/01/2026
-- Descrição: Remove registros de accounting_entry_lines
--            que já existem em accounting_entry_items
--            (mesmo account_id, mesma data, mesmo valor)
-- =====================================================

-- Desabilitar RLS temporariamente para esta migração
SET session_replication_role = 'replica';

-- Identificar e deletar linhas duplicadas
-- Um registro é duplicado se:
-- 1. Existe em accounting_entry_items com mesmo account_id
-- 2. O entry correspondente tem mesma data
-- 3. O valor (debit/credit) é igual

DO $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_line_record RECORD;
BEGIN
  RAISE NOTICE '=== INICIANDO LIMPEZA DE DUPLICAÇÕES ===';
  
  -- Criar tabela temporária com os entry_ids a deletar
  CREATE TEMP TABLE IF NOT EXISTS lines_to_delete AS
  SELECT DISTINCT ael.entry_id
  FROM accounting_entry_lines ael
  INNER JOIN accounting_entries ae_line ON ae_line.id = ael.entry_id
  WHERE EXISTS (
    SELECT 1
    FROM accounting_entry_items aei
    INNER JOIN accounting_entries ae_item ON ae_item.id = aei.entry_id
    WHERE aei.account_id = ael.account_id
      AND ae_item.entry_date = ae_line.entry_date
      AND aei.debit = ael.debit
      AND aei.credit = ael.credit
      AND aei.entry_id != ael.entry_id  -- entry_ids diferentes
  );

  -- Contar quantos serão deletados
  SELECT COUNT(*) INTO v_deleted_count FROM lines_to_delete;
  RAISE NOTICE 'Entries duplicados encontrados: %', v_deleted_count;

  -- Deletar as linhas duplicadas
  DELETE FROM accounting_entry_lines
  WHERE entry_id IN (SELECT entry_id FROM lines_to_delete);

  RAISE NOTICE 'Linhas deletadas de accounting_entry_lines';

  -- Deletar os entries órfãos (que não têm mais nenhuma linha)
  DELETE FROM accounting_entries ae
  WHERE ae.id IN (SELECT entry_id FROM lines_to_delete)
    AND NOT EXISTS (SELECT 1 FROM accounting_entry_lines ael WHERE ael.entry_id = ae.id)
    AND NOT EXISTS (SELECT 1 FROM accounting_entry_items aei WHERE aei.entry_id = ae.id);

  RAISE NOTICE 'Entries órfãos deletados';

  -- Limpar tabela temporária
  DROP TABLE IF EXISTS lines_to_delete;

  RAISE NOTICE '=== LIMPEZA CONCLUÍDA ===';
END $$;

-- Verificar resultado
DO $$
DECLARE
  v_items_count INTEGER;
  v_lines_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_items_count FROM accounting_entry_items;
  SELECT COUNT(*) INTO v_lines_count FROM accounting_entry_lines;
  
  RAISE NOTICE 'Total accounting_entry_items: %', v_items_count;
  RAISE NOTICE 'Total accounting_entry_lines: %', v_lines_count;
END $$;

-- Restaurar RLS
SET session_replication_role = 'origin';