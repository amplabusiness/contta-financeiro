# MEMORY.md - Contexto e Memória do Sistema

## ARQUITETURA MULTI-TENANT (SaaS)

O sistema suporta múltiplos escritórios contábeis (tenants). Cada escritório é completamente isolado.

### Tabelas de Multi-Tenancy
- **accounting_office** - Cadastro dos escritórios contábeis
- **user_office_access** - Vínculo usuário-escritório com permissões

### Contextos Globais
1. **OfficeContext** - Escritório selecionado (tenant) + permissões do usuário
2. **PeriodContext** - Período de trabalho (mês único + intervalo para relatórios)
3. **ClientContext** - Cliente selecionado (filtro opcional)

### Header Global (Layout.tsx)
- **Seletor de Escritório** - Define o tenant ativo (só mostra escritórios com permissão)
- **Seletor de Período** - Define mês/ano de trabalho
- **Seletor de Cliente** - Filtro opcional por cliente

### Permissões por Escritório (user_office_access.role)
- **admin** - Acesso total ao escritório
- **manager** - Gerencia operações
- **user** - Operações básicas
- **viewer** - Apenas visualização

### PeriodContext - Dois Modos
1. **Período de Trabalho** (mês único): `selectedYear`, `selectedMonth`, `getCompetence()`
   - Para operações do dia-a-dia (lançamentos, despesas, etc.)
2. **Período de Intervalo** (range): `rangeStartYear/Month` até `rangeEndYear/Month`
   - Para relatórios contábeis (DRE, Balancete, Balanço)
   - Funções: `getRangeStartDate()`, `getRangeEndDate()`, `getFormattedRange()`

### Componentes de Período
- **PeriodRangeSelector** - Seletor de intervalo de datas (Jan/2025 até Dez/2025)

---

## AMPLA CONTABILIDADE LTDA
- **CNPJ:** 23.893.032/0001-69
- **Cidade:** Goiânia/GO
- **Regime:** Lucro Presumido
- **Fundador:** Dr. Sérgio Carneiro Leão

---

## BANCO DE DADOS - TABELAS PRINCIPAIS

### 1. CLIENTES (clients)
```sql
- id: UUID (PK)
- name: TEXT (razão social)
- nome_fantasia: TEXT
- cnpj: TEXT (apenas números)
- status: 'active' | 'inactive' | 'suspended'
- email, phone, address
- created_at, updated_at
```

### 2. FATURAS (invoices)
```sql
- id: UUID (PK)
- client_id: UUID (FK -> clients)
- amount: DECIMAL
- due_date: DATE
- status: 'pending' | 'paid' | 'overdue' | 'cancelled'
- paid_at: TIMESTAMP
- payment_method: TEXT
```

### 3. DESPESAS (expenses)
```sql
- id: UUID (PK)
- description: TEXT
- amount: DECIMAL
- expense_date: DATE
- category_id: UUID (FK)
- cost_center_id: UUID (FK)
- status: 'pending' | 'paid' | 'cancelled'
```

### 4. TRANSAÇÕES BANCÁRIAS (bank_transactions)
```sql
- id: UUID (PK)
- bank_account_id: UUID (FK)
- transaction_date: DATE
- amount: DECIMAL
- description: TEXT
- transaction_type: 'credit' | 'debit'
- status: 'pending' | 'reconciled' | 'ignored'
- fitid: TEXT (identificador único do banco)
```

### 5. LANÇAMENTOS CONTÁBEIS (accounting_entries)
```sql
- id: UUID (PK)
- entry_date: DATE
- competence_date: DATE
- description: TEXT
- entry_type: 'manual' | 'automatic' | 'recebimento' | 'pagamento' | 'saldo_abertura' | 'encerramento'
- status: 'draft' | 'posted' | 'cancelled'
- reference_type: TEXT (origem: 'expense', 'invoice', 'bank_transaction')
- reference_id: UUID
```

### 6. LINHAS DE LANÇAMENTO (accounting_entry_lines)
```sql
- id: UUID (PK)
- entry_id: UUID (FK -> accounting_entries)
- account_id: UUID (FK -> chart_of_accounts)
- debit: DECIMAL
- credit: DECIMAL
- description: TEXT
- cost_center_id: UUID (FK)
```

