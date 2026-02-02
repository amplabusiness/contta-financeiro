-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | INSERT Grupos Econômicos - Baseado na Planilha SUELI AMARAL
-- Data: 02/02/2026
-- Autor: Dr. Cícero (Sistema Contta)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- EXECUTE APÓS: 20260202_GRUPOS_ECONOMICOS.sql
-- 
-- Este script cadastra os grupos econômicos e vincula as empresas.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tenant UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  v_group_id UUID;
  v_client_id UUID;
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════════
  -- GRUPO 1: GISELI E CLEITON
  -- Pagador principal: A.I Empreendimentos Ltda
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- Verificar se grupo já existe
  SELECT id INTO v_group_id
  FROM economic_groups
  WHERE tenant_id = v_tenant
    AND (name = 'GISELI E CLEITON' OR group_name = 'GISELI E CLEITON');
  
  -- Criar grupo se não existir
  IF v_group_id IS NULL THEN
    INSERT INTO economic_groups (
      tenant_id, name, group_name, description, 
      is_active, total_monthly_fee, consolidate_billing
    )
    VALUES (
      v_tenant, 'GISELI E CLEITON', 'GISELI E CLEITON', 
      'Grupo econômico GISELI E CLEITON - Indústria de roupas', 
      TRUE, 0, TRUE
    )
    RETURNING id INTO v_group_id;
    RAISE NOTICE 'Grupo GISELI E CLEITON criado: %', v_group_id;
  ELSE
    -- Atualizar se já existir
    UPDATE economic_groups 
    SET description = 'Grupo econômico GISELI E CLEITON - Indústria de roupas',
        updated_at = NOW()
    WHERE id = v_group_id;
    RAISE NOTICE 'Grupo GISELI E CLEITON atualizado: %', v_group_id;
  END IF;
  
  -- Vincular empresas ao grupo (buscar por nome similar)
  -- A.I EMPREENDIMENTOS LTDA (pagador principal)
  UPDATE clients SET economic_group_id = v_group_id
  WHERE tenant_id = v_tenant
    AND (UPPER(name) ILIKE '%A.I%EMPREENDIMENTOS%' OR UPPER(name) ILIKE '%AI EMPREENDIMENTOS%')
  RETURNING id INTO v_client_id;
  
  IF v_client_id IS NOT NULL THEN
    UPDATE economic_groups SET main_payer_client_id = v_client_id WHERE id = v_group_id;
    RAISE NOTICE '  → A.I Empreendimentos vinculada como pagador principal';
  END IF;
  
  -- CAGI INDUSTRIA DE ROUPAS LTDA
  UPDATE clients SET economic_group_id = v_group_id
  WHERE tenant_id = v_tenant
    AND UPPER(name) ILIKE '%CAGI%INDUSTRIA%ROUPAS%';
  
  -- P.A INDUSTRIA DE ROUPAS LTDA
  UPDATE clients SET economic_group_id = v_group_id
  WHERE tenant_id = v_tenant
    AND UPPER(name) ILIKE '%P.A%INDUSTRIA%ROUPAS%';
  
  -- CLEITON CESARIO DANTAS - MEI
  UPDATE clients SET economic_group_id = v_group_id
  WHERE tenant_id = v_tenant
    AND (UPPER(name) ILIKE '%CLEITON%CESARIO%' OR UPPER(name) ILIKE '%CLEITON%DANTAS%');
  
  -- GISELE DE MELO ESPINDULA - MEI  
  UPDATE clients SET economic_group_id = v_group_id
  WHERE tenant_id = v_tenant
    AND (UPPER(name) ILIKE '%GISELE%MELO%' OR UPPER(name) ILIKE '%GISELE%ESPINDULA%');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ADICIONE OUTROS GRUPOS AQUI CONFORME A PLANILHA
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- Exemplo de outro grupo (descomente e ajuste conforme necessário):
  /*
  INSERT INTO economic_groups (tenant_id, name, description, is_active)
  VALUES (v_tenant, 'NOME DO GRUPO', 'Descrição do grupo', TRUE)
  ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_group_id;
  
  UPDATE clients SET economic_group_id = v_group_id
  WHERE tenant_id = v_tenant
    AND UPPER(name) ILIKE '%NOME DA EMPRESA%';
  */

  -- ═══════════════════════════════════════════════════════════════════════════
  -- VERIFICAÇÃO FINAL
  -- ═══════════════════════════════════════════════════════════════════════════
  
  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Grupos econômicos inseridos!';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════════';

END $$;

-- =============================================================================
-- RELATÓRIO: Verificar grupos e membros
-- =============================================================================
SELECT 
  eg.name AS grupo,
  COUNT(c.id) AS empresas,
  COALESCE(SUM(
    (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id AND i.status IN ('pending','overdue'))
  ), 0) AS faturas_pendentes,
  COALESCE(SUM(
    (SELECT SUM(i.amount) FROM invoices i WHERE i.client_id = c.id AND i.status IN ('pending','overdue'))
  ), 0) AS valor_pendente
FROM economic_groups eg
LEFT JOIN clients c ON c.economic_group_id = eg.id
WHERE eg.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
GROUP BY eg.id, eg.name
ORDER BY eg.name;

-- Detalhe das empresas por grupo
SELECT 
  eg.name AS grupo,
  c.name AS empresa,
  c.document AS cnpj,
  CASE WHEN eg.payer_client_id = c.id THEN '✅ PAGADOR' ELSE '' END AS papel
FROM economic_groups eg
JOIN clients c ON c.economic_group_id = eg.id
WHERE eg.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
ORDER BY eg.name, c.name;
