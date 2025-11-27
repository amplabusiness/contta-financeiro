# 🗺️ ROADMAP - Sistema de Contas a Receber Ampla Contabilidade

## ⚡ STATUS ATUAL: FASE 1 CONCLUÍDA! 

### ✅ O QUE JÁ ESTÁ PRONTO (27/11/2025)

1. **✅ Tabela de Saldo de Abertura**
   - Migration SQL criada: `20251127153040_add_client_opening_balance.sql`
   - Estrutura completa para tracking de débitos 2024
   - Views e triggers configurados
   - ⚠️ **AÇÃO PENDENTE:** Executar SQL no Supabase (ver `EXECUTE_SQL_NO_SUPABASE.md`)

2. **✅ Edge Function para Excel**
   - Function criada: `process-bank-excel-report`
   - Parse automático de planilhas do banco
   - Detecção inteligente de colunas
   - Matching automático com faturas e saldo abertura

3. **✅ Página de Importação em Lote**
   - Componente: `BankFolderImport.tsx`
   - Upload múltiplo de OFX e Excel
   - Processamento batch com progresso
   - Rota: `/bank-folder-import`

4. **✅ Página de Saldo de Abertura**
   - Componente: `ClientOpeningBalance.tsx`
   - CRUD completo de competências 2024
   - Rota: `/client-opening-balance`

5. **✅ Configuração Conta SICREDI**
   - Migration SQL criada: `20251127153739_configure_sicredi_bank_account.sql`
   - Banco: 748, Agência: 3950, Conta: 27806-8
   - ⚠️ **AÇÃO PENDENTE:** Executar SQL no Supabase

6. **✅ Menu Reorganizado**
   - 7 grupos (antes: 12)
   - 34 itens (antes: 70+)
   - Navegação mais limpa

### 🎯 PRÓXIMAS AÇÕES (EM ORDEM!)

1. **⚠️ VOCÊ (MANUAL):** Executar SQLs no Supabase
   - Abrir: `EXECUTE_SQL_NO_SUPABASE.md`
   - Seguir instruções passo a passo
   - Tempo: 5 minutos

2. **⚠️ VOCÊ (MANUAL):** Cadastrar Saldos de Abertura
   - Acessar: `/client-opening-balance`
   - Cadastrar todos os débitos de 2024
   - Tempo: 30-60 minutos

3. **⚠️ VOCÊ (MANUAL):** Testar Importação
   - Acessar: `/bank-folder-import`
   - Upload de arquivos OFX + Excel
   - Tempo: 5-10 minutos

4. **⚠️ VOCÊ (MANUAL):** Validar Conciliação
   - Acessar: `/bank-reconciliation`
   - Conferir matches automáticos
   - Tempo: 20-30 minutos

**📖 Leia:** `GUIA_INICIO_RAPIDO.md` para instruções detalhadas!

---

## 📋 CONTEXTO DA OPERAÇÃO

### SITUAÇÃO ATUAL
```
1. Ampla gera boletos em SISTEMA EXTERNO (mantém)
2. Cliente recebe boleto e paga no banco SICREDI
3. Ampla recebe:
   - ✅ Extrato bancário (arquivo OFX)
   - ✅ Relatório do banco (Excel)
4. Ampla faz baixa MANUAL comparando com planilhas
```

### PROBLEMA
- ❌ Controle de contas a receber está fragmentado
- ❌ Baixa manual é trabalhosa e propensa a erros
- ❌ Difícil saber "quem pagou" e "quem deve"
- ❌ Análises gerenciais são demoradas

---

## 🎯 SOLUÇÃO PROPOSTA

### SISTEMA DE CONTAS A RECEBER INTERNO

**NÃO vamos gerar boletos bancários reais**

**SIM vamos:**
1. ✅ Registrar "honorários a receber" (boleto interno/fatura)
2. ✅ Importar extrato OFX do banco SICREDI
3. ✅ Importar relatório Excel do banco
4. ✅ Fazer matching automático (conciliação)
5. ✅ Dar baixa automática quando identificar pagamento
6. ✅ Ter visão completa de quem pagou/deve

### DADOS DA CONTA
- **Banco:** SICREDI (748)
- **Agência:** 3950
- **Conta:** 27806-8

---

## 📊 FLUXO COMPLETO (Como vai funcionar)

### 1️⃣ REGISTRAR CONTAS A RECEBER (Mensal)
```
📅 Todo dia 1º do mês
1. Sistema gera faturas automáticas (já funciona!)
2. Faturas ficam com status "pending"
3. Você gera boletos no SISTEMA EXTERNO (como hoje)
4. Cliente recebe boleto e paga
```

### 2️⃣ IMPORTAR EXTRATO BANCÁRIO (Diário/Semanal)
```
🏦 Quando tiver movimentações
1. Baixar extrato OFX do SICREDI (Internet Banking)
2. Acessar /bank-import
3. Fazer upload do arquivo OFX
4. Sistema importa todas as transações
5. Sistema identifica automaticamente:
   - CNPJ/CPF do pagador
   - Valor
   - Data
   - Descrição (contém nome do cliente)
```

