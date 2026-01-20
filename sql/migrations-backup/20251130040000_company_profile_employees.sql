-- =====================================================
-- PERFIL DA EMPRESA, SÓCIOS, FAMÍLIA E FUNCIONÁRIOS
-- Para contextualizar a IA nas classificações
-- =====================================================

-- =====================================================
-- 1. PERFIL DA EMPRESA
-- =====================================================

CREATE TABLE IF NOT EXISTS company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trading_name TEXT, -- Nome fantasia
  cnpj TEXT,
  state_registration TEXT, -- Inscrição estadual
  municipal_registration TEXT, -- Inscrição municipal

  -- Endereço
  address TEXT,
  address_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,

  -- Contato
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Informações fiscais
  tax_regime TEXT, -- Simples, Lucro Presumido, Lucro Real
  main_activity TEXT,
  cnae_code TEXT,

  -- Informações adicionais
  foundation_date DATE,
  description TEXT, -- Descrição da empresa para a IA
  notes TEXT, -- Observações gerais

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage company_profile" ON company_profile;
CREATE POLICY "Users can manage company_profile" ON company_profile
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 2. SÓCIOS DA EMPRESA
-- =====================================================

CREATE TABLE IF NOT EXISTS company_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company_profile(id),

  -- Dados pessoais
  name TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,

  -- Função na empresa
  role TEXT, -- Sócio-administrador, Sócio-quotista, etc.
  participation_percentage DECIMAL(5,2), -- % de participação
  is_administrator BOOLEAN DEFAULT false,
  entry_date DATE, -- Data de entrada na sociedade

  -- Endereço pessoal
  personal_address TEXT,
  personal_city TEXT,
  personal_state TEXT,

  -- Contato
  phone TEXT,
  email TEXT,

  -- Profissional
  crc_number TEXT, -- Se for contador
  oab_number TEXT, -- Se for advogado
  professional_council TEXT, -- Outro conselho

  -- Observações para IA
  description TEXT, -- Ex: "Patrono da empresa, responsável pelas decisões estratégicas"
  expense_patterns TEXT, -- Padrões de despesa conhecidos

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE company_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage company_partners" ON company_partners;
CREATE POLICY "Users can manage company_partners" ON company_partners
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 3. FAMILIARES DOS SÓCIOS
-- Importante para classificar despesas pessoais
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_family (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES company_partners(id) ON DELETE CASCADE,

  -- Dados pessoais
  name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- Filho(a), Cônjuge, Neto(a), etc.
  cpf TEXT,
  birth_date DATE,

  -- Vínculo com empresa
  works_at_company BOOLEAN DEFAULT false,
  department TEXT, -- Se trabalha na empresa
  role_at_company TEXT, -- Cargo se trabalhar

  -- Observações para IA
  description TEXT, -- Ex: "Filha com 2 filhos, a empresa paga babá"
  related_expenses TEXT, -- Ex: "Babá, escola das crianças"

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE partner_family ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage partner_family" ON partner_family;
CREATE POLICY "Users can manage partner_family" ON partner_family
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 4. FUNCIONÁRIOS
-- Com informações detalhadas de remuneração
-- =====================================================

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company_profile(id),

  -- Dados pessoais
  name TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  pis TEXT, -- PIS/PASEP

  -- Endereço
  address TEXT,
  city TEXT,
  state TEXT,

  -- Contato
  phone TEXT,
  email TEXT,

  -- Vínculo empregatício
  department TEXT NOT NULL, -- Fiscal, Contábil, DP, Legalização, Administrativo
  role TEXT NOT NULL, -- Cargo
  hire_date DATE,
  termination_date DATE,
  contract_type TEXT, -- CLT, PJ, Autônomo, Freelancer

  -- Remuneração oficial (CLT)
  official_salary DECIMAL(15,2), -- Salário em carteira

  -- Remuneração não oficial (por fora) - CONFIDENCIAL
  unofficial_salary DECIMAL(15,2), -- Valor pago por fora
  unofficial_payment_method TEXT, -- PIX, Dinheiro, Transferência
  unofficial_payment_description TEXT, -- Como identificar no extrato

  -- Para autônomos/PJ
  is_per_production BOOLEAN DEFAULT false, -- Pago por produção?
  production_description TEXT, -- O que produz
  average_monthly_payment DECIMAL(15,2), -- Média mensal

  -- Provisões obrigatórias
  vacation_days_accrued INTEGER DEFAULT 0, -- Dias de férias acumulados
  last_vacation_date DATE,
  thirteenth_provision DECIMAL(15,2) DEFAULT 0, -- Provisão 13º
  fgts_balance DECIMAL(15,2) DEFAULT 0, -- Saldo FGTS estimado

  -- Observações para IA
  description TEXT, -- Descrição geral
  payment_patterns TEXT, -- Padrões de pagamento para identificar no extrato
  labor_risk_notes TEXT, -- Observações sobre riscos trabalhistas

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage employees" ON employees;
CREATE POLICY "Users can manage employees" ON employees
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 5. ALERTAS E ORIENTAÇÕES TRABALHISTAS
-- =====================================================

CREATE TABLE IF NOT EXISTS labor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,

  alert_type TEXT NOT NULL, -- vacation_due, thirteenth_due, fgts_deposit, labor_risk
  severity TEXT NOT NULL, -- info, warning, critical
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT, -- O que fazer

  due_date DATE, -- Quando precisa ser resolvido
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE labor_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage labor_alerts" ON labor_alerts;
CREATE POLICY "Users can manage labor_alerts" ON labor_alerts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 6. IMÓVEIS DOS SÓCIOS
-- Para classificar IPTU, condomínio, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES company_partners(id) ON DELETE CASCADE,

  name TEXT NOT NULL, -- Nome de identificação (ex: "Apartamento Setor Marista")
  property_type TEXT, -- Apartamento, Casa, Sala Comercial, Terreno

  -- Endereço
  address TEXT,
  address_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,

  -- Identificadores
  property_registration TEXT, -- Matrícula do imóvel
  iptu_inscription TEXT, -- Inscrição IPTU

  -- Despesas associadas
  has_condominium BOOLEAN DEFAULT false,
  condominium_name TEXT, -- Nome do condomínio
  average_condominium DECIMAL(15,2),
  average_iptu DECIMAL(15,2),

  -- Observações para IA
  description TEXT,
  expense_patterns TEXT, -- Como aparece no extrato

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE partner_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage partner_properties" ON partner_properties;
CREATE POLICY "Users can manage partner_properties" ON partner_properties
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 7. VEÍCULOS DOS SÓCIOS
-- Para classificar IPVA, combustível, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES company_partners(id) ON DELETE CASCADE,

  name TEXT NOT NULL, -- Nome de identificação (ex: "BMW X5")
  vehicle_type TEXT, -- Carro, Moto, Caminhão, Reboque
  brand TEXT,
  model TEXT,
  year_manufacture INTEGER,
  year_model INTEGER,
  color TEXT,

  -- Documentação
  license_plate TEXT,
  renavam TEXT,
  chassis TEXT,

  -- Despesas
  average_ipva DECIMAL(15,2),
  average_fuel_monthly DECIMAL(15,2),

  -- Observações para IA
  description TEXT,
  expense_patterns TEXT, -- Como aparece no extrato

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE partner_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage partner_vehicles" ON partner_vehicles;
CREATE POLICY "Users can manage partner_vehicles" ON partner_vehicles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 8. PRESTADORES DE SERVIÇO (TERCEIROS)
-- Com controle de MEI, contratos e documentação
-- =====================================================

CREATE TABLE IF NOT EXISTS service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company_profile(id),

  -- Dados pessoais
  name TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,

  -- Contato
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,

  -- MEI / Empresa do prestador
  has_mei BOOLEAN DEFAULT false,
  mei_cnpj TEXT,
  mei_company_name TEXT, -- Razão social do MEI
  mei_trading_name TEXT, -- Nome fantasia
  mei_activity TEXT, -- Atividade principal

  -- Contrato
  contract_type TEXT, -- prestacao_servicos, autonomo, mei
  contract_start_date DATE,
  contract_end_date DATE,
  contract_value DECIMAL(15,2), -- Valor mensal ou por serviço
  payment_type TEXT, -- mensal, por_servico, por_producao
  contract_description TEXT, -- Objeto do contrato

  -- Documentação
  contract_signed BOOLEAN DEFAULT false,
  contract_file_url TEXT, -- URL do contrato assinado
  last_invoice_date DATE, -- Última nota fiscal emitida
  last_invoice_number TEXT,
  requires_invoice BOOLEAN DEFAULT true, -- Exige NF para pagamento?

  -- Serviços prestados
  service_description TEXT, -- Descrição dos serviços
  service_area TEXT, -- Área de atuação (Fiscal, Contábil, etc.)

  -- Observações para IA
  description TEXT,
  payment_patterns TEXT, -- Como aparece no extrato

  -- Alertas
  labor_risk_notes TEXT, -- Riscos trabalhistas identificados
  compliance_status TEXT DEFAULT 'pendente_contrato', -- regular, pendente_contrato, pendente_nf

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage service_providers" ON service_providers;
CREATE POLICY "Users can manage service_providers" ON service_providers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 9. NOTAS FISCAIS E RECIBOS DE PRESTADORES
-- =====================================================

CREATE TABLE IF NOT EXISTS provider_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES service_providers(id) ON DELETE CASCADE,

  -- Documento
  document_type TEXT NOT NULL, -- nota_fiscal, recibo, rpa
  document_number TEXT,
  document_date DATE NOT NULL,
  competence_month INTEGER, -- Mês de competência (1-12)
  competence_year INTEGER,

  -- Valores
  gross_value DECIMAL(15,2) NOT NULL,
  iss_value DECIMAL(15,2) DEFAULT 0, -- ISS retido
  inss_value DECIMAL(15,2) DEFAULT 0, -- INSS retido
  irrf_value DECIMAL(15,2) DEFAULT 0, -- IR retido
  other_deductions DECIMAL(15,2) DEFAULT 0,
  net_value DECIMAL(15,2), -- Valor líquido a pagar

  -- Pagamento
  payment_date DATE,
  payment_method TEXT, -- pix, transferencia, boleto
  bank_transaction_id UUID, -- Referência à transação bancária

  -- Arquivo
  file_url TEXT, -- URL do documento digitalizado

  -- Status
  status TEXT DEFAULT 'pending', -- pending, paid, cancelled

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE provider_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage provider_invoices" ON provider_invoices;
CREATE POLICY "Users can manage provider_invoices" ON provider_invoices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 10. MODELOS DE CONTRATO
-- =====================================================

CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL, -- prestacao_servicos, autonomo, mei, clt
  template_content TEXT NOT NULL, -- Conteúdo do modelo com placeholders

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage contract_templates" ON contract_templates;
CREATE POLICY "Users can manage contract_templates" ON contract_templates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Inserir modelos padrão de contrato
INSERT INTO contract_templates (name, description, contract_type, template_content) VALUES
(
  'Contrato de Prestação de Serviços - MEI',
  'Modelo padrão para contratação de MEI',
  'mei',
  E'CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\n' ||
  E'Pelo presente instrumento particular, de um lado:\n\n' ||
  E'CONTRATANTE: {{CONTRATANTE_NOME}}, inscrita no CNPJ sob nº {{CONTRATANTE_CNPJ}}, ' ||
  E'com sede em {{CONTRATANTE_ENDERECO}}, neste ato representada por seu sócio-administrador.\n\n' ||
  E'CONTRATADO(A): {{CONTRATADO_MEI_RAZAO}}, inscrita no CNPJ sob nº {{CONTRATADO_MEI_CNPJ}}, ' ||
  E'com sede em {{CONTRATADO_ENDERECO}}, neste ato representada por {{CONTRATADO_NOME}}, ' ||
  E'portador(a) do CPF nº {{CONTRATADO_CPF}}.\n\n' ||
  E'Têm entre si justo e contratado o que segue:\n\n' ||
  E'CLÁUSULA 1ª - DO OBJETO\n' ||
  E'O presente contrato tem por objeto a prestação de serviços de {{SERVICO_DESCRICAO}}, ' ||
  E'conforme demanda da CONTRATANTE.\n\n' ||
  E'CLÁUSULA 2ª - DO VALOR E FORMA DE PAGAMENTO\n' ||
  E'Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor de R$ {{VALOR}}, ' ||
  E'mediante apresentação de Nota Fiscal de Serviços.\n\n' ||
  E'CLÁUSULA 3ª - DA VIGÊNCIA\n' ||
  E'O presente contrato terá vigência de {{DATA_INICIO}} a {{DATA_FIM}}, ' ||
  E'podendo ser prorrogado mediante termo aditivo.\n\n' ||
  E'CLÁUSULA 4ª - DA INEXISTÊNCIA DE VÍNCULO EMPREGATÍCIO\n' ||
  E'Fica expressamente convencionado que não há vínculo empregatício entre as partes, ' ||
  E'sendo a CONTRATADA empresa legalmente constituída que presta serviços com autonomia e independência.\n\n' ||
  E'CLÁUSULA 5ª - DAS OBRIGAÇÕES DA CONTRATADA\n' ||
  E'a) Executar os serviços com qualidade e dentro dos prazos acordados;\n' ||
  E'b) Emitir Nota Fiscal de Serviços para cada pagamento;\n' ||
  E'c) Manter sua empresa regularizada junto aos órgãos competentes;\n' ||
  E'd) Assumir todos os encargos tributários decorrentes de sua atividade.\n\n' ||
  E'CLÁUSULA 6ª - DO FORO\n' ||
  E'Fica eleito o foro da comarca de {{CONTRATANTE_CIDADE}}-{{CONTRATANTE_UF}} para dirimir quaisquer dúvidas.\n\n' ||
  E'E por estarem assim justas e contratadas, as partes assinam o presente em 2 (duas) vias.\n\n' ||
  E'{{CONTRATANTE_CIDADE}}, {{DATA_ASSINATURA}}.\n\n\n' ||
  E'_______________________________\n' ||
  E'{{CONTRATANTE_NOME}}\n' ||
  E'CONTRATANTE\n\n\n' ||
  E'_______________________________\n' ||
  E'{{CONTRATADO_NOME}}\n' ||
  E'{{CONTRATADO_MEI_RAZAO}}\n' ||
  E'CONTRATADA'
),
(
  'Contrato de Prestação de Serviços - Autônomo',
  'Modelo padrão para contratação de autônomo (PF)',
  'autonomo',
  E'CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS\n\n' ||
  E'Pelo presente instrumento particular:\n\n' ||
  E'CONTRATANTE: {{CONTRATANTE_NOME}}, CNPJ {{CONTRATANTE_CNPJ}}\n' ||
  E'Endereço: {{CONTRATANTE_ENDERECO}}\n\n' ||
  E'CONTRATADO: {{CONTRATADO_NOME}}, CPF {{CONTRATADO_CPF}}\n' ||
  E'Endereço: {{CONTRATADO_ENDERECO}}\n\n' ||
  E'1. OBJETO: {{SERVICO_DESCRICAO}}\n\n' ||
  E'2. VALOR: R$ {{VALOR}} ({{VALOR_EXTENSO}})\n\n' ||
  E'3. VIGÊNCIA: {{DATA_INICIO}} a {{DATA_FIM}}\n\n' ||
  E'4. DECLARAÇÕES DO CONTRATADO:\n' ||
  E'- Prestará serviços com autonomia e independência;\n' ||
  E'- Não há subordinação nem vínculo empregatício;\n' ||
  E'- Pode prestar serviços a terceiros simultaneamente;\n' ||
  E'- Define seus próprios horários e métodos de trabalho;\n' ||
  E'- É responsável pelos encargos tributários de sua atividade.\n\n' ||
  E'5. PAGAMENTO:\n' ||
  E'O pagamento será realizado mediante apresentação de RPA (Recibo de Pagamento a Autônomo).\n' ||
  E'Serão retidos na fonte: INSS (11%), IRRF (conforme tabela) e ISS (se aplicável).\n\n' ||
  E'6. FORO: Comarca de {{CONTRATANTE_CIDADE}}-{{CONTRATANTE_UF}}\n\n' ||
  E'{{CONTRATANTE_CIDADE}}, {{DATA_ASSINATURA}}\n\n\n' ||
  E'____________________          ____________________\n' ||
  E'CONTRATANTE                   CONTRATADO'
),
(
  'Recibo de Pagamento a Autônomo (RPA)',
  'Modelo de RPA para pagamento de autônomos',
  'rpa',
  E'RECIBO DE PAGAMENTO A AUTÔNOMO - RPA\n\n' ||
  E'TOMADOR DO SERVIÇO:\n' ||
  E'Razão Social: {{CONTRATANTE_NOME}}\n' ||
  E'CNPJ: {{CONTRATANTE_CNPJ}}\n\n' ||
  E'PRESTADOR DO SERVIÇO:\n' ||
  E'Nome: {{CONTRATADO_NOME}}\n' ||
  E'CPF: {{CONTRATADO_CPF}}\n' ||
  E'PIS/PASEP: {{CONTRATADO_PIS}}\n' ||
  E'Endereço: {{CONTRATADO_ENDERECO}}\n\n' ||
  E'DISCRIMINAÇÃO DOS SERVIÇOS:\n' ||
  E'{{SERVICO_DESCRICAO}}\n\n' ||
  E'Competência: {{MES}}/{{ANO}}\n\n' ||
  E'VALORES:\n' ||
  E'Valor Bruto:                    R$ {{VALOR_BRUTO}}\n' ||
  E'(-) INSS (11%):                 R$ {{VALOR_INSS}}\n' ||
  E'(-) IRRF:                       R$ {{VALOR_IRRF}}\n' ||
  E'(-) ISS:                        R$ {{VALOR_ISS}}\n' ||
  E'(=) VALOR LÍQUIDO:              R$ {{VALOR_LIQUIDO}}\n\n' ||
  E'Recebi a importância líquida acima discriminada.\n\n' ||
  E'{{CONTRATANTE_CIDADE}}, {{DATA_PAGAMENTO}}\n\n\n' ||
  E'_______________________________\n' ||
  E'{{CONTRATADO_NOME}}\n' ||
  E'CPF: {{CONTRATADO_CPF}}'
);

-- =====================================================
-- 11. DESPESAS RECORRENTES DO ESCRITÓRIO
-- Bolacha, café, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS office_recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company_profile(id),

  name TEXT NOT NULL,
  category TEXT NOT NULL, -- alimentacao, limpeza, material_escritorio, etc.
  description TEXT,

  average_monthly_amount DECIMAL(15,2),
  payment_day INTEGER, -- Dia do mês que costuma pagar

  -- Como identificar no extrato
  transaction_patterns TEXT[], -- Array de padrões

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE office_recurring_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage office_recurring_expenses" ON office_recurring_expenses;
CREATE POLICY "Users can manage office_recurring_expenses" ON office_recurring_expenses
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- POPULAR DADOS DA AMPLA CONTABILIDADE
-- =====================================================

DO $$
DECLARE
  v_company_id UUID;
  v_sergio_id UUID;
BEGIN
  -- Criar perfil da empresa
  INSERT INTO company_profile (
    name, trading_name, description, tax_regime, main_activity,
    city, state, notes
  ) VALUES (
    'Ampla Contabilidade Ltda',
    'Ampla Contabilidade',
    'Escritório de contabilidade familiar fundado por Sergio Carneiro Leão. Atende empresas de diversos portes com serviços de contabilidade, fiscal, departamento pessoal e legalização.',
    'Lucro Presumido',
    'Serviços contábeis',
    'Goiânia',
    'GO',
    'Empresa familiar com equipe fiscal trabalhando remotamente. Possui sistema de pagamento misto (CLT + informal) para alguns funcionários.'
  )
  RETURNING id INTO v_company_id;

  -- Cadastrar sócio principal - Sergio Carneiro Leão
  INSERT INTO company_partners (
    company_id, name, role, is_administrator, participation_percentage,
    crc_number, description, expense_patterns
  ) VALUES (
    v_company_id,
    'Sergio Carneiro Leão',
    'Sócio-Administrador',
    true,
    100, -- Ajustar conforme realidade
    'CRC-GO', -- Completar
    'Patrono da empresa. Responsável pelas decisões estratégicas e relacionamento com clientes importantes. Possui diversos imóveis e veículos cujas despesas são pagas pela empresa como adiantamento.',
    'PIX SERGIO, PAGAMENTO SERGIO, CARNEIRO LEAO'
  )
  RETURNING id INTO v_sergio_id;

  -- Cadastrar familiares do Sergio
  INSERT INTO partner_family (partner_id, name, relationship, works_at_company, department, role_at_company, description, related_expenses) VALUES
    (v_sergio_id, 'Nayara Leão', 'Filha', false, NULL, NULL,
     'Filha com 2 filhos. A empresa paga a babá das crianças.',
     'Babá, escola das crianças'),
    (v_sergio_id, 'Victor Hugo de Oliveira Leão', 'Filho', true, 'Legalização', 'Responsável Legalização',
     'Trabalha no setor de legalização de empresas.',
     NULL),
    (v_sergio_id, 'Sergio Augusto de Oliveira Leão', 'Filho', false, NULL, NULL,
     'Estudante de medicina. Possui a Clínica Médica do Trabalho Ampla.',
     'Clínica Ampla, medicina do trabalho');

  -- Cadastrar imóveis do Sergio
  INSERT INTO partner_properties (partner_id, name, property_type, neighborhood, city, state, has_condominium, condominium_name, description, expense_patterns) VALUES
    (v_sergio_id, 'Apartamento Setor Marista', 'Apartamento', 'Setor Marista', 'Goiânia', 'GO', true, NULL,
     'Apartamento na Rua 27, Apto 2303. Residência principal.',
     'IPTU MARISTA, CONDOMINIO MARISTA'),
    (v_sergio_id, 'Casa Lago das Brisas', 'Casa', 'Lago das Brisas', 'Buriti Alegre', 'GO', true, 'Lago das Brisas',
     'Casa de lazer no Lago das Brisas em Buriti Alegre.',
     'LAGO BRISAS, BURITI ALEGRE, CONDOMINIO LAGO'),
    (v_sergio_id, 'Sala 301', 'Sala Comercial', NULL, 'Goiânia', 'GO', true, 'Galeria Nacional',
     'Sala comercial 301.',
     'IPTU 301, SALA 301'),
    (v_sergio_id, 'Sala 302', 'Sala Comercial', NULL, 'Goiânia', 'GO', true, 'Galeria Nacional',
     'Sala comercial 302.',
     'IPTU 302, SALA 302'),
    (v_sergio_id, 'Sala 303', 'Sala Comercial', NULL, 'Goiânia', 'GO', true, 'Galeria Nacional',
     'Sala comercial 303.',
     'IPTU 303, SALA 303'),
    (v_sergio_id, 'Imóvel Vila Abajá', 'Casa', 'Vila Abajá', 'Goiânia', 'GO', false, NULL,
     'Imóvel na Vila Abajá.',
     'VILA ABAJA, IPTU ABAJA');

  -- Cadastrar veículos do Sergio
  INSERT INTO partner_vehicles (partner_id, name, vehicle_type, brand, model, description, expense_patterns) VALUES
    (v_sergio_id, 'BMW', 'Carro', 'BMW', NULL, 'Veículo principal.', 'IPVA BMW, DETRAN BMW'),
    (v_sergio_id, 'Moto Biz', 'Moto', 'Honda', 'Biz', 'Moto para uso urbano.', 'IPVA BIZ'),
    (v_sergio_id, 'Moto CG', 'Moto', 'Honda', 'CG', 'Moto CG.', 'IPVA CG'),
    (v_sergio_id, 'Carretinha', 'Reboque', NULL, NULL, 'Reboque/carretinha.', 'IPVA CARRETINHA, REBOQUE');

  -- Cadastrar funcionários
  INSERT INTO employees (
    company_id, name, department, role, contract_type,
    official_salary, unofficial_salary, unofficial_payment_method, unofficial_payment_description,
    is_per_production, production_description, average_monthly_payment,
    description, payment_patterns, labor_risk_notes
  ) VALUES
    -- Daniel - Fiscal (PJ/Produção)
    (v_company_id, 'Daniel', 'Fiscal', 'Responsável Fiscal', 'PJ',
     NULL, NULL, NULL, NULL,
     true, 'Fechamento de todas as empresas da área fiscal, entrega de obrigações acessórias e guias aos clientes. Contrata e gerencia seus próprios ajudantes.',
     NULL, -- Preencher valor médio
     'Profissional sênior que trabalha por produção. Ele contrata os ajudantes dele. Fecha todas as empresas fiscais e entrega obrigações acessórias via WhatsApp.',
     'DANIEL, SR DANIEL, FISCAL',
     'Risco baixo: contratação como PJ com autonomia real. Documenta bem a prestação de serviços.'),

    -- Rose - DP (CLT misto)
    (v_company_id, 'Rose', 'Departamento Pessoal', 'Analista DP', 'CLT',
     NULL, -- Preencher salário carteira
     NULL, -- Preencher valor por fora
     'PIX', 'Pagamento complementar via PIX',
     false, NULL, NULL,
     'Responsável pelo departamento pessoal. Recebe parte em carteira e parte por fora.',
     'ROSE, ROSIANE, DP',
     'RISCO ALTO: Pagamento por fora caracteriza fraude trabalhista. Em caso de reclamação, o valor total será considerado como salário. Recomendação: regularizar gradualmente ou converter para PJ se possível.'),

    -- Josimar - Gerente Contador (CLT misto)
    (v_company_id, 'Josimar', 'Contábil', 'Gerente Contador', 'CLT',
     NULL, -- Preencher salário carteira
     NULL, -- Preencher valor por fora
     'PIX', 'Pagamento complementar via PIX',
     false, NULL, NULL,
     'Gerente contador. Recebe parte em carteira e parte por fora.',
     'JOSIMAR, CONTADOR',
     'RISCO ALTO: Mesmo caso da Rose. Cargo de gerente agrava a situação em caso de reclamação trabalhista.'),

    -- Faxineira
    (v_company_id, 'Faxineira', 'Administrativo', 'Serviços Gerais', 'Autônomo',
     NULL, NULL, 'Dinheiro', NULL,
     false, NULL, NULL,
     'Serviço de limpeza do escritório.',
     'LIMPEZA, FAXINA',
     'Verificar frequência. Se for mais de 2x por semana, considerar registro CLT.');

  -- Despesas recorrentes do escritório
  INSERT INTO office_recurring_expenses (company_id, name, category, description, transaction_patterns) VALUES
    (v_company_id, 'Café', 'alimentacao', 'Café para consumo diário no escritório', ARRAY['CAFE', 'COFFEE', 'MELITTA']),
    (v_company_id, 'Bolacha/Biscoitos', 'alimentacao', 'Bolachas e biscoitos para o escritório', ARRAY['BOLACHA', 'BISCOITO', 'BAUDUCCO']),
    (v_company_id, 'Água Mineral', 'alimentacao', 'Galões de água para o escritório', ARRAY['AGUA', 'MINERAL', 'INDAIA']),
    (v_company_id, 'Material de Limpeza', 'limpeza', 'Produtos de limpeza', ARRAY['LIMPEZA', 'DETERGENTE', 'DESINFETANTE']),
    (v_company_id, 'Material de Escritório', 'material_escritorio', 'Papel, canetas, etc.', ARRAY['PAPELARIA', 'KALUNGA', 'PAPEL A4']);

  -- Prestadores de Serviço (Terceiros)
  INSERT INTO service_providers (
    company_id, name, service_area, contract_type, payment_type,
    has_mei, requires_invoice, contract_signed, compliance_status,
    service_description, description, payment_patterns, labor_risk_notes
  ) VALUES
    -- Daniel - Fiscal (MEI com equipe própria)
    (v_company_id, 'Sr. Daniel', 'Fiscal', 'mei', 'por_producao',
     true, true, false, 'pendente_contrato',
     'Fechamento fiscal de todas as empresas, entrega de obrigações acessórias (DCTF, SPED, EFD), entrega de guias aos clientes, suporte via WhatsApp',
     'Profissional sênior que trabalha por produção. Contrata e gerencia seus próprios ajudantes. Possui autonomia total sobre horários e método de trabalho. MODELO IDEAL para evitar vínculo.',
     'DANIEL, SR DANIEL, FISCAL, PIX DANIEL',
     'RISCO BAIXO: Tem empresa própria, contrata ajudantes, trabalha por produção, possui autonomia. AÇÃO: Formalizar contrato de prestação de serviços e exigir NF mensal.');

  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'PERFIL DA EMPRESA CADASTRADO COM SUCESSO!';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Empresa: Ampla Contabilidade Ltda';
  RAISE NOTICE 'Sócio: Sergio Carneiro Leão';
  RAISE NOTICE '';
  RAISE NOTICE 'Familiares cadastrados:';
  RAISE NOTICE '  - Nayara Leão (filha) - 2 netos, babá';
  RAISE NOTICE '  - Victor Hugo (filho) - Legalização';
  RAISE NOTICE '  - Sergio Augusto (filho) - Medicina/Clínica';
  RAISE NOTICE '';
  RAISE NOTICE 'Imóveis cadastrados:';
  RAISE NOTICE '  - Apartamento Setor Marista';
  RAISE NOTICE '  - Casa Lago das Brisas';
  RAISE NOTICE '  - Salas 301, 302, 303 (Galeria Nacional)';
  RAISE NOTICE '  - Imóvel Vila Abajá';
  RAISE NOTICE '';
  RAISE NOTICE 'Veículos cadastrados:';
  RAISE NOTICE '  - BMW, Moto Biz, Moto CG, Carretinha';
  RAISE NOTICE '';
  RAISE NOTICE 'Funcionários CLT:';
  RAISE NOTICE '  - Rose (DP - CLT misto) ⚠️ RISCO ALTO';
  RAISE NOTICE '  - Josimar (Contador - CLT misto) ⚠️ RISCO ALTO';
  RAISE NOTICE '  - Faxineira (Autônomo) ⚠️ RISCO MÉDIO';
  RAISE NOTICE '';
  RAISE NOTICE 'Prestadores de Serviço (Terceiros):';
  RAISE NOTICE '  - Sr. Daniel (Fiscal - MEI) ✅ RISCO BAIXO';
  RAISE NOTICE '    → Pendente: Contrato + Exigir NF mensal';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  ALERTAS DE RISCO TRABALHISTA:';
  RAISE NOTICE '  Rose e Josimar recebem "por fora"';
  RAISE NOTICE '  Isso configura FRAUDE TRABALHISTA';
  RAISE NOTICE '  Em reclamação, o valor total é considerado salário';
  RAISE NOTICE '';
  RAISE NOTICE '✅ BOAS PRÁTICAS:';
  RAISE NOTICE '  Sr. Daniel é modelo ideal de terceirização';
  RAISE NOTICE '  - Tem MEI próprio';
  RAISE NOTICE '  - Contrata ajudantes dele';
  RAISE NOTICE '  - Trabalha por produção';
  RAISE NOTICE '  - Autonomia total';
  RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- FUNÇÃO PARA CALCULAR PROVISÕES TRABALHISTAS
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_labor_provisions(p_employee_id UUID)
RETURNS TABLE (
  employee_name TEXT,
  total_salary DECIMAL,
  vacation_provision DECIMAL,
  thirteenth_provision DECIMAL,
  fgts_provision DECIMAL,
  inss_provision DECIMAL,
  total_provisions DECIMAL,
  risk_level TEXT,
  risk_notes TEXT
) AS $$
DECLARE
  v_employee employees%ROWTYPE;
  v_total_salary DECIMAL;
  v_months_worked INTEGER;
BEGIN
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Calcular salário total (oficial + não oficial para fins de provisão de risco)
  v_total_salary := COALESCE(v_employee.official_salary, 0) + COALESCE(v_employee.unofficial_salary, 0);

  -- Meses trabalhados
  v_months_worked := EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_employee.hire_date));
  IF v_months_worked < 0 THEN v_months_worked := 0; END IF;
  IF v_months_worked > 12 THEN v_months_worked := 12; END IF;

  RETURN QUERY SELECT
    v_employee.name,
    v_total_salary,
    -- Férias: 1/12 do salário por mês + 1/3 constitucional
    ROUND((v_total_salary / 12) * v_months_worked * 1.33, 2) AS vacation_provision,
    -- 13º: 1/12 do salário por mês
    ROUND((v_total_salary / 12) * v_months_worked, 2) AS thirteenth_provision,
    -- FGTS: 8% do salário por mês
    ROUND(v_total_salary * 0.08 * v_months_worked, 2) AS fgts_provision,
    -- INSS patronal: ~28% (simplificado)
    ROUND(v_total_salary * 0.28, 2) AS inss_provision,
    -- Total
    ROUND((v_total_salary / 12) * v_months_worked * 1.33 + -- Férias
          (v_total_salary / 12) * v_months_worked + -- 13º
          v_total_salary * 0.08 * v_months_worked + -- FGTS
          v_total_salary * 0.28, 2) AS total_provisions,
    -- Nível de risco
    CASE
      WHEN v_employee.unofficial_salary > 0 THEN 'ALTO'
      WHEN v_employee.contract_type = 'Autônomo' AND v_employee.is_per_production = false THEN 'MÉDIO'
      ELSE 'BAIXO'
    END AS risk_level,
    v_employee.labor_risk_notes;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_labor_provisions IS 'Calcula provisões trabalhistas considerando salário total (oficial + não oficial)';

