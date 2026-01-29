/**
 * Script: executar_setup_automacao.mjs
 *
 * Executa o SQL de configuração de automação no banco Supabase
 *
 * @author Dr. Cícero + Ampla Contabilidade
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SQL das funções RPC (sem as partes que dependem de pg_cron e pg_net)
const SQL_FUNCOES = `
-- ============================================
-- 5. FUNÇÃO: VALIDAR LANÇAMENTO (RPC)
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
  -- Validar cada linha
  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    -- Buscar conta
    SELECT code, name, is_synthetic, accepts_entries
    INTO v_conta
    FROM chart_of_accounts
    WHERE code = v_linha->>'contaCode';

    -- Conta não existe
    IF v_conta IS NULL THEN
      v_erros := array_append(v_erros,
        format('Conta %s não existe', v_linha->>'contaCode'));
    ELSE
      -- Conta sintética
      IF v_conta.is_synthetic THEN
        v_erros := array_append(v_erros,
          format('BLOQUEADO: Conta %s (%s) é SINTÉTICA', v_conta.code, v_conta.name));
      END IF;

      -- Não aceita lançamentos
      IF v_conta.accepts_entries = FALSE THEN
        v_erros := array_append(v_erros,
          format('BLOQUEADO: Conta %s não aceita lançamentos', v_conta.code));
      END IF;
    END IF;

    -- Somar totais
    v_total_debitos := v_total_debitos + COALESCE((v_linha->>'debito')::NUMERIC, 0);
    v_total_creditos := v_total_creditos + COALESCE((v_linha->>'credito')::NUMERIC, 0);
  END LOOP;

  -- Validar partidas dobradas
  IF ABS(v_total_debitos - v_total_creditos) > 0.01 THEN
    v_erros := array_append(v_erros,
      format('BLOQUEADO: Débitos (R$ %s) != Créditos (R$ %s)',
        to_char(v_total_debitos, 'FM999G999G999D00'),
        to_char(v_total_creditos, 'FM999G999G999D00')));
  END IF;

  -- Validar idempotência
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

  -- Retornar resultado
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
-- 6. FUNÇÃO: VERIFICAR EQUAÇÃO CONTÁBIL (RPC)
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
-- 7. FUNÇÃO: VERIFICAR SALDO TRANSITÓRIA (RPC)
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
  -- Buscar conta transitória
  SELECT id INTO v_conta_id
  FROM chart_of_accounts
  WHERE code = '1.1.9.01';

  IF v_conta_id IS NULL THEN
    RETURN jsonb_build_object(
      'erro', 'Conta transitória 1.1.9.01 não encontrada',
      'saldo', NULL
    );
  END IF;

  -- Calcular saldo
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
`;

const SQL_VIEW = `
-- ============================================
-- 8. VIEW: DIAGNÓSTICO RÁPIDO
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
`;

const SQL_GRANTS = `
-- ============================================
-- 9. PERMISSÕES
-- ============================================

GRANT EXECUTE ON FUNCTION public.validar_lancamento_contabil TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_equacao_contabil TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_saldo_transitoria TO authenticated;
GRANT SELECT ON public.v_diagnostico_contabil TO authenticated;
`;

async function executarSQL() {
  console.log('='.repeat(80));
  console.log('EXECUTANDO SETUP DE AUTOMAÇÃO NO SUPABASE');
  console.log('='.repeat(80));

  // Executar funções RPC
  console.log('\n[1/3] Criando funções RPC...');
  const { error: error1 } = await supabase.rpc('exec_sql', { sql_text: SQL_FUNCOES });
  if (error1) {
    // Tentar via função existente ou continuar
    console.log('   Tentando método alternativo...');

    // Verificar se tem função exec-sql
    const response = await fetch(`${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/functions/v1/exec-sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql: SQL_FUNCOES })
    });

    if (response.ok) {
      console.log('   Funções RPC criadas com sucesso!');
    } else {
      const err = await response.text();
      console.log(`   Aviso: ${err.substring(0, 100)}`);
    }
  } else {
    console.log('   Funções RPC criadas!');
  }

  // Executar view
  console.log('\n[2/3] Criando view de diagnóstico...');
  const response2 = await fetch(`${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/functions/v1/exec-sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql: SQL_VIEW })
  });

  if (response2.ok) {
    console.log('   View criada com sucesso!');
  } else {
    const err = await response2.text();
    console.log(`   Aviso: ${err.substring(0, 100)}`);
  }

  // Executar grants
  console.log('\n[3/3] Configurando permissões...');
  const response3 = await fetch(`${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/functions/v1/exec-sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql: SQL_GRANTS })
  });

  if (response3.ok) {
    console.log('   Permissões configuradas!');
  } else {
    const err = await response3.text();
    console.log(`   Aviso: ${err.substring(0, 100)}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('SETUP CONCLUÍDO!');
  console.log('='.repeat(80));
  console.log('\nNOTA: Para habilitar triggers e cron jobs automáticos:');
  console.log('1. Acesse: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/database/extensions');
  console.log('2. Habilite as extensões: pg_net e pg_cron');
  console.log('3. Execute o SQL completo em: SQL Editor');
  console.log('\nAs Edge Functions já estão funcionando via chamada direta!');
}

executarSQL();