### 7. PLANO DE CONTAS (chart_of_accounts)
```sql
- id: UUID (PK)
- code: TEXT (ex: "1.1.1.05")
- name: TEXT
- type: 'ATIVO' | 'PASSIVO' | 'RECEITA' | 'DESPESA' | 'PATRIMONIO_LIQUIDO'
- nature: 'DEVEDORA' | 'CREDORA'
- is_synthetic: BOOLEAN (conta pai)
- is_analytical: BOOLEAN (conta que recebe lançamentos)
- is_active: BOOLEAN
```

### 8. CENTROS DE CUSTO (cost_centers)
```sql
- id: UUID (PK)
- code: TEXT
- name: TEXT
- type: 'departamento' | 'projeto' | 'socio' | 'empresa'
- is_active: BOOLEAN
```

### 9. PERÍODOS CONTÁBEIS (accounting_periods)
```sql
- id: UUID (PK)
- year: INTEGER
- month: INTEGER
- status: 'open' | 'closed' | 'locked'
- closed_at: TIMESTAMP
- notes: TEXT
```

---

## PLANO DE CONTAS - CÓDIGOS PRINCIPAIS

### ATIVO (1.x)
- **1.1.1.05** - Banco Sicredi (conta principal)
- **1.1.2.01** - Clientes a Receber (honorários)
- **1.1.3.01** - Adiantamento a Sócios - Sérgio Carneiro
- **1.1.3.02** - Adiantamento a Sócios - Victor Hugo
- **1.1.3.03** - Adiantamento a Sócios - Sérgio Augusto
- **1.1.3.05** - Adiantamento a Sócios - Nayara
- **1.2.1.01** - Investimento Ampla Saúde

### PASSIVO (2.x)
- **2.1.1.01** - Salários a Pagar
- **2.1.1.02** - FGTS a Recolher
- **2.1.1.03** - INSS a Recolher
- **2.1.4.01** - ISS a Recolher
- **2.1.4.02** - IRRF a Recolher

### RECEITAS (3.x)
- **3.1.1.01** - Receita de Honorários Contábeis
- **3.1.1.02** - Receita de Honorários Extras
- **3.1.1.03** - Receita de Legalização

### DESPESAS (4.x)
- **4.1.1.01** - Aluguel
- **4.1.1.02** - Energia Elétrica
- **4.1.1.03** - Água e Esgoto
- **4.1.1.04** - Internet e Telefone
- **4.1.2.01** - Salários
- **4.1.2.02** - FGTS
- **4.1.2.03** - INSS Patronal
- **4.1.3.01** - Material de Escritório
- **4.1.3.02** - Material de Limpeza
- **4.1.3.03** - Copa e Cozinha
- **4.1.4.01** - Tarifas Bancárias
- **4.1.5.01** - ISS
- **4.1.5.02** - IRPJ
- **4.1.5.03** - CSLL

### PATRIMÔNIO LÍQUIDO (5.x)
- **5.1.1.01** - Capital Social
- **5.1.1.02** - Resultado do Exercício

---

## FAMÍLIA LEÃO (SÓCIOS)

### Sérgio Carneiro Leão (Fundador)
- Contador e Advogado
- Centro de custo: SÉRGIO CARNEIRO
- Adiantamento: 1.1.3.01
- Despesas da casa = SEMPRE Adiantamento

### Carla Leão (Esposa)
- Sócia
- Centro de custo: SÉRGIO CARNEIRO
- Usa mesmo adiantamento do Sérgio

### Sérgio Augusto (Filho)
- Proprietário Ampla Saúde
- Centro de custo: SÉRGIO AUGUSTO
- Adiantamento: 1.1.3.03
- Faculdade de medicina = Adiantamento

### Victor Hugo (Filho)
- Legalização de empresas
- Centro de custo: VICTOR HUGO
- Adiantamento: 1.1.3.02

### Nayara (Filha)
- Administradora
- Centro de custo: NAYARA
- Adiantamento: 1.1.3.05
- Babá dos filhos = Adiantamento

---

## REGRAS DE CLASSIFICAÇÃO