-- =====================================================
-- VIEW PARA RESUMO DE RISCOS TRABALHISTAS
-- =====================================================

CREATE OR REPLACE VIEW vw_labor_risk_summary AS
SELECT
  e.id,
  e.name,
  e.department,
  e.role,
  e.contract_type,
  e.official_salary,
  e.unofficial_salary,
  COALESCE(e.official_salary, 0) + COALESCE(e.unofficial_salary, 0) AS total_salary,
  CASE
    WHEN e.unofficial_salary > 0 THEN 'ALTO'
    WHEN e.contract_type = 'Autônomo' AND e.is_per_production = false THEN 'MÉDIO'
    ELSE 'BAIXO'
  END AS risk_level,
  e.labor_risk_notes,
  e.hire_date,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) AS years_worked
FROM employees e
WHERE e.is_active = true
ORDER BY
  CASE
    WHEN e.unofficial_salary > 0 THEN 1
    WHEN e.contract_type = 'Autônomo' THEN 2
    ELSE 3
  END,
  e.name;

COMMENT ON VIEW vw_labor_risk_summary IS 'Resumo de riscos trabalhistas por funcionário';

-- =====================================================
-- VIEW PARA CONTEXTO DA IA
-- Todas as informações relevantes para classificação
-- =====================================================

