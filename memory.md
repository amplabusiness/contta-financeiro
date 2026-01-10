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

## REGRA GERAL DO FLUXO CONTÁBIL (Dr. Cícero)

### TODO lançamento DEVE iniciar no Plano de Contas - SEM EXCEÇÃO

```
PLANO DE CONTAS → LIVRO DIÁRIO → LIVRO RAZÃO → BALANCETE → DRE → BALANÇO PATRIMONIAL
```

| Ordem | Etapa | Descrição | Tabela/Origem |
|-------|-------|-----------|---------------|
| 1 | **PLANO DE CONTAS** | Fonte da verdade. Todo lançamento inicia aqui. | `chart_of_accounts` |
| 2 | **LIVRO DIÁRIO** | Registro cronológico de todos os lançamentos | `accounting_entries` + `accounting_entry_lines` |
| 3 | **LIVRO RAZÃO** | Movimentação por conta contábil | Derivado do Diário |
| 4 | **BALANCETE** | Saldos de todas as contas no período | Derivado do Razão |
| 5 | **DRE** | Receitas - Despesas (grupos 3 e 4) | Derivado do Balancete |
| 6 | **BALANÇO PATRIMONIAL** | Ativo = Passivo + PL (grupos 1, 2 e 5) | Derivado do Balancete + DRE |

### Princípio Fundamental

O **PLANO DE CONTAS** é a **FONTE DA VERDADE** de toda a aplicação.

- Nenhum lançamento pode existir sem estar vinculado a uma conta do plano
- **TODAS as telas e relatórios DEVEM buscar dados a partir do Plano de Contas**
- Os lançamentos contábeis (accounting_entries + accounting_entry_lines) estão vinculados ao plano
- Este fluxo é **INVIOLÁVEL** e segue as NBC TG 26 e ITG 2000

### Validações Obrigatórias

1. Não permitir lançamento sem `account_id` válido
2. Não permitir conta sem código estruturado (ex: 1.1.1.01)
3. Débitos SEMPRE devem igualar Créditos (partidas dobradas)
4. Contas sintéticas NÃO recebem lançamentos diretos

---

## REGRA FUNDAMENTAL - DR. CÍCERO

### OBRIGATÓRIO: Consultar Dr. Cícero para Questões Contábeis

**NENHUMA questão contábil pode ser resolvida sem consultar o Dr. Cícero.**

O Dr. Cícero é o agente especialista em contabilidade, NBC e CFC. Ele deve ser consultado para:

1. **Classificação de Contas** - Onde lançar cada operação
2. **Saldo de Abertura** - Contrapartidas corretas (PL, não Resultado)
3. **Lançamentos Contábeis** - Débito/Crédito corretos
4. **Fechamento de Período** - Apuração de resultado
5. **Demonstrações Contábeis** - BP, DRE, DFC, DMPL
6. **Regime de Competência** - Reconhecimento de receitas/despesas
7. **Partidas Dobradas** - Verificação de equilíbrio
8. **Correções Contábeis** - Estornos e reclassificações

### Como Consultar
```javascript
// Via Edge Function
const response = await supabase.functions.invoke('dr-cicero-brain', {
  body: { question: 'Qual a contrapartida correta para saldo de abertura de ativo?' }
});

// Via Script de Verificação
// Criar arquivo temp_consulta_dr_cicero_ASSUNTO.mjs
// Incluir análise fundamentada nas NBC TG
```

### Fundamentação Legal do Dr. Cícero
- NBC TG 00 - Estrutura Conceitual
- NBC TG 26 - Apresentação das Demonstrações Contábeis
- ITG 2000 - Escrituração Contábil
- Código Civil - Art. 264-275 (Solidariedade), Art. 827 (Fiança)

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

## CORREÇÃO CONCLUÍDA - SALDO DE ABERTURA (Dr. Cícero) ✅

**Status:** CONCLUÍDO em 01/01/2025

### Problema Identificado (RESOLVIDO)
As contas de saldo de abertura estavam **incorretamente** no grupo 5 (Resultado):

| Conta Atual | Nome | Problema |
|-------------|------|----------|
| 5.2.1.02 | Saldos de Abertura | Grupo 5 = Resultado |
| 5.3.02.01 | Saldo de Abertura - Disponibilidades | Grupo 5 = Resultado |
| 5.3.02.02 | Saldo de Abertura - Clientes | Grupo 5 = Resultado |

### Impacto
- **Total em contas 5.3.xx:** R$ 479.977,45
- Este valor está **inflando o resultado** no DRE
- O Patrimônio Líquido está **subestimado**

