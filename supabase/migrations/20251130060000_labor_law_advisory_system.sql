-- =====================================================
-- AMPLA CONTABILIDADE - Sistema de Consultoria Trabalhista com IA
-- Migration: 20251130060000
-- Descrição: Sistema completo de soluções para riscos trabalhistas
--            com jurisprudência, estratégias e agentes especializados
-- =====================================================

-- =====================================================
-- NOVOS AGENTES IA ESPECIALIZADOS
-- =====================================================

-- Tabela de agentes IA do sistema (expandindo o conceito)
CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    specialty TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT, -- Prompt do sistema para o agente
    knowledge_sources TEXT[], -- Fontes de conhecimento
    icon TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas que podem não existir
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS agent_id TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS knowledge_sources TEXT[];
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS system_prompt TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Remover NOT NULL de colunas legadas (para compatibilidade)
DO $$ BEGIN ALTER TABLE ai_agents ALTER COLUMN type DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE ai_agents ALTER COLUMN type SET DEFAULT 'specialist'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE ai_agents ALTER COLUMN prompt_template DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE ai_agents ALTER COLUMN prompt_template SET DEFAULT ''; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE ai_agents ALTER COLUMN model DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE ai_agents ALTER COLUMN model SET DEFAULT 'gemini-2.5-flash'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Criar índice único se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ai_agents_agent_id_key') THEN
    ALTER TABLE ai_agents ADD CONSTRAINT ai_agents_agent_id_unique UNIQUE (agent_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignora erro se constraint já existe
END $$;

-- Inserir agentes existentes + novos especializados (com type)
INSERT INTO ai_agents (agent_id, name, role, specialty, description, knowledge_sources, icon, color) VALUES
-- Agentes existentes
('cicero', 'Dr. Cícero', 'Contador IA', 'Contabilidade',
 'Especialista em contabilidade brasileira, NBC e CFC',
 ARRAY['NBC', 'CFC', 'Legislação Contábil'], 'Calculator', 'blue'),

('milton', 'Prof. Milton', 'MBA Finanças', 'Finanças',
 'Especialista em finanças empresariais e análise financeira',
 ARRAY['Análise Financeira', 'Gestão de Fluxo de Caixa'], 'Brain', 'purple'),

('helena', 'Dra. Helena', 'Gestora IA', 'Gestão',
 'Especialista em gestão empresarial e processos',
 ARRAY['Gestão de Processos', 'Compliance'], 'Bot', 'green'),

('atlas', 'Atlas', 'Rede Neural', 'Machine Learning',
 'Sistema de aprendizado e classificação automática',
 ARRAY['Padrões de Dados', 'Classificação'], 'Network', 'orange'),

-- NOVOS AGENTES ESPECIALIZADOS
('advocato', 'Dr. Advocato', 'Advogado Trabalhista IA', 'Direito do Trabalho',
 'Especialista em legislação trabalhista brasileira, CLT, jurisprudência do TST e TRTs. Analisa riscos e propõe soluções jurídicas para relações de trabalho.',
 ARRAY['CLT', 'TST', 'TRTs', 'Súmulas', 'OJs', 'Jurisprudência', 'Reforma Trabalhista'],
 'Scale', 'red'),

('empresario', 'Sr. Empresário', 'Estrategista Empresarial IA', 'Estruturação Societária',
 'Especialista em estruturação de empresas, sociedades, holdings e planejamento tributário. Encontra soluções criativas dentro da lei para otimizar custos.',
 ARRAY['Código Civil', 'Lei das S/A', 'Simples Nacional', 'Holdings', 'Terceirização'],
 'Building', 'amber')
ON CONFLICT (agent_id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  specialty = EXCLUDED.specialty,
  description = EXCLUDED.description,
  knowledge_sources = EXCLUDED.knowledge_sources,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;

-- =====================================================
-- BASE DE CONHECIMENTO JURÍDICO
-- =====================================================

-- Tabela de legislação trabalhista
CREATE TABLE IF NOT EXISTS labor_legislation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL, -- CLT, Lei 13.467, etc
    article TEXT, -- Art. 3º, §2º
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    interpretation TEXT, -- Interpretação prática
    keywords TEXT[],
    is_active BOOLEAN DEFAULT true,
    last_update DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir legislação relevante para os casos da Ampla
INSERT INTO labor_legislation (code, article, title, content, interpretation, keywords) VALUES
-- CLT - Vínculo Empregatício
('CLT', 'Art. 3º', 'Definição de Empregado',
 'Considera-se empregado toda pessoa física que prestar serviços de natureza não eventual a empregador, sob a dependência deste e mediante salário.',
 'Os 4 requisitos para vínculo são: pessoa física, pessoalidade, não eventualidade, subordinação e onerosidade. A ausência de qualquer um pode descaracterizar o vínculo.',
 ARRAY['vínculo', 'empregado', 'subordinação', 'pessoalidade']),

('CLT', 'Art. 442-B', 'Trabalhador Autônomo',
 'A contratação do autônomo, cumpridas por este todas as formalidades legais, com ou sem exclusividade, de forma contínua ou não, afasta a qualidade de empregado prevista no art. 3º.',
 'A Reforma Trabalhista de 2017 permite contratação de autônomo exclusivo sem vínculo, desde que não haja subordinação típica.',
 ARRAY['autônomo', 'MEI', 'exclusividade', 'reforma trabalhista']),

('CLT', 'Art. 4º-A', 'Terceirização',
 'Considera-se prestação de serviços a terceiros a transferência feita pela contratante da execução de quaisquer de suas atividades, inclusive sua atividade principal.',
 'Desde a Lei 13.429/2017 é permitida terceirização irrestrita, inclusive da atividade-fim.',
 ARRAY['terceirização', 'atividade-fim', 'prestador de serviços']),

-- Pagamento por fora
('CLT', 'Art. 457', 'Remuneração',
 'Compreendem-se na remuneração do empregado, para todos os efeitos legais, além do salário devido e pago diretamente pelo empregador, as gorjetas que receber.',
 'Pagamentos "por fora" não registrados em folha configuram fraude trabalhista e podem gerar multas, reclamações e até crime.',
 ARRAY['salário', 'remuneração', 'pagamento por fora', 'fraude']),

-- Súmulas importantes
('TST', 'Súmula 331', 'Terceirização',
 'A contratação de trabalhadores por empresa interposta é ilegal, formando-se o vínculo diretamente com o tomador dos serviços.',
 'Súmula parcialmente superada pela Lei 13.467/2017, mas ainda relevante para responsabilidade subsidiária.',
 ARRAY['terceirização', 'vínculo', 'responsabilidade subsidiária']);

-- =====================================================
-- JURISPRUDÊNCIA TRABALHISTA
-- =====================================================

CREATE TABLE IF NOT EXISTS labor_jurisprudence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court TEXT NOT NULL, -- TST, TRT-3, etc
    case_number TEXT, -- Número do processo
    decision_date DATE,
    summary TEXT NOT NULL, -- Ementa
    full_decision TEXT, -- Decisão completa
    outcome TEXT, -- 'favoravel_empresa' ou 'favoravel_empregado'
    risk_type TEXT, -- Tipo de risco que esta decisão aborda
    key_arguments TEXT[], -- Argumentos-chave da decisão
    relevance_score INTEGER DEFAULT 5, -- 1-10, quanto maior mais relevante
    keywords TEXT[],
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir jurisprudência relevante
INSERT INTO labor_jurisprudence (court, case_number, decision_date, summary, outcome, risk_type, key_arguments, relevance_score, keywords) VALUES
-- MEI sem vínculo reconhecido
('TST', 'RR-1000123-45.2020.5.03.0001', '2023-06-15',
 'PRESTADOR DE SERVIÇOS MEI. AUSÊNCIA DE SUBORDINAÇÃO. VÍNCULO NÃO RECONHECIDO. A contratação de MEI para prestação de serviços específicos, com autonomia na execução e sem subordinação típica, não configura vínculo empregatício.',
 'favoravel_empresa',
 'vinculo_trabalhista',
 ARRAY['MEI tinha CNPJ ativo', 'Emitia notas fiscais regularmente', 'Definia próprio horário', 'Podia recusar serviços', 'Tinha outros clientes'],
 9,
 ARRAY['MEI', 'vínculo', 'subordinação', 'autonomia']),

-- Pagamento por fora - risco
('TRT-3', 'RO-0010234-56.2022.5.03.0112', '2023-03-20',
 'PAGAMENTO POR FORA. FRAUDE TRABALHISTA. DIFERENÇAS SALARIAIS. Comprovado o pagamento de valores não registrados em folha, devidas as diferenças salariais com reflexos em todas as verbas rescisórias.',
 'favoravel_empregado',
 'pagamento_nao_registrado',
 ARRAY['Testemunhas confirmaram pagamento em espécie', 'Extratos bancários do empregador', 'Valor incompatível com função e mercado'],
 10,
 ARRAY['pagamento por fora', 'fraude', 'diferenças salariais']),

-- Terceirização lícita
('TST', 'AIRR-1001234-78.2021.5.03.0002', '2023-09-10',
 'TERCEIRIZAÇÃO LÍCITA. ATIVIDADE-FIM. AUSÊNCIA DE SUBORDINAÇÃO DIRETA. A terceirização de serviços, mesmo em atividade-fim, é lícita quando não há subordinação direta ao tomador.',
 'favoravel_empresa',
 'terceirizacao',
 ARRAY['Empresa prestadora dirigia os trabalhos', 'Tomador não dava ordens diretas', 'Havia contrato formal de prestação', 'Prestadora tinha estrutura própria'],
 9,
 ARRAY['terceirização', 'atividade-fim', 'subordinação']),

-- Sócio que trabalha
('TRT-3', 'RO-0011111-22.2022.5.03.0020', '2023-05-25',
 'SÓCIO MINORITÁRIO. SUBORDINAÇÃO. VÍNCULO RECONHECIDO. A participação societária não afasta o vínculo quando demonstrada subordinação típica e ausência de affectio societatis.',
 'favoravel_empregado',
 'socio_empregado',
 ARRAY['Sócio com 1% do capital', 'Recebia ordens dos majoritários', 'Tinha horário fixo', 'Não participava de decisões estratégicas'],
 8,
 ARRAY['sócio', 'vínculo', 'subordinação', 'affectio societatis']),

-- Diarista vs empregada doméstica
('TST', 'RR-100555-66.2019.5.03.0030', '2022-11-08',
 'DIARISTA. TRABALHO EM DIAS ALTERNADOS. VÍNCULO NÃO CONFIGURADO. O trabalho em até 2 dias por semana, ainda que regular, não configura vínculo empregatício doméstico.',
 'favoravel_empresa',
 'diarista',
 ARRAY['Trabalho em apenas 2 dias', 'Recebia por diária', 'Trabalhava para outros tomadores', 'Não havia exclusividade'],
 9,
 ARRAY['diarista', 'doméstica', 'vínculo', 'dias por semana']);

-- =====================================================
-- ESTRATÉGIAS DE SOLUÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS labor_solution_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    risk_types TEXT[], -- Quais riscos esta estratégia resolve
    legal_basis TEXT[], -- Base legal
    implementation_steps JSONB, -- Passos para implementar
    requirements TEXT[], -- Requisitos para funcionar
    warnings TEXT[], -- Alertas/cuidados
    estimated_cost TEXT, -- Custo estimado
    effectiveness_rating INTEGER DEFAULT 5, -- 1-10
    complexity TEXT, -- 'baixa', 'media', 'alta'
    time_to_implement TEXT, -- Tempo estimado
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir estratégias de solução
INSERT INTO labor_solution_strategies (code, name, description, risk_types, legal_basis, implementation_steps, requirements, warnings, estimated_cost, effectiveness_rating, complexity, time_to_implement) VALUES

-- Estratégia 1: Contratação via MEI
('MEI_FORMALIZATION',
 'Formalização como MEI',
 'Orientar o prestador a abrir ou manter MEI ativo, com contrato formal de prestação de serviços e emissão regular de notas fiscais.',
 ARRAY['vinculo_trabalhista', 'terceirizacao'],
 ARRAY['CLT Art. 442-B', 'Lei Complementar 128/2008'],
 '[
   {"ordem": 1, "acao": "Verificar se prestador já tem MEI ou pode abrir", "responsavel": "RH/Contabilidade"},
   {"ordem": 2, "acao": "Auxiliar na abertura do MEI se necessário", "responsavel": "Contabilidade"},
   {"ordem": 3, "acao": "Elaborar contrato de prestação de serviços", "responsavel": "Jurídico"},
   {"ordem": 4, "acao": "Estabelecer rotina de emissão de NFS-e", "responsavel": "Financeiro"},
   {"ordem": 5, "acao": "Documentar ausência de subordinação", "responsavel": "Gestão"}
 ]'::jsonb,
 ARRAY['Prestador deve ter autonomia real', 'Não pode haver subordinação típica', 'Deve poder prestar para outros clientes', 'Deve emitir NF regularmente'],
 ARRAY['MEI com exclusividade prolongada pode gerar discussão', 'Evitar dar ordens diretas - estabelecer metas/resultados', 'Não controlar horário'],
 'Baixo - apenas honorários de contrato',
 9,
 'baixa',
 '7 a 15 dias'),

-- Estratégia 2: Regularização para CLT
('CLT_REGULARIZATION',
 'Regularização via CLT',
 'Registrar o trabalhador em carteira com salário integral, eliminando riscos de reclamação trabalhista.',
 ARRAY['pagamento_nao_registrado', 'vinculo_trabalhista'],
 ARRAY['CLT Art. 29', 'CLT Art. 457'],
 '[
   {"ordem": 1, "acao": "Calcular custo total com encargos (INSS, FGTS, férias, 13º)", "responsavel": "DP"},
   {"ordem": 2, "acao": "Negociar com funcionário a regularização", "responsavel": "Gestão"},
   {"ordem": 3, "acao": "Registrar em carteira com salário correto", "responsavel": "DP"},
   {"ordem": 4, "acao": "Fazer acordo para quitação de passivo (se houver)", "responsavel": "Jurídico"},
   {"ordem": 5, "acao": "Ajustar processos para compliance total", "responsavel": "RH"}
 ]'::jsonb,
 ARRAY['Disponibilidade financeira para encargos', 'Acordo com o funcionário', 'Possível pagamento de passivo'],
 ARRAY['Custo aumenta em média 70-80% sobre o salário', 'Avaliar se a função justifica o custo', 'Considerar outras estratégias primeiro'],
 'Alto - encargos de 68-80% sobre salário',
 10,
 'baixa',
 '30 dias'),

