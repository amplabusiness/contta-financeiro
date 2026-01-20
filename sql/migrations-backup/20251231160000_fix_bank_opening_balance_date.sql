-- =====================================================
-- CORRIGIR DATA DO SALDO DE ABERTURA DO BANCO SICREDI
-- A data deve ser 31/12/2024 para aparecer como Saldo Inicial
-- e não misturar com os movimentos de Janeiro/2025
-- =====================================================

BEGIN;

-- Corrigir a data do saldo de abertura do Banco Sicredi
-- de 2025-01-01 para 2024-12-31
UPDATE accounting_entries
SET entry_date = '2024-12-31',
    description = 'Saldo de Abertura - Sicredi em 31/12/2024'
WHERE entry_type = 'saldo_abertura'
  AND entry_date = '2025-01-01'
  AND description LIKE '%Sicredi%';

-- Verificação: mostrar o lançamento corrigido
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM accounting_entries
  WHERE entry_type = 'saldo_abertura'
    AND entry_date = '2024-12-31'
    AND description LIKE '%Sicredi%';

  RAISE NOTICE 'Lançamentos de abertura Sicredi em 31/12/2024: %', v_count;
END $$;

COMMIT;