CREATE OR REPLACE VIEW vw_ai_company_context AS
SELECT
  'company' AS entity_type,
  cp.id,
  cp.name,
  cp.description,
  cp.notes AS additional_info
FROM company_profile cp

UNION ALL

SELECT
  'partner' AS entity_type,
  p.id,
  p.name,
  p.description,
  p.expense_patterns AS additional_info
FROM company_partners p WHERE p.is_active = true

UNION ALL

SELECT
  'family' AS entity_type,
  f.id,
  f.name || ' (' || f.relationship || ' de ' || p.name || ')' AS name,
  f.description,
  f.related_expenses AS additional_info
FROM partner_family f
JOIN company_partners p ON f.partner_id = p.id
WHERE f.is_active = true

UNION ALL

SELECT
  'employee' AS entity_type,
  e.id,
  e.name || ' (' || e.department || ')' AS name,
  e.description,
  e.payment_patterns AS additional_info
FROM employees e WHERE e.is_active = true

UNION ALL

SELECT
  'property' AS entity_type,
  pp.id,
  pp.name || ' - ' || p.name AS name,
  pp.description,
  pp.expense_patterns AS additional_info
FROM partner_properties pp
JOIN company_partners p ON pp.partner_id = p.id
WHERE pp.is_active = true

UNION ALL

