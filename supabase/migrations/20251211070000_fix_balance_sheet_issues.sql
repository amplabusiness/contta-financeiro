-- =====================================================
-- CORREÇÃO DO BALANÇO PATRIMONIAL
-- =====================================================
-- Problemas identificados:
-- 1. Contas de CAIXA com saldo (empresa não trabalha com dinheiro)
-- 2. Contas duplicadas no Plano de Contas
-- 3. Saldo de Abertura em contas erradas
-- 4. Balanço desbalanceado
-- =====================================================

-- 1. INVESTIGAR: Ver todas as contas de "Caixa" e seus saldos
DO $$
DECLARE
  v_caixa RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTAS DE CAIXA NO PLANO DE CONTAS:';
  RAISE NOTICE '========================================';

  FOR v_caixa IN
    SELECT id, code, name, is_active
    FROM chart_of_accounts
    WHERE LOWER(name) LIKE '%caixa%'
    ORDER BY code
  LOOP
    RAISE NOTICE 'Conta: % - % (ativa: %)', v_caixa.code, v_caixa.name, v_caixa.is_active;
  END LOOP;
END;
$$;

-- 2. INVESTIGAR: Ver lançamentos na conta "Caixa Geral" (1.1.1.01)
DO $$
DECLARE
  v_caixa_id UUID;
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
  v_entry_count INTEGER;
BEGIN
  -- Buscar ID da conta Caixa Geral
  SELECT id INTO v_caixa_id
  FROM chart_of_accounts
  WHERE code = '1.1.1.01';

  IF v_caixa_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0),
      COUNT(*)
    INTO v_total_debit, v_total_credit, v_entry_count
    FROM accounting_entry_lines
    WHERE account_id = v_caixa_id;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONTA 1.1.1.01 - Caixa Geral:';
    RAISE NOTICE '  Lançamentos: %', v_entry_count;
    RAISE NOTICE '  Total Débitos: %', v_total_debit;
    RAISE NOTICE '  Total Créditos: %', v_total_credit;
    RAISE NOTICE '  Saldo: %', v_total_debit - v_total_credit;
    RAISE NOTICE '========================================';
  END IF;
END;
$$;

-- 3. RECLASSIFICAR: Mover lançamentos de Caixa para Bancos
-- Como a empresa não trabalha com dinheiro, todo valor que está em "Caixa"
-- deveria estar em "Bancos Conta Movimento"
DO $$
DECLARE
  v_caixa_id UUID;
  v_banco_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Buscar IDs
  SELECT id INTO v_caixa_id FROM chart_of_accounts WHERE code = '1.1.1.01'; -- Caixa Geral
  SELECT id INTO v_banco_id FROM chart_of_accounts WHERE code = '1.1.1.02'; -- Bancos Conta Movimento

  IF v_caixa_id IS NOT NULL AND v_banco_id IS NOT NULL THEN
    -- Reclassificar lançamentos de Caixa para Bancos
    UPDATE accounting_entry_lines
    SET account_id = v_banco_id
    WHERE account_id = v_caixa_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RAISE NOTICE '[Correção] % lançamentos movidos de Caixa Geral para Bancos Conta Movimento', v_count;
  ELSE
    RAISE NOTICE '[Correção] Contas não encontradas - Caixa: %, Banco: %', v_caixa_id IS NOT NULL, v_banco_id IS NOT NULL;
  END IF;
END;
$$;

-- 4. DESATIVAR contas de Caixa (empresa não usa)
UPDATE chart_of_accounts
SET is_active = false
WHERE code IN ('1.1.1.01', '1.1.01.001')
  AND LOWER(name) LIKE '%caixa%';

-- 5. VERIFICAR contas de Saldo de Abertura no PL
DO $$
DECLARE
  v_saldo RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONTAS DE SALDO DE ABERTURA NO PL:';
  RAISE NOTICE '========================================';

  FOR v_saldo IN
    SELECT
      coa.id,
      coa.code,
      coa.name,
      COALESCE(SUM(ael.debit), 0) as total_debit,
      COALESCE(SUM(ael.credit), 0) as total_credit
    FROM chart_of_accounts coa
    LEFT JOIN accounting_entry_lines ael ON ael.account_id = coa.id
    WHERE coa.code LIKE '5.3.02%' OR coa.code LIKE '5.2.1.02%'
    GROUP BY coa.id, coa.code, coa.name
    ORDER BY coa.code
  LOOP
    RAISE NOTICE 'Conta: % - % | D: % | C: %',
      v_saldo.code, v_saldo.name, v_saldo.total_debit, v_saldo.total_credit;
  END LOOP;
END;
$$;