### Correção Necessária (NBC TG 26)

**INCORRETO (atual):**
```
D: 1.1.2.01 Clientes a Receber     R$ 298.527,29
C: 5.3.02.02 Saldo de Abertura     R$ 298.527,29  ← RESULTADO!
```

**CORRETO:**
```
D: 1.1.2.01 Clientes a Receber     R$ 298.527,29
C: 2.3.01 Lucros/Prejuízos Acum.   R$ 298.527,29  ← PATRIMÔNIO LÍQUIDO
```

### Ação Executada ✅
1. ✅ Criadas contas 2.3.xx (Patrimônio Líquido)
2. ✅ Reclassificadas 87 linhas de 5.x para 2.3.xx
3. ✅ Contas antigas (5.2.1.02, 5.3.02.01, 5.3.02.02, 5.3.02.03) desativadas
4. ✅ DRE verificado: Resultado Janeiro/2025 = Lucro R$ 2.474,28

---

## INADIMPLÊNCIA CLIENTES (Janeiro/2025)

| Descrição | Valor |
|-----------|-------|
| Saldo de Abertura (31/12/2024) | R$ 298.527,29 |
| Recebimentos em Janeiro | R$ 298.527,29 |
| **Inadimplência Real** | **R$ 0,00** |

**Nota:** Todo o saldo anterior foi quitado em janeiro/2025.
Os R$ 136.821,59 de honorários de janeiro vencem em fevereiro.

---

## AUDITORIA DR. CÍCERO - PLANO DE CONTAS (01/01/2025)

### Regra Suprema
> **TODO lançamento DEVE ter DÉBITO e CRÉDITO com número da conta do Plano de Contas**

### Páginas Corrigidas (usam useAccounting)
| Página | Hook Usado | Status |
|--------|------------|--------|
| PixReconciliation.tsx | `registrarRecebimento()` | ✅ Corrigido |
| ImportInvoices.tsx | `registrarHonorario()`, `registrarRecebimento()` | ✅ Corrigido |
| RecurringExpenses.tsx | `registrarDespesa()` | ✅ Corrigido |
| NFSe.tsx | `registrarHonorario()`, `registrarDespesa()` | ✅ Corrigido |

### Páginas Corretas (já usavam useAccounting)
- Invoices.tsx
- Payroll.tsx
- BankImport.tsx
- ImportBoletos.tsx
- ReconcileHonorarios.tsx
- PendingReconciliations.tsx
- HonorariosFlow.tsx
- ClientOpeningBalance.tsx

### Páginas Corrigidas (01/01/2025)
- CashFlow.tsx - Transações manuais com lançamento D/C
- DebtNegotiation.tsx - Negociações com desconto registram perdas
- OpeningBalanceReconciliation.tsx - Conciliação com registrarRecebimento()

---

## SISTEMA DE RASTREABILIDADE INTERNO (Dr. Cícero)

### Regra Suprema de Rastreabilidade

> **NENHUM lançamento pode existir sem número de origem interna**

Todo lançamento contábil DEVE ter:
1. **referenceType** - Tipo de origem (invoice, expense, bank_transaction, etc)
2. **referenceId** - ID único do registro de origem
3. **internal_code** - Código automático gerado pelo banco (trigger)

### Formato do internal_code
```
{source_type}:{YYYYMMDD}:{hash_12_chars}
```
Exemplo: `invoice:20250115:a1b2c3d4e5f6`

### Implementação

#### AccountingService.ts
```typescript
// Validação OBRIGATÓRIA de rastreabilidade
if (!params.referenceType) {
  return { success: false, error: 'VIOLAÇÃO CONTÁBIL: Todo lançamento DEVE ter referenceType' };
}
if (!params.referenceId) {
  return { success: false, error: 'VIOLAÇÃO CONTÁBIL: Todo lançamento DEVE ter referenceId' };
}
```

#### useAccounting Hook
```typescript
// Usar com sourceModule para identificar página de origem
const { registrarHonorario } = useAccounting({
  showToasts: false,
  sourceModule: 'Invoices'  // Nome da página que gera o lançamento
});
```