SELECT
  'vehicle' AS entity_type,
  v.id,
  v.name || ' - ' || p.name AS name,
  v.description,
  v.expense_patterns AS additional_info
FROM partner_vehicles v
JOIN company_partners p ON v.partner_id = p.id
WHERE v.is_active = true;

COMMENT ON VIEW vw_ai_company_context IS 'Contexto completo da empresa para uso pela IA na classificação de transações';

-- =====================================================
-- VIEW PARA COMPLIANCE DE PRESTADORES DE SERVIÇO
-- =====================================================

CREATE OR REPLACE VIEW vw_provider_compliance AS
SELECT
  sp.id,
  sp.name,
  sp.service_area,
  sp.contract_type,
  sp.has_mei,
  sp.mei_cnpj,
  sp.contract_signed,
  sp.requires_invoice,
  sp.last_invoice_date,
  sp.compliance_status,
  sp.labor_risk_notes,
  -- Calcular pendências
  CASE WHEN sp.contract_signed = false THEN 1 ELSE 0 END AS pending_contract,
  CASE WHEN sp.requires_invoice AND sp.last_invoice_date IS NULL THEN 1
       WHEN sp.requires_invoice AND sp.last_invoice_date < (CURRENT_DATE - INTERVAL '45 days') THEN 1
       ELSE 0
  END AS pending_invoice,
  CASE WHEN sp.has_mei = true AND sp.mei_cnpj IS NULL THEN 1 ELSE 0 END AS pending_mei_data,
  -- Status geral
  CASE
    WHEN sp.contract_signed = false THEN 'CRÍTICO: Sem contrato'
    WHEN sp.requires_invoice AND sp.last_invoice_date IS NULL THEN 'ALERTA: Nunca emitiu NF'
    WHEN sp.requires_invoice AND sp.last_invoice_date < (CURRENT_DATE - INTERVAL '45 days') THEN 'ALERTA: NF atrasada'
    ELSE 'REGULAR'
  END AS status_description