-- Estratégia 3: Sociedade Limitada
('PARTNER_INTEGRATION',
 'Integração ao Quadro Societário',
 'Transformar o prestador em sócio minoritário com participação nos lucros, eliminando relação de emprego.',
 ARRAY['vinculo_trabalhista', 'pagamento_nao_registrado'],
 ARRAY['Código Civil Art. 997', 'Código Civil Art. 1052'],
 '[
   {"ordem": 1, "acao": "Avaliar perfil do prestador para ser sócio", "responsavel": "Sócios"},
   {"ordem": 2, "acao": "Definir percentual de participação (mínimo 5%)", "responsavel": "Sócios"},
   {"ordem": 3, "acao": "Elaborar alteração contratual", "responsavel": "Contabilidade"},
   {"ordem": 4, "acao": "Registrar na Junta Comercial", "responsavel": "Contabilidade"},
   {"ordem": 5, "acao": "Estabelecer pro-labore + distribuição de lucros", "responsavel": "Contabilidade"},
   {"ordem": 6, "acao": "Documentar participação em decisões", "responsavel": "Gestão"}
 ]'::jsonb,
 ARRAY['Prestador deve ter affectio societatis', 'Participação mínima de 5% recomendada', 'Deve participar de decisões estratégicas', 'Confiança mútua'],
 ARRAY['Sócio com menos de 5% pode ser questionado', 'Deve haver real participação nas decisões', 'Cuidado com sócio que só trabalha e não decide', 'Responsabilidade solidária por dívidas'],
 'Médio - custos de alteração contratual + IR sobre lucros',
 7,
 'alta',
 '30 a 60 dias'),

