-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | Regras de Classificação - GRUPOS ECONÔMICOS
-- Data: 02/02/2026
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- EXECUTE APÓS: SQL_FIX_AND_INSERT_RULES.sql
-- 
-- Adiciona regras especiais para identificar pagamentos de grupos econômicos.
-- Essas transações NÃO são classificadas automaticamente - vão para a RPC
-- reconcile_group_payment() que faz a baixa inteligente.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tenant UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════════
  -- REGRAS PARA GRUPO GISELI E CLEITON
  -- Prioridade 5 (antes dos bloqueios de sócio)
  -- Direção: credit (entrada de dinheiro)
  -- Conta: NULL (não classifica, vai para RPC de grupo)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  INSERT INTO classification_rules (
    tenant_id, priority, rule_name, match_type, match_value, direction,
    destination_account_id, requires_approval, notes
  ) VALUES 
    -- A.I Empreendimentos (pagador principal)
    (v_tenant, 5, 'GRUPO: PIX A.I Empreendimentos', 'ilike', '%A.I%EMPREENDIMENTOS%', 'credit',
     NULL, TRUE, 'PIX do grupo GISELI E CLEITON. Usar RPC reconcile_group_payment().'),
    (v_tenant, 5, 'GRUPO: PIX AI Empreendimentos', 'ilike', '%AI EMPREENDIMENTOS%', 'credit',
     NULL, TRUE, 'PIX do grupo GISELI E CLEITON.'),
    (v_tenant, 5, 'GRUPO: PIX IA Empreendimentos', 'ilike', '%IA EMPREENDIMENTOS%', 'credit',
     NULL, TRUE, 'PIX do grupo GISELI E CLEITON.'),
     
    -- Outros membros do grupo (caso paguem diretamente)
    (v_tenant, 5, 'GRUPO: PIX CAGI Roupas', 'ilike', '%CAGI%INDUSTRIA%', 'credit',
     NULL, TRUE, 'PIX do grupo GISELI E CLEITON.'),
    (v_tenant, 5, 'GRUPO: PIX P.A Roupas', 'ilike', '%P.A%INDUSTRIA%', 'credit',
     NULL, TRUE, 'PIX do grupo GISELI E CLEITON.'),
    (v_tenant, 5, 'GRUPO: PIX Cleiton Cesário', 'ilike', '%CLEITON%CESARIO%', 'credit',
     NULL, TRUE, 'PIX do grupo GISELI E CLEITON.'),
    (v_tenant, 5, 'GRUPO: PIX Gisele Espíndula', 'ilike', '%GISELE%ESPINDULA%', 'credit',
     NULL, TRUE, 'PIX do grupo GISELI E CLEITON.')
  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SAÍDAS para empresas do grupo (transferências)
  -- Prioridade 6 - requer aprovação
  -- ═══════════════════════════════════════════════════════════════════════════
  
  INSERT INTO classification_rules (
    tenant_id, priority, rule_name, match_type, match_value, direction,
    destination_account_id, requires_approval, notes
  ) VALUES 
    (v_tenant, 6, 'GRUPO: Transf A.I Empreend', 'ilike', '%A.I%EMPREEND%', 'debit',
     NULL, TRUE, 'Transferência para empresa do grupo. Verificar natureza: mútuo, rateio, pagamento.'),
    (v_tenant, 6, 'GRUPO: Transf CAGI', 'ilike', '%CAGI%', 'debit',
     NULL, TRUE, 'Transferência para empresa do grupo.'),
    (v_tenant, 6, 'GRUPO: Transf P.A Roupas', 'ilike', '%P.A%INDUSTRIA%', 'debit',
     NULL, TRUE, 'Transferência para empresa do grupo.')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '═════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Regras de grupos econômicos inseridas!';
  RAISE NOTICE '';
  RAISE NOTICE 'Regras adicionadas (prioridade 5-6):';
  RAISE NOTICE '  • PIX de entrada do grupo GISELI E CLEITON';
  RAISE NOTICE '  • Transferências para empresas do grupo';
  RAISE NOTICE '';
  RAISE NOTICE 'Fluxo:';
  RAISE NOTICE '  1. Classificador identifica PIX do grupo (prioridade 5)';
  RAISE NOTICE '  2. NÃO classifica automaticamente (requires_approval=TRUE)';
  RAISE NOTICE '  3. Runner chama reconcile_group_payment()';
  RAISE NOTICE '  4. RPC faz baixa inteligente em múltiplas faturas';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════════';
END $$;

-- Verificar regras inseridas
SELECT 
  priority,
  rule_name,
  direction,
  CASE WHEN destination_account_id IS NULL THEN '🔄 GRUPO/MANUAL' ELSE '✅ Auto' END AS tipo,
  LEFT(notes, 50) AS notas
FROM classification_rules
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND priority <= 10
ORDER BY priority, rule_name;