### Páginas com Rastreabilidade Implementada
| Página | sourceModule |
|--------|--------------|
| PixReconciliation.tsx | 'PixReconciliation' |
| ImportInvoices.tsx | 'ImportInvoices' |
| RecurringExpenses.tsx | 'RecurringExpenses' |
| NFSe.tsx | 'NFSe' |
| Invoices.tsx | 'Invoices' |
| HonorariosFlow.tsx | 'HonorariosFlow' |
| ClientOpeningBalance.tsx | 'ClientOpeningBalance' |
| ReconcileHonorarios.tsx | 'ReconcileHonorarios' |
| CashFlow.tsx | 'CashFlow' |
| DebtNegotiation.tsx | 'DebtNegotiation' |
| OpeningBalanceReconciliation.tsx | 'OpeningBalanceReconciliation' |

### Tabela accounting_entries - Colunas de Rastreabilidade
```sql
- internal_code: VARCHAR(100) UNIQUE  -- Código único gerado automaticamente
- source_type: VARCHAR(50)            -- Tipo de origem (invoice, expense, etc)
- source_id: UUID                     -- ID do registro de origem
- source_hash: VARCHAR(64)            -- Hash para detecção de duplicatas
- reference_type: TEXT                -- Tabela de origem
- reference_id: UUID                  -- ID do registro original
```

### Trigger Automático (banco de dados)
```sql
-- Trigger tr_set_internal_code gera automaticamente o internal_code
-- baseado em source_type, entry_date e hash do valor
CREATE TRIGGER tr_set_internal_code
    BEFORE INSERT ON accounting_entries
    FOR EACH ROW
    EXECUTE FUNCTION set_internal_code();
```

---

## AUDITORIA DR. CÍCERO - RASTREABILIDADE (01/01/2026) ✅

### Resultado da Auditoria
```
📊 SITUAÇÃO FINAL:
   Total de lançamentos:   380
   ✅ Com internal_code:   380 (100%)
   ✅ Com reference_type:  380 (100%)
   ✅ Com reference_id:    380 (100%)

✅ AUDITORIA APROVADA!
   Todos os lançamentos estão em conformidade com NBC TG 26 e ITG 2000.
```

### Scripts de Correção Executados
1. `scripts/audit_internal_code.mjs` - Auditoria completa de rastreabilidade
2. `scripts/fix_internal_code.mjs` - Correção de 86 lançamentos sem internal_code
3. `scripts/fix_reference_final3.mjs` - Correção de 152 lançamentos sem reference_type e 183 sem reference_id

### Descoberta: Sistema de Proteção de Período Fechado
O sistema possui **DOIS** mecanismos de controle de período:
1. `monthly_closings` - Controla fechamento via `is_period_closed()`
2. `accounting_periods` - Controla via trigger `check_period_before_entry_trigger`

**AMBOS** precisam estar com status 'open' para permitir modificações em lançamentos.

---

## AUDITORIA BALANÇO PATRIMONIAL - JANEIRO/2025 ✅

### Resultado Final (01/01/2026)

| Item | Valor |
|------|-------|
| **ATIVO** | R$ 391.726,63 |
| **PASSIVO** | R$ 0,00 |
| **PL (Saldos de Abertura)** | R$ 389.252,35 |
| **RESULTADO DO EXERCÍCIO** | R$ 2.474,28 |
| **PASSIVO + PL + RESULTADO** | R$ 391.726,63 |
| **DIFERENÇA** | **R$ 0,00** ✅ |

### Composição do Ativo
- Banco Sicredi: R$ 18.553,54
- Clientes a Receber: R$ 136.821,59
- Adiantamentos a Sócios: R$ 236.351,50

### Composição do PL
- Saldo de Abertura Disponibilidades: R$ 90.725,06
- Saldo de Abertura Clientes: R$ 298.527,29

### Resultado do Exercício
- Receitas (Honorários): R$ 136.821,59
- Despesas: R$ 134.347,31
- **Lucro: R$ 2.474,28**

### Problemas Corrigidos
1. ✅ **Saldo fantasma Bradesco R$ 90.725,10** - Deletado lançamento duplicado
2. ✅ **Contas filhas duplicadas 1.1.2.01.xxx** - 84 entradas removidas, 116 contas desativadas
3. ✅ **Conta inativa 4.1.2.10 com saldo R$ 1.127,59** - Reclassificada para 4.1.2.99

### Scripts de Auditoria Criados
- `scripts/audit_bradesco.mjs` - Detectar duplicatas no Bradesco
- `scripts/fix_bradesco_duplicate.mjs` - Corrigir duplicata Bradesco
- `scripts/audit_balance_sheet.mjs` - Auditar balanço patrimonial
- `scripts/fix_account_types.mjs` - Corrigir tipos de contas
- `scripts/fix_clients_structure.mjs` - Corrigir estrutura de clientes
- `scripts/check_balance_equation.mjs` - Verificar equação contábil
- `scripts/compare_opening_balance.mjs` - Comparar saldo de abertura