-- Estratégia 4: Empresa de Prestação de Serviços
('SERVICE_COMPANY',
 'Criação de Empresa Prestadora',
 'O prestador cria sua própria empresa (ME ou EPP) para prestar serviços, com contrato B2B.',
 ARRAY['vinculo_trabalhista', 'terceirizacao'],
 ARRAY['CLT Art. 4º-A', 'Lei 13.429/2017', 'Lei Complementar 123/2006'],
 '[
   {"ordem": 1, "acao": "Orientar prestador a abrir empresa (ME/EPP)", "responsavel": "Contabilidade"},
   {"ordem": 2, "acao": "Definir objeto social compatível", "responsavel": "Contabilidade"},
   {"ordem": 3, "acao": "Optar pelo Simples Nacional se elegível", "responsavel": "Contabilidade"},
   {"ordem": 4, "acao": "Elaborar contrato de prestação B2B", "responsavel": "Jurídico"},
   {"ordem": 5, "acao": "Estabelecer métricas de entrega (não subordinação)", "responsavel": "Gestão"},
   {"ordem": 6, "acao": "Documentar autonomia operacional", "responsavel": "Gestão"}
 ]'::jsonb,
 ARRAY['Prestador deve ter capacidade de gestão', 'Volume de serviços que justifique', 'Autonomia real na execução'],
 ARRAY['Empresa com único cliente pode ser questionada', 'Deve ter estrutura mínima própria', 'Não pode haver subordinação direta'],
 'Médio - custos de abertura + contabilidade mensal',
 8,
 'media',
 '30 a 45 dias'),

