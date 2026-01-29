-- ============================================
-- CONFIGURAÇÃO DE AUTOMAÇÃO - SUPABASE (SIMPLIFICADO)
-- ============================================
-- Execute este SQL no SQL Editor do Supabase
-- As extensões pg_net e pg_cron já estão habilitadas
-- ============================================

-- ============================================
-- 1. FUNÇÃO: VALIDAR LANÇAMENTO (RPC)
-- ============================================

CREATE OR REPLACE FUNCTION public.validar_lancamento_contabil(
  p_linhas JSONB,
  p_reference_type TEXT,
  p_reference_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_erros TEXT[] := '{}';
  v_avisos TEXT[] := '{}';
  v_linha JSONB;
  v_conta RECORD;
  v_total_debitos NUMERIC := 0;
  v_total_creditos NUMERIC := 0;
  v_existe_duplicado INTEGER;
BEGIN
  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    SELECT code, name, is_synthetic, accepts_entries
    INTO v_conta
    FROM chart_of_accounts
    WHERE code = v_linha->>'contaCode';

    IF v_conta IS NULL THEN
      v_erros := array_append(v_erros,
        format('Conta %s não existe', v_linha->>'contaCode'));
    ELSE
      IF v_conta.is_synthetic THEN
        v_erros := array_append(v_erros,
          format('BLOQUEADO: Conta %s (%s) é SINTÉTICA', v_conta.code, v_conta.name));
      END IF;
      IF v_conta.accepts_entries = FALSE THEN
        v_erros := array_append(v_erros,
          format('BLOQUEADO: Conta %s não aceita lançamentos', v_conta.code));
      END IF;
    END IF;

    v_total_debitos := v_total_debitos + COALESCE((v_linha->>'debito')::NUMERIC, 0);
    v_total_creditos := v_total_creditos + COALESCE((v_linha->>'credito')::NUMERIC, 0);
  END LOOP;

  IF ABS(v_total_debitos - v_total_creditos) > 0.01 THEN
    v_erros := array_append(v_erros,
      format('BLOQUEADO: Débitos (R$ %s) != Créditos (R$ %s)',
        to_char(v_total_debitos, 'FM999G999G999D00'),
        to_char(v_total_creditos, 'FM999G999G999D00')));
  END IF;

  IF p_reference_id IS NOT NULL AND p_reference_id != '' THEN
    SELECT COUNT(*) INTO v_existe_duplicado
    FROM accounting_entries
    WHERE reference_id = p_reference_id
      AND reference_type = COALESCE(p_reference_type, 'unknown');

    IF v_existe_duplicado > 0 THEN
      v_erros := array_append(v_erros,
        format('BLOQUEADO: Já existe lançamento com referenceId=%s', p_reference_id));
    END IF;
  ELSE
    v_avisos := array_append(v_avisos, 'referenceId não informado - risco de duplicação');
  END IF;

  RETURN jsonb_build_object(
    'valido', array_length(v_erros, 1) IS NULL,
    'podeExecutar', array_length(v_erros, 1) IS NULL,
    'erros', to_jsonb(v_erros),
    'avisos', to_jsonb(v_avisos),
    'totalDebitos', v_total_debitos,
    'totalCreditos', v_total_creditos
  );
END;
$$;

-- ============================================
-- 2. FUNÇÃO: VERIFICAR EQUAÇÃO CONTÁBIL (RPC)
-- ============================================

CREATE OR REPLACE FUNCTION public.verificar_equacao_contabil()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_debitos NUMERIC;
  v_total_creditos NUMERIC;
  v_diferenca NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_total_debitos, v_total_creditos
  FROM accounting_entry_lines;

  v_diferenca := ABS(v_total_debitos - v_total_creditos);

  RETURN jsonb_build_object(
    'totalDebitos', v_total_debitos,
    'totalCreditos', v_total_creditos,
    'diferenca', v_diferenca,
    'balanceada', v_diferenca < 0.01,
    'status', CASE WHEN v_diferenca < 0.01 THEN 'BALANCEADA' ELSE 'DESBALANCEADA' END
  );
END;
$$;

-- ============================================
-- 3. FUNÇÃO: VERIFICAR SALDO TRANSITÓRIA (RPC)
-- ============================================

CREATE OR REPLACE FUNCTION public.verificar_saldo_transitoria()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conta_id UUID;
  v_saldo NUMERIC;
BEGIN
  SELECT id INTO v_conta_id
  FROM chart_of_accounts
  WHERE code = '1.1.9.01';

  IF v_conta_id IS NULL THEN
    RETURN jsonb_build_object(
      'erro', 'Conta transitória 1.1.9.01 não encontrada',
      'saldo', NULL
    );
  END IF;

  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
  INTO v_saldo
  FROM accounting_entry_lines
  WHERE account_id = v_conta_id;

  RETURN jsonb_build_object(
    'contaCode', '1.1.9.01',
    'saldo', v_saldo,
    'status', CASE WHEN ABS(v_saldo) < 0.01 THEN 'ZERADA' ELSE 'PENDENTE' END,
    'mensagem', CASE
      WHEN ABS(v_saldo) < 0.01 THEN 'Todas as conciliações foram feitas'
      ELSE format('R$ %s pendentes de desmembramento', to_char(v_saldo, 'FM999G999G999D00'))
    END
  );
END;
$$;

-- ============================================
-- 4. VIEW: DIAGNÓSTICO RÁPIDO
-- ============================================

CREATE OR REPLACE VIEW public.v_diagnostico_contabil AS
SELECT
  (SELECT jsonb_build_object(
    'totalDebitos', SUM(debit),
    'totalCreditos', SUM(credit),
    'diferenca', ABS(SUM(debit) - SUM(credit)),
    'balanceada', ABS(SUM(debit) - SUM(credit)) < 0.01
  ) FROM accounting_entry_lines) AS equacao_contabil,

  (SELECT COUNT(*)
   FROM accounting_entry_lines ael
   JOIN chart_of_accounts coa ON ael.account_id = coa.id
   WHERE coa.code = '1.1.2.01') AS lancamentos_sintetica,

  (SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
   FROM accounting_entry_lines ael
   JOIN chart_of_accounts coa ON ael.account_id = coa.id
   WHERE coa.code = '1.1.9.01') AS saldo_transitoria,

  (SELECT COUNT(*)
   FROM accounting_entry_lines ael
   WHERE NOT EXISTS (
     SELECT 1 FROM accounting_entries ae WHERE ae.id = ael.entry_id
   )) AS linhas_orfas,

  NOW() AS verificado_em;

-- ============================================
-- 5. PERMISSÕES
-- ============================================

GRANT EXECUTE ON FUNCTION public.validar_lancamento_contabil TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_equacao_contabil TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_saldo_transitoria TO authenticated;
GRANT SELECT ON public.v_diagnostico_contabil TO authenticated;

-- ============================================
-- PRONTO! Funções RPC e View criadas.
-- ============================================
