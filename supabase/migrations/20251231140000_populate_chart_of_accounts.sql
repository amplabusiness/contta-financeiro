-- =====================================================
-- POPULAR PLANO DE CONTAS CONTÁBIL
-- Estrutura hierárquica conforme Normas Brasileiras
-- =====================================================
--
-- REGRAS DO DR. CÍCERO (Contador):
-- 1. Contas DEVEDORAS (natureza devedora): Ativo (1) e Despesas (4)
--    Saldo aumenta com DÉBITO, diminui com CRÉDITO
--
-- 2. Contas CREDORAS (natureza credora): Passivo (2), Receitas (3), PL (5)
--    Saldo aumenta com CRÉDITO, diminui com DÉBITO
--
-- 3. Saldo de Abertura:
--    - Contas DEVEDORAS: primeiro lançamento é a DÉBITO
--    - Contas CREDORAS: primeiro lançamento é a CRÉDITO
--
-- 4. Partidas Dobradas: TODO lançamento DEVE ter Débito = Crédito
--
-- 5. Contas Analíticas: Somente elas recebem lançamentos
--    Contas Sintéticas: São apenas grupos (totalizam as analíticas)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ATIVO (Grupo 1) - Natureza DEVEDORA
-- =====================================================
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('1', 'ATIVO', 'ATIVO', 'DEVEDORA', 1, false, 'Bens e direitos da empresa'),
('1.1', 'ATIVO CIRCULANTE', 'ATIVO', 'DEVEDORA', 2, false, 'Realizável no curto prazo'),
('1.1.1', 'DISPONÍVEL', 'ATIVO', 'DEVEDORA', 3, false, 'Caixa e bancos'),
('1.1.1.01', 'Caixa', 'ATIVO', 'DEVEDORA', 4, true, 'Dinheiro em espécie'),
('1.1.1.02', 'Banco Bradesco', 'ATIVO', 'DEVEDORA', 4, true, 'Conta corrente Bradesco'),
('1.1.1.03', 'Banco Itaú', 'ATIVO', 'DEVEDORA', 4, true, 'Conta corrente Itaú'),
('1.1.1.04', 'Banco do Brasil', 'ATIVO', 'DEVEDORA', 4, true, 'Conta corrente BB'),
('1.1.1.05', 'Banco Sicredi', 'ATIVO', 'DEVEDORA', 4, true, 'Conta corrente Sicredi - PRINCIPAL'),
('1.1.1.06', 'Aplicações Financeiras', 'ATIVO', 'DEVEDORA', 4, true, 'CDB, Poupança, etc'),
('1.1.2', 'CLIENTES', 'ATIVO', 'DEVEDORA', 3, false, 'Valores a receber de clientes'),
('1.1.2.01', 'Clientes a Receber', 'ATIVO', 'DEVEDORA', 4, true, 'Honorários a receber'),
('1.1.2.02', 'Cheques a Receber', 'ATIVO', 'DEVEDORA', 4, true, 'Cheques pré-datados'),
('1.1.2.03', '(-) PCLD', 'ATIVO', 'CREDORA', 4, true, 'Provisão para Créditos de Liquidação Duvidosa'),
('1.1.3', 'OUTROS CRÉDITOS', 'ATIVO', 'DEVEDORA', 3, false, 'Adiantamentos e outros'),
('1.1.3.01', 'Adiantamento a Fornecedores', 'ATIVO', 'DEVEDORA', 4, true, 'Pagamentos antecipados'),
('1.1.3.02', 'Adiantamento a Funcionários', 'ATIVO', 'DEVEDORA', 4, true, 'Vales e adiantamentos'),
('1.1.3.03', 'Impostos a Recuperar', 'ATIVO', 'DEVEDORA', 4, true, 'IRRF, PIS, COFINS a recuperar'),
('1.1.3.04', 'ADIANTAMENTOS A SÓCIOS', 'ATIVO', 'DEVEDORA', 4, false, 'Adiantamentos aos sócios'),
('1.1.3.04.01', 'Adiantamento Sérgio Carneiro', 'ATIVO', 'DEVEDORA', 5, true, 'Sócio Sérgio'),
('1.1.3.04.02', 'Adiantamento Victor Hugo', 'ATIVO', 'DEVEDORA', 5, true, 'Sócio Victor'),
('1.1.3.04.03', 'Adiantamento José Carlos', 'ATIVO', 'DEVEDORA', 5, true, 'Sócio José'),
('1.2', 'ATIVO NÃO CIRCULANTE', 'ATIVO', 'DEVEDORA', 2, false, 'Longo prazo e permanente'),
('1.2.1', 'IMOBILIZADO', 'ATIVO', 'DEVEDORA', 3, false, 'Bens permanentes'),
('1.2.1.01', 'Móveis e Utensílios', 'ATIVO', 'DEVEDORA', 4, true, 'Mobiliário'),
('1.2.1.02', 'Equipamentos de Informática', 'ATIVO', 'DEVEDORA', 4, true, 'Computadores e periféricos'),
('1.2.1.03', 'Veículos', 'ATIVO', 'DEVEDORA', 4, true, 'Veículos da empresa'),
('1.2.1.04', '(-) Depreciação Acumulada', 'ATIVO', 'CREDORA', 4, true, 'Depreciação dos bens')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  nature = EXCLUDED.nature,
  level = EXCLUDED.level,
  is_analytical = EXCLUDED.is_analytical,
  description = EXCLUDED.description;