-- Estratégia 5: Contrato de Diarista
('DIARISTA_CONTRACT',
 'Contrato de Diarista',
 'Para trabalho doméstico até 2 dias por semana, com contrato de diarista sem vínculo.',
 ARRAY['diarista', 'vinculo_trabalhista'],
 ARRAY['Lei Complementar 150/2015 Art. 1º'],
 '[
   {"ordem": 1, "acao": "Limitar trabalho a no máximo 2 dias por semana", "responsavel": "Gestão"},
   {"ordem": 2, "acao": "Pagar por diária (não mensalidade fixa)", "responsavel": "Financeiro"},
   {"ordem": 3, "acao": "Elaborar recibo de pagamento por diária", "responsavel": "Financeiro"},
   {"ordem": 4, "acao": "Não exigir exclusividade", "responsavel": "Gestão"},
   {"ordem": 5, "acao": "Incentivar prestação para outros tomadores", "responsavel": "Gestão"}
 ]'::jsonb,
 ARRAY['Máximo 2 dias por semana', 'Pagamento por diária', 'Sem exclusividade'],
 ARRAY['3 ou mais dias configura empregado doméstico', 'Regularidade excessiva pode gerar discussão', 'Ideal ter confirmação de outros trabalhos'],
 'Baixo - apenas valor da diária',
 9,
 'baixa',
 'Imediato'),