### 3️⃣ IMPORTAR RELATÓRIO DO BANCO (Opcional)
```
📄 Se tiver relatório Excel mais detalhado
1. Acessar /import-boleto-report
2. Upload do Excel
3. Sistema extrai:
   - Nosso número
   - Número do documento
   - Cliente
   - Valor pago
   - Data pagamento
```

### 4️⃣ CONCILIAÇÃO AUTOMÁTICA
```
🔄 Sistema faz automaticamente
1. Compara transações do extrato com faturas pendentes
2. Busca por:
   - CNPJ igual
   - Nome similar (fuzzy matching)
   - Valor igual ou próximo
   - Data próxima ao vencimento
3. Quando encontra match:
   - Marca fatura como "paid"
   - Preenche data de pagamento
   - Registra valor recebido
   - Cria lançamento contábil
```

### 5️⃣ REVISÃO MANUAL (Só o que não bateu)
```
👤 Você só precisa revisar pendências
1. Acessar /bank-reconciliation
2. Ver sugestões de match do sistema
3. Confirmar ou corrigir manualmente
4. Pronto!
```

---

## 🚀 FASES DE IMPLEMENTAÇÃO

### ✅ **FASE 1: JÁ ESTÁ PRONTO (95%)**

**O que já funciona:**
- [x] Gestão de clientes
- [x] Geração de faturas (honorários)
- [x] Status de faturas (pending, paid, overdue)
- [x] Gestão de despesas
- [x] Contabilidade completa
- [x] Parser OFX (extrato bancário)
- [x] Auto-reconciliation (conciliação automática)
- [x] Dashboard de conciliação

**O que falta ajustar:**
- [ ] Configurar dados da conta SICREDI (3950 / 27806-8)
- [ ] **Implementar Saldo de Abertura (Competências Anteriores)**
- [ ] Testar importação OFX
- [ ] Ajustar regras de matching

---

### 🟡 **FASE 2: CONFIGURAÇÃO INICIAL (1-2 dias)**

#### Checklist de Configuração

**1. Configurar Saldo de Abertura por Cliente**

⚠️ **IMPORTANTE:** Como o sistema vai começar a ser usado a partir de Janeiro/2025, precisamos registrar os honorários não pagos de 2024 (competências anteriores).

**Estrutura do Saldo de Abertura:**
```
Cliente: João Silva Ltda
Saldo Devedor: R$ 4.500,00
Detalhamento:
- 01/2024 - R$ 1.500,00 (Venceu em 10/02/2024)
- 03/2024 - R$ 1.500,00 (Venceu em 10/04/2024)
- 08/2024 - R$ 1.500,00 (Venceu em 10/09/2024)
```

**Checklist:**
- [ ] **Criar campo na tabela `clients`:**
  ```sql
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS
    opening_balance DECIMAL(15,2) DEFAULT 0,
    opening_balance_details JSONB,
    opening_balance_date DATE DEFAULT '2024-12-31';
  ```

- [ ] **Criar tabela de detalhamento (opcional - mais robusto):**
  ```sql
  CREATE TABLE IF NOT EXISTS client_opening_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    competence VARCHAR(7) NOT NULL, -- '01/2024', '03/2024'
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
  );

  CREATE INDEX idx_opening_balance_client ON client_opening_balance(client_id);
  ```

- [ ] **Criar página `/clientes/:id/saldo-abertura`:**
  - [ ] Formulário para adicionar competências devidas
  - [ ] Lista de competências com valores
  - [ ] Total do saldo de abertura
  - [ ] Opção de editar/remover competências
  - [ ] Salvar em `client_opening_balance` ou `opening_balance_details`

- [ ] **Atualizar Dashboard de Honorários:**
  - [ ] Incluir saldo de abertura no cálculo de inadimplência
  - [ ] Mostrar separadamente: "Dívidas de 2024" vs "Dívidas de 2025"
  - [ ] Filtro para ver apenas saldo de abertura

- [ ] **Importação em Lote (Excel):**
  - [ ] Criar página `/importar-saldo-abertura`
  - [ ] Template Excel:
    ```
    Cliente | CNPJ | Competência | Valor | Vencimento
    João Silva | 12.345.678/0001-90 | 01/2024 | 1500.00 | 10/02/2024
    ```
  - [ ] Validar formato
  - [ ] Importar para `client_opening_balance`

**2. Configurar Conta Bancária**
- [ ] Adicionar conta SICREDI no sistema:
  ```sql
  INSERT INTO bank_accounts (
    bank_name,
    bank_code,
    account_type,
    agency,
    account_number,
    account_holder,
    document,
    is_active
  ) VALUES (
    'SICREDI',
    '748',
    'checking',
    '3950',
    '27806-8',
    'AMPLA CONTABILIDADE LTDA',
    'SEU_CNPJ_AQUI',
    true
  );
  ```

**2. Testar Importação de Extrato OFX**
- [ ] Baixar arquivo OFX de teste do SICREDI
- [ ] Acessar `/bank-import`
- [ ] Upload do arquivo
- [ ] Verificar se transações foram importadas
- [ ] Validar dados extraídos (data, valor, descrição)

