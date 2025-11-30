-- =====================================================
-- AMPLA CONTABILIDADE - Sistema de Governança IA
-- Migration: 20251130080000
-- Descrição: Automação completa com agentes IA em cada tela
--            Lançamentos automáticos, reuniões, apresentações
-- =====================================================

-- =====================================================
-- 1. MAPEAMENTO DE AGENTES IA POR TELA/FORMULÁRIO
-- Cada tela tem um agente responsável - NADA SEM IA
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_page_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_path TEXT UNIQUE NOT NULL, -- Caminho da página (ex: /bank-import)
    page_name TEXT NOT NULL, -- Nome amigável
    primary_agent_id TEXT NOT NULL, -- Agente principal responsável
    secondary_agents TEXT[], -- Agentes de apoio
    agent_role TEXT NOT NULL, -- O que o agente faz nesta tela
    auto_actions TEXT[], -- Ações automáticas que o agente executa
    requires_approval BOOLEAN DEFAULT false, -- Se precisa aprovação humana
    approval_threshold DECIMAL(15,2), -- Valor acima do qual precisa aprovação
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir mapeamento de agentes por página
INSERT INTO ai_page_agents (page_path, page_name, primary_agent_id, secondary_agents, agent_role, auto_actions, requires_approval, approval_threshold) VALUES
-- Dashboard e Visão Geral
('/dashboard', 'Dashboard', 'helena', ARRAY['milton', 'cicero'],
 'Dra. Helena monitora indicadores de desempenho e alerta sobre desvios',
 ARRAY['Gerar alertas de KPIs', 'Sugerir ações corretivas', 'Priorizar tarefas'],
 false, NULL),

('/executive', 'Visão Executiva', 'milton', ARRAY['helena', 'cicero'],
 'Prof. Milton apresenta análise financeira executiva com projeções',
 ARRAY['Calcular indicadores', 'Gerar projeções', 'Comparar períodos'],
 false, NULL),

('/cash-flow', 'Fluxo de Caixa', 'milton', ARRAY['cicero'],
 'Prof. Milton gerencia fluxo de caixa e previsões de liquidez',
 ARRAY['Projetar saldos', 'Alertar sobre gaps', 'Sugerir investimentos'],
 false, NULL),

-- Banco
('/bank-accounts', 'Contas Bancárias', 'cicero', ARRAY['milton'],
 'Dr. Cícero valida cadastro de contas conforme plano contábil',
 ARRAY['Vincular conta contábil', 'Validar dados bancários'],
 false, NULL),

('/bank-import', 'Importar Extrato', 'atlas', ARRAY['cicero', 'milton'],
 'Atlas classifica transações automaticamente com aprendizado contínuo',
 ARRAY['Classificar transações', 'Aprender padrões', 'Gerar lançamentos'],
 true, 5000.00),

('/bank-reconciliation', 'Conciliação Bancária', 'cicero', ARRAY['atlas'],
 'Dr. Cícero garante que extrato e contabilidade estejam conciliados',
 ARRAY['Identificar divergências', 'Sugerir correções', 'Fechar conciliação'],
 false, NULL),

-- Contas a Receber
('/billing', 'Honorários', 'helena', ARRAY['milton', 'cicero'],
 'Dra. Helena gerencia faturamento e controla inadimplência',
 ARRAY['Gerar boletos', 'Enviar cobranças', 'Negociar débitos'],
 true, 10000.00),

('/generate-billing', 'Gerar Honorários', 'helena', ARRAY['cicero'],
 'Dra. Helena calcula honorários mensais conforme contratos',
 ARRAY['Calcular valores', 'Aplicar reajustes', 'Gerar lotes'],
 true, NULL),

-- Contas a Pagar
('/expenses', 'Despesas', 'milton', ARRAY['cicero', 'advocato'],
 'Prof. Milton controla despesas e analisa custos operacionais',
 ARRAY['Classificar despesas', 'Alertar sobre orçamento', 'Aprovar pagamentos'],
 true, 2000.00),

('/accounts-payable', 'Fornecedores', 'cicero', ARRAY['milton', 'advocato'],
 'Dr. Cícero registra obrigações e provisiona pagamentos',
 ARRAY['Registrar NFs', 'Provisionar valores', 'Gerar lançamentos'],
 true, 5000.00),

-- Funcionários e Terceiros
('/employees', 'Funcionários', 'advocato', ARRAY['empresario', 'cicero'],
 'Dr. Advocato monitora riscos trabalhistas e sugere regularizações',
 ARRAY['Calcular provisões', 'Alertar riscos', 'Sugerir soluções'],
 false, NULL),

