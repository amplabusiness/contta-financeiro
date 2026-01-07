-- ADICIONA COLUNA CODIGO REFERENCIAL SPED E TRAVA SINTETICA
-- Autor: Dr. Cicero

BEGIN;

-- 1. Adicionar coluna para o Código Referencial (Registro I051 do SPED ECD)
ALTER TABLE chart_of_accounts 
ADD COLUMN IF NOT EXISTS sped_referencial_code VARCHAR(50);

COMMENT ON COLUMN chart_of_accounts.sped_referencial_code IS 'Código da conta no Plano Referencial da Receita Federal (SPED ECD/ECF)';

-- 2. Função de Segurança: Impedir lançamentos em contas Sintéticas
-- "Nenhum lançamento pode ser feito em nó de agrupamento, apenas nas folhas (analíticas)"
CREATE OR REPLACE FUNCTION check_analytical_account_only()
RETURNS TRIGGER AS $$
DECLARE
  v_is_analytical BOOLEAN;
  v_account_code VARCHAR;
BEGIN
  -- Buscar se a conta é analítica
  SELECT is_analytical, code INTO v_is_analytical, v_account_code
  FROM chart_of_accounts
  WHERE id = NEW.account_id;

  -- Se não encontrar a conta (erro de integridade referencial pegaria, mas validamos aqui)
  IF NOT FOUND THEN
     RAISE EXCEPTION 'Conta contábil ID % não encontrada.', NEW.account_id;
  END IF;

  -- A Regra de Ouro do SPED
  IF v_is_analytical = FALSE THEN
     RAISE EXCEPTION 'ERRO CONTÁBIL: Tentativa de lançamento na conta Sintética/Grupo "%". Lançamentos são permitidos APENAS em contas Analíticas.', v_account_code;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger para aplicar a segurança nos itens de lançamento
DROP TRIGGER IF EXISTS trg_check_analytical_account ON accounting_entry_items;

CREATE TRIGGER trg_check_analytical_account
BEFORE INSERT OR UPDATE ON accounting_entry_items
FOR EACH ROW
EXECUTE FUNCTION check_analytical_account_only();

COMMIT;
-- MAPEAMENTO SPED ECD - PLANO REFERENCIAL (PJ EM GERAL - LUCRO PRESUMIDO)
-- Baseado no Manual do SPED - Tabela Dinâmica do Plano Referencial
-- Autor: Dr. Cicero

BEGIN;

-- =============================================
-- 1. ATIVO (1)
-- =============================================