**3. Configurar Regras de Matching**
- [ ] Ajustar tolerância de valor (ex: aceitar ±R$0,50 para taxas)
- [ ] Ajustar tolerância de data (ex: ±7 dias do vencimento)
- [ ] Definir prioridade de matching:
  1. CNPJ exato
  2. Nome similar + valor exato
  3. Apenas valor + data próxima

---

### 🟢 **FASE 3: MELHORIAS NO IMPORTADOR (1 semana)**

#### 3.1 Melhorar Parser OFX

**Checklist:**
- [ ] **Revisar `parse-ofx-statement` Edge Function**
  - [ ] Garantir extração de CNPJ/CPF da descrição
  - [ ] Extrair informações específicas do SICREDI
  - [ ] Padronizar formato de descrição
  - [ ] Identificar tipo de transação (PIX, TED, boleto)

- [ ] **Adicionar validações**
  - [ ] Verificar duplicatas antes de importar
  - [ ] Validar formato de valores
  - [ ] Validar formato de datas
  - [ ] Alertar se arquivo já foi processado

#### 3.2 Importador de Relatório Excel

**Checklist:**
- [ ] **Criar Edge Function `import-bank-excel-report`**
  - [ ] Aceitar arquivo .xlsx ou .xls
  - [ ] Detectar formato automaticamente:
    - Layout SICREDI
    - Layout Banco do Brasil
    - Layout genérico
  - [ ] Extrair colunas principais:
    - Data
    - Descrição/Histórico
    - Documento (nosso número, se tiver)
    - Valor
    - CNPJ/CPF (se tiver)
  - [ ] Importar para `bank_transactions`
  - [ ] Chamar auto-reconciliation após importar

- [ ] **Criar página `/import-bank-excel`**
  - [ ] Upload de arquivo Excel
  - [ ] Preview das primeiras 10 linhas
  - [ ] Permitir mapear colunas manualmente:
    ```
    Coluna A = Data
    Coluna B = Descrição
    Coluna C = Valor
    ```
  - [ ] Botão "Importar"
  - [ ] Exibir resultado

#### 3.3 Melhorar Auto-Reconciliation

**Checklist:**
- [ ] **Atualizar `auto-reconciliation` Edge Function**
  - [ ] Adicionar matching por "nosso número" (se vier no Excel)
  - [ ] Melhorar fuzzy matching de nomes:
    ```typescript
    // Exemplo:
    "AMPLA CONTABILIDADE LTDA" match com
    "AMPLA CONTAB" ou "CONTABILIDADE AMPLA"
    ```
  - [ ] Adicionar matching por múltiplos critérios:
    ```typescript
    Score de confiança:
    - CNPJ exato + valor exato = 100%
    - Nome similar (>80%) + valor exato = 90%
    - Valor exato + data ±3 dias = 70%
    ```
  - [ ] Quando score >= 90%: match automático
  - [ ] Quando score 70-89%: sugerir para revisão
  - [ ] Quando score < 70%: deixar manual

---

### 🟢 **FASE 4: INTERFACE DE CONCILIAÇÃO (3-4 dias)**

#### 4.1 Dashboard de Importações

**Checklist:**
- [ ] **Criar página `/bank-imports-dashboard`**
  - [ ] Listar todos os arquivos importados:
    - Nome do arquivo
    - Data de importação
    - Tipo (OFX, Excel)
    - Total de registros
    - Total conciliado
    - Total pendente
  - [ ] KPIs:
    - Total importado hoje
    - Total conciliado automaticamente
    - Total pendente de revisão
  - [ ] Gráfico de evolução mensal

#### 4.2 Melhorar Página de Conciliação

**Checklist:**
- [ ] **Atualizar `/bank-reconciliation`**
  - [ ] Adicionar filtro "Apenas pendentes"
  - [ ] Adicionar filtro por conta bancária
  - [ ] Melhorar exibição de sugestões:
    ```
    Transação: R$ 1.500,00 - João Silva - 15/11/2025
    
    Sugestões (por score):
    
    1. ✅ 95% - Fatura #1234 - João Silva Ltda
       CNPJ: 12.345.678/0001-90
       Valor: R$ 1.500,00
       Vencimento: 10/11/2025
       [Aceitar] [Rejeitar]
    
    2. ⚠️ 75% - Fatura #1235 - João Silva ME
       CNPJ: Diferente
       Valor: R$ 1.500,00
       Vencimento: 12/11/2025
       [Aceitar] [Rejeitar]
    ```
  - [ ] Botão "Aceitar Todos (>90%)"
  - [ ] Botão "Marcar como Não Identificado"

#### 4.3 Página de Revisão Manual

**Checklist:**
- [ ] **Criar página `/conciliar-manualmente`**
  - [ ] Lado esquerdo: Transações não conciliadas
  - [ ] Lado direito: Faturas pendentes
  - [ ] Busca rápida por cliente/CNPJ
  - [ ] Drag & drop para fazer match manual
  - [ ] Ou: selecionar transação + fatura + "Conciliar"

---

### 🔵 **FASE 5: RELATÓRIOS E ANÁLISES (1 semana)**

#### 5.1 Relatório de Recebimentos