---

## SISTEMA DE COMISSÕES - VICTOR E NAYARA (10/01/2026)

### Agentes Comissionados
Os filhos Victor Hugo e Nayara Cristina recebem comissões sobre honorários de clientes específicos.

### Tabelas do Banco de Dados
```sql
-- Agentes que recebem comissões
commission_agents (
  id, name, cpf, pix_key, pix_key_type, is_active
)

-- Vínculo cliente-agente
client_commission_agents (
  client_id, agent_id, percentage, is_active
)

-- Registro de comissões
agent_commissions (
  agent_id, client_id, source_type, source_description,
  client_payment_amount, agent_percentage, commission_amount,
  competence, payment_date, status, paid_date
)
```

### Agentes Cadastrados
| Nome | CPF | PIX |
|------|-----|-----|
| VICTOR HUGO LEÃO | 752.126.331-68 | 75212633168 |
| NAYARA CRISTINA LEÃO | 037.887.511-69 | 03788751169 |

### Clientes Vinculados (50% Victor + 50% Nayara)
- AMAGU FESTAS
- AÇAÍ DO MADRUGA
- SHARKSPACE
- CARRO DE OURO / OURO CAR
- STAR EMPÓRIO DE BEBIDAS
- JOHNANTHAN MACHADO

### Página
- `/agent-commissions` - Dashboard de comissões (AgentCommissions.tsx)

---

## DASHBOARD DE INADIMPLÊNCIA (10/01/2026)

### Página
- `/inadimplencia-dashboard` - Controle completo de inadimplência (InadimplenciaDashboard.tsx)

### Funcionalidades
1. **Cards de Resumo:**
   - Boletos Gerados (competência)
   - Valor Recebido
   - Inadimplência (R$ e %)
   - Clientes Inadimplentes

2. **Gráficos:**
   - Evolução Mensal (12 meses) - BarChart
   - Distribuição por Faixa de Valor - PieChart

3. **Tabela de Inadimplentes:**
   - Busca por nome
   - Filtro por severidade (Crítico, Alto, Médio, Baixo)
   - Badge de severidade
   - Export CSV

4. **Modal Ficha do Cliente (ao clicar):**
   - Dados cadastrais
   - Resumo financeiro (saldo anterior, gerado, recebido, saldo devedor)
   - Competências em aberto
   - Razão analítico com saldo acumulado
   - Histórico de pagamentos

### Fonte de Dados
- `invoices` - Boletos gerados (competência MM/YYYY)
- `boleto_payments` - Pagamentos liquidados (data_liquidacao)
- `clients` - Dados dos clientes

---

## TABELA BOLETO_PAYMENTS (09/01/2026)

### Estrutura
```sql
boleto_payments (
  id UUID PRIMARY KEY,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  client_id UUID REFERENCES clients(id),
  invoice_id UUID REFERENCES invoices(id),
  cob VARCHAR(20),           -- Código da carteira (COB000001)
  nosso_numero VARCHAR(50),  -- Nosso número do boleto
  data_vencimento DATE,
  data_liquidacao DATE,      -- Data que foi pago
  data_extrato DATE,
  valor_original DECIMAL(15,2),
  valor_liquidado DECIMAL(15,2),
  juros DECIMAL(15,2),
  multa DECIMAL(15,2),
  desconto DECIMAL(15,2)
)
```

### Dados Importados
- **1.096 registros** de baixas de boletos (Jan-Dez/2025)
- Match de 98.8% com clientes cadastrados
- Vinculação com bank_transactions via COB

---

## EDGE FUNCTIONS - AGENTES IA

### ai-collection-agent (Agente de Cobrança)
Edge function para cobrança automatizada via WhatsApp.

**Funcionalidades:**
- Consulta clientes inadimplentes
- Gera mensagem personalizada com lista de débitos
- Integração com API de WhatsApp
- Histórico de cobranças enviadas

**Invocar:**
```javascript
const { data } = await supabase.functions.invoke('ai-collection-agent', {
  body: { 
    action: 'check_delinquent',
    client_id: 'uuid-do-cliente'
  }
});
```

### MCP (Model Context Protocol) - Azure Integration

O sistema utiliza MCP para integração com Azure e outros serviços.