-- =====================================================
-- 2. PASSIVO (Grupo 2) - Natureza CREDORA
-- =====================================================
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('2', 'PASSIVO', 'PASSIVO', 'CREDORA', 1, false, 'Obrigações da empresa'),
('2.1', 'PASSIVO CIRCULANTE', 'PASSIVO', 'CREDORA', 2, false, 'Obrigações de curto prazo'),
('2.1.1', 'FORNECEDORES', 'PASSIVO', 'CREDORA', 3, false, 'Contas a pagar a fornecedores'),
('2.1.1.01', 'Fornecedores Nacionais', 'PASSIVO', 'CREDORA', 4, true, 'Fornecedores do Brasil'),
('2.1.1.02', 'Fornecedores de Serviços', 'PASSIVO', 'CREDORA', 4, true, 'Prestadores de serviço'),
('2.1.2', 'OBRIGAÇÕES TRABALHISTAS', 'PASSIVO', 'CREDORA', 3, false, 'Salários e encargos'),
('2.1.2.01', 'Salários a Pagar', 'PASSIVO', 'CREDORA', 4, true, 'Salários do mês'),
('2.1.2.02', 'FGTS a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'FGTS sobre folha'),
('2.1.2.03', 'INSS a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'INSS patronal e funcionário'),
('2.1.2.04', 'IRRF a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'Imposto de renda retido'),
('2.1.2.05', 'Férias a Pagar', 'PASSIVO', 'CREDORA', 4, true, 'Provisão de férias'),
('2.1.2.06', '13º Salário a Pagar', 'PASSIVO', 'CREDORA', 4, true, 'Provisão 13º'),
('2.1.3', 'OBRIGAÇÕES FISCAIS', 'PASSIVO', 'CREDORA', 3, false, 'Impostos a pagar'),
('2.1.3.01', 'ISS a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'Imposto sobre serviços'),
('2.1.3.02', 'PIS a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'PIS sobre faturamento'),
('2.1.3.03', 'COFINS a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'COFINS sobre faturamento'),
('2.1.3.04', 'IRPJ a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'Imposto de renda PJ'),
('2.1.3.05', 'CSLL a Recolher', 'PASSIVO', 'CREDORA', 4, true, 'Contribuição social'),
('2.1.4', 'OUTRAS OBRIGAÇÕES', 'PASSIVO', 'CREDORA', 3, false, 'Outras contas a pagar'),
('2.1.4.01', 'Contas a Pagar', 'PASSIVO', 'CREDORA', 4, true, 'Contas diversas'),
('2.1.4.02', 'Adiantamento de Clientes', 'PASSIVO', 'CREDORA', 4, true, 'Recebimentos antecipados'),
('2.2', 'PASSIVO NÃO CIRCULANTE', 'PASSIVO', 'CREDORA', 2, false, 'Obrigações de longo prazo'),
('2.2.1', 'EMPRÉSTIMOS E FINANCIAMENTOS', 'PASSIVO', 'CREDORA', 3, false, 'Dívidas LP'),
('2.2.1.01', 'Empréstimos Bancários', 'PASSIVO', 'CREDORA', 4, true, 'Empréstimos a pagar')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  nature = EXCLUDED.nature,
  level = EXCLUDED.level,
  is_analytical = EXCLUDED.is_analytical,
  description = EXCLUDED.description;

-- =====================================================
-- 3. RECEITAS (Grupo 3) - Natureza CREDORA
-- =====================================================
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('3', 'RECEITAS', 'RECEITA', 'CREDORA', 1, false, 'Receitas operacionais e outras'),
('3.1', 'RECEITA OPERACIONAL', 'RECEITA', 'CREDORA', 2, false, 'Receitas da atividade principal'),
('3.1.1', 'RECEITAS DE SERVIÇOS', 'RECEITA', 'CREDORA', 3, false, 'Prestação de serviços contábeis'),
('3.1.1.01', 'Honorários Contábeis', 'RECEITA', 'CREDORA', 4, true, 'Honorários mensais'),
('3.1.1.02', 'Honorários de Consultoria', 'RECEITA', 'CREDORA', 4, true, 'Consultoria avulsa'),
('3.1.1.03', 'Outras Receitas de Serviços', 'RECEITA', 'CREDORA', 4, true, 'Serviços extraordinários'),
('3.2', 'OUTRAS RECEITAS', 'RECEITA', 'CREDORA', 2, false, 'Receitas não operacionais'),
('3.2.1', 'RECEITAS FINANCEIRAS', 'RECEITA', 'CREDORA', 3, false, 'Juros e rendimentos'),
('3.2.1.01', 'Juros Recebidos', 'RECEITA', 'CREDORA', 4, true, 'Juros de aplicações'),
('3.2.1.02', 'Rendimentos de Aplicações', 'RECEITA', 'CREDORA', 4, true, 'Rendimentos financeiros'),
('3.2.1.03', 'Descontos Obtidos', 'RECEITA', 'CREDORA', 4, true, 'Descontos recebidos')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  nature = EXCLUDED.nature,
  level = EXCLUDED.level,
  is_analytical = EXCLUDED.is_analytical,
  description = EXCLUDED.description;

-- =====================================================
-- 4. DESPESAS (Grupo 4) - Natureza DEVEDORA
-- =====================================================
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('4', 'DESPESAS', 'DESPESA', 'DEVEDORA', 1, false, 'Despesas operacionais'),
('4.1', 'DESPESAS ADMINISTRATIVAS', 'DESPESA', 'DEVEDORA', 2, false, 'Custos administrativos'),
('4.1.01', 'Aluguel', 'DESPESA', 'DEVEDORA', 3, true, 'Aluguel do escritório'),
('4.1.02', 'Condomínio', 'DESPESA', 'DEVEDORA', 3, true, 'Taxa de condomínio'),
('4.1.03', 'Energia Elétrica', 'DESPESA', 'DEVEDORA', 3, true, 'Conta de luz'),
('4.1.04', 'Água e Esgoto', 'DESPESA', 'DEVEDORA', 3, true, 'Conta de água'),
('4.1.05', 'Telefone e Internet', 'DESPESA', 'DEVEDORA', 3, true, 'Telecomunicações'),
('4.1.06', 'Material de Escritório', 'DESPESA', 'DEVEDORA', 3, true, 'Papelaria e materiais'),
('4.1.07', 'Correios e Transportes', 'DESPESA', 'DEVEDORA', 3, true, 'Envios e fretes'),
('4.1.08', 'Manutenção e Reparos', 'DESPESA', 'DEVEDORA', 3, true, 'Manutenção do escritório'),
('4.1.09', 'Seguros', 'DESPESA', 'DEVEDORA', 3, true, 'Seguros diversos'),
('4.1.10', 'Despesas Bancárias', 'DESPESA', 'DEVEDORA', 3, true, 'Tarifas bancárias'),
('4.1.11', 'Tarifas e Taxas', 'DESPESA', 'DEVEDORA', 3, true, 'Outras taxas'),
('4.1.12', 'Outras Despesas Administrativas', 'DESPESA', 'DEVEDORA', 3, true, 'Despesas diversas'),
('4.1.13', 'Softwares e Sistemas', 'DESPESA', 'DEVEDORA', 3, true, 'Licenças de software'),
('4.1.14', 'Copa e Cozinha', 'DESPESA', 'DEVEDORA', 3, true, 'Café, água mineral, etc'),
('4.1.15', 'Limpeza e Conservação', 'DESPESA', 'DEVEDORA', 3, true, 'Serviços de limpeza'),
('4.2', 'DESPESAS COM PESSOAL', 'DESPESA', 'DEVEDORA', 2, false, 'Folha de pagamento'),
('4.2.01', 'Salários e Ordenados', 'DESPESA', 'DEVEDORA', 3, true, 'Salários CLT'),
('4.2.02', 'Férias', 'DESPESA', 'DEVEDORA', 3, true, 'Pagamento de férias'),
('4.2.03', '13º Salário', 'DESPESA', 'DEVEDORA', 3, true, 'Décimo terceiro'),
('4.2.04', 'FGTS', 'DESPESA', 'DEVEDORA', 3, true, 'FGTS sobre folha'),
('4.2.05', 'INSS Patronal', 'DESPESA', 'DEVEDORA', 3, true, 'INSS parte empresa'),
('4.2.06', 'Vale Transporte', 'DESPESA', 'DEVEDORA', 3, true, 'VT funcionários'),
('4.2.07', 'Vale Alimentação', 'DESPESA', 'DEVEDORA', 3, true, 'VA/VR funcionários'),
('4.2.08', 'Plano de Saúde', 'DESPESA', 'DEVEDORA', 3, true, 'Convênio médico'),
('4.2.09', 'Outras Despesas com Pessoal', 'DESPESA', 'DEVEDORA', 3, true, 'Outras despesas RH'),
('4.2.10', 'Pró-Labore', 'DESPESA', 'DEVEDORA', 3, true, 'Retirada dos sócios'),
('4.2.11', 'Terceiros e Autônomos', 'DESPESA', 'DEVEDORA', 3, true, 'Prestadores de serviço'),
('4.3', 'DESPESAS TRIBUTÁRIAS', 'DESPESA', 'DEVEDORA', 2, false, 'Impostos e taxas'),
('4.3.01', 'ISS', 'DESPESA', 'DEVEDORA', 3, true, 'Imposto sobre serviços'),
('4.3.02', 'PIS', 'DESPESA', 'DEVEDORA', 3, true, 'PIS sobre faturamento'),
('4.3.03', 'COFINS', 'DESPESA', 'DEVEDORA', 3, true, 'COFINS sobre faturamento'),
('4.3.04', 'IRPJ', 'DESPESA', 'DEVEDORA', 3, true, 'Imposto de renda PJ'),
('4.3.05', 'CSLL', 'DESPESA', 'DEVEDORA', 3, true, 'Contribuição social'),
('4.3.06', 'Outros Impostos e Taxas', 'DESPESA', 'DEVEDORA', 3, true, 'IPTU, IPVA, etc'),
('4.4', 'DESPESAS FINANCEIRAS', 'DESPESA', 'DEVEDORA', 2, false, 'Juros e encargos'),
('4.4.01', 'Juros Pagos', 'DESPESA', 'DEVEDORA', 3, true, 'Juros de empréstimos'),
('4.4.02', 'Multas', 'DESPESA', 'DEVEDORA', 3, true, 'Multas por atraso'),
('4.4.03', 'IOF', 'DESPESA', 'DEVEDORA', 3, true, 'IOF sobre operações'),
('4.4.04', 'Descontos Concedidos', 'DESPESA', 'DEVEDORA', 3, true, 'Descontos dados a clientes')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  nature = EXCLUDED.nature,
  level = EXCLUDED.level,
  is_analytical = EXCLUDED.is_analytical,
  description = EXCLUDED.description;

-- =====================================================
-- 5. PATRIMÔNIO LÍQUIDO (Grupo 5) - Natureza CREDORA
-- =====================================================
INSERT INTO chart_of_accounts (code, name, account_type, nature, level, is_analytical, description) VALUES
('5', 'PATRIMÔNIO LÍQUIDO', 'PATRIMONIO_LIQUIDO', 'CREDORA', 1, false, 'Recursos próprios'),
('5.1', 'CAPITAL SOCIAL', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, 'Capital dos sócios'),
('5.1.01', 'Capital Social Subscrito', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, 'Capital registrado'),
('5.1.02', '(-) Capital a Integralizar', 'PATRIMONIO_LIQUIDO', 'DEVEDORA', 3, true, 'Capital não integralizado'),
('5.2', 'RESERVAS', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, 'Reservas de lucros'),
('5.2.01', 'Reserva Legal', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, '5% do lucro'),
('5.2.02', 'Reserva de Lucros', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, 'Lucros retidos'),
('5.3', 'LUCROS OU PREJUÍZOS', 'PATRIMONIO_LIQUIDO', 'CREDORA', 2, false, 'Resultado acumulado'),
('5.3.01', 'Lucros Acumulados', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, 'Lucros não distribuídos'),
('5.3.02', 'Prejuízos Acumulados', 'PATRIMONIO_LIQUIDO', 'DEVEDORA', 3, true, 'Prejuízos acumulados'),
('5.3.03', 'Resultado do Exercício', 'PATRIMONIO_LIQUIDO', 'CREDORA', 3, true, 'Lucro/Prejuízo do período')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  nature = EXCLUDED.nature,
  level = EXCLUDED.level,
  is_analytical = EXCLUDED.is_analytical,
  description = EXCLUDED.description;

-- Verificar quantidade de contas criadas
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM chart_of_accounts;
    RAISE NOTICE 'Plano de Contas: % contas cadastradas', v_count;
END $$;

COMMIT;