('/payroll', 'Folha de Pagamento', 'cicero', ARRAY['advocato', 'milton'],
 'Dr. Cícero gera folha, calcula encargos e faz lançamentos contábeis',
 ARRAY['Calcular folha', 'Gerar lançamentos', 'Provisionar férias/13º'],
 true, NULL),

('/providers', 'Prestadores de Serviço', 'advocato', ARRAY['empresario', 'cicero'],
 'Dr. Advocato e Sr. Empresário avaliam riscos e propõem estruturas',
 ARRAY['Verificar compliance', 'Exigir NFs', 'Gerar contratos'],
 false, NULL),

-- Estoque e Compras
('/inventory', 'Estoque', 'helena', ARRAY['milton', 'cicero'],
 'Dra. Helena controla estoque e gera listas de compras automaticamente',
 ARRAY['Monitorar níveis', 'Gerar listas', 'Alertar reposição'],
 false, NULL),

('/purchases', 'Compras', 'milton', ARRAY['helena', 'cicero'],
 'Prof. Milton aprova orçamentos e registra entradas no estoque',
 ARRAY['Comparar preços', 'Aprovar compras', 'Dar entrada estoque'],
 true, 500.00),

-- Contabilidade
('/chart-of-accounts', 'Plano de Contas', 'cicero', '{}'::text[],
 'Dr. Cícero mantém plano de contas conforme NBC/CFC',
 ARRAY['Validar estrutura', 'Criar contas', 'Manter conformidade'],
 false, NULL),

('/journal', 'Livro Diário', 'cicero', ARRAY['milton'],
 'Dr. Cícero registra e valida todos os lançamentos contábeis',
 ARRAY['Validar partidas', 'Verificar saldos', 'Fechar período'],
 false, NULL),

('/trial-balance', 'Balancete', 'cicero', ARRAY['milton', 'helena'],
 'Dr. Cícero gera balancete e identifica inconsistências',
 ARRAY['Calcular saldos', 'Verificar fechamento', 'Identificar erros'],
 false, NULL),

-- Configurações
('/settings', 'Configurações', 'helena', ARRAY['cicero', 'advocato', 'empresario'],
 'Dra. Helena coordena configurações gerais com toda a equipe IA',
 ARRAY['Validar cadastros', 'Manter compliance', 'Atualizar parâmetros'],
 false, NULL),

-- Reuniões
('/meetings', 'Reuniões', 'helena', ARRAY['milton', 'cicero', 'advocato', 'empresario'],
 'Dra. Helena organiza e conduz reuniões financeiras periódicas',
 ARRAY['Agendar reuniões', 'Gerar pautas', 'Criar apresentações', 'Registrar decisões'],
 false, NULL);

-- =====================================================
-- 2. LANÇAMENTOS CONTÁBEIS AUTOMÁTICOS DA FOLHA
-- =====================================================

CREATE TABLE IF NOT EXISTS payroll_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID REFERENCES payroll(id) ON DELETE CASCADE,
    journal_entry_id UUID, -- Referência ao lançamento no diário
    entry_type TEXT NOT NULL, -- 'salarios', 'encargos', 'provisoes'
    description TEXT NOT NULL,
    debit_account TEXT NOT NULL,
    credit_account TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    competence_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Função para gerar lançamentos contábeis da folha