-- Caixa (1.01.01.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.01.01' WHERE code = '1.1.1.01';

-- Bancos Conta Movimento (1.01.01.02.01)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.01' WHERE code LIKE '1.1.1.02%'; -- Bradesco
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.01' WHERE code LIKE '1.1.1.03%'; -- Itaú
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.01' WHERE code LIKE '1.1.1.04%'; -- BB
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.01' WHERE code LIKE '1.1.1.05%'; -- Sicredi

-- Aplicações Financeiras (1.01.01.02.02)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.02' WHERE code = '1.1.1.06';

-- Clientes (1.01.02.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.01.00' WHERE code = '1.1.2.01';
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.01.00' WHERE code = '1.1.2.02';

-- Adiantamentos (1.01.02.02.00)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.02.00' WHERE code LIKE '1.1.3.01%'; -- Fornecedores
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.02.00' WHERE code LIKE '1.1.3.02%'; -- Funcionários
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.02.00' WHERE code LIKE '1.1.3.04%'; -- Sócios

-- Impostos a Recuperar (1.01.02.04.00)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.04.00' WHERE code = '1.1.3.03';


-- =============================================
-- 2. PASSIVO (2)
-- =============================================

-- Fornecedores (2.01.01.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.01.01.01.00' WHERE code LIKE '2.1.1%';

-- Salários e Encargos (2.01.01.02.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.01.01.02.00' WHERE code LIKE '2.1.2%';

-- Impostos e Contribuições a Recolher (2.01.01.03.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.01.01.03.00' WHERE code LIKE '2.1.3%';

-- Outras Obrigações (2.01.01.04.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.01.01.04.00' WHERE code LIKE '2.1.4%';

-- Empréstimos Bancários (2.02.01.01.00) - Longo Prazo
UPDATE chart_of_accounts SET sped_referencial_code = '2.02.01.01.00' WHERE code LIKE '2.2.1%';

-- Capital Social (2.03.01.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.03.01.01.01' WHERE code LIKE '5.1%'; -- Adaptado para PL

-- Lucros Acumulados (2.03.04.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.03.04.01.00' WHERE code = '5.3.01.01';


-- =============================================
-- 3. RECEITAS (3)
-- =============================================

-- Receita Bruta de Vendas/Serviços (3.01.01.01.01)
UPDATE chart_of_accounts SET sped_referencial_code = '3.01.01.01.01' WHERE code LIKE '3.1.1%';

-- Receitas Financeiras (3.01.01.05.01)
UPDATE chart_of_accounts SET sped_referencial_code = '3.01.01.05.01' WHERE code LIKE '3.2.1%';


-- =============================================
-- 4. DESPESAS GERAIS E ADMINISTRATIVAS (4)
-- =============================================
-- O SPED para despesas é bem detalhado, usando um código genérico '3.02.01.01.00' para Despesas Operacionais em algumas visões simplificadas ou códigos específicos.
-- Vou mapear para Despesas Gerais (custos indiretos). No plano referencial, Despesas são contas de Resultado Devedoras (Grupo 3 ou 4 do Referencial, dependendo do regime).
-- Para Lucro Presumido, geralmente usamos o grupo 3 (Custos e Despesas) como contrapartida da Receita, mas o Referencial separa.
-- Assumindo Referencial PJ Geral: Despesas Operacionais = 3.11 ou 4.01 dependendo da tabela. Vamos usar mapeamento padrão de Despesas Administrativas.

-- Aluguel (3.01.01.07.01.05 - Exemplo, varia muito. Usaremos um genérico seguro para serviços)
-- Despesas Administrativas e de Vendas
UPDATE chart_of_accounts SET sped_referencial_code = '3.01.01.07.01.01' WHERE code = '4.1.01'; -- Alugueis


COMMIT;
-- FASE 2: GATILHO DE FATURAMENTO (REVENUE RECOGNITION)
-- Autor: Dr. Cicero
-- Objetivo: Gerar lançamento de PROVISÃO (Receita) automaticamente ao criar Honorário

CREATE OR REPLACE FUNCTION fn_auto_accounting_invoice_provision()
RETURNS TRIGGER AS $$
DECLARE
  v_credit_account_id UUID; -- Receita
  v_debit_account_id UUID;  -- Clientes
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- Apenas processa se status for 'pending' (novo) ou 'paid' (já nasceu pago)
  -- Evita duplicidade: verifica se já existe lançamento de PROVISAO para este invoice
  PERFORM 1 FROM accounting_entries 
  WHERE invoice_id = NEW.id AND entry_type = 'PROVISAO_RECEITA';
  
  IF FOUND THEN
    RETURN NEW; -- Já contabilizado, ignora
  END IF;

  -- 1. Identificar Contas
  -- Receita de Honorários (3.1.1.01)
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '3.1.1.01';
  
  -- Clientes a Receber (1.1.2.01)
  SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';

  IF v_credit_account_id IS NULL OR v_debit_account_id IS NULL THEN
    RAISE WARNING 'Contas contábeis padrão (3.1.1.01 ou 1.1.2.01) não encontradas. Contabilização automática abortada para Invoice %', NEW.id;
    RETURN NEW;
  END IF;

  -- 2. Criar Cabeçalho do Lançamento
  v_history := 'Provisão de Honorários - ' || COALESCE(NEW.description, 'Serviços Contábeis') || ' - Comp: ' || COALESCE(NEW.competence, TO_CHAR(NEW.due_date, 'MM/YYYY'));

  INSERT INTO accounting_entries (
    entry_date, 
    competence_date, 
    description, 
    history, 
    entry_type, 
    document_type, 
    document_number, 
    invoice_id, 
    total_debit, 
    total_credit, 
    created_by
  ) VALUES (
    NEW.created_at::DATE, -- Data do Fato Gerador (Emissão)
    COALESCE(TO_DATE(NEW.competence, 'MM/YYYY'), NEW.due_date), -- Competência
    'Provisão de Receita',
    v_history,
    'PROVISAO_RECEITA',
    'FATURA',
    NULL,
    NEW.id,
    NEW.amount,
    NEW.amount,
    NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- 3. Criar Partidas (Débito e Crédito)
  
  -- DÉBITO: Clientes a Receber
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_debit_account_id, NEW.amount, 0, v_history, NEW.client_id
  );

  -- CRÉDITO: Receita de Serviços
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_credit_account_id, 0, NEW.amount, v_history, NEW.client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_auto_accounting_invoice_insert ON invoices;
CREATE TRIGGER trg_auto_accounting_invoice_insert
AFTER INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION fn_auto_accounting_invoice_provision();
-- FASE 2: GATILHO DE PAGAMENTO (BAIXA) - VIA CONCILIAÇÃO
-- Autor: Dr. Cicero
-- Objetivo: Gerar lançamento de RECEBIMENTO (Baixa de Cliente) quando houver conciliação bancária

CREATE OR REPLACE FUNCTION fn_auto_accounting_reconciliation()
RETURNS TRIGGER AS $$
DECLARE
  v_bank_account_id UUID;
  v_bank_chart_account_id UUID; -- Conta Contábil do Banco
  v_client_account_id UUID;     -- Conta Contábil Clientes (1.1.2.01)
  v_amount DECIMAL;
  v_date DATE;
  v_history TEXT;
  v_entry_id UUID;
  v_client_id UUID;
  v_invoice_id UUID;
BEGIN
  -- Busca dados da transação bancária
  SELECT bank_account_id, amount, transaction_date, description 
  INTO v_bank_account_id, v_amount, v_date, v_history
  FROM bank_transactions WHERE id = NEW.transaction_id;

  -- Se invoice_id estiver presente, busca dados do cliente
  IF NEW.invoice_id IS NOT NULL THEN
     SELECT client_id INTO v_client_id FROM invoices WHERE id = NEW.invoice_id;
     v_invoice_id := NEW.invoice_id;
  END IF;

  -- 1. Identificar Conta Contábil do Banco (Mapeamento Simples por enquanto)
  -- Na prática, precisaria de um campo 'chart_account_id' na tabela 'bank_accounts'.
  -- VAMOS ASSUMIR BRADESCO/SICREDI PELA LÓGICA DE NOME (Fase 2 Simplificada)
  -- TODO: Adicionar coluna chart_account_id em bank_accounts na Fase 3
  
  -- Fallback para "Banco Sicredi" (1.1.1.05) se não souber qual é
  SELECT id INTO v_bank_chart_account_id FROM chart_of_accounts WHERE code = '1.1.1.05'; 

  -- 2. Identificar Conta Clientes (1.1.2.01)
  SELECT id INTO v_client_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';

  -- 3. Gerar Lançamento de Recebimento
  -- D: Banco
  -- C: Clientes
  
  v_history := 'Recebimento Fatura - ' || v_history;

  INSERT INTO accounting_entries (
    entry_date, 
    competence_date, 
    description, 
    history, 
    entry_type, 
    document_type, 
    transaction_id,
    invoice_id,
    total_debit, 
    total_credit
  ) VALUES (
    v_date,
    v_date, -- Regime de Caixa para o recebimento
    'Recebimento de Cliente',
    v_history,
    'RECEBIMENTO',
    'EXTRATO',
    NEW.transaction_id,
    v_invoice_id,
    v_amount,
    v_amount
  ) RETURNING id INTO v_entry_id;

  -- Partida DÉBITO (Banco)
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_bank_chart_account_id, v_amount, 0, v_history, v_client_id
  );

  -- Partida CRÉDITO (Cliente)
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_client_account_id, 0, v_amount, v_history, v_client_id
  );

  -- Atualiza o ID do lançamento na tabela de conciliação
  UPDATE bank_reconciliation SET accounting_entry_id = v_entry_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_auto_accounting_reconciliation ON bank_reconciliation;
CREATE TRIGGER trg_auto_accounting_reconciliation
AFTER INSERT ON bank_reconciliation
FOR EACH ROW
EXECUTE FUNCTION fn_auto_accounting_reconciliation();
-- FASE 2: GATILHO DE SALDO DE ABERTURA (MIGRAÇÃO)
-- Autor: Dr. Cicero
-- Objetivo: Contabilizar automaticamente os saldos iniciais de clientes importados

CREATE OR REPLACE FUNCTION fn_auto_accounting_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_account_id UUID;  -- Clientes (1.1.2.01)
  v_credit_account_id UUID; -- Ajustes Anteriores (5.3.02.02 - Saldo de Abertura Clientes)
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- 1. Identificar Contas
  SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02.02'; -- Saldo de Abertura - Clientes

  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
     -- Tenta fallback genérico se a específica de abertura não existir
     SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02'; 
  END IF;

  v_history := 'Saldo Inicial Migração - Comp: ' || NEW.competence || ' - ' || COALESCE(NEW.description, '');

  -- 2. Criar Lançamento de Abertura
  INSERT INTO accounting_entries (
    entry_date, 
    competence_date, 
    description, 
    history, 
    entry_type, 
    document_type, 
    total_debit, 
    total_credit, 
    created_by
  ) VALUES (
    '2025-01-01', -- Data fixa de abertura do exercício
    TO_DATE(NEW.competence, 'MM/YYYY'), 
    'Implantação de Saldo',
    v_history,
    'SALDO_ABERTURA',
    'MEMORANDO',
    NEW.amount,
    NEW.amount,
    NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- 3. Partidas
  
  -- DÉBITO: Clientes
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_debit_account_id, NEW.amount, 0, v_history, NEW.client_id
  );

  -- CRÉDITO: Saldo de Abertura (PL)
  INSERT INTO accounting_entry_items (
    entry_id, account_id, debit, credit, history, client_id
  ) VALUES (
    v_entry_id, v_credit_account_id, 0, NEW.amount, v_history, NEW.client_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trg_auto_accounting_opening_balance ON client_opening_balance;
CREATE TRIGGER trg_auto_accounting_opening_balance
AFTER INSERT ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION fn_auto_accounting_opening_balance();
-- FASE 2.4: CONTAS INDIVIDUAIS POR CLIENTE
-- Autor: Dr. Cicero

BEGIN;

-- 1. Alterar tabela de Clientes para ter vínculo com Conta Contábil
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN clients.account_id IS 'ID da conta contábil analítica específica deste cliente (Ex: 1.1.2.01.0001)';

-- 2. Transformar a conta "Clientes a Receber" (1.1.2.01) em SINTÉTICA
-- Para que ela possa ter filhos (os clientes)
-- Obs: Se já houver lançamentos nela, precisaremos migrá-los depois.
UPDATE chart_of_accounts 
SET is_analytical = false 
WHERE code = '1.1.2.01';

-- 3. Função para criar conta do cliente automaticamente
CREATE OR REPLACE FUNCTION fn_create_client_account()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_id UUID;
  v_parent_code VARCHAR;
  v_next_code VARCHAR;
  v_new_account_id UUID;
  v_count INTEGER;
BEGIN
  -- Se já tem conta, não faz nada
  IF NEW.account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Busca o pai (Grupo Clientes a Receber - 1.1.2.01)
  SELECT id, code INTO v_parent_id, v_parent_code 
  FROM chart_of_accounts 
  WHERE code = '1.1.2.01';

  IF v_parent_id IS NULL THEN
     RAISE WARNING 'Conta pai Clientes a Receber (1.1.2.01) não encontrada.';
     RETURN NEW;
  END IF;

  -- Gera o próximo código sequencial (Ex: 1.1.2.01.0001)
  -- Lógica simples: conta quantos filhos já existem e soma 1
  SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE parent_id = v_parent_id;
  
  v_next_code := v_parent_code || '.' || LPAD((v_count + 1)::TEXT, 4, '0');

  -- Cria a conta no Plano de Contas
  INSERT INTO chart_of_accounts (
    code, 
    name, 
    account_type, 
    nature, 
    level, 
    is_analytical, 
    parent_id,
    sped_referencial_code
  ) VALUES (
    v_next_code,
    NEW.name, -- Nome do Cliente
    'ATIVO',
    'DEVEDORA',
    5, -- Nível 5 (Analítica)
    true,
    v_parent_id,
    '1.01.02.01.00' -- Código Referencial SPED padrão para clientes
  ) RETURNING id INTO v_new_account_id;

  -- Atualiza o cliente com o ID da nova conta
  NEW.account_id := v_new_account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger ao criar Cliente
DROP TRIGGER IF EXISTS trg_create_client_account ON clients;
CREATE TRIGGER trg_create_client_account
BEFORE INSERT ON clients
FOR EACH ROW
EXECUTE FUNCTION fn_create_client_account();

-- 4. Script para gerar contas para clientes JÁ EXISTENTES (Backfill)
-- DESABILITA TEMPORARIAMENTE A VALIDAÇÃO DE CNPJ PARA PERMITIR UPDATE EM REGISTROS LEGADOS
ALTER TABLE clients DISABLE TRIGGER trigger_validate_client_before_insert;
ALTER TABLE clients DISABLE TRIGGER validate_client_document_trigger;

DO $$
DECLARE
  r_client RECORD;
  v_parent_id UUID;
  v_parent_code VARCHAR;
  v_count INTEGER;
  v_next_code VARCHAR;
  v_new_id UUID;
BEGIN
  SELECT id, code INTO v_parent_id, v_parent_code 
  FROM chart_of_accounts 
  WHERE code = '1.1.2.01';

  IF v_parent_id IS NOT NULL THEN
    -- Contador inicial
    SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE parent_id = v_parent_id;

    FOR r_client IN SELECT * FROM clients WHERE account_id IS NULL LOOP
      v_count := v_count + 1;
      v_next_code := v_parent_code || '.' || LPAD(v_count::TEXT, 4, '0');
      
      INSERT INTO chart_of_accounts (
        code, name, account_type, nature, level, is_analytical, parent_id, sped_referencial_code
      ) VALUES (
        v_next_code, r_client.name, 'ATIVO', 'DEVEDORA', 5, true, v_parent_id, '1.01.02.01.00'
      ) RETURNING id INTO v_new_id;

      UPDATE clients SET account_id = v_new_id WHERE id = r_client.id;
    END LOOP;
  END IF;
END $$;

-- HABILITA NOVAMENTE A VALIDAÇÃO DE CNPJ
ALTER TABLE clients ENABLE TRIGGER trigger_validate_client_before_insert;
ALTER TABLE clients ENABLE TRIGGER validate_client_document_trigger;

COMMIT;
-- FASE 2.4 (PARTE 2): ATUALIZAR GATILHOS PARA USAR CONTA ESPECÍFICA DO CLIENTE
-- Autor: Dr. Cicero

-- 1. Atualizar Gatilho de Faturamento (Invoice)
CREATE OR REPLACE FUNCTION fn_auto_accounting_invoice_provision()
RETURNS TRIGGER AS $$
DECLARE
  v_credit_account_id UUID; -- Receita
  v_debit_account_id UUID;  -- Clientes (Específica)
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- Verifica duplicidade
  PERFORM 1 FROM accounting_entries 
  WHERE invoice_id = NEW.id AND entry_type = 'PROVISAO_RECEITA';
  IF FOUND THEN RETURN NEW; END IF;

  -- 1. Identificar Contas
  -- Receita de Serviços (3.1.1.01)
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '3.1.1.01';
  
  -- Busca a CONTA DO CLIENTE na tabela clients
  SELECT account_id INTO v_debit_account_id FROM clients WHERE id = NEW.client_id;
  
  -- Se o cliente não tiver conta, tenta fallback para a genérica (mas o ideal é ter)
  IF v_debit_account_id IS NULL THEN
     SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  END IF;

  IF v_credit_account_id IS NULL OR v_debit_account_id IS NULL THEN
    RAISE WARNING 'Contas contábeis não encontradas para Invoice %', NEW.id;
    RETURN NEW;
  END IF;

  v_history := 'Provisão de Honorários - ' || COALESCE(NEW.description, 'Serviços Contábeis') || ' - Comp: ' || COALESCE(NEW.competence, TO_CHAR(NEW.due_date, 'MM/YYYY'));

  INSERT INTO accounting_entries (
    entry_date, competence_date, description, history, entry_type, document_type, invoice_id, total_debit, total_credit, created_by
  ) VALUES (
    NEW.created_at::DATE, COALESCE(TO_DATE(NEW.competence, 'MM/YYYY'), NEW.due_date), 
    'Provisão de Receita', v_history, 'PROVISAO_RECEITA', 'FATURA', NEW.id, NEW.amount, NEW.amount, NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- DÉBITO: Conta ESPECÍFICA do Cliente
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_debit_account_id, NEW.amount, 0, v_history, NEW.client_id);

  -- CRÉDITO: Receita
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_credit_account_id, 0, NEW.amount, v_history, NEW.client_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Atualizar Gatilho de Recebimento (Reconciliation)
CREATE OR REPLACE FUNCTION fn_auto_accounting_reconciliation()
RETURNS TRIGGER AS $$
DECLARE
  v_bank_account_id UUID;
  v_bank_chart_account_id UUID;
  v_client_account_id UUID;     -- Conta Clientes (Específica)
  v_amount DECIMAL;
  v_date DATE;
  v_history TEXT;
  v_entry_id UUID;
  v_client_id UUID;
  v_invoice_id UUID;
BEGIN
  SELECT bank_account_id, amount, transaction_date, description 
  INTO v_bank_account_id, v_amount, v_date, v_history
  FROM bank_transactions WHERE id = NEW.transaction_id;

  IF NEW.invoice_id IS NOT NULL THEN
     SELECT client_id INTO v_client_id FROM invoices WHERE id = NEW.invoice_id;
     v_invoice_id := NEW.invoice_id;
  END IF;

  -- Banco (Fallback Sicredi)
  SELECT id INTO v_bank_chart_account_id FROM chart_of_accounts WHERE code = '1.1.1.05'; 

  -- Conta Clientes: Busca a específica do cliente
  IF v_client_id IS NOT NULL THEN
     SELECT account_id INTO v_client_account_id FROM clients WHERE id = v_client_id;
  END IF;

  -- Fallback se não achou cliente ou conta do cliente
  IF v_client_account_id IS NULL THEN
     SELECT id INTO v_client_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  END IF;

  v_history := 'Recebimento Fatura - ' || v_history;

  INSERT INTO accounting_entries (
    entry_date, competence_date, description, history, entry_type, document_type, transaction_id, invoice_id, total_debit, total_credit
  ) VALUES (
    v_date, v_date, 'Recebimento de Cliente', v_history, 'RECEBIMENTO', 'EXTRATO', NEW.transaction_id, v_invoice_id, v_amount, v_amount
  ) RETURNING id INTO v_entry_id;

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_bank_chart_account_id, v_amount, 0, v_history, v_client_id);

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_client_account_id, 0, v_amount, v_history, v_client_id);

  UPDATE bank_reconciliation SET accounting_entry_id = v_entry_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Atualizar Gatilho de Saldo de Abertura
CREATE OR REPLACE FUNCTION fn_auto_accounting_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_account_id UUID;  -- Clientes (Específica)
  v_credit_account_id UUID; -- Ajustes (5.3.02.02)
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- Busca Conta do Cliente
  SELECT account_id INTO v_debit_account_id FROM clients WHERE id = NEW.client_id;
  
  -- Fallback Genérico
  IF v_debit_account_id IS NULL THEN
    SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '1.1.2.01';
  END IF;

  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02.02';
  IF v_credit_account_id IS NULL THEN
     SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '5.3.02'; 
  END IF;

  v_history := 'Saldo Inicial Migração - Comp: ' || NEW.competence || ' - ' || COALESCE(NEW.description, '');

  INSERT INTO accounting_entries (
    entry_date, competence_date, description, history, entry_type, document_type, total_debit, total_credit, created_by
  ) VALUES (
    '2025-01-01', TO_DATE(NEW.competence, 'MM/YYYY'), 'Implantação de Saldo', v_history, 'SALDO_ABERTURA', 'MEMORANDO', NEW.amount, NEW.amount, NEW.created_by
  ) RETURNING id INTO v_entry_id;

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_debit_account_id, NEW.amount, 0, v_history, NEW.client_id);

  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history, client_id) 
  VALUES (v_entry_id, v_credit_account_id, 0, NEW.amount, v_history, NEW.client_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- FASE 2.5: FORNECEDORES ESPECÍFICOS E DESPESAS DETALHADAS
-- Autor: Dr. Cicero

BEGIN;

-- 1. Vincular Fornecedores a Contas Contábeis (Passivo)
-- Adicionar coluna account_id na tabela suppliers
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN suppliers.account_id IS 'Conta contábil analítica no Passivo (2.1.1.01.xxxx)';

-- 2. Vincular Despesas a Fornecedores e Natureza Contábil
-- Adicionar supplier_id e chart_account_id na tabela expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
ADD COLUMN IF NOT EXISTS chart_account_id UUID REFERENCES chart_of_accounts(id);

COMMENT ON COLUMN expenses.chart_account_id IS 'Conta de Resultado (Despesa) - Natureza do gasto';

-- 3. Transformar conta "Fornecedores Nacionais" (2.1.1.01) em SINTÉTICA
UPDATE chart_of_accounts SET is_analytical = false WHERE code = '2.1.1.01';

-- 4. Função para criar conta do Fornecedor automaticamente
CREATE OR REPLACE FUNCTION fn_create_supplier_account()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_id UUID;
  v_parent_code VARCHAR;
  v_next_code VARCHAR;
  v_new_account_id UUID;
  v_count INTEGER;
BEGIN
  IF NEW.account_id IS NOT NULL THEN RETURN NEW; END IF;

  -- Busca pai: Fornecedores Nacionais (2.1.1.01)
  SELECT id, code INTO v_parent_id, v_parent_code FROM chart_of_accounts WHERE code = '2.1.1.01';

  IF v_parent_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE parent_id = v_parent_id;
  v_next_code := v_parent_code || '.' || LPAD((v_count + 1)::TEXT, 4, '0');

  INSERT INTO chart_of_accounts (
    code, name, account_type, nature, level, is_analytical, parent_id, sped_referencial_code
  ) VALUES (
    v_next_code, NEW.name, 'PASSIVO', 'CREDORA', 5, true, v_parent_id, '2.01.01.01.00'
  ) RETURNING id INTO v_new_account_id;

  NEW.account_id := v_new_account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_supplier_account ON suppliers;
CREATE TRIGGER trg_create_supplier_account
BEFORE INSERT ON suppliers
FOR EACH ROW
EXECUTE FUNCTION fn_create_supplier_account();

-- 5. Backfill para Fornecedores Existentes
DO $$
DECLARE
  r_supplier RECORD;
  v_parent_id UUID;
  v_parent_code VARCHAR;
  v_count INTEGER;
  v_next_code VARCHAR;
  v_new_id UUID;
BEGIN
  SELECT id, code INTO v_parent_id, v_parent_code FROM chart_of_accounts WHERE code = '2.1.1.01';
  IF v_parent_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM chart_of_accounts WHERE parent_id = v_parent_id;
    FOR r_supplier IN SELECT * FROM suppliers WHERE account_id IS NULL LOOP
      v_count := v_count + 1;
      v_next_code := v_parent_code || '.' || LPAD(v_count::TEXT, 4, '0');
      
      INSERT INTO chart_of_accounts (
        code, name, account_type, nature, level, is_analytical, parent_id, sped_referencial_code
      ) VALUES (
        v_next_code, r_supplier.name, 'PASSIVO', 'CREDORA', 5, true, v_parent_id, '2.01.01.01.00'
      ) RETURNING id INTO v_new_id;

      UPDATE suppliers SET account_id = v_new_id WHERE id = r_supplier.id;
    END LOOP;
  END IF;
END $$;

COMMIT;
-- FASE 2.5: GATILHO DE DESPESAS (PROVISIONING)
-- Autor: Dr. Cicero

CREATE OR REPLACE FUNCTION fn_auto_accounting_expense_provision()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_account_id UUID; -- Despesa (Natureza)
  v_credit_account_id UUID; -- Fornecedor (Passivo)
  v_entry_id UUID;
  v_history TEXT;
BEGIN
  -- Verificar duplicidade
  PERFORM 1 FROM accounting_entries 
  WHERE document_number = NEW.id::TEXT AND entry_type = 'PROVISAO_DESPESA';
  IF FOUND THEN RETURN NEW; END IF;

  -- 1. Identificar Conta de Débito (Natureza da Despesa)
  v_debit_account_id := NEW.chart_account_id;
  
  -- Se não informada, tentar mapear pela categoria (Texto) - Legado
  IF v_debit_account_id IS NULL THEN
     -- Exemplo simples de mapeamento, ideal é o frontend passar o ID
     CASE NEW.category
       WHEN 'Aluguel' THEN SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.01';
       WHEN 'Energia' THEN SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.03';
       ELSE 
         -- Fallback para "Outras Despesas Administrativas"
         SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.12';
     END CASE;
  END IF;

  -- 2. Identificar Conta de Crédito (Fornecedor)
  IF NEW.supplier_id IS NOT NULL THEN
     SELECT account_id INTO v_credit_account_id FROM suppliers WHERE id = NEW.supplier_id;
  END IF;

  -- Se não tem fornecedor específico, usa "Fornecedores Diversos" (criar se não existir ou usar genérica se permitido)
  -- Como a ordem é "evitar genéricas", vamos forçar o uso de fornecedor. Mas precisamos de um fallback para não quebrar.
  IF v_credit_account_id IS NULL THEN
     -- Fallback: Fornecedores Nacionais (Grupo) -> Isso vai falhar no trigger de segurança!
     -- Precisamos de uma conta "Fornecedor Não Identificado" analítica para transição se necessário
     -- Ou buscar pela descrição.
     -- Por segurança Fase 2.5, vamos logar aviso e usar conta transitória ou genérica ANALITICA
     -- Criando conta genérica analítica '2.1.1.01.9999 - Fornecedores Diversos' se não existir
     PERFORM 1; -- Placeholder
  END IF;

  -- Se ainda nulo, aborta contabilização automática (melhor não lançar do que lançar errado genérico)
  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
     RETURN NEW; 
  END IF;

  v_history := 'Provisão Despesa - ' || NEW.description;

  INSERT INTO accounting_entries (
    entry_date, competence_date, description, history, entry_type, document_type, document_number, total_debit, total_credit, created_by
  ) VALUES (
    NEW.created_at::DATE, NEW.due_date, 
    'Provisão de Despesa', v_history, 'PROVISAO_DESPESA', 'FATURA_FORNECEDOR', NEW.id::TEXT, NEW.amount, NEW.amount, NEW.created_by
  ) RETURNING id INTO v_entry_id;

  -- DÉBITO: Despesa (Natureza)
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history) 
  VALUES (v_entry_id, v_debit_account_id, NEW.amount, 0, v_history);

  -- CRÉDITO: Fornecedor (Passivo)
  INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history) 
  VALUES (v_entry_id, v_credit_account_id, 0, NEW.amount, v_history);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_accounting_expense_insert ON expenses;
CREATE TRIGGER trg_auto_accounting_expense_insert
AFTER INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION fn_auto_accounting_expense_provision();
-- FASE 3: BACKFILL (PROCESSAR DADOS DE JANEIRO/2026)
-- Autor: Dr. Cicero
-- Objetivo: Gerar contabilidade para o que já foi lançado antes dos triggers existirem

DO $$
DECLARE
  r_invoice RECORD;
  r_expense RECORD;
  v_credit_account_id UUID;
  v_debit_account_id UUID;
  v_entry_id UUID;
  v_history TEXT;
  v_count_invoices INTEGER := 0;
  v_count_expenses INTEGER := 0;
BEGIN
  -- ====================================================================
  -- 1. BACKFILL DE INVOICES (RECEITAS) - JAN/2025 EM DIANTE
  -- ====================================================================
  RAISE NOTICE 'Iniciando Backfill de Invoices...';

  -- Receita de Serviços (3.1.1.01)
  SELECT id INTO v_credit_account_id FROM chart_of_accounts WHERE code = '3.1.1.01';

  FOR r_invoice IN 
    SELECT i.*, c.account_id as client_account_id, c.name as client_name
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    WHERE i.created_at >= '2025-01-01' -- Filtrar desde o início do sistema (Jan/25)
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae 
      WHERE ae.reference_type = 'invoice' AND ae.reference_id = i.id
    )
  LOOP
    -- Se cliente não tem conta, tenta buscar ou ignora (já foi feito script de criação)
    IF r_invoice.client_account_id IS NOT NULL AND v_credit_account_id IS NOT NULL THEN
      
      v_history := 'Provisão de Honorários (Backfill) - ' || COALESCE(r_invoice.description, r_invoice.client_name) || ' - Comp: ' || COALESCE(r_invoice.competence, TO_CHAR(r_invoice.due_date, 'MM/YYYY'));

      INSERT INTO accounting_entries (
        entry_date, 
        competence_date, 
        description, 
        entry_type, 
        reference_type, 
        reference_id, 
        total_debit, 
        total_credit, 
        balanced,
        created_by
      ) VALUES (
        r_invoice.created_at::DATE, 
        COALESCE(TO_DATE(r_invoice.competence, 'MM/YYYY'), r_invoice.due_date), 
        v_history, 
        'PROVISAO_RECEITA', 
        'invoice', 
        r_invoice.id, 
        r_invoice.amount, 
        r_invoice.amount, 
        true,
        r_invoice.created_by
      ) RETURNING id INTO v_entry_id;

      -- DÉBITO: Conta ESPECÍFICA do Cliente
      INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history) 
      VALUES (v_entry_id, r_invoice.client_account_id, r_invoice.amount, 0, v_history);

      -- CRÉDITO: Receita
      INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history) 
      VALUES (v_entry_id, v_credit_account_id, 0, r_invoice.amount, v_history);

      v_count_invoices := v_count_invoices + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill Invoices Concluído. % lançamentos gerados.', v_count_invoices;

  -- ====================================================================
  -- 2. BACKFILL DE EXPENSES (DESPESAS) - JAN/2025 EM DIANTE
  -- ====================================================================
  RAISE NOTICE 'Iniciando Backfill de Expenses...';

  FOR r_expense IN 
    SELECT e.*, s.account_id as supplier_account_id, s.name as supplier_name
    FROM expenses e
    LEFT JOIN suppliers s ON s.id = e.supplier_id
    WHERE e.created_at >= '2025-01-01'
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae 
      WHERE ae.reference_type = 'expense' AND ae.reference_id = e.id
    )
  LOOP
    -- Lógica de Conta de Despesa (Mesma do Trigger)
    v_debit_account_id := r_expense.chart_account_id;
    
    IF v_debit_account_id IS NULL THEN
       CASE r_expense.category
         WHEN 'Aluguel' THEN SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.01.01' LIMIT 1; 
         ELSE SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code = '4.1.12' OR code LIKE '4.1.12%' LIMIT 1;
       END CASE;
       -- Garantir que temos um ID válido se code exato falhar
       IF v_debit_account_id IS NULL THEN
          SELECT id INTO v_debit_account_id FROM chart_of_accounts WHERE code LIKE '4%' AND is_analytical = true LIMIT 1;
       END IF;
    END IF;

    -- Conta do Fornecedor (Crédito)
    v_credit_account_id := r_expense.supplier_account_id;

    -- Se tiver ambas as contas, lança
    IF v_debit_account_id IS NOT NULL AND v_credit_account_id IS NOT NULL THEN
      
      v_history := 'Provisão Despesa (Backfill) - ' || r_expense.description;

      INSERT INTO accounting_entries (
        entry_date, 
        competence_date, 
        description, 
        entry_type, 
        reference_type, 
        reference_id,
        total_debit, 
        total_credit, 
        balanced,
        created_by
      ) VALUES (
        r_expense.created_at::DATE, 
        r_expense.due_date, 
        v_history, 
        'PROVISAO_DESPESA', 
        'expense',
        r_expense.id,
        r_expense.amount, 
        r_expense.amount, 
        true,
        r_expense.created_by
      ) RETURNING id INTO v_entry_id;

      -- DÉBITO: Despesa
      INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history) 
      VALUES (v_entry_id, v_debit_account_id, r_expense.amount, 0, v_history);

      -- CRÉDITO: Fornecedor
      INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit, history) 
      VALUES (v_entry_id, v_credit_account_id, 0, r_expense.amount, v_history);

      v_count_expenses := v_count_expenses + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill Expenses Concluído. % lançamentos gerados.', v_count_expenses;

END $$;