FROM service_providers sp
WHERE sp.is_active = true
ORDER BY
  CASE WHEN sp.contract_signed = false THEN 1 ELSE 2 END,
  sp.name;

COMMENT ON VIEW vw_provider_compliance IS 'Status de compliance dos prestadores de serviço';

-- =====================================================
-- VIEW CONSOLIDADA DE ALERTAS TRABALHISTAS
-- =====================================================

CREATE OR REPLACE VIEW vw_all_labor_alerts AS
-- Alertas de funcionários CLT com pagamento por fora
SELECT
  'employee' AS source,
  e.id AS source_id,
  e.name,
  'RISCO TRABALHISTA' AS alert_type,
  'critical' AS severity,
  'Pagamento não oficial detectado' AS title,
  e.labor_risk_notes AS description,
  'Regularizar pagamento ou converter para PJ' AS recommendation
FROM employees e
WHERE e.is_active = true AND e.unofficial_salary > 0

UNION ALL

-- Alertas de prestadores sem contrato
SELECT
  'provider' AS source,
  sp.id AS source_id,
  sp.name,
  'COMPLIANCE' AS alert_type,
  'critical' AS severity,
  'Prestador sem contrato assinado' AS title,
  'Prestador de serviços sem contrato formal pode gerar vínculo trabalhista' AS description,
  'Gerar e assinar contrato de prestação de serviços' AS recommendation
