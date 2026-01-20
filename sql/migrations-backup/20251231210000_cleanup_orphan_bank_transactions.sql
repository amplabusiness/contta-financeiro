-- Limpeza de transações bancárias órfãs
-- Essas transações foram importadas do OFX mas nunca convertidas em lançamentos contábeis
-- Com a remoção do Conciliador, o fluxo agora é: OFX -> Lançamentos Contábeis direto

-- Deletar todas as transações bancárias pendentes (não conciliadas)
-- que foram importadas mas nunca processadas
DELETE FROM bank_transactions
WHERE status = 'pending' OR status IS NULL;

-- Também limpar transações ignoradas que não fazem mais sentido
DELETE FROM bank_transactions
WHERE status = 'ignored';

-- Adicionar comentário explicativo
COMMENT ON TABLE bank_transactions IS 'Transações bancárias - Tabela legada. O novo fluxo importa direto para accounting_entries. Limpa em 31/12/2024.';