### 1. Recebimento de Honorários
```
D: 1.1.1.05 (Banco Sicredi)
C: 1.1.2.01 (Clientes a Receber)
Centro de custo: Nome do cliente
```

### 2. Despesa Normal da Empresa
```
D: 4.x.x.xx (Conta de despesa apropriada)
C: 1.1.1.05 (Banco Sicredi)
Centro de custo: EMPRESA ou departamento
```

### 3. Despesa Pessoal de Sócio
```
D: 1.1.3.xx (Adiantamento do sócio)
C: 1.1.1.05 (Banco Sicredi)
Centro de custo: Nome do sócio
```
**IMPORTANTE:** Despesas pessoais NUNCA são despesa (4.x), sempre Adiantamento (1.1.3.x)

### 4. Folha de Pagamento
```
Provisionamento:
D: 4.1.2.01 (Salários)
C: 2.1.1.01 (Salários a Pagar)

Pagamento:
D: 2.1.1.01 (Salários a Pagar)
C: 1.1.1.05 (Banco)
```

---

## IDENTIFICAÇÃO DE CLIENTES NO EXTRATO

1. **Por CNPJ:** Buscar CNPJ na descrição do PIX/TED
2. **Por Nome:** Buscar nome do pagador no cadastro
3. **Por Valor:** Comparar valor exato com faturas em aberto
4. **Por Boleto:** Nosso Número identifica a fatura

---

## JANEIRO/2025 (Competência Fechada)

- **Saldo Banco Sicredi:** R$ 18.553,54
- **Clientes a Receber:** R$ 136.821,59
- **Total Débitos:** R$ 1.389.946,51
- **Total Créditos:** R$ 1.389.946,51
- **Diferença Partidas Dobradas:** R$ 0,00 ✓

---

## EDGE FUNCTIONS DISPONÍVEIS

1. **dr-cicero-brain** - Consulta contador IA com NBC
2. **ai-agent-orchestrator** - Orquestrador de agentes
3. **ai-web-search** - Busca na web (Serper.dev)
4. **ai-context-provider** - Contexto para agentes
5. **smart-accounting** - Geração automática de lançamentos
6. **ai-bank-transaction-processor** - Processamento de extrato
7. **ai-dev-agent** - Agente de desenvolvimento com acesso ao banco
8. **ai-dev-agent-secure** - Agente DevOps seguro (GitHub, Vercel, Gemini)
9. **process-boletos-csv** - Processa CSV de boletos liquidados
10. **process-extrato-csv** - Processa CSV de extrato bancário

---

## CONFIGURAÇÃO DE CREDENCIAIS (SECRETS)

Para habilitar acesso completo aos serviços externos, configure os secrets no Supabase:

```bash
# GitHub - Para commits, PRs, e gerenciamento de código
npx supabase secrets set GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Vercel - Para deployments e gerenciamento de projetos
npx supabase secrets set VERCEL_TOKEN=xxxxxxxxxxxxxxxxx

# Gemini - Para processamento de linguagem natural avançado
npx supabase secrets set GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxx

# Serper - Para buscas na web
npx supabase secrets set SERPER_API_KEY=xxxxxxxxxxxxxxxx
```

### Como obter os tokens:
- **GITHUB_TOKEN:** Vá em GitHub → Settings → Developer settings → Personal access tokens → Generate new token
  - Permissões necessárias: `repo`, `workflow`
- **VERCEL_TOKEN:** Vá em Vercel → Settings → Tokens → Create Token
- **GEMINI_API_KEY:** Vá em Google AI Studio → API Keys → Create API Key
- **SERPER_API_KEY:** Vá em serper.dev → Dashboard → API Key

---

## NORMAS CONTÁBEIS (NBC)

- **NBC TG 00** - Estrutura Conceitual
- **NBC TG 03** - Demonstração dos Fluxos de Caixa (DFC)
- **NBC TG 26** - Apresentação das Demonstrações Contábeis
- **NBC TG 51** - Nova norma (obrigatória a partir de 01/01/2027)

### Demonstrações Obrigatórias:
1. Balanço Patrimonial (BP)
2. Demonstração do Resultado (DRE)
3. Demonstração dos Fluxos de Caixa (DFC)
4. Demonstração das Mutações do PL (DMPL)
5. Notas Explicativas

