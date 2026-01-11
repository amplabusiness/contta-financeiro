-- ============================================
-- CONFIGURAÇÃO DE AUTOMAÇÃO - SUPABASE
-- ============================================
-- Este arquivo configura triggers e cron jobs para
-- automatizar o fluxo contábil da AMPLA
-- ============================================

-- ============================================
-- 1. EXTENSÕES NECESSÁRIAS
-- ============================================

-- Extensão para HTTP requests (chamar Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Extensão para Cron Jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- 2. TRIGGER: PROCESSAR OFX AUTOMATICAMENTE
-- ============================================

-- Função que dispara quando um arquivo OFX é enviado
CREATE OR REPLACE FUNCTION public.trigger_processar_ofx()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Só processar arquivos .ofx
  IF NEW.name NOT LIKE '%.ofx' AND NEW.name NOT LIKE '%.OFX' THEN
    RETURN NEW;
  END IF;

  -- Só processar no bucket 'imports'
  IF NEW.bucket_id != 'imports' THEN
    RETURN NEW;
  END IF;

  -- Buscar configurações
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- Chamar Edge Function de forma assíncrona
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/processar-ofx',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'bucket', NEW.bucket_id,
      'name', NEW.name,
      'created_at', NEW.created_at
    )::text
  );

  -- Log
  RAISE NOTICE 'OFX trigger: Processando arquivo %', NEW.name;

  RETURN NEW;
END;
$$;

-- Criar trigger no storage
DROP TRIGGER IF EXISTS on_ofx_uploaded ON storage.objects;
CREATE TRIGGER on_ofx_uploaded
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_processar_ofx();

-- ============================================
-- 3. CRON JOB: GERAR HONORÁRIOS MENSAIS
-- ============================================

-- Agenda para dia 28 de cada mês às 08:00 (horário de Brasília = UTC-3)
SELECT cron.schedule(
  'gerar-honorarios-mensal',
  '0 11 28 * *',  -- 11:00 UTC = 08:00 Brasília
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gerar-honorarios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'competencia', to_char(CURRENT_DATE, 'YYYY-MM')
    )::text
  );
  $$
);

-- ============================================
-- 4. CRON JOB: VERIFICAÇÃO DIÁRIA DE INTEGRIDADE
-- ============================================

-- Agenda para todos os dias às 06:00 (horário de Brasília)
SELECT cron.schedule(
  'verificar-integridade-diaria',
  '0 9 * * *',  -- 09:00 UTC = 06:00 Brasília
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/mcp-guardiao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'ferramenta', 'diagnostico_completo',
      'params', '{}'::jsonb
    )::text
  );
  $$
);

-- ============================================
-- 5. FUNÇÃO: VALIDAR LANÇAMENTO (RPC)
-- ============================================

-- Função RPC para validar lançamento antes de criar
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

-- ============================================
-- 9. PERMISSÕES
-- ============================================

-- Permitir chamada das funções RPC
GRANT EXECUTE ON FUNCTION public.validar_lancamento_contabil TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_equacao_contabil TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_saldo_transitoria TO authenticated;

-- Permitir leitura da view de diagnóstico
GRANT SELECT ON public.v_diagnostico_contabil TO authenticated;

-- ============================================
-- 10. COMENTÁRIOS (DOCUMENTAÇÃO)
-- ============================================

COMMENT ON FUNCTION public.trigger_processar_ofx IS
'Trigger que dispara automaticamente quando um arquivo OFX é enviado para o bucket imports';

COMMENT ON FUNCTION public.validar_lancamento_contabil IS
'Valida um lançamento contábil ANTES de criar, verificando: conta sintética, partidas dobradas, idempotência';

COMMENT ON FUNCTION public.verificar_equacao_contabil IS
'Verifica se a equação contábil está balanceada (Débitos = Créditos)';

COMMENT ON FUNCTION public.verificar_saldo_transitoria IS
'Verifica o saldo da conta transitória 1.1.9.01 (Recebimentos a Conciliar)';

COMMENT ON VIEW public.v_diagnostico_contabil IS
'View para diagnóstico rápido da integridade contábil do sistema';