**Checklist:**
- [ ] **Criar página `/relatorio-recebimentos`**
  - [ ] Filtros:
    - Período (data de pagamento)
    - Cliente
    - Conta bancária
    - Status de conciliação
  - [ ] Colunas:
    - Data pagamento
    - Cliente
    - Fatura
    - Valor faturado
    - Valor pago
    - Diferença (se houver)
    - Status conciliação
  - [ ] Totalizadores:
    - Total recebido no período
    - Total conciliado
    - Total pendente
  - [ ] Botões:
    - Exportar Excel
    - Exportar PDF
    - Enviar por email

#### 5.2 Relatório de Inadimplência

**Checklist:**
- [x] **Página `/fees-analysis`** (já existe!)
  - [ ] Adicionar coluna "Última importação"
  - [ ] Adicionar botão "Reimportar Extrato"
  - [ ] Melhorar destaque de clientes com pagamento não identificado

- [ ] **Criar página `/inadimplencia-detalhada`**
  - [ ] Listar todos os clientes inadimplentes
  - [ ] Mostrar histórico de pagamentos
  - [ ] Indicar se teve transação bancária não conciliada no período
  - [ ] Sugerir qual transação pode ser do cliente

#### 5.3 Dashboard Financeiro Executivo

**Checklist:**
- [ ] **Atualizar `/executive-dashboard`**
  - [ ] Adicionar seção "Recebimentos"
  - [ ] Gráfico: Faturado vs Recebido (mensal)
  - [ ] Gráfico: Taxa de conciliação automática
  - [ ] KPI: % de recebimentos identificados automaticamente
  - [ ] KPI: Tempo médio entre vencimento e pagamento
  - [ ] Alerta: Transações não identificadas há mais de 7 dias

---

### 🟣 **FASE 6: AUTOMAÇÕES (Futuro)**

#### 6.1 Importação Automática

**Quando quiser automatizar:**
- [ ] Configurar acesso automático ao Internet Banking SICREDI
- [ ] Agendar importação diária de OFX
- [ ] Notificação por email quando houver novos recebimentos
- [ ] Notificação de transações não identificadas

---

## 🛠️ CONFIGURAÇÃO PASSO A PASSO

### 1️⃣ Configurar Saldo de Abertura (FAZER PRIMEIRO!)

**Por que é importante:**
- Sistema começa a operar em Janeiro/2025
- Clientes têm dívidas de competências anteriores (2024)
- Precisa manter histórico do que cada cliente deve
- Quando cliente pagar, sistema precisa identificar qual competência está sendo quitada

**Execute este SQL no Supabase:**

```sql
-- 1. Adicionar campos na tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  opening_balance DECIMAL(15,2) DEFAULT 0,
  opening_balance_details JSONB,
  opening_balance_date DATE DEFAULT '2024-12-31';

-- 2. Criar tabela de detalhamento do saldo de abertura
CREATE TABLE IF NOT EXISTS client_opening_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  competence VARCHAR(7) NOT NULL, -- '01/2024', '03/2024', etc
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  original_invoice_id UUID, -- Se tiver a fatura original
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'partial'
  paid_amount DECIMAL(15,2) DEFAULT 0,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Criar índices
CREATE INDEX idx_opening_balance_client ON client_opening_balance(client_id);
CREATE INDEX idx_opening_balance_status ON client_opening_balance(status);
CREATE INDEX idx_opening_balance_competence ON client_opening_balance(competence);

-- 4. Habilitar RLS
ALTER TABLE client_opening_balance ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS
CREATE POLICY "Enable all for authenticated users"
ON client_opening_balance FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Criar função para atualizar saldo
CREATE OR REPLACE FUNCTION update_client_opening_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE clients
  SET opening_balance = (
    SELECT COALESCE(SUM(amount - paid_amount), 0)
    FROM client_opening_balance
    WHERE client_id = NEW.client_id
    AND status != 'paid'
  )
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar trigger
CREATE TRIGGER trigger_update_opening_balance
AFTER INSERT OR UPDATE OR DELETE ON client_opening_balance
FOR EACH ROW
EXECUTE FUNCTION update_client_opening_balance();

-- 8. Comentários
COMMENT ON TABLE client_opening_balance IS 'Saldo de abertura detalhado por competência - honorários anteriores a 2025';
COMMENT ON COLUMN client_opening_balance.competence IS 'Formato: MM/YYYY - Ex: 01/2024, 03/2024';
COMMENT ON COLUMN client_opening_balance.status IS 'Status: pending (pendente), paid (pago), partial (pago parcial)';
```

**Exemplo de Importação via Excel:**

Crie uma planilha com estas colunas:
```
| Cliente              | CNPJ              | Competência | Valor   | Vencimento |
|---------------------|-------------------|-------------|---------|------------|
| João Silva Ltda     | 12.345.678/0001-90| 01/2024     | 1500.00 | 10/02/2024 |
| João Silva Ltda     | 12.345.678/0001-90| 03/2024     | 1500.00 | 10/04/2024 |
| João Silva Ltda     | 12.345.678/0001-90| 08/2024     | 1500.00 | 10/09/2024 |
| Maria Santos ME     | 98.765.432/0001-10| 02/2024     | 2000.00 | 10/03/2024 |
| Maria Santos ME     | 98.765.432/0001-10| 05/2024     | 2000.00 | 10/06/2024 |
```