---

## ARQUIVOS IMPORTANTES

### Código Fonte
- `src/pages/` - Páginas da aplicação
- `src/components/` - Componentes reutilizáveis
- `src/lib/` - Utilitários (csvParser, ofxParser)
- `src/integrations/supabase/` - Cliente Supabase

### Banco de Dados
- `supabase/migrations/` - Migrações SQL
- `supabase/functions/` - Edge Functions

### Configuração
- `.env` - Variáveis de ambiente
- `supabase/config.toml` - Configuração Supabase

---

## COMANDOS ÚTEIS

### Desenvolvimento Local
```bash
# Instalar dependências
npm install

# Rodar aplicação localmente (porta 5173)
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Verificar tipos TypeScript
npx tsc --noEmit

# Lint do código
npm run lint
```

### Supabase - Banco de Dados
```bash
# Login no Supabase
npx supabase login

# Vincular projeto
npx supabase link --project-ref xdtlhzysrpoinqtsglmr

# Aplicar migrações pendentes
npx supabase db push

# Criar nova migração
npx supabase migration new nome_da_migracao

# Ver status das migrações
npx supabase migration list

# Executar SQL diretamente
npx supabase db execute --file arquivo.sql
```

### Supabase - Edge Functions
```bash
# Deploy de função específica
npx supabase functions deploy nome-da-funcao

# Deploy de todas as funções
npx supabase functions deploy

# Testar função localmente
npx supabase functions serve nome-da-funcao

# Ver logs da função
npx supabase functions logs nome-da-funcao
```

### Supabase - Secrets (Credenciais)
```bash
# Configurar secret
npx supabase secrets set CHAVE=valor

# Listar secrets configurados
npx supabase secrets list

# Remover secret
npx supabase secrets unset CHAVE
```

### Git e Deploy
```bash
# Status do repositório
git status

# Adicionar alterações
git add .

# Commit
git commit -m "mensagem"

# Push para GitHub (dispara deploy automático na Vercel)
git push origin main

# Ver logs do Vercel
npx vercel logs
```

---

## PÁGINAS DA APLICAÇÃO

### Demonstrações Contábeis
- `/balance-sheet` - Balanço Patrimonial (BP)
- `/dre` - Demonstração do Resultado (DRE)
- `/cash-flow-statement` - Demonstração dos Fluxos de Caixa (DFC)
- `/period-closing` - Fechamento de Período

### Operacional
- `/accounting` - Lançamentos Contábeis
- `/expenses` - Despesas
- `/bank-import` - Importação Bancária
- `/clients` - Clientes
- `/invoices` - Faturas

### IA e Automação
- `/ai-workspace` - Workspace Autônomo (estilo VSCode/Claude Code)
- `/ai-chat` - Chat Interativo com Agentes
- `/ai-agents` - Dashboard de Agentes

---

## FLUXO DE DADOS (FONTE DA VERDADE)

```
Extrato Bancário (OFX) → Importar Extrato → Lançamentos Contábeis → Balancete → Telas
```

**IMPORTANTE:** A tabela `accounting_entries` é a FONTE DA VERDADE. Todas as telas devem consumir dados dos lançamentos contábeis, não de tabelas auxiliares.

- `bank_transactions` - Tabela LEGADA (não usar mais)
- `accounting_entries` + `accounting_entry_lines` - FONTE DA VERDADE
- `getAccountBalance()` em `src/lib/accountMapping.ts` - Função padrão para calcular saldos

---

## PÁGINA DE CLIENTES A RECEBER (DefaultAnalysis)

A página `/default-analysis` foi refatorada para usar a **FONTE DA VERDADE** (accounting_entries).

### Estrutura Contábil
- **Conta:** 1.1.2.01 (Clientes a Receber)
- **Natureza:** DEVEDORA
- **Fórmula:** Saldo Final = Saldo Inicial + Débitos - Créditos

### Funções Utilizadas (accountMapping.ts)
```typescript
// Busca saldo geral da conta
getAccountBalance(ACCOUNT_MAPPING.CONTAS_A_RECEBER, year, month)

// Busca saldos por cliente
getReceivablesByClient(year, month, clientId?)
```

