# 🚀 Sistema de Honorários Contábeis - Super Ferramenta

[![React](https://img.shields.io/badge/React-18.3.1-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-green)](https://supabase.com/)
[![AI Powered](https://img.shields.io/badge/AI-Gemini%202.5-orange)](https://ai.google.dev/)

Sistema completo e profissional de gestão de honorários contábeis com integrações bancárias, Open Finance, inteligência artificial e automações avançadas.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológico](#-stack-tecnológico)
- [Instalação](#-instalação)
- [Integrações](#-integrações)
- [MCP Financeiro](#-mcp-financeiro)
- [AI Agents](#-ai-agents)
- [Componentes](#-componentes)
- [Edge Functions](#-edge-functions)
- [Banco de Dados](#-banco-de-dados)
- [Deploy](#-deploy)
- [Documentação](#-documentação)

---

## 🎯 Visão Geral

Sistema SaaS profissional para escritórios de contabilidade gerenciarem honorários de múltiplos clientes com tecnologia de ponta:

- 💳 **Integração Bancária Completa** (Banco Cora)
- 🏦 **Open Finance** (Pluggy) com importação automática
- 🤖 **4 AI Agents Avançados** (Google Gemini 2.5 Flash)
- 📧 **Notificações Multi-Canal** (Email, WhatsApp, SMS)
- 📊 **Analytics e BI** em tempo real
- 🔄 **Workflows Automatizados**
- 🔐 **Multi-tenant** com RBAC completo
- 📄 **Parsers de Arquivos** (OFX, CNAB, NFe)

---

## ✨ Funcionalidades

### 💰 Gestão de Honorários

- Geração automática de faturas mensais
- Cálculo flexível (fixo, percentual, multiplicador)
- Controle completo de vencimentos e pagamentos
- Régua de cobrança automática configurável
- Portal do cliente para autoatendimento

### 🏦 Integrações Bancárias

#### 🟢 Banco Cora
- OAuth 2.0 authentication
- Geração de boletos bancários
- PIX dinâmico com QR Code
- Webhook para confirmação automática de pagamentos
- Consulta de saldo e extrato em tempo real

#### 🔵 Open Finance (Pluggy)
- Conexão segura de contas bancárias
- Importação automática de transações (últimos 90 dias)
- Sincronização agendada
- Suporte a múltiplos bancos brasileiros
- Dashboard de contas conectadas

### 📄 Importação de Arquivos

| Formato | Descrição | Status |
|---------|-----------|--------|
| **OFX** | Extratos bancários | ✅ Implementado |
| **CNAB 240/400** | Retorno de boletos | ✅ Implementado |
| **XML NFe/NFSe** | Notas fiscais eletrônicas | ✅ Implementado |
| **CSV** | Importação genérica | 🚧 Em desenvolvimento |

### 🧰 Scripts de apoio

- `scripts/import_recurring_expenses.py`: lê a planilha `banco/Controle Despesas-1.xlsx` usando **pandas** e cadastra as despesas recorrentes diretamente na tabela `accounts_payable` via REST do Supabase. Requisitos mínimos: `pip install pandas openpyxl requests`.
  - Simular importação: `python scripts/import_recurring_expenses.py --dry-run`
  - Executar importação real (exemplo): `SUPABASE_SERVICE_ROLE_KEY=... python scripts/import_recurring_expenses.py --due-date 2025-12-10 --recurrence-day 12 --created-by <uuid>`
  - O script aceita parâmetros para aba (`--sheet`), frequência (`--frequency`) e lote (`--batch-size`).

### 🤖 Inteligência Artificial

4 AI Agents powered by **Google Gemini 2.5 Flash**:

1. **💬 Chatbot Inteligente**
   - Responde dúvidas sobre faturas e pagamentos
   - Contexto completo do cliente
   - Histórico de conversas

2. **📉 Preditor de Churn**
   - Score de risco (0-100)
   - Análise de padrões de pagamento
   - Recomendações de retenção
   - Previsão de data de cancelamento

3. **💵 Otimizador de Preços**
   - Sugere honorário ideal baseado em complexidade
   - Comparação com mercado
   - Identifica oportunidades de upsell
   - Análise de CNPJ enriquecido

4. **🛡️ Detector de Fraudes**
   - Score de fraude (0-100)
   - Detecção de padrões anômalos
   - Recomendações (aprovar/revisar/bloquear)
   - Red flags automáticos

### 📢 Notificações

- **Email** via SendGrid
- **WhatsApp** via Evolution API
- **SMS** via Twilio
- Templates customizáveis com variáveis
- Régua de cobrança (antes/no dia/após vencimento)
- Log completo de envios e entregas

---

## 🛠️ Stack Tecnológico

### Frontend
- React 18.3.1 + TypeScript 5.8.3
- Vite 5.4.19 (build ultra-rápido)
- TailwindCSS 3.4.17 + shadcn/ui
- React Query 5.83.0 (state management)
- React Hook Form + Zod (forms)
- Recharts (gráficos)
- Zustand (global state)

### Backend
- Supabase (BaaS)
- PostgreSQL (20+ tabelas)
- Deno Runtime (Edge Functions)
- JWT Authentication
- Row Level Security (RLS)

### Integrações
- **Banco Cora** - Banking API
- **Pluggy** - Open Finance
- **Lovable AI** - Google Gemini 2.5 Flash
- **SendGrid** - Email
- **Evolution API** - WhatsApp
- **Twilio** - SMS
- **Google Vision** - OCR (planejado)

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/your-repo/data-bling-sheets.git
cd data-bling-sheets
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# AI
LOVABLE_API_KEY=your-lovable-key

# Banco Cora
CORA_CLIENT_ID=your-client-id
CORA_CLIENT_SECRET=your-client-secret

# Pluggy
PLUGGY_CLIENT_ID=your-client-id
PLUGGY_CLIENT_SECRET=your-client-secret

# Notificações
SENDGRID_API_KEY=your-sendgrid-key
EVOLUTION_API_URL=https://your-evolution-instance.com
EVOLUTION_API_KEY=your-evolution-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Serper.dev (pesquisa Econet)
SERPER_API_KEY=your-serper-key
```

### 4. Execute as migrations

```bash
# Conecte ao Supabase e execute:
supabase/migrations/20250114000000_comprehensive_system_upgrade.sql
```

### 5. Deploy das Edge Functions

```bash
supabase functions deploy parse-ofx-statement
supabase functions deploy parse-cnab-file
supabase functions deploy cora-banking-service
supabase functions deploy pluggy-integration
supabase functions deploy notification-dispatcher
supabase functions deploy ai-chatbot
supabase functions deploy ai-churn-predictor
supabase functions deploy ai-pricing-optimizer
supabase functions deploy ai-fraud-detector
```

### 6. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:5173`

---

## 🔌 Integrações

### Banco Cora - Criar Cobrança

```typescript
const { data } = await supabase.functions.invoke('cora-banking-service', {
  body: {
    action: 'create_charge',
    data: { invoice_id: 'uuid' }
  }
})

// Retorna: boleto_url, pix_qrcode, pix_copy_paste, payment_link
```

### Pluggy - Conectar Banco

```typescript
// 1. Obter token de conexão
const { data } = await supabase.functions.invoke('pluggy-integration', {
  body: { action: 'create_connect_token' }
})

// 2. Abrir Pluggy Widget com o token
// 3. Sincronizar transações
const { data } = await supabase.functions.invoke('pluggy-integration', {
  body: {
    action: 'sync_transactions',
    data: { item_id, account_id }
  }
})
```

### Enviar Notificações

```typescript
await supabase.functions.invoke('notification-dispatcher', {
  body: {
    event: 'invoice_overdue',
    client_id: 'uuid',
    invoice_id: 'uuid',
    channels: ['email', 'whatsapp']
  }
})
```

---

## 🔧 MCP Financeiro

Este projeto inclui o MCP Financeiro para expor dados e regras contábeis via Model Context Protocol.

### Ferramentas de Conhecimento
- `consultar_conhecimento` - Base interna (contábil, fiscal, DP, auditoria, NFSe, PIX, Ampla)
- `pesquisar_econet_contabil` - Pesquisa regras contábeis na Econet Editora via Serper.dev

### Variáveis de ambiente MCP
```env
# Serper.dev (pesquisa em econeteditora.com.br)
SERPER_API_KEY=your-serper-key
```

---

## 🤖 AI Agents

### Chatbot

```typescript
const { data } = await supabase.functions.invoke('ai-chatbot', {
  body: {
    client_id: 'uuid',
    message: 'Quando vence minha fatura?',
    conversation_history: []
  }
})
```

### Churn Predictor

```typescript
const { data } = await supabase.functions.invoke('ai-churn-predictor', {
  body: { client_id: 'uuid' }
})

// Retorna: churn_risk_score, risk_level, main_reasons, recommendations
```

### Pricing Optimizer

```typescript
const { data } = await supabase.functions.invoke('ai-pricing-optimizer', {
  body: { client_id: 'uuid' }
})

// Retorna: suggested_fee, min_fee, max_fee, upsell_opportunities
```

### Fraud Detector

```typescript
const { data } = await supabase.functions.invoke('ai-fraud-detector', {
  body: {
    transaction_id: 'uuid',
    client_id: 'uuid'
  }
})

// Retorna: fraud_score, recommendation, red_flags
```

---

## ⚛️ Componentes

### FileImporter

Importação de OFX, CNAB, NFe com drag & drop.

```tsx
import { FileImporter } from '@/components/FileImporter'

<FileImporter />
```

### CoraChargeManager

Gerar boletos e PIX via Banco Cora.

```tsx
import { CoraChargeManager } from '@/components/CoraChargeManager'

<CoraChargeManager invoice={invoice} />
```

### AIAgentPanel

Interface completa para AI Agents.

```tsx
import { AIAgentPanel } from '@/components/AIAgentPanel'

<AIAgentPanel clientId={id} transactionId={txId} />
```

### PluggyConnect

Conectar contas bancárias via Open Finance.

```tsx
import { PluggyConnect } from '@/components/PluggyConnect'

<PluggyConnect clientId={id} onConnected={() => {}} />
```

---

## 📦 Edge Functions

| Function | Input | Output |
|----------|-------|--------|
| `parse-ofx-statement` | `ofx_content` | Transactions imported |
| `parse-cnab-file` | `cnab_content` | Invoices updated |
| `cora-banking-service` | `action, data` | Charge/Balance/Statement |
| `pluggy-integration` | `action, data` | Connect/Sync results |
| `notification-dispatcher` | `event, channels` | Sent notifications |
| `ai-chatbot` | `message, client_id` | Bot response |
| `ai-churn-predictor` | `client_id` | Churn analysis |
| `ai-pricing-optimizer` | `client_id` | Pricing recommendations |
| `ai-fraud-detector` | `transaction_id` | Fraud analysis |

---

## 🗄️ Banco de Dados

### 20+ Tabelas PostgreSQL

#### Core
- `clients` - Clientes com enrichment
- `invoices` - Faturas/Honorários
- `expenses` - Despesas
- `bank_transactions` - Transações bancárias
- `chart_of_accounts` - Plano de contas

#### Banking & Integrations
- `banking_credentials` (encrypted)
- `bank_accounts` - Contas Pluggy
- `documents` - Gestão de documentos

#### Notifications
- `message_templates`
- `notifications_log`
- `collection_rules`

#### AI & Automation
- `ai_agents`
- `ai_executions`
- `workflows`
- `workflow_executions`

#### Multi-tenant
- `organizations`
- `organization_users`
- `roles`
- `audit_logs`

---

## 🚀 Deploy

### Frontend

```bash
npm run build
vercel deploy
```

### Edge Functions

```bash
supabase functions deploy
```

### Database

```bash
supabase db push
```

---

## 📚 Documentação

- [AI Implementation Guide](./AI_IMPLEMENTATION_GUIDE.md) - Guia completo
- [Supabase Docs](https://supabase.com/docs)
- [Banco Cora API](https://developers.cora.com.br/)
- [Pluggy Docs](https://docs.pluggy.ai/)

---

## 📈 Roadmap

### ✅ Implementado
- [x] Banco Cora (boleto + PIX)
- [x] Open Finance (Pluggy)
- [x] Parsers (OFX, CNAB, NFe)
- [x] Notificações multi-canal
- [x] 4 AI Agents
- [x] Componentes React

### 🚧 Em Desenvolvimento
- [ ] Portal do Cliente
- [ ] OCR de documentos
- [ ] Workflow Builder UI
- [ ] Fluxo de caixa
- [ ] Mobile app

---

**Desenvolvido com ❤️ usando as melhores tecnologias**