**Importação Manual (Se preferir):**

```sql
-- Exemplo para João Silva
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, description)
VALUES 
  (
    (SELECT id FROM clients WHERE cnpj = '12.345.678/0001-90'),
    '01/2024',
    1500.00,
    '2024-02-10',
    'Honorários de Janeiro/2024'
  ),
  (
    (SELECT id FROM clients WHERE cnpj = '12.345.678/0001-90'),
    '03/2024',
    1500.00,
    '2024-04-10',
    'Honorários de Março/2024'
  ),
  (
    (SELECT id FROM clients WHERE cnpj = '12.345.678/0001-90'),
    '08/2024',
    1500.00,
    '2024-09-10',
    'Honorários de Agosto/2024'
  );
```

### 2️⃣ Configurar Conta Bancária no Sistema

**Execute este SQL no Supabase:**

```sql
-- Inserir conta SICREDI da Ampla
INSERT INTO bank_accounts (
  bank_name,
  bank_code,
  account_type,
  agency,
  account_number,
  account_holder,
  document,
  is_active
) VALUES (
  'SICREDI',
  '748',
  'checking',
  '3950',
  '27806-8',
  'AMPLA CONTABILIDADE LTDA',
  'SEU_CNPJ_AQUI',
  true
);
```

### 2️⃣ Testar Importação de Extrato

1. Acesse o Internet Banking do SICREDI
2. Vá em Extrato / Exportar
3. Escolha formato OFX
4. Baixe últimos 30 dias
5. No sistema: `/bank-import`
6. Upload do arquivo OFX
7. Verificar se importou corretamente

### 3️⃣ Fazer Primeira Conciliação

1. Acessar `/bank-reconciliation`
2. Ver transações importadas
3. Ver faturas pendentes (incluindo saldo de abertura)
4. Revisar sugestões de match
5. **Se for pagamento de competência anterior (2024):**
   - Sistema deve mostrar saldo de abertura na lista
   - Ao conciliar, atualiza `client_opening_balance`
   - Marca competência específica como paga
6. Aceitar ou ajustar manualmente
7. Verificar se status da fatura/competência mudou para "paid"

### 4️⃣ Visualizar Saldo de Abertura por Cliente

1. Acessar `/clients`
2. Clicar em um cliente
3. Ver seção "Saldo de Abertura":
   ```
   Saldo Devedor Total: R$ 4.500,00
   
   Competências Pendentes:
   ✅ 01/2024 - R$ 1.500,00 - Pago em 15/01/2025
   ❌ 03/2024 - R$ 1.500,00 - Vencido em 10/04/2024
   ❌ 08/2024 - R$ 1.500,00 - Vencido em 10/09/2024
   ```
4. Acompanhar baixas conforme cliente for pagando

---

## 📋 CHECKLIST DE ATIVAÇÃO

### ✅ Semana 1: Configuração e Testes Iniciais

**Preparação (Antes de começar):**
- [ ] Listar todos os clientes com dívidas de 2024
- [ ] Para cada cliente, detalhar:
  - [ ] Competências devidas (01/2024, 02/2024, etc)
  - [ ] Valor de cada competência
  - [ ] Data de vencimento original
- [ ] Organizar em planilha Excel
- [ ] Validar valores com sistema anterior/planilhas

**Dia 1: Configuração de Saldo de Abertura**
- [ ] Criar migration para campo `opening_balance` na tabela clients
- [ ] Criar tabela `client_opening_balance`
- [ ] Criar página `/importar-saldo-abertura`
- [ ] Preparar planilha Excel com dívidas de 2024
- [ ] Importar saldos de abertura de todos os clientes

**Dia 2: Configuração Bancária**
- [ ] Adicionar conta SICREDI no banco de dados
- [ ] Validar que saldos de abertura estão corretos
- [ ] Baixar arquivo OFX de teste do SICREDI
- [ ] Testar importação via `/bank-import`

**Dia 3: Ajustes no Parser**
- [ ] Revisar Edge Function `parse-ofx-statement`
- [ ] Ajustar extração de dados do SICREDI
- [ ] Testar com arquivo real

**Dia 4: Testar Auto-Reconciliation**
- [ ] Importar extrato com pagamentos conhecidos
- [ ] Ver se sistema identificou automaticamente (incluindo saldo abertura)
- [ ] Ajustar regras de matching se necessário
- [ ] Testar pagamento de competência anterior (2024)

**Dia 5: Criar Importador Excel**
- [ ] Criar Edge Function para Excel
- [ ] Criar página de upload
- [ ] Testar com relatório real do banco
- [ ] Validar baixa de saldo de abertura

**Dia 6: Treinar e Documentar**
- [ ] Criar guia de uso interno
- [ ] Documentar processo de conciliação
- [ ] Testar fluxo completo ponta a ponta

### ✅ Semana 2-3: Melhorias e Refinamentos