### Dados Exibidos
- **Saldo Inicial:** Valores acumulados antes do período
- **Débitos:** Novas faturas emitidas no período
- **Créditos:** Recebimentos no período
- **Saldo Final:** Valor a receber

---

## GRUPOS ECONÔMICOS (GRUPOS FINANCEIROS)

### Conceito
Grupos econômicos são empresas relacionadas que possuem pagamento consolidado.
Quando uma empresa pagadora de um grupo realiza o pagamento, todas as faturas das
empresas do mesmo grupo para aquela competência são automaticamente marcadas como pagas.

### Tabelas do Banco de Dados

#### economic_groups
```sql
- id: UUID (PK)
- name: TEXT (nome do grupo)
- main_payer_client_id: UUID (FK -> clients, empresa pagadora)
- total_monthly_fee: DECIMAL (soma dos honorários do grupo)
- payment_day: INTEGER (dia de vencimento)
- is_active: BOOLEAN
- created_by: UUID
- created_at, updated_at: TIMESTAMPTZ
```

#### economic_group_members
```sql
- id: UUID (PK)
- economic_group_id: UUID (FK -> economic_groups)
- client_id: UUID (FK -> clients)
- individual_fee: DECIMAL (honorário individual da empresa)
- created_at: TIMESTAMPTZ
- UNIQUE(economic_group_id, client_id)
```

### Funções Disponíveis

1. **get_group_invoices_for_competence(client_id, competence)**
   - Retorna todas as faturas do grupo para uma competência

2. **is_in_economic_group(client_id)**
   - Verifica se cliente pertence a um grupo econômico

3. **get_economic_group_by_client(client_id)**
   - Retorna informações do grupo do cliente

### Página da Aplicação
- **URL:** `/economic-groups`
- **Funcionalidades:**
  - Listagem de grupos cadastrados
  - Criação manual de grupos
  - Importação via planilha Excel
  - Edição e exclusão de grupos
  - Auditoria e correção de grupos
  - Definição de empresa pagadora

### Regras de Negócio

1. **Pagamento Consolidado:**
   - O boleto é emitido apenas para a empresa pagadora
   - O valor é a soma de todos os honorários do grupo
   - Ao receber pagamento, todas as faturas do grupo são baixadas

2. **Dia de Vencimento:**
   - Configurável por grupo (dia 1 a 28)
   - Todas as empresas do grupo seguem o mesmo vencimento

3. **Honorário Individual:**
   - Cada empresa mantém seu honorário individual registrado
   - Usado para rateio contábil e relatórios

---

## CONTRATOS COM DEVEDORES SOLIDÁRIOS

### Cláusula de Devedores Solidários (Cláusula 13ª)
Os sócios da empresa contratante figuram como **devedores solidários** das obrigações contratuais, conforme:
- **Art. 264 CC** - Há solidariedade quando na mesma obrigação concorre mais de um credor/devedor
- **Art. 265 CC** - Solidariedade não se presume; resulta da lei ou vontade das partes
- **Art. 275 CC** - Credor pode exigir de um ou alguns dos devedores a dívida toda
- **Art. 827 CC** - Fiador que paga sub-roga-se nos direitos do credor

### Renúncia ao Benefício de Ordem
Os sócios renunciam expressamente ao benefício de ordem (Art. 827 CC), permitindo execução direta sem exigir primeiro do devedor principal.

### Justificativa de Data Posterior (Cláusula 1.5-1.6)
Contratos podem ser emitidos em data posterior ao início da prestação de serviços, ratificando relação contratual pré-existente.

---

## SISTEMA DE COBRANÇA VIA WHATSAPP

### Funcionalidade
- Botão "Notificar Cobrança" no menu de ações do contrato
- Busca automática de dívidas no Plano de Contas (1.1.2.01.xxx)
- Lista sócios como devedores solidários
- Prazo de 5 dias para negociação
- Ameaça de protesto e negativação

### Estrutura da Mensagem
```
NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA

Prezado(a) [CLIENTE],

Identificamos débito no valor de R$ X.XXX,XX referente aos honorários das competências [MESES].

PRAZO: 5 dias úteis para negociação.
Após o prazo: Execução do contrato + Protesto + Negativação (SPC/SERASA).

DEVEDORES SOLIDÁRIOS: [Lista de sócios com CPF]
(Art. 264-275 Código Civil)
```