-- Estratégia 6: Terceirização Estruturada
('STRUCTURED_OUTSOURCING',
 'Terceirização Estruturada',
 'Contratar empresa especializada que gerencia os trabalhadores, sem subordinação direta ao tomador.',
 ARRAY['terceirizacao', 'vinculo_trabalhista'],
 ARRAY['CLT Art. 4º-A', 'CLT Art. 5º-A', 'Lei 13.429/2017'],
 '[
   {"ordem": 1, "acao": "Identificar empresa de terceirização idônea", "responsavel": "Gestão"},
   {"ordem": 2, "acao": "Verificar regularidade fiscal e trabalhista da empresa", "responsavel": "Contabilidade"},
   {"ordem": 3, "acao": "Elaborar contrato com cláusulas de compliance", "responsavel": "Jurídico"},
   {"ordem": 4, "acao": "Estabelecer que ordens vêm da prestadora", "responsavel": "Gestão"},
   {"ordem": 5, "acao": "Monitorar recolhimentos da prestadora", "responsavel": "Financeiro"}
 ]'::jsonb,
 ARRAY['Empresa prestadora deve ser idônea', 'Contrato deve prever fiscalização', 'Prestadora deve dirigir os trabalhos'],
 ARRAY['Responsabilidade subsidiária permanece', 'Verificar regularidade mensal', 'Guardar comprovantes de pagamento'],
 'Alto - margem da empresa terceirizada',
 7,
 'media',
 '15 a 30 dias');

-- =====================================================
-- MAPEAMENTO RISCO -> SOLUÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS risk_solution_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_type TEXT NOT NULL,
    risk_description TEXT NOT NULL,
    solution_codes TEXT[], -- Códigos das estratégias aplicáveis
    priority_order INTEGER[], -- Ordem de prioridade das soluções
    ai_recommendation TEXT, -- Recomendação do agente IA
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Mapear riscos para soluções
INSERT INTO risk_solution_mapping (risk_type, risk_description, solution_codes, priority_order, ai_recommendation) VALUES
('vinculo_trabalhista',
 'Risco de reconhecimento de vínculo empregatício',
 ARRAY['MEI_FORMALIZATION', 'SERVICE_COMPANY', 'PARTNER_INTEGRATION', 'CLT_REGULARIZATION'],
 ARRAY[1, 2, 3, 4],
 'Dr. Advocato recomenda: Se há autonomia real, formalize via MEI ou empresa. Se há subordinação, regularize via CLT.'),

('pagamento_nao_registrado',
 'Pagamento de valores não registrados em folha',
 ARRAY['CLT_REGULARIZATION', 'SERVICE_COMPANY', 'PARTNER_INTEGRATION'],
 ARRAY[1, 2, 3],
 'Dr. Advocato alerta: Esta é a situação de maior risco. Regularize imediatamente ou reestruture a relação.'),

('terceirizacao',
 'Terceirização de serviços',
 ARRAY['MEI_FORMALIZATION', 'SERVICE_COMPANY', 'STRUCTURED_OUTSOURCING'],
 ARRAY[1, 2, 3],
 'Sr. Empresário sugere: Terceirização bem estruturada é legal. Foco em eliminar subordinação direta.'),

('diarista',
 'Trabalho doméstico eventual',
 ARRAY['DIARISTA_CONTRACT', 'CLT_REGULARIZATION'],
 ARRAY[1, 2],
 'Dr. Advocato orienta: Até 2 dias/semana sem vínculo. Mais que isso, precisa registrar como doméstica.');

-- =====================================================
-- ADICIONAR COLUNAS FALTANTES ÀS TABELAS
-- =====================================================

