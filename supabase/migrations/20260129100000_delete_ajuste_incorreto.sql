-- =====================================================
-- DELETAR LANÇAMENTO DE AJUSTE INCORRETO
-- Criado em: 29/01/2026
-- =====================================================
-- 
-- ANÁLISE DO LANÇAMENTO:
-- ID: 93ace5df-d999-41ce-bd44-df71004afa93
-- Data: 2025-01-31
-- Tipo: AJUSTE
-- Descrição: Ajuste de Conciliação Bancária - Janeiro/2025
-- 
-- MOTIVO DA DELEÇÃO:
-- 1. Este lançamento está causando uma diferença de R$ 132.047,06 no saldo do banco
-- 2. Saldo contábil: R$ -113.493,52 (errado)
-- 3. Saldo extrato: R$ 18.553,54 (correto)
-- 4. Diferença: R$ 132.047,06 = exatamente o valor deste lançamento
--
-- VERIFICAÇÕES REALIZADAS:
-- ✓ NÃO é saldo de abertura (entry_type = AJUSTE, não SALDO_ABERTURA)
-- ✓ NÃO é relacionado a clientes (sem reference_type, source_id, invoice)
-- ✓ NÃO corresponde a nenhuma soma conhecida de saldos
-- ✓ Foi criado recentemente (21/01/2026) como ajuste manual
-- ✓ Deletar fará o saldo do banco BATER com o extrato
--
-- ORIGEM PROVÁVEL:
-- Criado via interface do sistema ou script, junto com o saldo de abertura
-- do banco em 21/01/2026 às 19:33:17. Possivelmente um erro no processo
-- de conciliação que criou um ajuste espelho desnecessário.
-- =====================================================

BEGIN;

-- Configurar sessão para bypassar RLS
SET session_replication_role = replica;

-- 1. Deletar as linhas do lançamento (accounting_entry_lines)
DELETE FROM accounting_entry_lines 
WHERE entry_id = '93ace5df-d999-41ce-bd44-df71004afa93';

-- 2. Deletar os items do lançamento (accounting_entry_items) - caso existam
DELETE FROM accounting_entry_items 
WHERE entry_id = '93ace5df-d999-41ce-bd44-df71004afa93';

-- 3. Deletar o header do lançamento (accounting_entries)
DELETE FROM accounting_entries 
WHERE id = '93ace5df-d999-41ce-bd44-df71004afa93'
  AND tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';

-- Restaurar sessão
SET session_replication_role = DEFAULT;

-- 5. Verificar se foi deletado
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM accounting_entry_lines
  WHERE entry_id = '93ace5df-d999-41ce-bd44-df71004afa93';
  
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ERRO: Linhas do lançamento não foram deletadas!';
  ELSE
    RAISE NOTICE '✓ Linhas do lançamento deletadas com sucesso!';
  END IF;
END $$;

COMMIT;
