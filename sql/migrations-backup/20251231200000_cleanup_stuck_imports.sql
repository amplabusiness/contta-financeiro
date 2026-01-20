-- Limpeza de importações travadas com status 'processing'
-- Essas importações ficaram travadas e não foram concluídas

-- Primeiro, deletar os registros de importação com status 'processing'
-- que têm 0 transações novas e 0 duplicadas (importações vazias/travadas)
DELETE FROM bank_imports
WHERE status = 'processing'
  AND (new_transactions = 0 OR new_transactions IS NULL)
  AND (duplicated_transactions = 0 OR duplicated_transactions IS NULL);

-- Para importações 'processing' que possam ter dados, marcar como 'failed'
-- ao invés de deletar, para preservar histórico
UPDATE bank_imports
SET status = 'failed',
    error_message = 'Importação interrompida - marcada como falha durante limpeza automática'
WHERE status = 'processing';

COMMENT ON TABLE bank_imports IS 'Histórico de importações bancárias - Importações travadas limpas em 31/12/2024';