**Melhorias no Matching**
- [ ] Implementar scoring de confiança
- [ ] Adicionar matching por nosso número
- [ ] Melhorar fuzzy matching de nomes
- [ ] Testar com casos difíceis

**Interface de Conciliação**
- [ ] Criar dashboard de importações
- [ ] Melhorar página de reconciliação
- [ ] Adicionar página de revisão manual
- [ ] Implementar drag & drop

**Relatórios**
- [ ] Criar relatório de recebimentos
- [ ] Melhorar análise de inadimplência
- [ ] Atualizar dashboard executivo

### ✅ Semana 4: Produção

**Uso Real**
- [ ] Usar sistema para conciliação mensal completa
- [ ] Avaliar taxa de sucesso
- [ ] Coletar feedback
- [ ] Fazer ajustes finais
- [ ] Abandonar processo manual antigo! 🎉

---

## 🎯 RESULTADO ESPERADO

### Antes (Situação Atual)
```
⏱️ Tempo para conciliar 100 recebimentos: 2-3 horas
❌ Erros de digitação: 5-10%
❌ Recebimentos não identificados: muitos
📊 Visão de inadimplência: imprecisa
😫 Trabalho manual repetitivo
```

### Depois (Com o Sistema)
```
⏱️ Tempo para conciliar 100 recebimentos: 15-30 minutos
✅ Conciliação automática: 80-90%
✅ Erros: < 1%
✅ Recebimentos não identificados: destacados para revisão
📊 Visão de inadimplência: tempo real e precisa
😊 Trabalho focado apenas em exceções
```

### Métricas de Sucesso
- **Taxa de conciliação automática:** > 80%
- **Tempo de processamento:** < 5 minutos para 100 transações
- **Redução de tempo manual:** > 70%
- **Satisfação da equipe:** Alta (menos trabalho repetitivo)

---

## 💡 DICAS IMPORTANTES

### Para Funcionar Bem

1. **Importe o extrato regularmente**
   - Ideal: semanalmente
   - Mínimo: quinzenalmente
   - Quanto mais frequente, melhor o matching

2. **Mantenha cadastro de clientes atualizado**
   - CNPJ correto
   - Nome completo correto
   - Facilita identificação automática

3. **Revise pendências rapidamente**
   - Não deixe acumular transações não identificadas
   - Quanto antes revisar, mais fácil lembrar

4. **Use o relatório Excel para casos difíceis**
   - Se o OFX não trouxe CNPJ
   - Se descrição está truncada
   - Relatório do banco geralmente tem mais detalhes

### Casos Especiais

**Pagamento Parcial:**
- Sistema pode detectar automaticamente
- Sugerirá match com desconto
- Você confirma o valor parcial

**Múltiplas Faturas de Um Cliente:**
- Sistema agrupa por CNPJ
- Mostra todas as faturas pendentes (2025 + saldo abertura 2024)
- Você escolhe qual(is) aplicar o pagamento
- **Prioridade sugerida:** Competências mais antigas primeiro

**Cliente Pagou Errado:**
- Valor diferente do faturado
- Sistema destaca a diferença
- Você decide: aceitar, ajustar ou rejeitar

**Pagamento de Competência Anterior (2024):**
```
Exemplo: Cliente pagou R$ 1.500 em 15/01/2025

Sistema mostra opções:
1. ✅ Saldo Abertura - 01/2024 - R$ 1.500 (mais antiga)
2. ⚠️ Saldo Abertura - 03/2024 - R$ 1.500
3. ⚠️ Saldo Abertura - 08/2024 - R$ 1.500
4. ⚠️ Fatura Janeiro/2025 - R$ 1.500 (ainda não venceu)

Você seleciona a opção 1 (01/2024)
Sistema dá baixa na competência de Janeiro/2024
Saldo de abertura do cliente diminui R$ 1.500
```

**Cliente Pagou Múltiplas Competências de Uma Vez:**
```
Cliente pagou R$ 4.500 (3 competências juntas)

Sistema pode:
1. Detectar automaticamente se valor é múltiplo
2. Sugerir baixa proporcional
3. Ou você seleciona manualmente as 3 competências
4. Sistema dá baixa em todas de uma vez
```

**Importância de Manter Histórico Correto:**
- ✅ Saber exatamente quais meses o cliente está devendo
- ✅ Relatórios de inadimplência mais precisos
- ✅ Cobrança direcionada por competência
- ✅ Histórico completo para auditoria

---

### 🔧 COMANDOS ÚTEIS

### Consultar Saldo de Abertura

```sql
-- Ver saldo de abertura por cliente
SELECT 
  c.name as cliente,
  c.cnpj,
  c.opening_balance as saldo_total,
  COUNT(cob.*) as qtd_competencias,
  STRING_AGG(cob.competence, ', ' ORDER BY cob.competence) as competencias_pendentes
FROM clients c
LEFT JOIN client_opening_balance cob ON c.id = cob.client_id
WHERE c.opening_balance > 0
GROUP BY c.id, c.name, c.cnpj, c.opening_balance
ORDER BY c.opening_balance DESC;
```