CREATE OR REPLACE FUNCTION generate_payroll_journal_entries(p_payroll_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_payroll RECORD;
    v_employee RECORD;
    v_count INTEGER := 0;
    v_competencia DATE;
BEGIN
    -- Buscar dados da folha
    SELECT p.*, e.name as employee_name, e.work_area
    INTO v_payroll
    FROM payroll p
    JOIN employees e ON e.id = p.employee_id
    WHERE p.id = p_payroll_id;

    IF v_payroll IS NULL THEN
        RAISE EXCEPTION 'Folha não encontrada';
    END IF;

    v_competencia := v_payroll.competencia;

    -- Limpar lançamentos anteriores
    DELETE FROM payroll_journal_entries WHERE payroll_id = p_payroll_id;

    -- 1. SALÁRIOS OFICIAIS (Despesa)
    -- D - 4.1.1.01 Salários e Ordenados
    -- C - 2.1.3.01 Salários a Pagar
    IF v_payroll.total_proventos_oficial > 0 THEN
        INSERT INTO payroll_journal_entries (payroll_id, entry_type, description, debit_account, credit_account, amount, competence_date)
        VALUES (
            p_payroll_id,
            'salarios',
            'Salários - ' || v_payroll.employee_name || ' - ' || to_char(v_competencia, 'MM/YYYY'),
            '4.1.1.01', -- Despesa com Salários
            '2.1.3.01', -- Salários a Pagar
            v_payroll.total_proventos_oficial,
            v_competencia
        );
        v_count := v_count + 1;
    END IF;

    -- 2. INSS EMPRESA (Encargo)
    -- D - 4.1.2.01 INSS Patronal
    -- C - 2.1.3.02 INSS a Recolher
    IF v_payroll.inss_empresa > 0 THEN
        INSERT INTO payroll_journal_entries (payroll_id, entry_type, description, debit_account, credit_account, amount, competence_date)
        VALUES (
            p_payroll_id,
            'encargos',
            'INSS Patronal - ' || v_payroll.employee_name || ' - ' || to_char(v_competencia, 'MM/YYYY'),
            '4.1.2.01', -- INSS Patronal
            '2.1.3.02', -- INSS a Recolher
            v_payroll.inss_empresa,
            v_competencia
        );
        v_count := v_count + 1;
    END IF;

    -- 3. FGTS (Encargo)
    -- D - 4.1.2.02 FGTS
    -- C - 2.1.3.03 FGTS a Recolher
    IF v_payroll.fgts_valor > 0 THEN
        INSERT INTO payroll_journal_entries (payroll_id, entry_type, description, debit_account, credit_account, amount, competence_date)
        VALUES (
            p_payroll_id,
            'encargos',
            'FGTS - ' || v_payroll.employee_name || ' - ' || to_char(v_competencia, 'MM/YYYY'),
            '4.1.2.02', -- FGTS
            '2.1.3.03', -- FGTS a Recolher
            v_payroll.fgts_valor,
            v_competencia
        );
        v_count := v_count + 1;
    END IF;

    -- 4. PROVISÃO DE FÉRIAS
    -- D - 4.1.3.01 Provisão de Férias
    -- C - 2.1.4.01 Férias a Pagar
    IF v_payroll.provisao_ferias > 0 THEN
        INSERT INTO payroll_journal_entries (payroll_id, entry_type, description, debit_account, credit_account, amount, competence_date)
        VALUES (
            p_payroll_id,
            'provisoes',
            'Provisão Férias - ' || v_payroll.employee_name || ' - ' || to_char(v_competencia, 'MM/YYYY'),
            '4.1.3.01', -- Provisão de Férias
            '2.1.4.01', -- Férias a Pagar
            v_payroll.provisao_ferias,
            v_competencia
        );
        v_count := v_count + 1;
    END IF;

    -- 5. PROVISÃO 13º SALÁRIO
    -- D - 4.1.3.02 Provisão 13º Salário
    -- C - 2.1.4.02 13º Salário a Pagar
    IF v_payroll.provisao_13 > 0 THEN
        INSERT INTO payroll_journal_entries (payroll_id, entry_type, description, debit_account, credit_account, amount, competence_date)
        VALUES (
            p_payroll_id,
            'provisoes',
            'Provisão 13º - ' || v_payroll.employee_name || ' - ' || to_char(v_competencia, 'MM/YYYY'),
            '4.1.3.02', -- Provisão 13º
            '2.1.4.02', -- 13º a Pagar
            v_payroll.provisao_13,
            v_competencia
        );
        v_count := v_count + 1;
    END IF;

    -- Atualizar status da folha
    UPDATE payroll SET status = 'contabilizada' WHERE id = p_payroll_id;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar lançamentos ao fechar folha
CREATE OR REPLACE FUNCTION tr_payroll_generate_entries()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'fechada' AND OLD.status != 'fechada' THEN
        PERFORM generate_payroll_journal_entries(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_payroll_journal ON payroll;
CREATE TRIGGER tr_payroll_journal
    AFTER UPDATE ON payroll
    FOR EACH ROW
    EXECUTE FUNCTION tr_payroll_generate_entries();

-- =====================================================
-- 3. SISTEMA DE COMPRAS COM APROVAÇÃO E ESTOQUE
-- =====================================================

-- Estados da ordem de compra
-- pending -> approved -> purchased -> received -> stocked

ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS approved_by_agent TEXT; -- Qual agente aprovou
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS total_estimated DECIMAL(15,2);
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS total_actual DECIMAL(15,2);
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS invoice_file_url TEXT;
ALTER TABLE purchase_lists ADD COLUMN IF NOT EXISTS accounting_entry_id UUID; -- Lançamento contábil

-- Tabela de movimentação de estoque
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES office_products(id),
    movement_type TEXT NOT NULL, -- 'entrada', 'saida', 'ajuste'
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(15,2),
    reference_type TEXT, -- 'purchase', 'consumption', 'adjustment'
    reference_id UUID, -- ID da compra, consumo ou ajuste
    previous_stock DECIMAL(10,2),
    new_stock DECIMAL(10,2),
    notes TEXT,
    created_by TEXT, -- humano ou agente
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Função para aprovar orçamento de compras (executada pelo agente Milton)
CREATE OR REPLACE FUNCTION approve_purchase_list(
    p_list_id UUID,
    p_agent_id TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_list RECORD;
    v_total DECIMAL;
    v_threshold DECIMAL;
    v_needs_human BOOLEAN := false;
BEGIN
    -- Buscar lista
    SELECT * INTO v_list FROM purchase_lists WHERE id = p_list_id;

    IF v_list IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lista não encontrada');
    END IF;

    -- Calcular total estimado
    SELECT COALESCE(SUM(pli.estimated_price * pli.quantity), 0) INTO v_total
    FROM purchase_list_items pli
    WHERE pli.list_id = p_list_id;

    -- Verificar threshold do agente para esta página
    SELECT approval_threshold INTO v_threshold
    FROM ai_page_agents
    WHERE page_path = '/purchases';

    -- Se acima do threshold, precisa aprovação humana
    IF v_threshold IS NOT NULL AND v_total > v_threshold THEN
        v_needs_human := true;
    END IF;

    -- Atualizar lista
    UPDATE purchase_lists SET
        approval_status = CASE WHEN v_needs_human THEN 'pending_human' ELSE 'approved' END,
        approved_by_agent = p_agent_id,
        approved_at = CASE WHEN NOT v_needs_human THEN now() ELSE NULL END,
        total_estimated = v_total,
        notes = COALESCE(notes || E'\n', '') || 'Prof. Milton: ' || COALESCE(p_notes, 'Orçamento analisado e aprovado.')
    WHERE id = p_list_id;

    RETURN jsonb_build_object(
        'success', true,
        'approved', NOT v_needs_human,
        'needs_human_approval', v_needs_human,
        'total', v_total,
        'threshold', v_threshold,
        'agent', p_agent_id,
        'message', CASE
            WHEN v_needs_human THEN 'Valor R$ ' || v_total || ' acima do limite. Aguardando aprovação humana.'
            ELSE 'Orçamento aprovado por Prof. Milton. Pode prosseguir com a compra.'
        END
    );
END;
$$ LANGUAGE plpgsql;

-- Função para registrar compra e dar entrada no estoque
CREATE OR REPLACE FUNCTION register_purchase_and_stock(
    p_list_id UUID,
    p_invoice_number TEXT,
    p_total_actual DECIMAL,
    p_purchase_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_product RECORD;
    v_movement_id UUID;
    v_entry_count INTEGER := 0;
BEGIN
    -- Atualizar lista de compras
    UPDATE purchase_lists SET
        status = 'completed',
        approval_status = 'purchased',
        invoice_number = p_invoice_number,
        total_actual = p_total_actual,
        purchase_date = p_purchase_date
    WHERE id = p_list_id;

    -- Dar entrada em cada item
    FOR v_item IN
        SELECT pli.*, op.name as product_name, op.current_stock
        FROM purchase_list_items pli
        JOIN office_products op ON op.id = pli.product_id
        WHERE pli.list_id = p_list_id
    LOOP
        -- Criar movimento de entrada
        INSERT INTO inventory_movements (
            product_id, movement_type, quantity, unit_cost, total_cost,
            reference_type, reference_id, previous_stock, new_stock,
            notes, created_by
        ) VALUES (
            v_item.product_id,
            'entrada',
            v_item.quantity,
            v_item.actual_price,
            v_item.actual_price * v_item.quantity,
            'purchase',
            p_list_id,
            v_item.current_stock,
            v_item.current_stock + v_item.quantity,
            'Compra NF ' || p_invoice_number,
            'helena' -- Dra. Helena registra entrada
        )
        RETURNING id INTO v_movement_id;

        -- Atualizar estoque do produto
        UPDATE office_products SET
            current_stock = current_stock + v_item.quantity,
            last_purchase_price = v_item.actual_price,
            last_purchase_date = p_purchase_date,
            updated_at = now()
        WHERE id = v_item.product_id;

        v_entry_count := v_entry_count + 1;
    END LOOP;

    -- TODO: Gerar lançamento contábil
    -- D - 1.1.5.01 Estoque de Materiais
    -- C - 2.1.1.01 Fornecedores ou 1.1.1.XX Banco

    RETURN jsonb_build_object(
        'success', true,
        'items_stocked', v_entry_count,
        'invoice', p_invoice_number,
        'total', p_total_actual,
        'message', 'Dra. Helena: Compra registrada e ' || v_entry_count || ' itens entraram no estoque.'
    );
END;
$$ LANGUAGE plpgsql;

-- Função para dar baixa no estoque (consumo)
CREATE OR REPLACE FUNCTION register_consumption(
    p_product_id UUID,
    p_quantity DECIMAL,
    p_consumed_by TEXT DEFAULT 'Lilian',
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_new_stock DECIMAL;
BEGIN
    -- Buscar produto
    SELECT * INTO v_product FROM office_products WHERE id = p_product_id;

    IF v_product IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
    END IF;

    IF v_product.current_stock < p_quantity THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Estoque insuficiente. Disponível: ' || v_product.current_stock
        );
    END IF;

    v_new_stock := v_product.current_stock - p_quantity;

    -- Registrar movimento de saída
    INSERT INTO inventory_movements (
        product_id, movement_type, quantity, unit_cost, total_cost,
        reference_type, previous_stock, new_stock, notes, created_by
    ) VALUES (
        p_product_id,
        'saida',
        p_quantity,
        v_product.last_purchase_price,
        v_product.last_purchase_price * p_quantity,
        'consumption',
        v_product.current_stock,
        v_new_stock,
        COALESCE(p_notes, 'Consumo regular'),
        p_consumed_by
    );

    -- Atualizar estoque
    UPDATE office_products SET
        current_stock = v_new_stock,
        updated_at = now()
    WHERE id = p_product_id;

    -- Registrar na tabela de consumo
    INSERT INTO product_consumption (product_id, quantity, consumed_by, notes)
    VALUES (p_product_id, p_quantity, p_consumed_by, p_notes);

    RETURN jsonb_build_object(
        'success', true,
        'product', v_product.name,
        'consumed', p_quantity,
        'remaining', v_new_stock,
        'alert', CASE
            WHEN v_new_stock <= v_product.minimum_stock THEN 'ATENÇÃO: Estoque abaixo do mínimo!'
            WHEN v_new_stock <= v_product.minimum_stock * 1.5 THEN 'Estoque baixo, considere repor em breve.'
            ELSE NULL
        END
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. SISTEMA DE REUNIÕES PERIÓDICAS COM IA
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_type TEXT NOT NULL, -- 'semanal', 'mensal', 'trimestral', 'extraordinaria'
    title TEXT NOT NULL,
    scheduled_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,

    -- Participantes
    participants JSONB DEFAULT '[]'::jsonb, -- Lista de participantes (humanos)
    ai_facilitator TEXT DEFAULT 'helena', -- Agente que conduz
    ai_participants TEXT[] DEFAULT ARRAY['milton', 'cicero', 'advocato', 'empresario'],

    -- Pauta
    agenda JSONB DEFAULT '[]'::jsonb, -- Itens da pauta
    ai_generated_topics JSONB, -- Tópicos sugeridos pela IA

    -- Status
    status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    -- Resultados
    decisions JSONB DEFAULT '[]'::jsonb, -- Decisões tomadas
    action_items JSONB DEFAULT '[]'::jsonb, -- Ações a executar
    notes TEXT, -- Notas da reunião
    ai_summary TEXT, -- Resumo gerado pela IA

    -- Apresentação
    presentation_id UUID, -- Referência à apresentação gerada
    presentation_url TEXT,

    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Participantes padrão das reuniões
CREATE TABLE IF NOT EXISTS meeting_default_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_type TEXT NOT NULL,
    participant_type TEXT NOT NULL, -- 'partner', 'employee', 'family'
    participant_name TEXT NOT NULL,
    participant_role TEXT,
    is_mandatory BOOLEAN DEFAULT false,
    notify_email TEXT,
    notify_whatsapp TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir participantes padrão
INSERT INTO meeting_default_participants (meeting_type, participant_type, participant_name, participant_role, is_mandatory) VALUES
-- Reuniões mensais - sócios e filhos
('mensal', 'partner', 'Sergio Carneiro Leão', 'Sócio-Administrador', true),
('mensal', 'family', 'Nayara', 'Filha - Controladoria', false),
('mensal', 'family', 'Victor Hugo', 'Filho - Legalização', false),
('mensal', 'family', 'Sergio Augusto', 'Filho - Medicina/Clínica', false),

-- Reuniões semanais - operacional
('semanal', 'partner', 'Sergio Carneiro Leão', 'Sócio-Administrador', true),
('semanal', 'employee', 'Josimar', 'Contador Gerente', true),
('semanal', 'employee', 'Rose', 'Departamento Pessoal', false);

-- Tabela de apresentações/slides gerados pela IA
CREATE TABLE IF NOT EXISTS ai_presentations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES ai_meetings(id),
    title TEXT NOT NULL,
    presentation_type TEXT NOT NULL, -- 'slides', 'video', 'dashboard', 'report'
    purpose TEXT, -- Para que serve esta apresentação

    -- Conteúdo
    slides JSONB DEFAULT '[]'::jsonb, -- Array de slides com título e conteúdo
    data_sources JSONB, -- De onde vieram os dados
    charts JSONB, -- Gráficos incluídos
    highlights JSONB, -- Destaques/alertas

    -- Configuração de exibição
    display_mode TEXT DEFAULT 'fullscreen', -- fullscreen, embedded, tv
    auto_advance BOOLEAN DEFAULT true,
    slide_duration_seconds INTEGER DEFAULT 30,
    background_music BOOLEAN DEFAULT false,

    -- Status
    status TEXT DEFAULT 'draft', -- draft, ready, presented
    generated_by TEXT NOT NULL, -- Qual agente gerou
    generated_at TIMESTAMPTZ DEFAULT now(),

    -- Arquivo gerado
    file_url TEXT,
    file_format TEXT -- pdf, pptx, html, mp4

);

-- Função para gerar pauta da reunião automaticamente
CREATE OR REPLACE FUNCTION generate_meeting_agenda(p_meeting_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_meeting RECORD;
    v_agenda JSONB := '[]'::jsonb;
    v_alerts INTEGER;
    v_pending_invoices INTEGER;
    v_low_stock INTEGER;
    v_cash_flow DECIMAL;
BEGIN
    SELECT * INTO v_meeting FROM ai_meetings WHERE id = p_meeting_id;

    -- Contar alertas trabalhistas
    SELECT COUNT(*) INTO v_alerts FROM vw_all_labor_alerts;

    -- Contar NFs pendentes
    SELECT COUNT(*) INTO v_pending_invoices
    FROM service_providers WHERE contract_signed = false;

    -- Contar itens com estoque baixo
    SELECT COUNT(*) INTO v_low_stock FROM vw_low_stock_products;

    -- Montar pauta baseada nos dados
    v_agenda := jsonb_build_array(
        jsonb_build_object(
            'ordem', 1,
            'titulo', 'Abertura e Boas-vindas',
            'responsavel', 'helena',
            'duracao_minutos', 5,
            'descricao', 'Dra. Helena abre a reunião e apresenta a pauta'
        ),
        jsonb_build_object(
            'ordem', 2,
            'titulo', 'Análise Financeira do Período',
            'responsavel', 'milton',
            'duracao_minutos', 15,
            'descricao', 'Prof. Milton apresenta indicadores, receitas, despesas e fluxo de caixa'
        ),
        jsonb_build_object(
            'ordem', 3,
            'titulo', 'Situação Contábil',
            'responsavel', 'cicero',
            'duracao_minutos', 10,
            'descricao', 'Dr. Cícero apresenta balancete, pendências e regularizações'
        )
    );

    -- Se houver alertas trabalhistas
    IF v_alerts > 0 THEN
        v_agenda := v_agenda || jsonb_build_array(
            jsonb_build_object(
                'ordem', 4,
                'titulo', 'Riscos Trabalhistas (' || v_alerts || ' alertas)',
                'responsavel', 'advocato',
                'duracao_minutos', 15,
                'descricao', 'Dr. Advocato apresenta riscos identificados e soluções propostas',
                'urgente', true
            )
        );
    END IF;

    -- Se houver estoque baixo
    IF v_low_stock > 0 THEN
        v_agenda := v_agenda || jsonb_build_array(
            jsonb_build_object(
                'ordem', 5,
                'titulo', 'Reposição de Estoque (' || v_low_stock || ' itens)',
                'responsavel', 'helena',
                'duracao_minutos', 5,
                'descricao', 'Aprovar lista de compras para reposição'
            )
        );
    END IF;

    -- Encerramento sempre
    v_agenda := v_agenda || jsonb_build_array(
        jsonb_build_object(
            'ordem', 99,
            'titulo', 'Deliberações e Encerramento',
            'responsavel', 'helena',
            'duracao_minutos', 10,
            'descricao', 'Registrar decisões, definir responsáveis e próximos passos'
        )
    );

    -- Atualizar reunião
    UPDATE ai_meetings SET
        agenda = v_agenda,
        ai_generated_topics = jsonb_build_object(
            'alertas_trabalhistas', v_alerts,
            'nfs_pendentes', v_pending_invoices,
            'estoque_baixo', v_low_stock,
            'gerado_em', now(),
            'gerado_por', 'helena'
        )
    WHERE id = p_meeting_id;

    RETURN v_agenda;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar apresentação da reunião
CREATE OR REPLACE FUNCTION generate_meeting_presentation(p_meeting_id UUID)
RETURNS UUID AS $$
DECLARE
    v_meeting RECORD;
    v_presentation_id UUID;
    v_slides JSONB := '[]'::jsonb;
BEGIN
    SELECT * INTO v_meeting FROM ai_meetings WHERE id = p_meeting_id;

    -- Slide 1: Capa
    v_slides := v_slides || jsonb_build_array(
        jsonb_build_object(
            'numero', 1,
            'tipo', 'capa',
            'titulo', v_meeting.title,
            'subtitulo', to_char(v_meeting.scheduled_date, 'DD/MM/YYYY'),
            'logo', true,
            'background', 'gradient-blue'
        )
    );

    -- Slide 2: Pauta
    v_slides := v_slides || jsonb_build_array(
        jsonb_build_object(
            'numero', 2,
            'tipo', 'lista',
            'titulo', 'Pauta da Reunião',
            'icone', 'clipboard',
            'items', (
                SELECT jsonb_agg(item->>'titulo')
                FROM jsonb_array_elements(v_meeting.agenda) item
            )
        )
    );

    -- Slide 3: Indicadores Financeiros
    v_slides := v_slides || jsonb_build_array(
        jsonb_build_object(
            'numero', 3,
            'tipo', 'kpis',
            'titulo', 'Indicadores Financeiros',
            'responsavel', 'Prof. Milton',
            'kpis', jsonb_build_array(
                jsonb_build_object('nome', 'Receita Bruta', 'valor', 'R$ XX.XXX,XX', 'variacao', '+5%'),
                jsonb_build_object('nome', 'Despesas', 'valor', 'R$ XX.XXX,XX', 'variacao', '-2%'),
                jsonb_build_object('nome', 'Lucro Líquido', 'valor', 'R$ XX.XXX,XX', 'variacao', '+8%'),
                jsonb_build_object('nome', 'Inadimplência', 'valor', 'X%', 'variacao', '-1%')
            )
        )
    );

    -- Slide 4: Alertas (se houver)
    IF (v_meeting.ai_generated_topics->>'alertas_trabalhistas')::int > 0 THEN
        v_slides := v_slides || jsonb_build_array(
            jsonb_build_object(
                'numero', 4,
                'tipo', 'alerta',
                'titulo', 'ATENÇÃO: Riscos Identificados',
                'responsavel', 'Dr. Advocato',
                'urgente', true,
                'items', jsonb_build_array(
                    'Pagamentos não registrados em folha',
                    'Contratos de prestadores pendentes',
                    'Sugestão: Regularização imediata'
                )
            )
        );
    END IF;

    -- Slide Final: Próximos Passos
    v_slides := v_slides || jsonb_build_array(
        jsonb_build_object(
            'numero', 99,
            'tipo', 'acoes',
            'titulo', 'Próximos Passos',
            'responsavel', 'Dra. Helena',
            'items', jsonb_build_array(
                jsonb_build_object('acao', 'Definir na reunião', 'responsavel', 'A definir', 'prazo', 'A definir')
            )
        )
    );

    -- Criar apresentação
    INSERT INTO ai_presentations (
        meeting_id, title, presentation_type, purpose,
        slides, generated_by, status
    ) VALUES (
        p_meeting_id,
        v_meeting.title || ' - Apresentação',
        'slides',
        'Apresentação gerada automaticamente para exibição em TV durante a reunião',
        v_slides,
        'helena',
        'ready'
    )
    RETURNING id INTO v_presentation_id;

    -- Atualizar reunião
    UPDATE ai_meetings SET presentation_id = v_presentation_id WHERE id = p_meeting_id;

    RETURN v_presentation_id;
END;
$$ LANGUAGE plpgsql;

-- Função para agendar reunião mensal automática
CREATE OR REPLACE FUNCTION schedule_monthly_meeting()
RETURNS UUID AS $$
DECLARE
    v_meeting_id UUID;
    v_next_date TIMESTAMPTZ;
BEGIN
    -- Agendar para primeira segunda-feira do próximo mês às 10h
    v_next_date := date_trunc('month', CURRENT_DATE + INTERVAL '1 month') +
                   (7 - EXTRACT(DOW FROM date_trunc('month', CURRENT_DATE + INTERVAL '1 month'))::int + 1) % 7 * INTERVAL '1 day' +
                   INTERVAL '10 hours';

    INSERT INTO ai_meetings (
        meeting_type, title, scheduled_date, duration_minutes,
        participants, ai_facilitator, ai_participants
    ) VALUES (
        'mensal',
        'Reunião Mensal de Resultados - ' || to_char(v_next_date, 'MM/YYYY'),
        v_next_date,
        90,
        (SELECT jsonb_agg(jsonb_build_object(
            'nome', participant_name,
            'cargo', participant_role,
            'obrigatorio', is_mandatory
        )) FROM meeting_default_participants WHERE meeting_type = 'mensal'),
        'helena',
        ARRAY['milton', 'cicero', 'advocato', 'empresario']
    )
    RETURNING id INTO v_meeting_id;

    -- Gerar pauta
    PERFORM generate_meeting_agenda(v_meeting_id);

    -- Gerar apresentação
    PERFORM generate_meeting_presentation(v_meeting_id);

    RETURN v_meeting_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. VIEW DE CONTEXTO PARA CADA AGENTE
-- =====================================================

CREATE OR REPLACE VIEW vw_agent_dashboard AS
SELECT
    a.agent_id,
    a.name as agent_name,
    a.role,
    (SELECT COUNT(*) FROM ai_page_agents pa WHERE pa.primary_agent_id = a.agent_id) as pages_managed,
    (SELECT jsonb_agg(pa.page_name) FROM ai_page_agents pa WHERE pa.primary_agent_id = a.agent_id) as pages,
    CASE a.agent_id
        WHEN 'cicero' THEN (SELECT COUNT(*) FROM payroll WHERE status != 'fechada')
        WHEN 'milton' THEN (SELECT COUNT(*) FROM purchase_lists WHERE approval_status = 'pending')
        WHEN 'helena' THEN (SELECT COUNT(*) FROM ai_meetings WHERE status = 'scheduled')
        WHEN 'advocato' THEN (SELECT COUNT(*) FROM vw_all_labor_alerts)
        WHEN 'atlas' THEN (SELECT COUNT(*) FROM ai_pending_questions WHERE status = 'pending')
        ELSE 0
    END as pending_tasks,
    CASE a.agent_id
        WHEN 'cicero' THEN 'Dr. Cícero está monitorando a contabilidade e folha de pagamento'
        WHEN 'milton' THEN 'Prof. Milton está analisando finanças e orçamentos'
        WHEN 'helena' THEN 'Dra. Helena está coordenando gestão e reuniões'
        WHEN 'advocato' THEN 'Dr. Advocato está monitorando riscos trabalhistas'
        WHEN 'empresario' THEN 'Sr. Empresário está avaliando estruturas societárias'
        WHEN 'atlas' THEN 'Atlas está aprendendo padrões de transações'
        ELSE 'Agente ativo'
    END as current_status
FROM ai_agents a
WHERE a.is_active = true
ORDER BY a.agent_id;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE ai_page_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_default_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_page_agents_read" ON ai_page_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_journal_entries_all" ON payroll_journal_entries FOR ALL TO authenticated USING (true);
CREATE POLICY "inventory_movements_all" ON inventory_movements FOR ALL TO authenticated USING (true);
CREATE POLICY "ai_meetings_all" ON ai_meetings FOR ALL TO authenticated USING (true);
CREATE POLICY "meeting_default_participants_all" ON meeting_default_participants FOR ALL TO authenticated USING (true);
CREATE POLICY "ai_presentations_all" ON ai_presentations FOR ALL TO authenticated USING (true);

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE ai_page_agents IS 'Mapeamento de qual agente IA é responsável por cada tela - NADA SEM AGENTE';
COMMENT ON TABLE payroll_journal_entries IS 'Lançamentos contábeis gerados automaticamente pela folha de pagamento';
COMMENT ON TABLE inventory_movements IS 'Movimentação de estoque (entradas e saídas)';
COMMENT ON TABLE ai_meetings IS 'Reuniões periódicas com IA facilitando';
COMMENT ON TABLE ai_presentations IS 'Apresentações/slides gerados pela IA para reuniões';
COMMENT ON VIEW vw_agent_dashboard IS 'Visão geral do status de cada agente IA';
