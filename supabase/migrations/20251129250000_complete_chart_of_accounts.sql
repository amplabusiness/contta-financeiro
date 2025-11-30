-- =====================================================
-- PLANO DE CONTAS COMPLETO - CONTADOR IA
-- Estrutura conforme NBC/CFC para escritório de contabilidade
-- =====================================================

DO $$
DECLARE
  v_parent_id UUID;
BEGIN
  -- =====================================================
  -- 1. ATIVO (NATUREZA DEVEDORA)
  -- =====================================================
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
  VALUES ('1', 'ATIVO', 'ATIVO', 'DEVEDORA', 1, false, true)
  ON CONFLICT (code) DO NOTHING;

  -- 1.1 - ATIVO CIRCULANTE
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('1.1', 'ATIVO CIRCULANTE', 'ATIVO', 'DEVEDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 1.1.1 - DISPONIBILIDADES
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('1.1.1', 'DISPONIBILIDADES', 'ATIVO', 'DEVEDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('1.1.1.01', 'Caixa', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.1.1.02', 'Banco Sicredi', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.1.1.03', 'Banco do Brasil', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.1.1.04', 'Aplicações Financeiras', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 1.1.2 - CONTAS A RECEBER
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('1.1.2', 'CONTAS A RECEBER', 'ATIVO', 'DEVEDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1.2';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('1.1.2.01', 'Clientes a Receber', 'ATIVO', 'DEVEDORA', 4, false, true, v_parent_id),
    ('1.1.2.02', 'Duplicatas a Receber', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.1.2.03', 'Cheques a Receber', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.1.2.04', '(-) Provisão para Créditos de Liquidação Duvidosa', 'ATIVO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 1.1.3 - OUTROS CRÉDITOS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('1.1.3', 'OUTROS CRÉDITOS', 'ATIVO', 'DEVEDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.1.3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('1.1.3.01', 'Impostos a Recuperar', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.1.3.02', 'Adiantamentos a Fornecedores', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.1.3.03', 'Outros Valores a Recuperar', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 1.2 - ATIVO NÃO CIRCULANTE
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('1.2', 'ATIVO NÃO CIRCULANTE', 'ATIVO', 'DEVEDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 1.2.1 - ATIVO IMOBILIZADO
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.2';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('1.2.1', 'ATIVO IMOBILIZADO', 'ATIVO', 'DEVEDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '1.2.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('1.2.1.01', 'Móveis e Utensílios', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.2.1.02', 'Equipamentos de Informática', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.2.1.03', 'Veículos', 'ATIVO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('1.2.1.04', '(-) Depreciação Acumulada', 'ATIVO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- 2. PASSIVO (NATUREZA CREDORA)
  -- =====================================================
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
  VALUES ('2', 'PASSIVO', 'PASSIVO', 'CREDORA', 1, false, true)
  ON CONFLICT (code) DO NOTHING;

  -- 2.1 - PASSIVO CIRCULANTE
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('2.1', 'PASSIVO CIRCULANTE', 'PASSIVO', 'CREDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 2.1.1 - OBRIGAÇÕES TRIBUTÁRIAS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('2.1.1', 'OBRIGAÇÕES TRIBUTÁRIAS', 'PASSIVO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('2.1.1.01', 'Impostos a Recolher', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.1.02', 'Contribuições a Recolher', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 2.1.2 - OBRIGAÇÕES TRABALHISTAS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('2.1.2', 'OBRIGAÇÕES TRABALHISTAS', 'PASSIVO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1.2';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('2.1.2.01', 'Salários a Pagar', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.2.02', 'Férias a Pagar', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.2.03', '13º Salário a Pagar', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.2.04', 'FGTS a Recolher', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.2.05', 'INSS a Recolher', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 2.1.3 - FORNECEDORES
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('2.1.3', 'FORNECEDORES', 'PASSIVO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '2.1.3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('2.1.3.01', 'Fornecedores Nacionais', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id),
    ('2.1.3.02', 'Contas a Pagar', 'PASSIVO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- 3. RECEITAS (NATUREZA CREDORA)
  -- =====================================================
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
  VALUES ('3', 'RECEITAS', 'RECEITA', 'CREDORA', 1, false, true)
  ON CONFLICT (code) DO NOTHING;

  -- 3.1 - RECEITA OPERACIONAL
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('3.1', 'RECEITA OPERACIONAL', 'RECEITA', 'CREDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 3.1.1 - RECEITA DE SERVIÇOS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '3.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('3.1.1', 'RECEITA DE SERVIÇOS', 'RECEITA', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '3.1.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('3.1.1.01', 'Honorários Contábeis', 'RECEITA', 'CREDORA', 4, true, true, v_parent_id),
    ('3.1.1.02', 'Honorários de Consultoria', 'RECEITA', 'CREDORA', 4, true, true, v_parent_id),
    ('3.1.1.03', 'Outras Receitas de Serviços', 'RECEITA', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 3.2 - RECEITAS FINANCEIRAS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('3.2', 'RECEITAS FINANCEIRAS', 'RECEITA', 'CREDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '3.2';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('3.2.01', 'Rendimentos de Aplicações', 'RECEITA', 'CREDORA', 3, true, true, v_parent_id),
    ('3.2.02', 'Juros Ativos', 'RECEITA', 'CREDORA', 3, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- 4. DESPESAS (NATUREZA DEVEDORA)
  -- =====================================================
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
  VALUES ('4', 'DESPESAS', 'DESPESA', 'DEVEDORA', 1, false, true)
  ON CONFLICT (code) DO NOTHING;

  -- 4.1 - DESPESAS ADMINISTRATIVAS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('4.1', 'DESPESAS ADMINISTRATIVAS', 'DESPESA', 'DEVEDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('4.1.01', 'Aluguel', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.02', 'Condomínio', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.03', 'Energia Elétrica', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.04', 'Água e Esgoto', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.05', 'Telefone e Internet', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.06', 'Material de Escritório', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.07', 'Correios e Transportes', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.08', 'Manutenção e Reparos', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.09', 'Seguros', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.10', 'Despesas Bancárias', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.11', 'Tarifas e Taxas', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.1.12', 'Outras Despesas Administrativas', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 4.2 - DESPESAS COM PESSOAL
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('4.2', 'DESPESAS COM PESSOAL', 'DESPESA', 'DEVEDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.2';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('4.2.01', 'Salários e Ordenados', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.2.02', 'Férias', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.2.03', '13º Salário', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.2.04', 'FGTS', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.2.05', 'INSS', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.2.06', 'Vale Transporte', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.2.07', 'Vale Alimentação', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.2.08', 'Outras Despesas com Pessoal', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 4.3 - DESPESAS TRIBUTÁRIAS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('4.3', 'DESPESAS TRIBUTÁRIAS', 'DESPESA', 'DEVEDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('4.3.01', 'ISS', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.3.02', 'PIS', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.3.03', 'COFINS', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.3.04', 'IRPJ', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.3.05', 'CSLL', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.3.06', 'Outros Impostos e Taxas', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 4.4 - DESPESAS FINANCEIRAS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('4.4', 'DESPESAS FINANCEIRAS', 'DESPESA', 'DEVEDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '4.4';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('4.4.01', 'Juros Passivos', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.4.02', 'Multas', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id),
    ('4.4.03', 'IOF', 'DESPESA', 'DEVEDORA', 3, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- =====================================================
  -- 5. PATRIMÔNIO LÍQUIDO (NATUREZA CREDORA)
  -- =====================================================
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active)
  VALUES ('5', 'PATRIMÔNIO LÍQUIDO', 'PATRIMONIO_LIQUIDO', 'CREDORA', 1, false, true)
  ON CONFLICT (code) DO NOTHING;

  -- 5.1 - CAPITAL SOCIAL
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.1', 'CAPITAL SOCIAL', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.1';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('5.1.01', 'Capital Social Subscrito', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, true, v_parent_id),
    ('5.1.02', 'Capital Social a Integralizar', 'PATRIMONIO_LIQUIDO', 'DEVEDORA', 3, true, true, v_parent_id),
    ('5.1.03', 'Capital Social Integralizado', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 5.2 - RESERVAS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.2', 'RESERVAS', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.2';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('5.2.01', 'Reserva Legal', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, true, v_parent_id),
    ('5.2.02', 'Reserva Estatutária', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, true, v_parent_id),
    ('5.2.03', 'Reserva para Contingências', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 5.3 - RESULTADOS ACUMULADOS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.3', 'RESULTADOS ACUMULADOS', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 5.3.01 - LUCROS ACUMULADOS
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.3.01', 'Lucros Acumulados', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.3.01';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('5.3.01.01', 'Lucros Acumulados de Períodos Anteriores', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id),
    ('5.3.01.02', 'Lucros Acumulados do Período Corrente', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 5.3.02 - SALDOS DE ABERTURA (para registrar ativos iniciais)
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.3.02', 'Saldos de Abertura', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.3.02';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('5.3.02.01', 'Saldo de Abertura - Disponibilidades', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id),
    ('5.3.02.02', 'Saldo de Abertura - Clientes', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id),
    ('5.3.02.03', 'Saldo de Abertura - Outros Ativos', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 5.3.03 - AJUSTES DE EXERCÍCIOS ANTERIORES (para recebimentos de períodos anteriores)
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.3.03', 'Ajustes de Exercícios Anteriores', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.3.03';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('5.3.03.01', 'Ajustes Positivos de Exercícios Anteriores', 'PATRIMONIO_LIQUIDO', 'CREDORA', 4, true, true, v_parent_id),
    ('5.3.03.02', 'Ajustes Negativos de Exercícios Anteriores', 'PATRIMONIO_LIQUIDO', 'DEVEDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  -- 5.3.04 - PREJUÍZOS ACUMULADOS (redutora do PL)
  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.3';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES ('5.3.04', 'Prejuízos Acumulados', 'PATRIMONIO_LIQUIDO', 'DEVEDORA', 3, false, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_parent_id FROM chart_of_accounts WHERE code = '5.3.04';
  INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, is_active, parent_id)
  VALUES
    ('5.3.04.01', 'Prejuízos Acumulados de Períodos Anteriores', 'PATRIMONIO_LIQUIDO', 'DEVEDORA', 4, true, true, v_parent_id),
    ('5.3.04.02', 'Prejuízos Acumulados do Período Corrente', 'PATRIMONIO_LIQUIDO', 'DEVEDORA', 4, true, true, v_parent_id)
  ON CONFLICT (code) DO NOTHING;

  RAISE NOTICE 'Plano de contas completo criado com sucesso pelo Contador IA!';
END $$;
