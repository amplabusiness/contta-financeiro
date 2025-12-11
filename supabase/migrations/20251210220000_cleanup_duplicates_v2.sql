-- Migration para limpar duplicatas considerando reference_type singular/plural
-- Problema: Alguns lançamentos usam 'expense' e outros 'expenses', criando duplicatas

-- Passo 1: Remover constraint antiga se existir
DROP INDEX IF EXISTS idx_accounting_entries_unique_reference;

-- Passo 2: Normalizar reference_type (singular -> plural)
UPDATE accounting_entries SET reference_type = 'expenses' WHERE reference_type = 'expense';
UPDATE accounting_entries SET reference_type = 'invoices' WHERE reference_type = 'invoice';
UPDATE accounting_entries SET reference_type = 'expenses_payment' WHERE reference_type = 'expense_payment';
UPDATE accounting_entries SET reference_type = 'invoices_payment' WHERE reference_type = 'invoice_payment';

-- Passo 3: Identificar e manter apenas o primeiro lançamento de cada combinação
CREATE TEMP TABLE entries_to_keep_final AS
SELECT DISTINCT ON (reference_type, reference_id, entry_type) id
FROM accounting_entries
WHERE reference_id IS NOT NULL
ORDER BY reference_type, reference_id, entry_type, created_at ASC;

-- Passo 4: Deletar linhas de lançamentos duplicados
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT ae.id
  FROM accounting_entries ae
  WHERE ae.reference_id IS NOT NULL
    AND ae.id NOT IN (SELECT id FROM entries_to_keep_final)
);

-- Passo 5: Deletar os lançamentos duplicados
DELETE FROM accounting_entries
WHERE reference_id IS NOT NULL
  AND id NOT IN (SELECT id FROM entries_to_keep_final);

-- Limpar tabela temporária
DROP TABLE entries_to_keep_final;

-- Passo 6: Criar constraint única para prevenir futuras duplicatas
CREATE UNIQUE INDEX idx_accounting_entries_unique_reference
ON accounting_entries(reference_type, reference_id, entry_type)
WHERE reference_id IS NOT NULL;

-- Estatísticas após limpeza
DO $$
DECLARE
  entries_count INTEGER;
  lines_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO entries_count FROM accounting_entries;
  SELECT COUNT(*) INTO lines_count FROM accounting_entry_lines;
  RAISE NOTICE 'Limpeza v2 concluída: % lançamentos, % linhas', entries_count, lines_count;
END $$;
