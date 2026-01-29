-- ============================================================================
-- DESABILITAR TRIGGERS QUE USAM CONTA SINTÉTICA INCORRETAMENTE
-- Data: 2026-01-11
-- Autor: Dr. Cicero
--
-- PROBLEMA: Os triggers de blindagem estavam criando lançamentos diretamente
-- na conta sintética 1.1.2.01 (Clientes a Receber), violando a regra contábil
-- de que contas sintéticas NÃO podem receber lançamentos.
--
-- SOLUÇÃO: Desabilitar esses triggers até que sejam corrigidos para usar
-- as contas analíticas (1.1.2.01.xxxx) específicas de cada cliente.
-- ============================================================================

-- 1. Desabilitar trigger de saldo de abertura (blindagem)
DROP TRIGGER IF EXISTS trg_blindagem_saldo_abertura ON client_opening_balance;

-- 2. Desabilitar trigger antigo de saldo de abertura
DROP TRIGGER IF EXISTS trg_auto_accounting_opening_balance ON client_opening_balance;

-- 3. Comentário sobre o que precisa ser feito:
-- TODO: Criar novo trigger que:
--   a) Busque a conta analítica do cliente (1.1.2.01.xxxx) baseado no client_id
--   b) Se não existir, crie automaticamente
--   c) Use essa conta analítica como débito (não a sintética 1.1.2.01)
--   d) Use 5.2.1.01 (Lucros Acumulados) como contrapartida (não 5.3.02.02)

-- 4. Verificação
DO $$
BEGIN
  RAISE NOTICE 'Triggers de blindagem de saldo de abertura desabilitados com sucesso.';
  RAISE NOTICE 'IMPORTANTE: Novos saldos de abertura NÃO gerarão lançamentos automáticos.';
  RAISE NOTICE 'Use o script 33_lancamentos_saldo_abertura.cjs para criar lançamentos manualmente.';
END $$;
