-- Migration para limpar lançamentos contábeis duplicados e prevenir novas duplicatas
-- Problema: A DRE mostra R$ 985.177,23 em "Outras Despesas Administrativas" quando deveria ser muito menos
-- Causa: A função smart-accounting criava múltiplos lançamentos para o mesmo registro (despesa, fatura, etc.)

-- Passo 1: Identificar e manter apenas o primeiro lançamento de cada combinação reference_type/reference_id/entry_type
-- Criar tabela temporária com os IDs a manter
CREATE TEMP TABLE entries_to_keep AS
SELECT DISTINCT ON (reference_type, reference_id, entry_type) id
FROM accounting_entries
WHERE reference_id IS NOT NULL
ORDER BY reference_type, reference_id, entry_type, created_at ASC;

-- Passo 2: Deletar linhas de lançamentos duplicados (que não estão na lista de manter)
DELETE FROM accounting_entry_lines
WHERE entry_id IN (
  SELECT ae.id
  FROM accounting_entries ae
  WHERE ae.reference_id IS NOT NULL
    AND ae.id NOT IN (SELECT id FROM entries_to_keep)
);

-- Passo 3: Deletar os lançamentos duplicados
DELETE FROM accounting_entries
WHERE reference_id IS NOT NULL
  AND id NOT IN (SELECT id FROM entries_to_keep);

-- Limpar tabela temporária
DROP TABLE entries_to_keep;

-- Passo 4: Adicionar constraint único para prevenir futuras duplicatas
-- Índice único para reference_type + reference_id + entry_type (quando reference_id não é null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_entries_unique_reference
ON accounting_entries(reference_type, reference_id, entry_type)
WHERE reference_id IS NOT NULL;

-- Comentário explicativo
COMMENT ON INDEX idx_accounting_entries_unique_reference IS
  'Previne duplicação de lançamentos contábeis: apenas 1 lançamento por combinação de reference_type/reference_id/entry_type';

-- Estatísticas após limpeza (para log)
DO $$
DECLARE
  entries_count INTEGER;
  lines_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO entries_count FROM accounting_entries;
  SELECT COUNT(*) INTO lines_count FROM accounting_entry_lines;
  RAISE NOTICE 'Limpeza concluída: % lançamentos, % linhas', entries_count, lines_count;
END $$;
