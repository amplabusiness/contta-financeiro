-- ============================================================================
-- FIX: Criar contas específicas que não foram criadas na migration anterior
-- ============================================================================

-- Garantir que o grupo pai 4.1.4 existe
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
VALUES ('4.1.4', 'Impostos e Taxas', 'DESPESA', 'DEVEDORA', 3, false, true)
ON CONFLICT (code) DO NOTHING;

-- GRUPO 4.1.1 - DESPESAS COM PESSOAL
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  ('4.1.1.03', 'Vale Alimentação/Transporte', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
  ('4.1.1.04', 'Plano de Saúde Funcionários', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
  ('4.1.1.05', 'Rescisões Trabalhistas', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1')),
  ('4.1.1.06', 'Comissões', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.1'))
ON CONFLICT (code) DO NOTHING;

-- GRUPO 4.1.2 - DESPESAS ADMINISTRATIVAS
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  ('4.1.2.07', 'Água Mineral', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.08', 'Material de Limpeza', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.09', 'Copa e Cozinha', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.10', 'Condomínio Sede', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.11', 'Obras e Reformas Sede', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.12', 'Software e Sistemas', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.13', 'Serviços Terceirizados', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.14', 'Material de Papelaria', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2')),
  ('4.1.2.15', 'Manutenção de Equipamentos', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.2'))
ON CONFLICT (code) DO NOTHING;

-- GRUPO 4.1.3 - DESPESAS FINANCEIRAS
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  ('4.1.3.03', 'Manutenção de Conta Bancária', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.3'))
ON CONFLICT (code) DO NOTHING;

-- GRUPO 4.1.4 - IMPOSTOS E TAXAS
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
VALUES
  ('4.1.4.01', 'Simples Nacional', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.4')),
  ('4.1.4.02', 'ISS', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.4')),
  ('4.1.4.03', 'IPTU Sede', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.4')),
  ('4.1.4.04', 'Taxas e Licenças (CRC, etc)', 'DESPESA', 'DEVEDORA', 4, true, true,
    (SELECT id FROM chart_of_accounts WHERE code = '4.1.4'))
ON CONFLICT (code) DO NOTHING;

-- Verificar se contas foram criadas
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE code LIKE '4.1.%' AND level = 4;
  RAISE NOTICE 'Total de contas analíticas de despesa (nível 4): %', v_count;
END $$;