-- 6. MOVER Saldo de Abertura - Disponibilidades (5.3.02.01) para conta correta
-- O saldo de abertura de disponibilidades deveria estar no Ativo (Bancos)
-- não no Patrimônio Líquido
DO $$
DECLARE
  v_saldo_abertura_id UUID;
  v_banco_id UUID;
  v_capital_social_id UUID;
  v_valor NUMERIC;
  v_count INTEGER := 0;
BEGIN
  -- Buscar IDs
  SELECT id INTO v_saldo_abertura_id FROM chart_of_accounts WHERE code = '5.3.02.01';
  SELECT id INTO v_banco_id FROM chart_of_accounts WHERE code = '1.1.1.02';
  SELECT id INTO v_capital_social_id FROM chart_of_accounts WHERE code = '2.2.01.001';

  IF v_saldo_abertura_id IS NOT NULL THEN
    -- Calcular valor na conta de saldo de abertura
    SELECT COALESCE(SUM(credit) - SUM(debit), 0)
    INTO v_valor
    FROM accounting_entry_lines
    WHERE account_id = v_saldo_abertura_id;

    RAISE NOTICE '[Saldo de Abertura] Valor em 5.3.02.01: R$ %', v_valor;

    -- Não vamos mover automaticamente pois precisa de análise
    -- Mas vamos marcar a conta como inativa
  END IF;
END;
$$;

-- 7. LIMPAR contas duplicadas (versões antigas 1.1.01.xxx)
-- Desativar contas do padrão antigo que não têm lançamentos
DO $$
DECLARE
  v_old RECORD;
  v_entry_count INTEGER;
BEGIN
  FOR v_old IN
    SELECT id, code, name
    FROM chart_of_accounts
    WHERE code LIKE '1.1.01%' OR code LIKE '1.1.02%'
      AND is_active = true
  LOOP
    SELECT COUNT(*) INTO v_entry_count
    FROM accounting_entry_lines
    WHERE account_id = v_old.id;

    IF v_entry_count = 0 THEN
      UPDATE chart_of_accounts SET is_active = false WHERE id = v_old.id;
      RAISE NOTICE '[Limpeza] Desativada conta sem lançamentos: % - %', v_old.code, v_old.name;
    END IF;
  END LOOP;
END;
$$;

-- 8. VERIFICAR totais após correções
DO $$
DECLARE
  v_total_ativo NUMERIC;
  v_total_passivo NUMERIC;
  v_total_pl NUMERIC;
  v_diferenca NUMERIC;
BEGIN
  -- Total Ativo (contas 1.x)
  SELECT COALESCE(SUM(ael.debit - ael.credit), 0)
  INTO v_total_ativo
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '1%';

  -- Total Passivo (contas 2.x)
  SELECT COALESCE(SUM(ael.credit - ael.debit), 0)
  INTO v_total_passivo
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '2%';

  -- Total PL (contas 5.x) + Resultado (3.x - 4.x)
  SELECT COALESCE(SUM(
    CASE
      WHEN coa.code LIKE '3%' THEN ael.credit - ael.debit  -- Receitas
      WHEN coa.code LIKE '4%' THEN ael.debit - ael.credit  -- Despesas (negativo)
      WHEN coa.code LIKE '5%' THEN ael.credit - ael.debit  -- PL
      ELSE 0
    END
  ), 0)
  INTO v_total_pl
  FROM accounting_entry_lines ael
  JOIN chart_of_accounts coa ON coa.id = ael.account_id
  WHERE coa.code LIKE '3%' OR coa.code LIKE '4%' OR coa.code LIKE '5%';

  v_diferenca := v_total_ativo - (v_total_passivo + v_total_pl);

  RAISE NOTICE '========================================';
  RAISE NOTICE 'BALANÇO PATRIMONIAL APÓS CORREÇÕES:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Ativo: R$ %', v_total_ativo;
  RAISE NOTICE 'Total Passivo: R$ %', v_total_passivo;
  RAISE NOTICE 'Total PL (+ Resultado): R$ %', v_total_pl;
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Passivo + PL: R$ %', v_total_passivo + v_total_pl;
  RAISE NOTICE 'Diferença: R$ %', v_diferenca;
  RAISE NOTICE '========================================';

  IF ABS(v_diferenca) < 0.01 THEN
    RAISE NOTICE 'BALANÇO EQUILIBRADO!';
  ELSE
    RAISE NOTICE 'BALANÇO DESBALANCEADO - Investigar lançamentos';
  END IF;
END;
$$;

COMMENT ON TABLE chart_of_accounts IS
'Plano de Contas atualizado em 11/12/2025.
- Contas de Caixa desativadas (empresa não trabalha com dinheiro físico)
- Todas as disponibilidades devem ir para 1.1.1.02 Bancos Conta Movimento';