FROM service_providers sp
WHERE sp.is_active = true AND sp.contract_signed = false

UNION ALL

-- Alertas de prestadores sem NF
SELECT
  'provider' AS source,
  sp.id AS source_id,
  sp.name,
  'COMPLIANCE' AS alert_type,
  'warning' AS severity,
  'Prestador sem nota fiscal recente' AS title,
  'Não há registro de NF nos últimos 45 dias' AS description,
  'Exigir emissão de NF antes do próximo pagamento' AS recommendation
FROM service_providers sp
WHERE sp.is_active = true
  AND sp.requires_invoice = true
  AND (sp.last_invoice_date IS NULL OR sp.last_invoice_date < (CURRENT_DATE - INTERVAL '45 days'))

UNION ALL

-- Alertas de férias vencidas (simplificado)
SELECT
  'employee' AS source,
  e.id AS source_id,
  e.name,
  'FÉRIAS' AS alert_type,
  'warning' AS severity,
  'Férias podem estar vencendo' AS title,
  'Funcionário há mais de 12 meses sem férias registradas' AS description,
  'Verificar período aquisitivo e programar férias' AS recommendation
FROM employees e
WHERE e.is_active = true
  AND e.contract_type = 'CLT'
  AND (e.last_vacation_date IS NULL OR e.last_vacation_date < (CURRENT_DATE - INTERVAL '12 months'));

COMMENT ON VIEW vw_all_labor_alerts IS 'Consolidação de todos os alertas trabalhistas e de compliance';