**Tools Disponíveis:**
- `azure_resources-query_azure_resource_graph` - Consulta recursos Azure
- `mcp_azure_mcp_documentation` - Documentação Microsoft/Azure
- `mcp_azure_mcp_deploy` - Deploy para Azure
- `mcp_azure_mcp_postgres` - Operações PostgreSQL
- `mcp_context7_get-library-docs` - Documentação de bibliotecas
- `mcp_copilot_conta_*` - Gerenciamento de containers

**Configuração MCP (VS Code):**
```json
{
  "mcpServers": {
    "azure": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-azure"]
    }
  }
}
```

---

## ÚLTIMA ATUALIZAÇÃO
- **Data:** 10/01/2026
- **Por:** Claude Code + Dr. Cícero
- **Versão:** 5.0
- **Alterações:**
  - **INADIMPLÊNCIA DASHBOARD**: Nova página `/inadimplencia-dashboard` com controle completo
  - **FICHA DO CLIENTE**: Modal com razão analítico, saldo anterior, competências devidas
  - **SISTEMA COMISSÕES**: Victor Hugo e Nayara com 50% cada sobre clientes vinculados
  - **TABELA boleto_payments**: 1.096 registros de baixas importados
  - **5 NOVOS CLIENTES**: Cadastrados via CNPJA API (RBC, THC, UPPER, VIVA, ABRIGO)
  - **MCP INTEGRATION**: Azure MCP tools configurados para deploy e gestão
  - **EDGE FUNCTION**: ai-collection-agent para cobrança automatizada
  - **OFX IMPORT**: Scripts para importar Jan/2025 a Jan/2026 (2.256 transações)
  - **AUDITORIA OFX**: 100% match entre OFX e banco de dados
  - **BALANÇO EQUILIBRADO**: ATIVO = PASSIVO + PL + RESULTADO (diferença R$ 0,00)
  - **AUDITORIA COMPLETA**: Detectados e corrigidos 3 problemas no balanço
  - **SCRIPTS DE AUDITORIA**: 7 novos scripts para verificação contábil
  - **CONTA INATIVA CORRIGIDA**: 4.1.2.10 reclassificada para 4.1.2.99
  - **AUDITORIA 100% APROVADA**: 380/380 lançamentos com rastreabilidade completa
  - **CORREÇÃO AUTOMÁTICA**: Scripts de auditoria e correção em `scripts/`
  - **DESCOBERTA**: Sistema duplo de proteção de período (monthly_closings + accounting_periods)
  - **AUDITORIA 100% COMPLETA**: Todas as páginas agora usam useAccounting() com lançamentos D/C
  - **NOVAS CORREÇÕES**: CashFlow.tsx, DebtNegotiation.tsx, OpeningBalanceReconciliation.tsx
  - **11 páginas** agora com rastreabilidade completa (sourceModule)
  - **RASTREABILIDADE OBRIGATÓRIA**: Todo lançamento DEVE ter origem rastreável (internal_code)
  - Regra fundamental: consultar Dr. Cícero para questões contábeis
  - Contratos com Devedores Solidários (Art. 264-275, 827 CC)
  - Sistema de cobrança via WhatsApp com prazo de 5 dias
  - Grupos Econômicos por sócios em comum (client_partners)
  - 80+ migrations para classificação Jan/2025
  - Edge functions para IA e processamento de CSV

---

## CORREÇÃO CONTABILIDADE & CLASSIFICAÇÃO V2 - 06/01/2026

### 1. Correção Lógica Contábil (Critico)
- Identificado erro na funcão create_entry_from_bank_transaction onde **Pagamentos** estavam sendo tratados como Recebimentos devido a validacao simplista apenas por saldo positivo (banco armazena sempre positivo).
- Nova lógica valida bank_transactions.transaction_type:
  - credit = Recebimento (Débito Banco, Crédito Cliente)
  - debit = Pagamento (Débito Despesa, Crédito Banco)

### 2. Classificação Inteligente - Econet
- Identificado que lançamentos 'ECONET' caiam na regra geral 'Outras Despesas'.
- Criada conta analítica: 4.1.2.16 - Assinaturas Econet
- Script atualizado para mapear automaticamente descrições contendo 'ECONET', 'REVISTA', 'PERIODICO' para esta conta.

### 3. Scripts de Manutenção
- force_full_refresh_fev2025_v2.sql: Script mestre que recriou a conta, atualizou a função e regenerou Fevereiro de 2025.
- check_econet.mjs: Validador de classificação específica.

### 4. Melhorias UX
- SuperConciliação agora persiste o Mês/Ano selecionado no navegador, evitando reset indesejado ao atualizar a página.

