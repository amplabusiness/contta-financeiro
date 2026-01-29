-- ============================================================================
-- CORRIGIR FUNÇÃO increment_rule_usage
-- Data: 2026-01-11
--
-- PROBLEMA: A função foi criada com parâmetro "p_rule_id" mas o código
-- frontend chama via RPC com "rule_id". Isso causa erro 404.
-- ============================================================================

-- Remover função antiga (se existir com qualquer assinatura)
DROP FUNCTION IF EXISTS public.increment_rule_usage(UUID);

-- Criar função com o nome de parâmetro correto
CREATE OR REPLACE FUNCTION public.increment_rule_usage(rule_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE classification_rules
  SET usage_count = COALESCE(usage_count, 0) + 1,
      last_used_at = NOW()
  WHERE id = rule_id;
END;
$$;

-- Verificação
DO $$
BEGIN
  RAISE NOTICE 'Função increment_rule_usage criada/atualizada com sucesso.';
  RAISE NOTICE 'Parâmetro: rule_id UUID';
END $$;
