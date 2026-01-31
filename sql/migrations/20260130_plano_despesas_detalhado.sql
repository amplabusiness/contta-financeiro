-- ============================================================================
-- MIGRATION: Plano de Contas de Despesas Detalhado
-- Data: 30/01/2026
-- Autor: Dr. Cícero
-- Descrição: Cria estrutura completa de despesas SEM contas genéricas
--            Cada despesa tem sua própria conta para análise precisa
-- ============================================================================

-- ============================================================================
-- REGRA DO DR. CÍCERO:
-- "Evitar acumular despesas em uma única conta. Cada despesa deve ter sua 
--  própria conta para facilitar a análise de resultado. Nada de contas 
--  genéricas tipo 'Despesas Diversas'."
-- ============================================================================

-- Tenant ID da Ampla Contabilidade
DO $$ 
BEGIN
    PERFORM set_config('app.tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421', false);
END $$;

-- Função auxiliar para criar conta se não existir
CREATE OR REPLACE FUNCTION create_expense_account_if_not_exists(
    p_code VARCHAR(20),
    p_name VARCHAR(200),
    p_parent_code VARCHAR(20),
    p_is_analytical BOOLEAN DEFAULT TRUE
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_account_id UUID;
    v_parent_id UUID;
    v_level INTEGER;
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421'::UUID;
BEGIN
    -- Verificar se já existe
    SELECT id INTO v_account_id 
    FROM chart_of_accounts 
    WHERE code = p_code
      AND tenant_id = v_tenant_id;
    
    IF v_account_id IS NOT NULL THEN
        RETURN v_account_id;
    END IF;
    
    -- Buscar pai
    SELECT id INTO v_parent_id 
    FROM chart_of_accounts 
    WHERE code = p_parent_code
      AND tenant_id = v_tenant_id;
    
    -- Calcular nível
    v_level := array_length(string_to_array(p_code, '.'), 1);
    
    -- Criar conta
    INSERT INTO chart_of_accounts (
        tenant_id, code, name, account_type, nature, parent_id, level,
        is_analytical, is_synthetic, accepts_entries, is_active
    )
    VALUES (
        v_tenant_id, p_code, p_name, 'DESPESA', 'DEVEDORA', v_parent_id, v_level,
        p_is_analytical, NOT p_is_analytical, p_is_analytical, TRUE
    )
    RETURNING id INTO v_account_id;
    
    RETURN v_account_id;
END;
$$;

-- ============================================================================
-- 4. DESPESAS (já deve existir)
-- ============================================================================

SELECT create_expense_account_if_not_exists('4', 'DESPESAS', NULL, FALSE);

-- ============================================================================
-- 4.1 DESPESAS OPERACIONAIS
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.1', 'DESPESAS OPERACIONAIS', '4', FALSE);

-- 4.1.1 Utilidades Públicas
SELECT create_expense_account_if_not_exists('4.1.1', 'Utilidades Públicas', '4.1', FALSE);
SELECT create_expense_account_if_not_exists('4.1.1.01', 'Energia Elétrica', '4.1.1', TRUE);
SELECT create_expense_account_if_not_exists('4.1.1.02', 'Água e Esgoto', '4.1.1', TRUE);
SELECT create_expense_account_if_not_exists('4.1.1.03', 'Telefone Fixo', '4.1.1', TRUE);
SELECT create_expense_account_if_not_exists('4.1.1.04', 'Telefone Celular', '4.1.1', TRUE);
SELECT create_expense_account_if_not_exists('4.1.1.05', 'Internet', '4.1.1', TRUE);
SELECT create_expense_account_if_not_exists('4.1.1.06', 'Gás', '4.1.1', TRUE);
SELECT create_expense_account_if_not_exists('4.1.1.07', 'TV por Assinatura', '4.1.1', TRUE);

-- 4.1.2 Ocupação e Instalações
SELECT create_expense_account_if_not_exists('4.1.2', 'Ocupação e Instalações', '4.1', FALSE);
SELECT create_expense_account_if_not_exists('4.1.2.01', 'Aluguel de Imóvel', '4.1.2', TRUE);
SELECT create_expense_account_if_not_exists('4.1.2.02', 'Condomínio', '4.1.2', TRUE);
SELECT create_expense_account_if_not_exists('4.1.2.03', 'IPTU', '4.1.2', TRUE);
SELECT create_expense_account_if_not_exists('4.1.2.04', 'Seguro do Imóvel', '4.1.2', TRUE);
SELECT create_expense_account_if_not_exists('4.1.2.05', 'Manutenção Predial', '4.1.2', TRUE);
SELECT create_expense_account_if_not_exists('4.1.2.06', 'Reparos e Reformas', '4.1.2', TRUE);
SELECT create_expense_account_if_not_exists('4.1.2.07', 'Jardinagem', '4.1.2', TRUE);
SELECT create_expense_account_if_not_exists('4.1.2.08', 'Dedetização', '4.1.2', TRUE);

-- 4.1.3 Material de Consumo
SELECT create_expense_account_if_not_exists('4.1.3', 'Material de Consumo', '4.1', FALSE);
SELECT create_expense_account_if_not_exists('4.1.3.01', 'Material de Escritório', '4.1.3', TRUE);
SELECT create_expense_account_if_not_exists('4.1.3.02', 'Material de Limpeza', '4.1.3', TRUE);
SELECT create_expense_account_if_not_exists('4.1.3.03', 'Material de Copa/Cozinha', '4.1.3', TRUE);
SELECT create_expense_account_if_not_exists('4.1.3.04', 'Café, Água e Lanches', '4.1.3', TRUE);
SELECT create_expense_account_if_not_exists('4.1.3.05', 'Material de Informática', '4.1.3', TRUE);
SELECT create_expense_account_if_not_exists('4.1.3.06', 'Cartuchos e Toners', '4.1.3', TRUE);
SELECT create_expense_account_if_not_exists('4.1.3.07', 'Papel e Impressos', '4.1.3', TRUE);
SELECT create_expense_account_if_not_exists('4.1.3.08', 'Produtos de Higiene', '4.1.3', TRUE);

-- 4.1.4 Serviços de Terceiros PJ
SELECT create_expense_account_if_not_exists('4.1.4', 'Serviços de Terceiros PJ', '4.1', FALSE);
SELECT create_expense_account_if_not_exists('4.1.4.01', 'Serviços de Contabilidade', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.02', 'Serviços Advocatícios', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.03', 'Consultoria Empresarial', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.04', 'Consultoria de TI', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.05', 'Serviços de Marketing', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.06', 'Publicidade e Propaganda', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.07', 'Serviços Gráficos', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.08', 'Serviços de Limpeza', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.09', 'Serviços de Segurança', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.10', 'Serviços de Vigilância', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.11', 'Serviços de Motoboy', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.12', 'Correios e Malotes', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.13', 'Serviços de Tradução', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.14', 'Serviços de Auditoria', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.15', 'Serviços de RH/Recrutamento', '4.1.4', TRUE);
SELECT create_expense_account_if_not_exists('4.1.4.16', 'Despachante/Cartório', '4.1.4', TRUE);

-- 4.1.5 Serviços de Terceiros PF (Autônomos)
SELECT create_expense_account_if_not_exists('4.1.5', 'Serviços de Terceiros PF', '4.1', FALSE);
SELECT create_expense_account_if_not_exists('4.1.5.01', 'Serviços Autônomos Técnicos', '4.1.5', TRUE);
SELECT create_expense_account_if_not_exists('4.1.5.02', 'Serviços Autônomos Administrativos', '4.1.5', TRUE);
SELECT create_expense_account_if_not_exists('4.1.5.03', 'Comissões a Terceiros PF', '4.1.5', TRUE);

-- 4.1.6 Tecnologia e Sistemas
SELECT create_expense_account_if_not_exists('4.1.6', 'Tecnologia e Sistemas', '4.1', FALSE);
SELECT create_expense_account_if_not_exists('4.1.6.01', 'Software - Licenças', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.02', 'Software - Assinaturas SaaS', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.03', 'Hospedagem de Sites', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.04', 'Domínios', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.05', 'E-mail Corporativo', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.06', 'Armazenamento em Nuvem', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.07', 'Certificado Digital', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.08', 'Manutenção de Equipamentos', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.09', 'Suporte Técnico', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.10', 'Sistema ERP', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.11', 'Sistema Contábil', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.12', 'Sistema Fiscal', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.13', 'Sistema de RH/DP', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.14', 'Antivírus e Segurança', '4.1.6', TRUE);
SELECT create_expense_account_if_not_exists('4.1.6.15', 'Backup e Recuperação', '4.1.6', TRUE);

-- 4.1.7 Assinaturas e Associações
SELECT create_expense_account_if_not_exists('4.1.7', 'Assinaturas e Associações', '4.1', FALSE);
SELECT create_expense_account_if_not_exists('4.1.7.01', 'Assinatura de Jornais', '4.1.7', TRUE);
SELECT create_expense_account_if_not_exists('4.1.7.02', 'Assinatura de Revistas', '4.1.7', TRUE);
SELECT create_expense_account_if_not_exists('4.1.7.03', 'Assinatura de Periódicos Técnicos', '4.1.7', TRUE);
SELECT create_expense_account_if_not_exists('4.1.7.04', 'Anuidade CRC', '4.1.7', TRUE);
SELECT create_expense_account_if_not_exists('4.1.7.05', 'Anuidade OAB', '4.1.7', TRUE);
SELECT create_expense_account_if_not_exists('4.1.7.06', 'Anuidade CREA', '4.1.7', TRUE);
SELECT create_expense_account_if_not_exists('4.1.7.07', 'Mensalidade Sindicato', '4.1.7', TRUE);
SELECT create_expense_account_if_not_exists('4.1.7.08', 'Mensalidade Associação Comercial', '4.1.7', TRUE);
SELECT create_expense_account_if_not_exists('4.1.7.09', 'Contribuição CDL', '4.1.7', TRUE);

-- 4.1.8 Seguros
SELECT create_expense_account_if_not_exists('4.1.8', 'Seguros', '4.1', FALSE);
SELECT create_expense_account_if_not_exists('4.1.8.01', 'Seguro de Vida Empresarial', '4.1.8', TRUE);
SELECT create_expense_account_if_not_exists('4.1.8.02', 'Seguro Responsabilidade Civil', '4.1.8', TRUE);
SELECT create_expense_account_if_not_exists('4.1.8.03', 'Seguro de Equipamentos', '4.1.8', TRUE);
SELECT create_expense_account_if_not_exists('4.1.8.04', 'Seguro Empresarial', '4.1.8', TRUE);

-- ============================================================================
-- 4.2 DESPESAS COM PESSOAL
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.2', 'DESPESAS COM PESSOAL', '4', FALSE);

-- 4.2.1 Remuneração
SELECT create_expense_account_if_not_exists('4.2.1', 'Remuneração', '4.2', FALSE);
SELECT create_expense_account_if_not_exists('4.2.1.01', 'Salários e Ordenados', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.02', 'Horas Extras', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.03', 'Adicional Noturno', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.04', 'Adicional Periculosidade', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.05', 'Adicional Insalubridade', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.06', 'Comissões', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.07', 'Gratificações', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.08', 'Prêmios e Bonificações', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.09', 'Participação nos Lucros - PLR', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.10', '13º Salário', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.11', 'Férias', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.12', '1/3 Férias Constitucional', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.13', 'Abono Pecuniário', '4.2.1', TRUE);
SELECT create_expense_account_if_not_exists('4.2.1.14', 'DSR - Descanso Semanal Remunerado', '4.2.1', TRUE);

-- 4.2.2 Encargos Sociais
SELECT create_expense_account_if_not_exists('4.2.2', 'Encargos Sociais', '4.2', FALSE);
SELECT create_expense_account_if_not_exists('4.2.2.01', 'INSS Patronal', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.02', 'FGTS', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.03', 'FGTS - Multa Rescisória', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.04', 'RAT - Risco Ambiental Trabalho', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.05', 'Salário Educação', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.06', 'Sistema S (SENAC, SESC, etc)', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.07', 'INSS s/ 13º Salário', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.08', 'FGTS s/ 13º Salário', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.09', 'INSS s/ Férias', '4.2.2', TRUE);
SELECT create_expense_account_if_not_exists('4.2.2.10', 'FGTS s/ Férias', '4.2.2', TRUE);

-- 4.2.3 Benefícios
SELECT create_expense_account_if_not_exists('4.2.3', 'Benefícios', '4.2', FALSE);
SELECT create_expense_account_if_not_exists('4.2.3.01', 'Vale Transporte', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.02', 'Vale Alimentação', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.03', 'Vale Refeição', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.04', 'Cesta Básica', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.05', 'Plano de Saúde', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.06', 'Plano Odontológico', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.07', 'Seguro de Vida Funcionários', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.08', 'Auxílio Creche', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.09', 'Auxílio Educação', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.10', 'Auxílio Combustível', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.11', 'Auxílio Home Office', '4.2.3', TRUE);
SELECT create_expense_account_if_not_exists('4.2.3.12', 'Programa de Bem-Estar', '4.2.3', TRUE);

-- 4.2.4 Rescisões
SELECT create_expense_account_if_not_exists('4.2.4', 'Rescisões', '4.2', FALSE);
SELECT create_expense_account_if_not_exists('4.2.4.01', 'Aviso Prévio Indenizado', '4.2.4', TRUE);
SELECT create_expense_account_if_not_exists('4.2.4.02', 'Férias Indenizadas', '4.2.4', TRUE);
SELECT create_expense_account_if_not_exists('4.2.4.03', '13º Proporcional Rescisão', '4.2.4', TRUE);
SELECT create_expense_account_if_not_exists('4.2.4.04', 'Multa Art. 477 CLT', '4.2.4', TRUE);
SELECT create_expense_account_if_not_exists('4.2.4.05', 'Indenizações Trabalhistas', '4.2.4', TRUE);
SELECT create_expense_account_if_not_exists('4.2.4.06', 'Acordos Judiciais Trabalhistas', '4.2.4', TRUE);

-- 4.2.5 Treinamento e Desenvolvimento
SELECT create_expense_account_if_not_exists('4.2.5', 'Treinamento e Desenvolvimento', '4.2', FALSE);
SELECT create_expense_account_if_not_exists('4.2.5.01', 'Cursos e Treinamentos', '4.2.5', TRUE);
SELECT create_expense_account_if_not_exists('4.2.5.02', 'Palestras e Workshops', '4.2.5', TRUE);
SELECT create_expense_account_if_not_exists('4.2.5.03', 'Congressos e Seminários', '4.2.5', TRUE);
SELECT create_expense_account_if_not_exists('4.2.5.04', 'Material Didático', '4.2.5', TRUE);
SELECT create_expense_account_if_not_exists('4.2.5.05', 'Plataformas de Ensino Online', '4.2.5', TRUE);

-- 4.2.6 Pró-labore e Retiradas
SELECT create_expense_account_if_not_exists('4.2.6', 'Pró-labore e Retiradas', '4.2', FALSE);
SELECT create_expense_account_if_not_exists('4.2.6.01', 'Pró-labore Sócios', '4.2.6', TRUE);
SELECT create_expense_account_if_not_exists('4.2.6.02', 'INSS s/ Pró-labore', '4.2.6', TRUE);

-- 4.2.7 Medicina e Segurança do Trabalho
SELECT create_expense_account_if_not_exists('4.2.7', 'Medicina e Segurança do Trabalho', '4.2', FALSE);
SELECT create_expense_account_if_not_exists('4.2.7.01', 'Exames Admissionais', '4.2.7', TRUE);
SELECT create_expense_account_if_not_exists('4.2.7.02', 'Exames Periódicos', '4.2.7', TRUE);
SELECT create_expense_account_if_not_exists('4.2.7.03', 'Exames Demissionais', '4.2.7', TRUE);
SELECT create_expense_account_if_not_exists('4.2.7.04', 'PCMSO', '4.2.7', TRUE);
SELECT create_expense_account_if_not_exists('4.2.7.05', 'PPRA/PGR', '4.2.7', TRUE);
SELECT create_expense_account_if_not_exists('4.2.7.06', 'EPIs - Equipamentos Proteção', '4.2.7', TRUE);
SELECT create_expense_account_if_not_exists('4.2.7.07', 'CIPA', '4.2.7', TRUE);
SELECT create_expense_account_if_not_exists('4.2.7.08', 'Laudos Técnicos (LTCAT, etc)', '4.2.7', TRUE);

-- ============================================================================
-- 4.3 DESPESAS FINANCEIRAS
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.3', 'DESPESAS FINANCEIRAS', '4', FALSE);

-- 4.3.1 Encargos Bancários
SELECT create_expense_account_if_not_exists('4.3.1', 'Encargos Bancários', '4.3', FALSE);
SELECT create_expense_account_if_not_exists('4.3.1.01', 'Tarifa de Manutenção de Conta', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.02', 'Tarifa DOC/TED', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.03', 'Tarifa PIX', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.04', 'Tarifa Boleto Emitido', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.05', 'Tarifa Boleto Liquidado', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.06', 'Tarifa Extrato', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.07', 'Tarifa Saque', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.08', 'Tarifa Depósito', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.09', 'Pacote de Serviços Bancários', '4.3.1', TRUE);
SELECT create_expense_account_if_not_exists('4.3.1.10', 'Tarifa Cobrança Registrada', '4.3.1', TRUE);

-- 4.3.2 Juros e Encargos
SELECT create_expense_account_if_not_exists('4.3.2', 'Juros e Encargos', '4.3', FALSE);
SELECT create_expense_account_if_not_exists('4.3.2.01', 'Juros de Mora', '4.3.2', TRUE);
SELECT create_expense_account_if_not_exists('4.3.2.02', 'Juros sobre Empréstimos', '4.3.2', TRUE);
SELECT create_expense_account_if_not_exists('4.3.2.03', 'Juros sobre Financiamentos', '4.3.2', TRUE);
SELECT create_expense_account_if_not_exists('4.3.2.04', 'Juros de Cheque Especial', '4.3.2', TRUE);
SELECT create_expense_account_if_not_exists('4.3.2.05', 'Juros sobre Parcelamentos', '4.3.2', TRUE);
SELECT create_expense_account_if_not_exists('4.3.2.06', 'IOF - Operações de Crédito', '4.3.2', TRUE);
SELECT create_expense_account_if_not_exists('4.3.2.07', 'IOF - Operações de Câmbio', '4.3.2', TRUE);

-- 4.3.3 Cartões e Meios de Pagamento
SELECT create_expense_account_if_not_exists('4.3.3', 'Cartões e Meios de Pagamento', '4.3', FALSE);
SELECT create_expense_account_if_not_exists('4.3.3.01', 'Taxa Cartão de Crédito', '4.3.3', TRUE);
SELECT create_expense_account_if_not_exists('4.3.3.02', 'Taxa Cartão de Débito', '4.3.3', TRUE);
SELECT create_expense_account_if_not_exists('4.3.3.03', 'Aluguel Máquina de Cartão', '4.3.3', TRUE);
SELECT create_expense_account_if_not_exists('4.3.3.04', 'Taxa Antecipação Recebíveis', '4.3.3', TRUE);
SELECT create_expense_account_if_not_exists('4.3.3.05', 'Taxa Gateway de Pagamento', '4.3.3', TRUE);
SELECT create_expense_account_if_not_exists('4.3.3.06', 'Taxa PayPal/PagSeguro/etc', '4.3.3', TRUE);

-- 4.3.4 Multas e Penalidades Financeiras
SELECT create_expense_account_if_not_exists('4.3.4', 'Multas e Penalidades Financeiras', '4.3', FALSE);
SELECT create_expense_account_if_not_exists('4.3.4.01', 'Multa por Atraso de Pagamento', '4.3.4', TRUE);
SELECT create_expense_account_if_not_exists('4.3.4.02', 'Multa Contratual', '4.3.4', TRUE);
SELECT create_expense_account_if_not_exists('4.3.4.03', 'Protesto de Títulos', '4.3.4', TRUE);

-- 4.3.5 Descontos Concedidos
SELECT create_expense_account_if_not_exists('4.3.5', 'Descontos Concedidos', '4.3', FALSE);
SELECT create_expense_account_if_not_exists('4.3.5.01', 'Descontos Comerciais Concedidos', '4.3.5', TRUE);
SELECT create_expense_account_if_not_exists('4.3.5.02', 'Descontos Financeiros Concedidos', '4.3.5', TRUE);

-- ============================================================================
-- 4.4 DESPESAS TRIBUTÁRIAS
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.4', 'DESPESAS TRIBUTÁRIAS', '4', FALSE);

-- 4.4.1 Impostos Federais
SELECT create_expense_account_if_not_exists('4.4.1', 'Impostos Federais', '4.4', FALSE);
SELECT create_expense_account_if_not_exists('4.4.1.01', 'IRPJ', '4.4.1', TRUE);
SELECT create_expense_account_if_not_exists('4.4.1.02', 'CSLL', '4.4.1', TRUE);
SELECT create_expense_account_if_not_exists('4.4.1.03', 'PIS', '4.4.1', TRUE);
SELECT create_expense_account_if_not_exists('4.4.1.04', 'COFINS', '4.4.1', TRUE);
SELECT create_expense_account_if_not_exists('4.4.1.05', 'IPI', '4.4.1', TRUE);
SELECT create_expense_account_if_not_exists('4.4.1.06', 'Simples Nacional (DAS)', '4.4.1', TRUE);
SELECT create_expense_account_if_not_exists('4.4.1.07', 'IRRF s/ Serviços', '4.4.1', TRUE);

-- 4.4.2 Impostos Estaduais
SELECT create_expense_account_if_not_exists('4.4.2', 'Impostos Estaduais', '4.4', FALSE);
SELECT create_expense_account_if_not_exists('4.4.2.01', 'ICMS', '4.4.2', TRUE);
SELECT create_expense_account_if_not_exists('4.4.2.02', 'ICMS-ST', '4.4.2', TRUE);
SELECT create_expense_account_if_not_exists('4.4.2.03', 'DIFAL', '4.4.2', TRUE);

-- 4.4.3 Impostos Municipais
SELECT create_expense_account_if_not_exists('4.4.3', 'Impostos Municipais', '4.4', FALSE);
SELECT create_expense_account_if_not_exists('4.4.3.01', 'ISS', '4.4.3', TRUE);
SELECT create_expense_account_if_not_exists('4.4.3.02', 'ISS Retido', '4.4.3', TRUE);
SELECT create_expense_account_if_not_exists('4.4.3.03', 'Taxa de Licença/Alvará', '4.4.3', TRUE);
SELECT create_expense_account_if_not_exists('4.4.3.04', 'Taxa de Publicidade', '4.4.3', TRUE);
SELECT create_expense_account_if_not_exists('4.4.3.05', 'Taxa de Funcionamento', '4.4.3', TRUE);

-- 4.4.4 Multas Fiscais
SELECT create_expense_account_if_not_exists('4.4.4', 'Multas Fiscais', '4.4', FALSE);
SELECT create_expense_account_if_not_exists('4.4.4.01', 'Multa IRPJ/CSLL', '4.4.4', TRUE);
SELECT create_expense_account_if_not_exists('4.4.4.02', 'Multa PIS/COFINS', '4.4.4', TRUE);
SELECT create_expense_account_if_not_exists('4.4.4.03', 'Multa ISS', '4.4.4', TRUE);
SELECT create_expense_account_if_not_exists('4.4.4.04', 'Multa ICMS', '4.4.4', TRUE);
SELECT create_expense_account_if_not_exists('4.4.4.05', 'Multa Obrigações Acessórias', '4.4.4', TRUE);
SELECT create_expense_account_if_not_exists('4.4.4.06', 'Multa FGTS', '4.4.4', TRUE);
SELECT create_expense_account_if_not_exists('4.4.4.07', 'Multa INSS', '4.4.4', TRUE);
SELECT create_expense_account_if_not_exists('4.4.4.08', 'Multa Receita Federal', '4.4.4', TRUE);

-- ============================================================================
-- 4.5 DESPESAS COM VEÍCULOS
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.5', 'DESPESAS COM VEÍCULOS', '4', FALSE);

SELECT create_expense_account_if_not_exists('4.5.1', 'Combustíveis e Lubrificantes', '4.5', FALSE);
SELECT create_expense_account_if_not_exists('4.5.1.01', 'Gasolina', '4.5.1', TRUE);
SELECT create_expense_account_if_not_exists('4.5.1.02', 'Etanol', '4.5.1', TRUE);
SELECT create_expense_account_if_not_exists('4.5.1.03', 'Diesel', '4.5.1', TRUE);
SELECT create_expense_account_if_not_exists('4.5.1.04', 'GNV', '4.5.1', TRUE);
SELECT create_expense_account_if_not_exists('4.5.1.05', 'Óleo Lubrificante', '4.5.1', TRUE);
SELECT create_expense_account_if_not_exists('4.5.1.06', 'Aditivos', '4.5.1', TRUE);

SELECT create_expense_account_if_not_exists('4.5.2', 'Manutenção de Veículos', '4.5', FALSE);
SELECT create_expense_account_if_not_exists('4.5.2.01', 'Revisão Veículos', '4.5.2', TRUE);
SELECT create_expense_account_if_not_exists('4.5.2.02', 'Troca de Óleo', '4.5.2', TRUE);
SELECT create_expense_account_if_not_exists('4.5.2.03', 'Troca de Pneus', '4.5.2', TRUE);
SELECT create_expense_account_if_not_exists('4.5.2.04', 'Alinhamento e Balanceamento', '4.5.2', TRUE);
SELECT create_expense_account_if_not_exists('4.5.2.05', 'Peças e Acessórios', '4.5.2', TRUE);
SELECT create_expense_account_if_not_exists('4.5.2.06', 'Funilaria e Pintura', '4.5.2', TRUE);
SELECT create_expense_account_if_not_exists('4.5.2.07', 'Lavagem e Higienização', '4.5.2', TRUE);
SELECT create_expense_account_if_not_exists('4.5.2.08', 'Reparos Mecânicos', '4.5.2', TRUE);
SELECT create_expense_account_if_not_exists('4.5.2.09', 'Reparos Elétricos', '4.5.2', TRUE);

SELECT create_expense_account_if_not_exists('4.5.3', 'Taxas e Licenciamento', '4.5', FALSE);
SELECT create_expense_account_if_not_exists('4.5.3.01', 'IPVA', '4.5.3', TRUE);
SELECT create_expense_account_if_not_exists('4.5.3.02', 'Licenciamento', '4.5.3', TRUE);
SELECT create_expense_account_if_not_exists('4.5.3.03', 'DPVAT', '4.5.3', TRUE);
SELECT create_expense_account_if_not_exists('4.5.3.04', 'Multas de Trânsito', '4.5.3', TRUE);
SELECT create_expense_account_if_not_exists('4.5.3.05', 'Pedágio', '4.5.3', TRUE);
SELECT create_expense_account_if_not_exists('4.5.3.06', 'Estacionamento', '4.5.3', TRUE);

SELECT create_expense_account_if_not_exists('4.5.4', 'Seguro de Veículos', '4.5', FALSE);
SELECT create_expense_account_if_not_exists('4.5.4.01', 'Seguro Auto', '4.5.4', TRUE);
SELECT create_expense_account_if_not_exists('4.5.4.02', 'Franquia de Sinistro', '4.5.4', TRUE);

SELECT create_expense_account_if_not_exists('4.5.5', 'Locação de Veículos', '4.5', FALSE);
SELECT create_expense_account_if_not_exists('4.5.5.01', 'Aluguel de Veículos', '4.5.5', TRUE);
SELECT create_expense_account_if_not_exists('4.5.5.02', 'Uber/99/Taxi', '4.5.5', TRUE);

-- ============================================================================
-- 4.6 DESPESAS COM VIAGENS
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.6', 'DESPESAS COM VIAGENS', '4', FALSE);

SELECT create_expense_account_if_not_exists('4.6.1', 'Transporte', '4.6', FALSE);
SELECT create_expense_account_if_not_exists('4.6.1.01', 'Passagens Aéreas', '4.6.1', TRUE);
SELECT create_expense_account_if_not_exists('4.6.1.02', 'Passagens Rodoviárias', '4.6.1', TRUE);
SELECT create_expense_account_if_not_exists('4.6.1.03', 'Táxi/Uber em Viagens', '4.6.1', TRUE);
SELECT create_expense_account_if_not_exists('4.6.1.04', 'Aluguel de Carro em Viagens', '4.6.1', TRUE);
SELECT create_expense_account_if_not_exists('4.6.1.05', 'Combustível em Viagens', '4.6.1', TRUE);

SELECT create_expense_account_if_not_exists('4.6.2', 'Hospedagem', '4.6', FALSE);
SELECT create_expense_account_if_not_exists('4.6.2.01', 'Hotel/Pousada', '4.6.2', TRUE);
SELECT create_expense_account_if_not_exists('4.6.2.02', 'Airbnb/Aluguel Temporário', '4.6.2', TRUE);

SELECT create_expense_account_if_not_exists('4.6.3', 'Alimentação em Viagens', '4.6', FALSE);
SELECT create_expense_account_if_not_exists('4.6.3.01', 'Refeições em Viagens', '4.6.3', TRUE);
SELECT create_expense_account_if_not_exists('4.6.3.02', 'Diárias de Alimentação', '4.6.3', TRUE);

SELECT create_expense_account_if_not_exists('4.6.4', 'Outros Custos de Viagem', '4.6', FALSE);
SELECT create_expense_account_if_not_exists('4.6.4.01', 'Seguro Viagem', '4.6.4', TRUE);
SELECT create_expense_account_if_not_exists('4.6.4.02', 'Visto/Documentação', '4.6.4', TRUE);
SELECT create_expense_account_if_not_exists('4.6.4.03', 'Vacinas/Saúde Viagem', '4.6.4', TRUE);
SELECT create_expense_account_if_not_exists('4.6.4.04', 'Comunicação em Viagens', '4.6.4', TRUE);

-- ============================================================================
-- 4.7 DESPESAS COM MARKETING E COMERCIAL
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.7', 'DESPESAS COM MARKETING', '4', FALSE);

SELECT create_expense_account_if_not_exists('4.7.1', 'Publicidade', '4.7', FALSE);
SELECT create_expense_account_if_not_exists('4.7.1.01', 'Anúncios Google Ads', '4.7.1', TRUE);
SELECT create_expense_account_if_not_exists('4.7.1.02', 'Anúncios Facebook/Instagram', '4.7.1', TRUE);
SELECT create_expense_account_if_not_exists('4.7.1.03', 'Anúncios LinkedIn', '4.7.1', TRUE);
SELECT create_expense_account_if_not_exists('4.7.1.04', 'Anúncios em Rádio', '4.7.1', TRUE);
SELECT create_expense_account_if_not_exists('4.7.1.05', 'Anúncios em TV', '4.7.1', TRUE);
SELECT create_expense_account_if_not_exists('4.7.1.06', 'Anúncios em Jornais/Revistas', '4.7.1', TRUE);
SELECT create_expense_account_if_not_exists('4.7.1.07', 'Outdoor/Painéis', '4.7.1', TRUE);
SELECT create_expense_account_if_not_exists('4.7.1.08', 'Patrocínios', '4.7.1', TRUE);

SELECT create_expense_account_if_not_exists('4.7.2', 'Material Promocional', '4.7', FALSE);
SELECT create_expense_account_if_not_exists('4.7.2.01', 'Brindes', '4.7.2', TRUE);
SELECT create_expense_account_if_not_exists('4.7.2.02', 'Cartões de Visita', '4.7.2', TRUE);
SELECT create_expense_account_if_not_exists('4.7.2.03', 'Folders e Catálogos', '4.7.2', TRUE);
SELECT create_expense_account_if_not_exists('4.7.2.04', 'Banners e Faixas', '4.7.2', TRUE);
SELECT create_expense_account_if_not_exists('4.7.2.05', 'Uniformes com Logo', '4.7.2', TRUE);
SELECT create_expense_account_if_not_exists('4.7.2.06', 'Embalagens Personalizadas', '4.7.2', TRUE);

SELECT create_expense_account_if_not_exists('4.7.3', 'Eventos', '4.7', FALSE);
SELECT create_expense_account_if_not_exists('4.7.3.01', 'Feiras e Exposições', '4.7.3', TRUE);
SELECT create_expense_account_if_not_exists('4.7.3.02', 'Congressos e Convenções', '4.7.3', TRUE);
SELECT create_expense_account_if_not_exists('4.7.3.03', 'Eventos Corporativos', '4.7.3', TRUE);
SELECT create_expense_account_if_not_exists('4.7.3.04', 'Coffee Break/Coquetel', '4.7.3', TRUE);
SELECT create_expense_account_if_not_exists('4.7.3.05', 'Locação de Espaço p/ Eventos', '4.7.3', TRUE);

SELECT create_expense_account_if_not_exists('4.7.4', 'Marketing Digital', '4.7', FALSE);
SELECT create_expense_account_if_not_exists('4.7.4.01', 'Criação de Conteúdo', '4.7.4', TRUE);
SELECT create_expense_account_if_not_exists('4.7.4.02', 'SEO', '4.7.4', TRUE);
SELECT create_expense_account_if_not_exists('4.7.4.03', 'E-mail Marketing', '4.7.4', TRUE);
SELECT create_expense_account_if_not_exists('4.7.4.04', 'Redes Sociais - Gestão', '4.7.4', TRUE);
SELECT create_expense_account_if_not_exists('4.7.4.05', 'Influenciadores', '4.7.4', TRUE);

SELECT create_expense_account_if_not_exists('4.7.5', 'Relacionamento com Clientes', '4.7', FALSE);
SELECT create_expense_account_if_not_exists('4.7.5.01', 'Brindes para Clientes', '4.7.5', TRUE);
SELECT create_expense_account_if_not_exists('4.7.5.02', 'Cestas de Natal', '4.7.5', TRUE);
SELECT create_expense_account_if_not_exists('4.7.5.03', 'Refeições com Clientes', '4.7.5', TRUE);
SELECT create_expense_account_if_not_exists('4.7.5.04', 'Entretenimento de Clientes', '4.7.5', TRUE);

-- ============================================================================
-- 4.8 DEPRECIAÇÃO E AMORTIZAÇÃO
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.8', 'DEPRECIAÇÃO E AMORTIZAÇÃO', '4', FALSE);

SELECT create_expense_account_if_not_exists('4.8.1', 'Depreciação', '4.8', FALSE);
SELECT create_expense_account_if_not_exists('4.8.1.01', 'Depreciação de Móveis', '4.8.1', TRUE);
SELECT create_expense_account_if_not_exists('4.8.1.02', 'Depreciação de Equipamentos', '4.8.1', TRUE);
SELECT create_expense_account_if_not_exists('4.8.1.03', 'Depreciação de Computadores', '4.8.1', TRUE);
SELECT create_expense_account_if_not_exists('4.8.1.04', 'Depreciação de Veículos', '4.8.1', TRUE);
SELECT create_expense_account_if_not_exists('4.8.1.05', 'Depreciação de Edificações', '4.8.1', TRUE);
SELECT create_expense_account_if_not_exists('4.8.1.06', 'Depreciação de Instalações', '4.8.1', TRUE);

SELECT create_expense_account_if_not_exists('4.8.2', 'Amortização', '4.8', FALSE);
SELECT create_expense_account_if_not_exists('4.8.2.01', 'Amortização de Software', '4.8.2', TRUE);
SELECT create_expense_account_if_not_exists('4.8.2.02', 'Amortização de Marcas/Patentes', '4.8.2', TRUE);
SELECT create_expense_account_if_not_exists('4.8.2.03', 'Amortização de Benfeitorias', '4.8.2', TRUE);

-- ============================================================================
-- 4.9 PERDAS E PROVISÕES (específicas, NÃO genéricas)
-- ============================================================================

SELECT create_expense_account_if_not_exists('4.9', 'PERDAS E PROVISÕES', '4', FALSE);

SELECT create_expense_account_if_not_exists('4.9.1', 'Perdas', '4.9', FALSE);
SELECT create_expense_account_if_not_exists('4.9.1.01', 'Perda em Créditos Incobráveis', '4.9.1', TRUE);
SELECT create_expense_account_if_not_exists('4.9.1.02', 'Perda por Roubo/Furto', '4.9.1', TRUE);
SELECT create_expense_account_if_not_exists('4.9.1.03', 'Perda em Sinistros', '4.9.1', TRUE);
SELECT create_expense_account_if_not_exists('4.9.1.04', 'Perda em Litígios', '4.9.1', TRUE);
SELECT create_expense_account_if_not_exists('4.9.1.05', 'Perda em Investimentos', '4.9.1', TRUE);

SELECT create_expense_account_if_not_exists('4.9.2', 'Provisões', '4.9', FALSE);
SELECT create_expense_account_if_not_exists('4.9.2.01', 'Provisão p/ Créditos Liquidação Duvidosa', '4.9.2', TRUE);
SELECT create_expense_account_if_not_exists('4.9.2.02', 'Provisão p/ Contingências Trabalhistas', '4.9.2', TRUE);
SELECT create_expense_account_if_not_exists('4.9.2.03', 'Provisão p/ Contingências Fiscais', '4.9.2', TRUE);
SELECT create_expense_account_if_not_exists('4.9.2.04', 'Provisão p/ Contingências Cíveis', '4.9.2', TRUE);
SELECT create_expense_account_if_not_exists('4.9.2.05', 'Provisão p/ Garantias', '4.9.2', TRUE);

-- ============================================================================
-- REMOVER CONTAS GENÉRICAS (se existirem e não tiverem movimentação)
-- ============================================================================

-- Identificar contas genéricas para revisão (não deletar automaticamente)
DO $$
DECLARE
    v_conta RECORD;
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421'::UUID;
BEGIN
    RAISE NOTICE '=== CONTAS GENÉRICAS IDENTIFICADAS PARA REVISÃO ===';
    
    FOR v_conta IN 
        SELECT id, code, name
        FROM chart_of_accounts
        WHERE code LIKE '4%'
          AND tenant_id = v_tenant_id
          AND (
              name ILIKE '%diversas%'
              OR name ILIKE '%diversos%'
              OR name ILIKE '%outras%'
              OR name ILIKE '%outros%'
              OR name ILIKE '%genéric%'
              OR name ILIKE '%generic%'
              OR name ILIKE '%a classificar%'
              OR name ILIKE '%não identificad%'
          )
          AND is_analytical = TRUE
        ORDER BY code
    LOOP
        RAISE NOTICE 'Conta genérica: % - %', v_conta.code, v_conta.name;
    END LOOP;
END $$;

-- ============================================================================
-- LIMPAR FUNÇÃO AUXILIAR
-- ============================================================================

DROP FUNCTION IF EXISTS create_expense_account_if_not_exists;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
    v_total INTEGER;
    v_analiticas INTEGER;
    v_tenant_id UUID := 'a53a4957-fe97-4856-b3ca-70045157b421'::UUID;
BEGIN
    SELECT COUNT(*) INTO v_total 
    FROM chart_of_accounts 
    WHERE code LIKE '4%'
      AND tenant_id = v_tenant_id;
    
    SELECT COUNT(*) INTO v_analiticas 
    FROM chart_of_accounts 
    WHERE code LIKE '4%' 
      AND is_analytical = TRUE
      AND tenant_id = v_tenant_id;
    
    RAISE NOTICE '=== RESULTADO DA MIGRAÇÃO ===';
    RAISE NOTICE 'Total de contas de despesa: %', v_total;
    RAISE NOTICE 'Contas analíticas (lançáveis): %', v_analiticas;
    RAISE NOTICE 'Contas sintéticas (grupos): %', v_total - v_analiticas;
END $$;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================

COMMENT ON SCHEMA public IS 'Migration: Plano de Despesas Detalhado sem contas genéricas - 30/01/2026';