```sql
-- Ver detalhes de um cliente específico
SELECT 
  competence,
  amount,
  due_date,
  status,
  paid_amount,
  paid_date,
  (amount - paid_amount) as saldo_pendente
FROM client_opening_balance
WHERE client_id = 'UUID_DO_CLIENTE'
ORDER BY competence;
```

```sql
-- Total de saldo de abertura no sistema
SELECT 
  COUNT(DISTINCT client_id) as total_clientes_com_divida,
  SUM(amount) as valor_total_original,
  SUM(paid_amount) as valor_ja_pago,
  SUM(amount - paid_amount) as saldo_pendente
FROM client_opening_balance
WHERE status != 'paid';
```

### Atualizar Saldo de Abertura

```sql
-- Marcar competência como paga
UPDATE client_opening_balance
SET 
  status = 'paid',
  paid_amount = amount,
  paid_date = '2025-01-15',
  updated_at = now()
WHERE client_id = 'UUID_DO_CLIENTE'
AND competence = '01/2024';
```

```sql
-- Pagamento parcial de uma competência
UPDATE client_opening_balance
SET 
  status = 'partial',
  paid_amount = paid_amount + 500.00,
  updated_at = now()
WHERE client_id = 'UUID_DO_CLIENTE'
AND competence = '03/2024';
```

```sql
-- Adicionar nova competência (se esqueceu alguma)
INSERT INTO client_opening_balance (client_id, competence, amount, due_date, description)
VALUES (
  (SELECT id FROM clients WHERE cnpj = '12.345.678/0001-90'),
  '11/2024',
  1500.00,
  '2024-12-10',
  'Honorários de Novembro/2024'
);
```

### Reimportar Extrato (Se Errou)
```sql
-- Deletar importação específica
DELETE FROM bank_transactions 
WHERE imported_from = 'ofx' 
AND created_at > '2025-11-27'
AND bank_account_id = 'ID_DA_CONTA_SICREDI';
```

### Ver Taxa de Conciliação
```sql
SELECT 
  COUNT(*) FILTER (WHERE matched = true) * 100.0 / COUNT(*) as taxa_conciliacao,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE matched = true) as conciliados,
  COUNT(*) FILTER (WHERE matched = false) as pendentes
FROM bank_transactions
WHERE transaction_date >= '2025-11-01'
AND bank_account_id = 'ID_DA_CONTA_SICREDI';
```

### Listar Não Conciliados
```sql
SELECT 
  transaction_date,
  description,
  amount,
  matched,
  created_at
FROM bank_transactions
WHERE matched = false
AND bank_account_id = 'ID_DA_CONTA_SICREDI'
ORDER BY transaction_date DESC;
```

### Buscar Fatura ou Saldo de Abertura por Valor
```sql
-- Buscar em faturas normais (2025 em diante)
SELECT 
  'FATURA' as tipo,
  i.id,
  c.name as cliente,
  i.amount,
  i.due_date,
  i.status,
  i.competence
FROM invoices i
JOIN clients c ON i.client_id = c.id
WHERE i.status = 'pending'
AND ABS(i.amount - 1500.00) < 0.50
ORDER BY i.due_date DESC;

-- Buscar em saldo de abertura (2024)
SELECT 
  'SALDO_ABERTURA' as tipo,
  cob.id,
  c.name as cliente,
  cob.amount,
  cob.due_date,
  cob.status,
  cob.competence
FROM client_opening_balance cob
JOIN clients c ON cob.client_id = c.id
WHERE cob.status = 'pending'
AND ABS(cob.amount - 1500.00) < 0.50
ORDER BY cob.due_date DESC;

-- Buscar em ambos (UNION)
SELECT * FROM (
  SELECT 
    'FATURA_2025' as tipo,
    i.id,
    c.name as cliente,
    i.amount,
    i.due_date,
    i.status,
    i.competence
  FROM invoices i
  JOIN clients c ON i.client_id = c.id
  WHERE i.status = 'pending'
  AND ABS(i.amount - 1500.00) < 0.50
  
  UNION ALL
  
  SELECT 
    'SALDO_ABERTURA' as tipo,
    cob.id,
    c.name as cliente,
    cob.amount,
    cob.due_date,
    cob.status,
    cob.competence
  FROM client_opening_balance cob
  JOIN clients c ON cob.client_id = c.id
  WHERE cob.status = 'pending'
  AND ABS(cob.amount - 1500.00) < 0.50
) combined
ORDER BY due_date DESC;
```

### Buscar Fatura por Valor (Versão Antiga)
```sql
SELECT 
  i.id,
  c.name as cliente,
  i.amount,
  i.due_date,
  i.status
FROM invoices i
JOIN clients c ON i.client_id = c.id
WHERE i.status = 'pending'
AND ABS(i.amount - 1500.00) < 0.50  -- Busca valor próximo
ORDER BY i.due_date DESC;
```

---

## 📞 PRÓXIMOS PASSOS IMEDIATOS

### Esta Semana (Prioridade MÁXIMA) 🔥

**ANTES DE TUDO:**
1. 🔥 **Levantar saldo de abertura de todos os clientes**
2. 🔥 **Executar SQL para criar tabela `client_opening_balance`**
3. 🔥 **Importar/cadastrar todas as competências devidas de 2024**
4. 🔥 **Validar que saldos estão corretos**