---

## GRUPOS ECONÔMICOS POR SÓCIOS EM COMUM

### Conceito Atualizado
Grupos econômicos são identificados automaticamente quando empresas possuem **sócios em comum** (mesmo CPF).

### Tabela client_partners
```sql
- id: UUID (PK)
- client_id: UUID (FK -> clients)
- name: TEXT (nome do sócio)
- cpf: VARCHAR(14)
- partner_type: 'individual' | 'company' | 'administrator' | 'director'
- percentage: DECIMAL(5,2)
- is_administrator: BOOLEAN
```

### Script de Atualização via API CNPJA
```bash
node scripts/update_clients_cnpja.mjs
```
- Atualiza dados cadastrais (endereço, natureza jurídica, porte)
- Importa QSA (Quadro de Sócios e Administradores)
- Detecta grupos econômicos automaticamente

---

## AGENTES DE IA DISPONÍVEIS

### Agentes Especialistas (Supabase ai_agents)
| ID | Nome | Especialidade |
|----|------|---------------|
| cicero | Dr. Cícero | Contabilidade, NBC, CFC |
| advocato | Dr. Advocato | Direito do Trabalho, CLT |
| helena | Dra. Helena | Gestão de Processos |
| milton | Prof. Milton | Finanças |
| empresario | Sr. Empresário | Estruturação Societária |
| vendedor | Sr. Vendedor | Vendas Consultivas |
| marketing | Sra. Marketing | Marketing e Comunicação |
| atlas | Atlas | Machine Learning |

### Edge Functions de IA
| Função | Descrição |
|--------|-----------|
| dr-cicero-brain | Consulta contador IA com NBC |
| ai-agent-orchestrator | Orquestrador de agentes |
| ai-web-search | Busca na web (Serper.dev) |
| ai-context-provider | Contexto para agentes |
| ai-dev-agent | Agente de desenvolvimento |
| ai-dev-agent-secure | Agente DevOps seguro |
| process-boletos-csv | Processa CSV de boletos |
| process-extrato-csv | Processa CSV de extrato |

---

## PÁGINAS NOVAS

| Página | URL | Descrição |
|--------|-----|-----------|
| AIChat | /ai-chat | Chat interativo com agentes |
| AIWorkspace | /ai-workspace | Workspace autônomo estilo VSCode |
| CashFlowStatement | /cash-flow-statement | DFC (Demonstração Fluxos de Caixa) |
| PeriodClosing | /period-closing | Fechamento de período contábil |
| CodeEditor | /code-editor | Editor de código integrado |

---

## MIGRATIONS JANEIRO/2025

### Classificação de Despesas
- `20251230xxx` - Série de ~50 migrations para classificação correta de despesas
- Separação de: DP CLT vs Terceiros, Tarifas Bancárias, Copa/Cozinha, Impostos
- Correção de lançamentos incorretos (FGTS, IPTU, ISS, IPVA)

### Estrutura Contábil
- `20251231xxx` - Série de ~30 migrations para estrutura contábil
- Saldo de abertura de Clientes a Receber
- Sistema de código interno para proteção contra duplicatas
- Lançamentos automáticos de extrato bancário
- Fechamento de Janeiro/2025

### Grupos Econômicos
- `20251231500000` - Fix RLS para economic_groups
- `20251231540000` - Atualização de grupos por sócios em comum

---

## ÚLTIMA ATUALIZAÇÃO
- **Data:** 31/12/2024
- **Por:** Claude Code + Dr. Cícero
- **Versão:** 3.4
- **Alterações:**
  - Contratos com Devedores Solidários (Art. 264-275, 827 CC)
  - Sistema de cobrança via WhatsApp com prazo de 5 dias
  - Justificativa de data posterior em contratos
  - DebtConfession usando Plano de Contas como fonte da verdade
  - Grupos Econômicos por sócios em comum (client_partners)
  - 80+ migrations para classificação Jan/2025
  - Novas páginas: AIChat, AIWorkspace, CashFlowStatement, PeriodClosing
  - Edge functions para IA e processamento de CSV
  - Script update_clients_cnpja.mjs para atualização via API