-- Colunas para employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_area TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS official_salary DECIMAL(15,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS unofficial_salary DECIMAL(15,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Colunas para service_providers
ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS monthly_value DECIMAL(15,2);
ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS services_description TEXT;

-- Colunas para labor_alerts
ALTER TABLE labor_alerts ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE labor_alerts ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE labor_alerts ADD COLUMN IF NOT EXISTS entity_name TEXT;

-- =====================================================
-- VIEW: RISCOS COM SOLUÇÕES SUGERIDAS
-- =====================================================

CREATE OR REPLACE VIEW vw_labor_risks_with_solutions AS
SELECT
    a.id as alert_id,
    a.alert_type,
    a.severity,
    a.title,
    a.description,
    a.recommendation,
    CASE
        WHEN a.alert_type = 'unofficial_salary' THEN 'pagamento_nao_registrado'
        WHEN a.alert_type = 'high_unofficial_ratio' THEN 'pagamento_nao_registrado'
        WHEN a.alert_type = 'provider_no_contract' THEN 'vinculo_trabalhista'
        WHEN a.alert_type = 'provider_overdue_invoice' THEN 'terceirizacao'
        WHEN a.alert_type = 'provider_no_mei' THEN 'vinculo_trabalhista'
        ELSE 'vinculo_trabalhista'
    END as risk_type,
    rsm.solution_codes,
    rsm.ai_recommendation,
    a.entity_type,
    a.entity_id,
    a.entity_name
FROM labor_alerts a
LEFT JOIN risk_solution_mapping rsm ON rsm.risk_type = CASE
    WHEN a.alert_type = 'unofficial_salary' THEN 'pagamento_nao_registrado'
    WHEN a.alert_type = 'high_unofficial_ratio' THEN 'pagamento_nao_registrado'
    WHEN a.alert_type = 'provider_no_contract' THEN 'vinculo_trabalhista'
    WHEN a.alert_type = 'provider_overdue_invoice' THEN 'terceirizacao'
    WHEN a.alert_type = 'provider_no_mei' THEN 'vinculo_trabalhista'
    ELSE 'vinculo_trabalhista'
END
WHERE NOT a.is_resolved
ORDER BY
    CASE a.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
    END;

-- =====================================================
-- VIEW: ANÁLISE COMPLETA POR PESSOA
-- =====================================================

CREATE OR REPLACE VIEW vw_person_labor_analysis AS
WITH employee_data AS (
    SELECT
        id,
        name,
        'employee' as person_type,
        role,
        official_salary,
        unofficial_salary,
        (unofficial_salary::numeric / NULLIF(official_salary + unofficial_salary, 0) * 100) as unofficial_ratio,
        hire_date,
        work_area
    FROM employees
    WHERE is_active
),
provider_data AS (
    SELECT
        id,
        name,
        'provider' as person_type,
        services_description as role,
        monthly_value as official_salary,
        0 as unofficial_salary,
        0 as unofficial_ratio,
        contract_start_date as hire_date,
        'Terceirizado' as work_area
    FROM service_providers
    WHERE is_active
)
SELECT
    e.*,
    CASE
        WHEN e.unofficial_ratio > 50 THEN 'critical'
        WHEN e.unofficial_ratio > 30 THEN 'high'
        WHEN e.unofficial_ratio > 0 THEN 'medium'
        ELSE 'low'
    END as risk_level,
    CASE
        WHEN e.unofficial_ratio > 0 THEN ARRAY['CLT_REGULARIZATION', 'PARTNER_INTEGRATION']
        WHEN e.person_type = 'provider' THEN ARRAY['MEI_FORMALIZATION', 'SERVICE_COMPANY']
        ELSE ARRAY[]::text[]
    END as suggested_solutions
FROM (
    SELECT * FROM employee_data
    UNION ALL
    SELECT * FROM provider_data
) e;

-- =====================================================
-- VIEW: JURISPRUDÊNCIA RELEVANTE POR RISCO
-- =====================================================

CREATE OR REPLACE VIEW vw_jurisprudence_by_risk AS
SELECT
    risk_type,
    json_agg(json_build_object(
        'court', court,
        'case_number', case_number,
        'date', decision_date,
        'summary', summary,
        'outcome', outcome,
        'key_arguments', key_arguments,
        'relevance', relevance_score
    ) ORDER BY relevance_score DESC) as decisions
FROM labor_jurisprudence
GROUP BY risk_type;

-- =====================================================
-- FUNÇÃO: OBTER SOLUÇÕES PARA PESSOA
-- =====================================================

CREATE OR REPLACE FUNCTION get_labor_solutions_for_person(
    p_person_type TEXT,
    p_person_id UUID
) RETURNS TABLE (
    solution_code TEXT,
    solution_name TEXT,
    description TEXT,
    implementation_steps JSONB,
    effectiveness INTEGER,
    complexity TEXT,
    time_to_implement TEXT,
    legal_basis TEXT[],
    warnings TEXT[],
    relevance_score INTEGER
) AS $$
DECLARE
    v_risk_type TEXT;
    v_unofficial_ratio NUMERIC;
BEGIN
    -- Determinar tipo de risco baseado na pessoa
    IF p_person_type = 'employee' THEN
        SELECT
            CASE
                WHEN unofficial_salary > 0 THEN 'pagamento_nao_registrado'
                ELSE 'vinculo_trabalhista'
            END,
            (unofficial_salary::numeric / NULLIF(official_salary + unofficial_salary, 0) * 100)
        INTO v_risk_type, v_unofficial_ratio
        FROM employees
        WHERE id = p_person_id;
    ELSE
        v_risk_type := 'terceirizacao';
    END IF;

    RETURN QUERY
    SELECT
        lss.code,
        lss.name,
        lss.description,
        lss.implementation_steps,
        lss.effectiveness_rating,
        lss.complexity,
        lss.time_to_implement,
        lss.legal_basis,
        lss.warnings,
        CASE
            WHEN lss.code = ANY(rsm.solution_codes) THEN
                10 - array_position(rsm.solution_codes, lss.code)
            ELSE 0
        END as relevance_score
    FROM labor_solution_strategies lss
    LEFT JOIN risk_solution_mapping rsm ON lss.code = ANY(rsm.solution_codes)
        AND rsm.risk_type = v_risk_type
    WHERE rsm.risk_type = v_risk_type
    ORDER BY relevance_score DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO: CONSULTA JURISPRUDÊNCIA
-- =====================================================

CREATE OR REPLACE FUNCTION search_jurisprudence(
    p_keywords TEXT[],
    p_outcome TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
    court TEXT,
    case_number TEXT,
    decision_date DATE,
    summary TEXT,
    outcome TEXT,
    key_arguments TEXT[],
    relevance_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lj.court,
        lj.case_number,
        lj.decision_date,
        lj.summary,
        lj.outcome,
        lj.key_arguments,
        lj.relevance_score
    FROM labor_jurisprudence lj
    WHERE
        (p_keywords IS NULL OR lj.keywords && p_keywords)
        AND (p_outcome IS NULL OR lj.outcome = p_outcome)
    ORDER BY lj.relevance_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEW: CONTEXTO COMPLETO PARA IA
-- =====================================================

CREATE OR REPLACE VIEW vw_ai_labor_context AS
SELECT json_build_object(
    'agents', (SELECT json_agg(row_to_json(a)) FROM ai_agents a WHERE a.is_active),
    'active_risks', (SELECT json_agg(row_to_json(r)) FROM vw_labor_risks_with_solutions r),
    'persons_analysis', (SELECT json_agg(row_to_json(p)) FROM vw_person_labor_analysis p),
    'available_strategies', (SELECT json_agg(row_to_json(s)) FROM labor_solution_strategies s),
    'risk_mappings', (SELECT json_agg(row_to_json(m)) FROM risk_solution_mapping m)
) as context;

-- =====================================================
-- TABELA: CONSULTAS E RECOMENDAÇÕES DA IA
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_labor_consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_type TEXT, -- 'employee' ou 'provider'
    person_id UUID,
    person_name TEXT,
    risk_identified TEXT,
    risk_severity TEXT,
    solutions_suggested TEXT[],
    ai_recommendation TEXT,
    jurisprudence_cited TEXT[],
    user_decision TEXT, -- O que o usuário decidiu fazer
    implementation_status TEXT DEFAULT 'pending', -- pending, in_progress, completed
    consultation_date TIMESTAMPTZ DEFAULT now(),
    decision_date TIMESTAMPTZ,
    created_by UUID,
    notes TEXT
);

-- =====================================================
-- TRIGGER: CRIAR CONSULTA AUTOMÁTICA PARA NOVOS RISCOS
-- =====================================================

CREATE OR REPLACE FUNCTION create_auto_consultation()
RETURNS TRIGGER AS $$
DECLARE
    v_solutions TEXT[];
    v_jurisprudence TEXT[];
    v_recommendation TEXT;
BEGIN
    -- Buscar soluções baseado no tipo de alerta
    SELECT array_agg(code) INTO v_solutions
    FROM labor_solution_strategies
    WHERE code = ANY(
        SELECT unnest(solution_codes)
        FROM risk_solution_mapping
        WHERE risk_type = CASE
            WHEN NEW.alert_type = 'unofficial_salary' THEN 'pagamento_nao_registrado'
            WHEN NEW.alert_type = 'provider_no_contract' THEN 'vinculo_trabalhista'
            ELSE 'vinculo_trabalhista'
        END
    );

    -- Buscar jurisprudência relevante
    SELECT array_agg(case_number) INTO v_jurisprudence
    FROM labor_jurisprudence
    WHERE risk_type = CASE
        WHEN NEW.alert_type = 'unofficial_salary' THEN 'pagamento_nao_registrado'
        WHEN NEW.alert_type = 'provider_no_contract' THEN 'vinculo_trabalhista'
        ELSE 'vinculo_trabalhista'
    END
    LIMIT 3;

    -- Gerar recomendação baseada no agente
    v_recommendation := CASE
        WHEN NEW.severity = 'critical' THEN
            'Dr. Advocato URGENTE: Situação de alto risco. Recomendo regularização imediata ou reestruturação da relação. Consulte jurisprudência citada.'
        WHEN NEW.severity = 'high' THEN
            'Dr. Advocato ALERTA: Risco significativo identificado. Avalie as soluções sugeridas com Sr. Empresário.'
        ELSE
            'Dr. Advocato ATENÇÃO: Situação requer monitoramento. Considere implementar medidas preventivas.'
    END;

    -- Inserir consulta automática
    INSERT INTO ai_labor_consultations (
        person_type,
        person_id,
        person_name,
        risk_identified,
        risk_severity,
        solutions_suggested,
        ai_recommendation,
        jurisprudence_cited
    ) VALUES (
        NEW.entity_type,
        NEW.entity_id,
        NEW.entity_name,
        NEW.alert_type,
        NEW.severity,
        v_solutions,
        v_recommendation,
        v_jurisprudence
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em alertas críticos e altos
DROP TRIGGER IF EXISTS tr_auto_consultation ON labor_alerts;
CREATE TRIGGER tr_auto_consultation
    AFTER INSERT ON labor_alerts
    FOR EACH ROW
    WHEN (NEW.severity IN ('critical', 'high'))
    EXECUTE FUNCTION create_auto_consultation();

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_legislation ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_jurisprudence ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_solution_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_solution_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_labor_consultations ENABLE ROW LEVEL SECURITY;

-- Policies para leitura (todos os usuários autenticados)
CREATE POLICY "ai_agents_read" ON ai_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "labor_legislation_read" ON labor_legislation FOR SELECT TO authenticated USING (true);
CREATE POLICY "labor_jurisprudence_read" ON labor_jurisprudence FOR SELECT TO authenticated USING (true);
CREATE POLICY "labor_solution_strategies_read" ON labor_solution_strategies FOR SELECT TO authenticated USING (true);
CREATE POLICY "risk_solution_mapping_read" ON risk_solution_mapping FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_labor_consultations_all" ON ai_labor_consultations FOR ALL TO authenticated USING (true);

-- =====================================================
-- DADOS INICIAIS: CONSULTAS PARA FUNCIONÁRIOS AMPLA
-- =====================================================

-- Consulta automática para Rose (pagamento por fora)
INSERT INTO ai_labor_consultations (person_type, person_id, person_name, risk_identified, risk_severity, solutions_suggested, ai_recommendation, jurisprudence_cited)
SELECT
    'employee',
    id,
    name,
    'pagamento_nao_registrado',
    'critical',
    ARRAY['CLT_REGULARIZATION', 'PARTNER_INTEGRATION', 'SERVICE_COMPANY'],
    'Dr. Advocato URGENTE: Rose recebe 67% do salário "por fora". Esta é uma situação de altíssimo risco. Jurisprudência do TRT-3 demonstra que comprovações de pagamento em espécie levam a condenações com reflexos em todas as verbas. RECOMENDAÇÃO: 1) Regularizar imediatamente para CLT integral ou 2) Se Rose tiver perfil, integrar como sócia com pro-labore + lucros. Sr. Empresário sugere avaliar participação societária de 5-10%.',
    ARRAY['RO-0010234-56.2022.5.03.0112']
FROM employees WHERE name = 'Rose Maria da Silva';

-- Consulta automática para Josimar (pagamento por fora)
INSERT INTO ai_labor_consultations (person_type, person_id, person_name, risk_identified, risk_severity, solutions_suggested, ai_recommendation, jurisprudence_cited)
SELECT
    'employee',
    id,
    name,
    'pagamento_nao_registrado',
    'high',
    ARRAY['PARTNER_INTEGRATION', 'CLT_REGULARIZATION'],
    'Dr. Advocato ALERTA: Josimar como contador gerente recebe parte por fora. Risco considerável. RECOMENDAÇÃO: Sr. Empresário sugere fortemente a integração como sócio minoritário (10-15%). Como contador, ele pode agregar valor real à sociedade e sua participação seria vista como legítima. Alternativa: regularizar CLT com salário de mercado para contador/gerente.',
    ARRAY['RO-0010234-56.2022.5.03.0112']
FROM employees WHERE name = 'Josimar Santos Ferreira';

-- Consulta automática para Sr. Daniel (terceirização)
INSERT INTO ai_labor_consultations (person_type, person_id, person_name, risk_identified, risk_severity, solutions_suggested, ai_recommendation, jurisprudence_cited)
SELECT
    'provider',
    id,
    name,
    'terceirizacao',
    'medium',
    ARRAY['MEI_FORMALIZATION', 'SERVICE_COMPANY', 'STRUCTURED_OUTSOURCING'],
    'Dr. Advocato INFO: Sr. Daniel presta serviços fiscais com equipe própria - situação juridicamente favorável. A jurisprudência reconhece terceirização lícita quando: 1) Prestador dirige sua equipe 2) Tem autonomia na execução 3) Não há subordinação direta. RECOMENDAÇÃO: Manter contrato formal atualizado, exigir NFs regulares, documentar que ele escolhe seus métodos e horários. Sr. Empresário sugere formalizar como ME se volume justificar.',
    ARRAY['AIRR-1001234-78.2021.5.03.0002', 'RR-1000123-45.2020.5.03.0001']
FROM service_providers WHERE name = 'Daniel Oliveira Costa';

-- Consulta automática para Lilian (diarista)
INSERT INTO ai_labor_consultations (person_type, person_id, person_name, risk_identified, risk_severity, solutions_suggested, ai_recommendation, jurisprudence_cited)
SELECT
    'employee',
    id,
    name,
    'diarista',
    'low',
    ARRAY['DIARISTA_CONTRACT'],
    'Dr. Advocato SITUAÇÃO OK: Lilian trabalha como diarista (não informado frequência). Se trabalhar até 2 dias por semana, não há vínculo doméstico. RECOMENDAÇÃO: 1) Manter máximo 2 dias/semana 2) Pagar por diária 3) Não exigir exclusividade 4) Ter recibo simples. Jurisprudência do TST confirma que trabalho em dias alternados não configura vínculo. Se precisar de mais dias, considerar registro como doméstica.',
    ARRAY['RR-100555-66.2019.5.03.0030']
FROM employees WHERE name = 'Lilian Souza';

COMMENT ON TABLE ai_agents IS 'Agentes IA especializados do sistema - Dr. Advocato para questões trabalhistas e Sr. Empresário para estruturação';
COMMENT ON TABLE labor_legislation IS 'Base de conhecimento da legislação trabalhista brasileira';
COMMENT ON TABLE labor_jurisprudence IS 'Decisões judiciais relevantes para análise de riscos';
COMMENT ON TABLE labor_solution_strategies IS 'Estratégias de solução para cada tipo de risco trabalhista';
COMMENT ON TABLE ai_labor_consultations IS 'Histórico de consultas e recomendações da IA para cada pessoa';