**DEPOIS:**
1. ✅ Executar SQL para adicionar conta SICREDI
2. ✅ Baixar arquivo OFX de teste do Internet Banking
3. ✅ Testar importação via `/bank-import`
4. ✅ Fazer primeira conciliação manual (incluindo saldo abertura)
5. ✅ Avaliar taxa de match automático

### Semana que vem
1. ✅ Criar importador de Excel (se necessário)
2. ✅ Melhorar regras de matching
3. ✅ Treinar equipe no uso do sistema
4. ✅ Começar a usar em produção
5. ✅ Abandonar processo manual antigo 🎉

---

## 🎓 RECURSOS E REFERÊNCIAS

### Páginas do Sistema Já Disponíveis
- `/bank-import` - Importação de OFX/CSV
- `/bank-reconciliation` - Conciliação bancária
- `/bank-accounts` - Gestão de contas
- `/fees-analysis` - Análise de honorários
- `/executive-dashboard` - Dashboard executivo
- `/invoices` - Gestão de faturas
- `/clients` - Gestão de clientes

### Edge Functions Já Disponíveis
- `parse-ofx-statement` - Parser de OFX
- `auto-reconciliation` - Conciliação automática
- `process-boleto-report` - Processamento de boletos
- `create-accounting-entry` - Lançamentos contábeis

### Documentação
- `README.md` - Visão geral do sistema
- `AI_IMPLEMENTATION_GUIDE.md` - Guia técnico completo
- `STATUS_ATUAL_SISTEMA.md` - Status da implementação
- `ROADMAP.md` - Este arquivo (guia de implementação)

---

## ✅ CRITÉRIOS DE CONCLUSÃO

### MVP (Mínimo Viável) - Fase 2 Completa
- ✅ Conta SICREDI configurada
- ✅ Importação de OFX funcionando
- ✅ Auto-reconciliation com taxa > 70%
- ✅ Interface de revisão manual funcionando
- ✅ Pelo menos 1 mês de dados conciliados com sucesso

### Versão Completa - Fases 3-5 Completas
- ✅ Importador de Excel funcionando
- ✅ Taxa de conciliação automática > 80%
- ✅ Dashboard de importações
- ✅ Relatórios completos
- ✅ Equipe treinada e usando regularmente
- ✅ Processo antigo abandonado

### Excelência - Fase 6 Completa
- ✅ Importação automática agendada
- ✅ Notificações configuradas
- ✅ Taxa de conciliação > 90%
- ✅ Zero trabalho manual para casos padrão
- ✅ Apenas exceções precisam de intervenção

---

## 🏆 BENEFÍCIOS ESPERADOS

### Ganhos de Tempo
- **Economia mensal:** 8-12 horas
- **Redução de erros:** 90%
- **Visibilidade financeira:** Tempo real
- **Tomada de decisão:** Mais rápida e precisa

### Ganhos de Qualidade
- **Precisão:** > 99%
- **Rastreabilidade:** 100% (tudo registrado)
- **Auditabilidade:** Completa
- **Conformidade:** Automática

### Ganhos Estratégicos
- **Análises:** Disponíveis a qualquer momento
- **Projeções:** Mais precisas
- **Inadimplência:** Controle proativo
- **Fluxo de caixa:** Previsível

---

## 📝 ANOTAÇÕES E OBSERVAÇÕES

### Lições Aprendidas (Atualizar conforme uso)
```
Data: ___/___/___
Lição: _______________________
Ação: _______________________

Data: ___/___/___
Lição: _______________________
Ação: _______________________
```

### Casos Especiais (Documentar conforme surgem)
```
Cliente: _______________________
Situação: _______________________
Solução: _______________________

Cliente: _______________________
Situação: _______________________
Solução: _______________________
```

---

**Roadmap Criado por:** Claude (Anthropic)  
**Data de Criação:** 27 de novembro de 2025  
**Versão:** 2.0 (Adaptado para realidade da Ampla)  
**Status:** ✅ Pronto para execução

**Última Atualização:** ___/___/___  
**Atualizado por:** _______________________  
**Mudanças:** _______________________

---

## 🚦 STATUS ATUAL

- [x] Roadmap criado e revisado
- [ ] Fase 1: Sistema base (95% completo)
- [ ] **Fase 1.5: Saldo de Abertura (0% - FAZER PRIMEIRO!)** 🔥
- [ ] Fase 2: Configuração inicial (0%)
- [ ] Fase 3: Melhorias no importador (0%)
- [ ] Fase 4: Interface de conciliação (0%)
- [ ] Fase 5: Relatórios e análises (0%)
- [ ] Fase 6: Automações (0%)

**Próxima Ação:** Levantar e cadastrar saldo de abertura de 2024 🎯

**IMPORTANTE:** Não adianta configurar o sistema sem o saldo de abertura! Você precisa saber o que cada cliente deve de 2024 para poder fazer a conciliação corretamente a partir de janeiro/2025.

---

**Este é seu guia completo de implementação!**  
**Siga passo a passo e marque os checkboxes conforme avança.**  
**Boa implementação! 🚀**
