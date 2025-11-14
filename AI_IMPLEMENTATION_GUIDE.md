# 🤖 GUIA COMPLETO DE IMPLEMENTAÇÃO - SISTEMA DE HONORÁRIOS CONTÁBEIS
## Prompt de Treinamento para IA Desenvolvedora

---

## 📋 ÍNDICE

1. [Contexto da Aplicação](#contexto)
2. [Arquitetura Atual](#arquitetura-atual)
3. [Checklist de Implementação](#checklist)
4. [Integrações Específicas](#integracoes)
5. [Implementação Detalhada por Módulo](#modulos)
6. [MCP Servers e Ferramentas](#mcp-servers)
7. [Padrões e Boas Práticas](#padroes)
8. [Testes e Validação](#testes)

---

## 🎯 CONTEXTO DA APLICAÇÃO {#contexto}

### O que é este sistema?
Sistema SaaS de gestão de honorários contábeis para escritórios de contabilidade que gerenciam múltiplos clientes.

### Stack Tecnológico Atual
```yaml
Frontend:
  - React 18.3.1 + TypeScript 5.8.3
  - Vite 5.4.19 (build tool)
  - TailwindCSS 3.4.17 + shadcn-ui
  - React Query 5.83.0 (state management)
  - React Hook Form 7.61.1 + Zod 3.25.76
  - Recharts 3.4.1 (gráficos)
  - XLSX 0.18.5 (importação/exportação)

Backend:
  - Supabase (BaaS)
  - PostgreSQL (banco de dados)
  - Deno (Edge Functions)
  - Supabase Auth (JWT)
  - Supabase Storage (arquivos)

IA:
  - Lovable API (Google Gemini 2.5 Flash)
  - 4 AI Agents: Financial Analyst, Expense Classifier, PIX Reconciliation, Reconciliation Agent

Banco de Dados:
  - 11+ tabelas PostgreSQL
  - RLS (Row Level Security)
  - Foreign Keys e Indexes
```

### Estrutura de Diretórios
```
/src
├── pages/                    # 37 páginas
├── components/               # Componentes React
│   ├── ui/                  # shadcn-ui base
│   └── ...                  # Componentes de domínio
├── contexts/                 # Context API
├── hooks/                    # Custom hooks
├── integrations/supabase/    # Cliente Supabase
├── lib/                      # Utilitários
└── data/                     # Dados estáticos

/supabase
├── functions/                # 12 Edge Functions
└── migrations/               # Migrations SQL

/public                       # Assets estáticos
```

---

## 🏗️ ARQUITETURA ATUAL {#arquitetura-atual}

### Fluxo de Dados
```
┌─────────────────┐
│  React Frontend │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Supabase Client │◄──────┐
└────────┬────────┘       │
         │                │
         ▼                │
┌─────────────────┐       │
│  Supabase Cloud │       │
├─────────────────┤       │
│  - PostgreSQL   │       │
│  - Auth (JWT)   │       │
│  - Storage      │       │
│  - Realtime     │       │
│  - Edge Funcs   │───────┘
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  External APIs  │
│  - Lovable AI   │
│  - (faltando)   │
└─────────────────┘
```

### Tabelas Principais
```sql
-- Clientes
clients (id, name, cnpj, email, monthly_fee, payment_day, status)

-- Faturas/Honorários
invoices (id, client_id, amount, due_date, payment_date, status, competence)

-- Despesas
expenses (id, account_id, amount, due_date, payment_date, status)

-- Transações Bancárias
bank_transactions (id, amount, description, transaction_type, matched, matched_invoice_id)

-- Plano de Contas
chart_of_accounts (id, code, name, type, parent_id)

-- Tipos de Receita
revenue_types (id, name, calculation_type, value, percentage)

-- Razão do Cliente
client_ledger (id, client_id, invoice_id, debit, credit, balance)

-- Enriquecimento de Dados
client_enrichment (id, client_id, razao_social, cnpj_data, endereco, qsa)

-- Pagadores Alternativos
client_payers (id, client_id, name, document, relationship)
```

---

## ✅ CHECKLIST COMPLETA DE IMPLEMENTAÇÃO {#checklist}

### 🔴 FASE 1 - CRÍTICO (Semanas 1-4)

#### ✅ 1.1 Parsers de Arquivos Bancários e Fiscais

**Objetivo:** Permitir importação automática de extratos e documentos fiscais

**Checklist Técnico:**
```
□ Implementar OFX Parser
  □ Criar Edge Function: parse-ofx-statement
  □ Biblioteca: node-ofx-parser ou implementação manual
  □ Extrair: data, valor, descrição, tipo (crédito/débito)
  □ Validar estrutura XML OFX
  □ Mapear para table: bank_transactions
  □ Detectar duplicatas por bank_reference
  □ Testes com arquivos OFX reais

□ Implementar CNAB 240/400 Parser
  □ Criar Edge Function: parse-cnab-file
  □ Remessa (geração de boletos)
  □ Retorno (baixa de boletos pagos)
  □ Layouts: Banco do Brasil, Itaú, Bradesco, Caixa
  □ Validar checksum e campos obrigatórios
  □ Mapear retorno para: invoices.payment_date e status

□ Implementar XML NFe/NFSe Parser
  □ Criar Edge Function: import-nfe-xml
  □ Extrair: emitente, destinatário, itens, valores, impostos
  □ Validar assinatura digital
  □ Criar despesa automaticamente se destinatário = empresa
  □ Criar receita se emitente = empresa
  □ Armazenar XML em Supabase Storage

□ Implementar CSV Genérico
  □ Criar componente: GenericCSVImporter
  □ Mapeamento configurável de colunas
  □ Preview antes de importar
  □ Templates para bancos populares (Nubank, Inter, C6)

□ SPED Contábil
  □ Criar Edge Function: generate-sped-contabil
  □ Blocos: 0 (abertura), I (lançamentos), J (demonstrativos)
  □ Validar com PVA (Programa Validador SPED)
```

**Código Exemplo - OFX Parser:**
```typescript
// supabase/functions/parse-ofx-statement/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { ofx_content } = await req.json()

    // Parse OFX XML
    const transactions = parseOFX(ofx_content)

    // Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Insert transactions
    const { data, error } = await supabase
      .from('bank_transactions')
      .upsert(transactions, {
        onConflict: 'bank_reference',
        ignoreDuplicates: true
      })

    return new Response(JSON.stringify({
      imported: data?.length || 0
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

function parseOFX(content: string) {
  // Implementação do parser OFX
  // Extrair tags: <STMTTRN>, <DTPOSTED>, <TRNAMT>, <MEMO>
  const transactions = []

  // Regex para extrair transações
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
  let match

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const trn = match[1]

    const date = extractTag(trn, 'DTPOSTED')
    const amount = parseFloat(extractTag(trn, 'TRNAMT'))
    const memo = extractTag(trn, 'MEMO') || extractTag(trn, 'NAME')
    const fitid = extractTag(trn, 'FITID')

    transactions.push({
      bank_reference: fitid,
      transaction_date: formatOFXDate(date),
      amount: Math.abs(amount),
      description: memo,
      transaction_type: amount > 0 ? 'credit' : 'debit',
      matched: false,
      imported_from: 'ofx'
    })
  }

  return transactions
}

function extractTag(content: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]+)`)
  const match = content.match(regex)
  return match ? match[1].trim() : ''
}

function formatOFXDate(ofxDate: string): string {
  // 20250114 -> 2025-01-14
  const year = ofxDate.substring(0, 4)
  const month = ofxDate.substring(4, 6)
  const day = ofxDate.substring(6, 8)
  return `${year}-${month}-${day}`
}
```

---

#### ✅ 1.2 Integração Banco Cora (API Banking)

**Objetivo:** Conectar com Banco Cora para cobrança e movimentação financeira

**Checklist Técnico:**
```
□ Setup Conta Cora
  □ Criar conta PJ no Banco Cora
  □ Solicitar acesso à API
  □ Obter credenciais: client_id, client_secret, certificate
  □ Configurar webhook URL

□ Autenticação OAuth 2.0
  □ Implementar fluxo OAuth2 com certificado
  □ Armazenar tokens em tabela: banking_credentials
  □ Auto-refresh de access_token

□ Criar Edge Function: cora-banking-service
  □ Endpoints:
    - /balance (consultar saldo)
    - /statement (extrato)
    - /create-charge (criar cobrança)
    - /create-pix (gerar QR Code PIX)
    - /webhook-handler (receber notificações)

□ Tabela: banking_integrations
  □ Campos: id, bank_name, access_token, refresh_token, expires_at

□ Sincronização Automática
  □ Cron job diário: importar extrato Cora
  □ Webhook real-time: receber pagamentos
  □ Auto-conciliação com invoices

□ Features:
  □ Gerar boleto via Cora
  □ Gerar PIX dinâmico
  □ Consultar status de cobrança
  □ Receber webhook de pagamento
  □ Atualizar invoice automaticamente
```

**Código Exemplo - Integração Cora:**
```typescript
// supabase/functions/cora-banking-service/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORA_API_BASE = 'https://api.cora.com.br'

serve(async (req) => {
  const { action, data } = await req.json()

  switch (action) {
    case 'create_charge':
      return await createCharge(data)
    case 'get_balance':
      return await getBalance()
    case 'get_statement':
      return await getStatement(data.start_date, data.end_date)
    case 'webhook':
      return await handleWebhook(data)
    default:
      return new Response('Invalid action', { status: 400 })
  }
})

async function getAccessToken() {
  // OAuth2 com certificado
  const response = await fetch(`${CORA_API_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: Deno.env.get('CORA_CLIENT_ID')!,
      client_secret: Deno.env.get('CORA_CLIENT_SECRET')!
    })
  })

  const { access_token } = await response.json()
  return access_token
}

async function createCharge(invoiceData: any) {
  const token = await getAccessToken()

  // Criar cobrança (boleto ou PIX)
  const response = await fetch(`${CORA_API_BASE}/charges`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: invoiceData.amount * 100, // em centavos
      due_date: invoiceData.due_date,
      payer: {
        name: invoiceData.client_name,
        document: invoiceData.client_cnpj,
        email: invoiceData.client_email
      },
      payment_methods: ['boleto', 'pix'],
      description: `Honorários ${invoiceData.competence}`
    })
  })

  const charge = await response.json()

  // Salvar no banco
  const supabase = createClient(...)
  await supabase
    .from('invoices')
    .update({
      boleto_url: charge.boleto_url,
      pix_qrcode: charge.pix_qrcode,
      pix_copy_paste: charge.pix_emv,
      external_charge_id: charge.id
    })
    .eq('id', invoiceData.invoice_id)

  return new Response(JSON.stringify(charge), {
    headers: { 'Content-Type': 'application/json' }
  })
}

async function getStatement(startDate: string, endDate: string) {
  const token = await getAccessToken()

  const response = await fetch(
    `${CORA_API_BASE}/statements?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  const transactions = await response.json()

  // Importar para bank_transactions
  const supabase = createClient(...)
  await supabase
    .from('bank_transactions')
    .upsert(transactions.map(t => ({
      bank_reference: t.id,
      amount: t.amount / 100,
      description: t.description,
      transaction_type: t.type === 'CREDIT' ? 'credit' : 'debit',
      transaction_date: t.created_at,
      imported_from: 'cora',
      matched: false
    })), {
      onConflict: 'bank_reference',
      ignoreDuplicates: true
    })

  return new Response(JSON.stringify({ imported: transactions.length }))
}

async function handleWebhook(webhookData: any) {
  // Processar webhook do Cora
  // Eventos: charge.paid, charge.refunded, charge.canceled

  if (webhookData.event === 'charge.paid') {
    const supabase = createClient(...)

    // Buscar invoice pelo external_charge_id
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('external_charge_id', webhookData.charge.id)
      .single()

    if (invoice) {
      // Marcar como paga
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          payment_date: webhookData.charge.paid_at,
          payment_method: webhookData.charge.payment_method
        })
        .eq('id', invoice.id)

      // Criar lançamento contábil
      await supabase.functions.invoke('create-accounting-entry', {
        body: {
          type: 'invoice',
          operation: 'payment',
          referenceId: invoice.id,
          amount: invoice.amount,
          date: webhookData.charge.paid_at
        }
      })
    }
  }

  return new Response('OK')
}
```

**Configuração do Webhook Cora:**
```bash
# Registrar webhook no Cora
curl -X POST https://api.cora.com.br/webhooks \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-project.supabase.co/functions/v1/cora-banking-service",
    "events": ["charge.paid", "charge.refunded", "pix.received"]
  }'
```

---

#### ✅ 1.3 Sistema de Cobranças (Boleto + PIX)

**Checklist Técnico:**
```
□ Estender tabela invoices
  □ boleto_url VARCHAR
  □ boleto_barcode VARCHAR
  □ pix_qrcode TEXT (base64 image)
  □ pix_copy_paste TEXT (PIX copia e cola)
  □ external_charge_id VARCHAR
  □ payment_method VARCHAR (boleto/pix/card)

□ Componente: InvoicePaymentMethods
  □ Exibir boleto (URL + código de barras)
  □ Exibir QR Code PIX + botão copiar
  □ Status de pagamento em tempo real

□ Régua de Cobrança Automática
  □ Tabela: collection_rules
    - trigger_days: [-3, 0, 3, 7, 15] (antes/depois vencimento)
    - action: send_email, send_whatsapp, send_sms
    - template_id: link para template
  □ Cron job diário: verificar invoices e enviar
  □ Histórico: collection_history (sent_at, channel, status)

□ Templates de Mensagens
  □ Tabela: message_templates
    - type: pre_due, due_today, overdue
    - channel: email, whatsapp, sms
    - subject, body (com variáveis: {client_name}, {amount}, {due_date})
```

---

#### ✅ 1.4 Notificações Multi-Canal

**Checklist Técnico:**
```
□ Email (SendGrid ou Amazon SES)
  □ Edge Function: send-email
  □ Templates HTML responsivos
  □ Anexar boleto PDF
  □ Track de abertura (opcional)

□ WhatsApp Business API
  □ Integração: Twilio ou Evolution API
  □ Edge Function: send-whatsapp
  □ Templates aprovados pelo WhatsApp
  □ Enviar link de pagamento

□ SMS (Twilio)
  □ Edge Function: send-sms
  □ Apenas alertas críticos
  □ Limite de caracteres

□ Dispatcher Central
  □ Edge Function: notification-dispatcher
  □ Recebe: event, client_id, template, channel
  □ Escolhe canal baseado em preferência
  □ Retry com backoff exponencial
  □ Log de envios

□ Tabela: notifications_log
  □ Campos: id, client_id, type, channel, status, sent_at, error
```

**Código Exemplo - Notification Dispatcher:**
```typescript
// supabase/functions/notification-dispatcher/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface NotificationRequest {
  event: 'invoice_created' | 'invoice_due' | 'invoice_overdue' | 'invoice_paid'
  client_id: string
  invoice_id: string
  channels: ('email' | 'whatsapp' | 'sms')[]
}

serve(async (req) => {
  const request: NotificationRequest = await req.json()

  // Buscar dados do cliente e invoice
  const supabase = createClient(...)
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(*)')
    .eq('id', request.invoice_id)
    .single()

  // Buscar template
  const { data: template } = await supabase
    .from('message_templates')
    .select('*')
    .eq('type', request.event)
    .single()

  // Renderizar template com variáveis
  const message = renderTemplate(template.body, {
    client_name: invoice.clients.name,
    amount: formatCurrency(invoice.amount),
    due_date: formatDate(invoice.due_date),
    boleto_url: invoice.boleto_url,
    pix_copy_paste: invoice.pix_copy_paste
  })

  // Enviar para cada canal
  const results = []
  for (const channel of request.channels) {
    try {
      if (channel === 'email') {
        await sendEmail(invoice.clients.email, template.subject, message)
      } else if (channel === 'whatsapp') {
        await sendWhatsApp(invoice.clients.phone, message)
      } else if (channel === 'sms') {
        await sendSMS(invoice.clients.phone, message)
      }

      results.push({ channel, status: 'sent' })
    } catch (error) {
      results.push({ channel, status: 'failed', error: error.message })
    }
  }

  // Log
  await supabase.from('notifications_log').insert(results.map(r => ({
    client_id: request.client_id,
    invoice_id: request.invoice_id,
    type: request.event,
    channel: r.channel,
    status: r.status,
    error: r.error
  })))

  return new Response(JSON.stringify({ results }))
})

async function sendEmail(to: string, subject: string, html: string) {
  // SendGrid API
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'noreply@seuescritorio.com.br', name: 'Escritório Contábil' },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  })

  if (!response.ok) {
    throw new Error('Failed to send email')
  }
}

async function sendWhatsApp(phone: string, message: string) {
  // Evolution API ou Twilio
  const response = await fetch(`${Deno.env.get('EVOLUTION_API_URL')}/message/sendText`, {
    method: 'POST',
    headers: {
      'apikey': Deno.env.get('EVOLUTION_API_KEY')!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      number: phone.replace(/\D/g, ''),
      text: message
    })
  })

  if (!response.ok) {
    throw new Error('Failed to send WhatsApp')
  }
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value)
  }
  return result
}
```

---

### 🟡 FASE 2 - PORTAL DO CLIENTE (Semanas 5-7)

#### ✅ 2.1 Frontend do Portal

**Checklist Técnico:**
```
□ Criar nova aplicação React
  □ Diretório: /client-portal
  □ Mesma stack: React + Vite + TypeScript
  □ Compartilhar: Supabase client, componentes UI

□ Páginas do Portal
  □ Login (email/senha ou link mágico)
  □ Dashboard (resumo financeiro)
  □ Invoices (faturas pendentes e pagas)
  □ Documents (documentos enviados e recebidos)
  □ Messages (chat com contador)
  □ Profile (editar dados)

□ Autenticação
  □ Login com link mágico (passwordless)
  □ Login com senha
  □ Recuperação de senha
  □ Sessão persistente

□ RLS Policies
  □ Clientes só veem suas próprias invoices
  □ Clientes só veem seus documentos
  □ Permissão de upload de arquivos
```

**Código Exemplo - Portal Login:**
```typescript
// client-portal/src/pages/Login.tsx
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleMagicLink() {
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Link mágico enviado para seu email!')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <h1 className="text-3xl font-bold">Portal do Cliente</h1>

        <input
          type="email"
          placeholder="Seu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />

        <button
          onClick={handleMagicLink}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          {loading ? 'Enviando...' : 'Enviar Link de Acesso'}
        </button>
      </div>
    </div>
  )
}
```

---

#### ✅ 2.2 Upload de Documentos

**Checklist Técnico:**
```
□ Supabase Storage
  □ Bucket: client-documents
  □ Policies: clientes só veem suas pastas
  □ Limites: 10MB por arquivo

□ Tabela: documents
  □ Campos: id, client_id, type, file_path, file_name, file_size, uploaded_at

□ Componente: DocumentUploader
  □ Drag & drop
  □ Preview de imagens/PDFs
  □ Progress bar
  □ Validação de tipo e tamanho

□ OCR Automático (Google Vision API)
  □ Edge Function: ocr-document
  □ Extrair dados de NF, recibos
  □ Salvar metadata em JSON
```

**Código Exemplo - Upload com Storage:**
```typescript
// client-portal/src/components/DocumentUploader.tsx
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function DocumentUploader({ clientId }: { clientId: string }) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)

    // Upload para Storage
    const filePath = `${clientId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(filePath, file)

    if (uploadError) {
      alert(uploadError.message)
      setUploading(false)
      return
    }

    // Salvar metadados no banco
    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        client_id: clientId,
        type: 'client_upload',
        file_path: filePath,
        file_name: file.name,
        file_size: file.size
      })

    if (dbError) {
      alert(dbError.message)
    } else {
      alert('Documento enviado com sucesso!')
    }

    setUploading(false)
  }

  return (
    <div>
      <input
        type="file"
        onChange={handleUpload}
        disabled={uploading}
        accept=".pdf,.jpg,.png,.xml"
      />
      {uploading && <p>Enviando...</p>}
    </div>
  )
}
```

---

### 🟢 FASE 3 - AUTOMAÇÃO E INTEGRAÇÃO BANCÁRIA (Semanas 8-12)

#### ✅ 3.1 Open Finance (Pluggy)

**Objetivo:** Importação automática de extratos bancários

**Checklist Técnico:**
```
□ Criar conta Pluggy
  □ Obter client_id e client_secret
  □ Configurar webhooks

□ Edge Function: pluggy-integration
  □ Endpoints:
    - /connect (conectar conta bancária)
    - /sync-transactions (sincronizar extrato)
    - /webhook-handler (receber atualizações)

□ Tabela: bank_accounts
  □ Campos: id, client_id, bank_name, pluggy_item_id, account_number, balance

□ Fluxo de Conexão
  □ Cliente inicia conexão no portal
  □ Pluggy Widget (iframe) para login no banco
  □ Salvar item_id retornado
  □ Sincronizar transações automáticas

□ Sincronização Diária
  □ Cron job: sync-all-bank-accounts
  □ Para cada conta conectada
  □ Importar transações últimos 30 dias
  □ Auto-conciliação com invoices
```

**Código Exemplo - Pluggy Integration:**
```typescript
// supabase/functions/pluggy-integration/index.ts
const PLUGGY_API = 'https://api.pluggy.ai'

async function connectBankAccount(clientId: string) {
  // Criar accessToken para Pluggy Widget
  const response = await fetch(`${PLUGGY_API}/connect_token`, {
    method: 'POST',
    headers: {
      'X-API-KEY': Deno.env.get('PLUGGY_CLIENT_ID')!,
      'X-CLIENT-SECRET': Deno.env.get('PLUGGY_CLIENT_SECRET')!
    }
  })

  const { accessToken } = await response.json()

  // Retornar para frontend mostrar widget
  return { accessToken }
}

async function syncTransactions(itemId: string) {
  // Buscar transações da conta conectada
  const response = await fetch(`${PLUGGY_API}/transactions?itemId=${itemId}`, {
    headers: {
      'X-API-KEY': Deno.env.get('PLUGGY_CLIENT_ID')!,
      'X-CLIENT-SECRET': Deno.env.get('PLUGGY_CLIENT_SECRET')!
    }
  })

  const { results } = await response.json()

  // Importar para bank_transactions
  const supabase = createClient(...)
  await supabase
    .from('bank_transactions')
    .upsert(results.map(t => ({
      bank_reference: t.id,
      amount: Math.abs(t.amount),
      description: t.description,
      transaction_type: t.amount > 0 ? 'credit' : 'debit',
      transaction_date: t.date,
      imported_from: 'pluggy',
      matched: false
    })), {
      onConflict: 'bank_reference',
      ignoreDuplicates: true
    })

  return { imported: results.length }
}
```

---

#### ✅ 3.2 Workflow Builder

**Checklist Técnico:**
```
□ Tabela: workflows
  □ Campos: id, name, trigger_type, trigger_config, actions, active

□ Tabela: workflow_executions
  □ Campos: id, workflow_id, trigger_data, status, executed_at, logs

□ Triggers Disponíveis
  □ invoice_created
  □ invoice_overdue
  □ invoice_paid
  □ expense_created
  □ client_created
  □ bank_transaction_matched
  □ scheduled (cron)

□ Actions Disponíveis
  □ send_email
  □ send_whatsapp
  □ send_sms
  □ create_task
  □ update_client
  □ call_webhook
  □ run_ai_agent

□ Componente UI: WorkflowBuilder
  □ Drag & drop de nodes
  □ Configuração visual de condições
  □ Teste de workflow
  □ Histórico de execuções
```

---

### 🔵 FASE 4 - INTELIGÊNCIA E ANALYTICS (Semanas 13-16)

#### ✅ 4.1 Novos AI Agents

**Checklist Técnico:**
```
□ AI Chatbot
  □ Edge Function: ai-chatbot
  □ RAG com documentação da empresa
  □ Responder dúvidas sobre invoices, pagamentos
  □ Integração com portal do cliente

□ AI Churn Predictor
  □ Analisar histórico de pagamentos
  □ Calcular score de risco (0-100)
  □ Alertar sobre clientes em risco
  □ Sugerir ações de retenção

□ AI Pricing Optimizer
  □ Analisar complexidade do cliente
  □ Comparar com mercado
  □ Sugerir honorário ideal
  □ Calcular potencial de upsell

□ AI Fraud Detector
  □ Detectar transações suspeitas
  □ Padrões anômalos de pagamento
  □ Múltiplos pagadores com mesmo IP
  □ Alertas em tempo real
```

---

#### ✅ 4.2 Fluxo de Caixa Projetado

**Checklist Técnico:**
```
□ Página: CashFlowProjection
  □ Gráfico 12 meses futuro
  □ Entradas previstas (invoices pendentes)
  □ Saídas previstas (despesas recorrentes)
  □ Saldo projetado dia a dia

□ Edge Function: calculate-cash-flow
  □ Buscar invoices futuras
  □ Aplicar % de recebimento baseado em histórico
  □ Considerar inadimplência média
  □ Projetar despesas recorrentes

□ ML Model (opcional)
  □ Treinar modelo com histórico
  □ Prever probabilidade de recebimento
  □ Ajustar projeção dinamicamente
```

---

## 🔌 MCP SERVERS E FERRAMENTAS {#mcp-servers}

### O que são MCP Servers?

MCP (Model Context Protocol) permite que IAs acessem ferramentas externas de forma padronizada.

### MCP Servers Recomendados para Este Projeto

#### 1. **MCP Context7** (Pesquisa na Web e Documentação)

```json
// .mcp/config.json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"],
      "env": {
        "CONTEXT7_API_KEY": "sua-chave-aqui"
      }
    }
  }
}
```

**Uso:**
- Buscar documentação de APIs (Cora, Pluggy, SendGrid)
- Pesquisar padrões de implementação
- Encontrar exemplos de código

**Exemplo de uso na IA:**
```
"Use Context7 para buscar a documentação da API do Banco Cora sobre como criar cobranças via PIX"
```

---

#### 2. **MCP Filesystem** (Acesso a Arquivos)

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/caminho/do/projeto"]
  }
}
```

**Uso:**
- Ler/escrever arquivos do projeto
- Analisar código existente
- Criar novos arquivos

---

#### 3. **MCP Postgres** (Acesso ao Banco)

```json
{
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": {
      "DATABASE_URL": "postgresql://user:pass@host:5432/db"
    }
  }
}
```

**Uso:**
- Executar queries SQL
- Analisar schema
- Criar migrations
- Validar dados

---

#### 4. **MCP GitHub** (Integração com GitHub)

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "ghp_..."
    }
  }
}
```

**Uso:**
- Criar issues
- Gerenciar PRs
- Acessar repositório

---

#### 5. **MCP Puppeteer** (Automação Web)

```json
{
  "puppeteer": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
  }
}
```

**Uso:**
- Testar portal do cliente
- Fazer scraping de dados
- Gerar screenshots

---

#### 6. **Custom MCP - Banking APIs**

Criar MCP customizado para APIs bancárias:

```typescript
// mcp-servers/banking-apis/index.ts
import { MCPServer } from '@modelcontextprotocol/sdk'

const server = new MCPServer({
  name: 'banking-apis',
  version: '1.0.0'
})

server.tool({
  name: 'cora_get_balance',
  description: 'Consultar saldo da conta Cora',
  parameters: {},
  handler: async () => {
    const balance = await coraAPI.getBalance()
    return { balance }
  }
})

server.tool({
  name: 'cora_create_charge',
  description: 'Criar cobrança no Banco Cora',
  parameters: {
    amount: { type: 'number' },
    due_date: { type: 'string' },
    payer_name: { type: 'string' }
  },
  handler: async (params) => {
    const charge = await coraAPI.createCharge(params)
    return charge
  }
})

server.start()
```

**Configuração:**
```json
{
  "banking-apis": {
    "command": "node",
    "args": ["./mcp-servers/banking-apis/index.js"]
  }
}
```

---

### Workflow com MCP Servers

**Exemplo: Criar cobrança automaticamente**

1. IA recebe comando: "Criar cobrança para cliente X"
2. Usa **MCP Postgres** para buscar dados do cliente
3. Usa **MCP Banking APIs** para criar cobrança no Cora
4. Usa **MCP Filesystem** para salvar comprovante
5. Usa **MCP Context7** para buscar template de email
6. Envia notificação ao cliente

---

## 📐 PADRÕES E BOAS PRÁTICAS {#padroes}

### Estrutura de Edge Functions

```typescript
// Padrão para todas as Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Interface de Request
interface FunctionRequest {
  action?: string
  data?: any
}

// Interface de Response
interface FunctionResponse {
  success: boolean
  data?: any
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const request: FunctionRequest = await req.json()

    // Validate JWT (se necessário)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Business logic
    let result
    switch (request.action) {
      case 'action1':
        result = await handleAction1(request.data)
        break
      case 'action2':
        result = await handleAction2(request.data)
        break
      default:
        throw new Error('Invalid action')
    }

    // Return success
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function handleAction1(data: any) {
  // Implementation
}

async function handleAction2(data: any) {
  // Implementation
}
```

### Estrutura de Componentes React

```typescript
// components/FeatureName/FeatureName.tsx
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface FeatureNameProps {
  clientId: string
  onSuccess?: () => void
}

export function FeatureName({ clientId, onSuccess }: FeatureNameProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Fetch data
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table')
        .select('*')
        .eq('client_id', clientId)

      if (error) throw error
      return data
    }
  })

  // Mutation
  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase
        .from('table')
        .insert(payload)

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast({ title: 'Sucesso!' })
      onSuccess?.()
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    }
  })

  if (isLoading) return <div>Carregando...</div>
  if (error) return <div>Erro: {error.message}</div>

  return (
    <div className="space-y-4">
      {/* UI */}
    </div>
  )
}
```

### Estrutura de Migrations

```sql
-- supabase/migrations/20250114_add_feature.sql

-- Create table
CREATE TABLE IF NOT EXISTS feature_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_feature_table_client_id ON feature_table(client_id);
CREATE INDEX idx_feature_table_created_at ON feature_table(created_at);

-- Enable RLS
ALTER TABLE feature_table ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own data"
  ON feature_table FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own data"
  ON feature_table FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_table_updated_at
  BEFORE UPDATE ON feature_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE feature_table IS 'Descrição da tabela';
COMMENT ON COLUMN feature_table.name IS 'Descrição do campo';
```

---

## 🧪 TESTES E VALIDAÇÃO {#testes}

### Checklist de Testes

```
□ Testes Unitários
  □ Funções de parsing (OFX, CNAB, XML)
  □ Cálculos de honorários
  □ Formatação de dados
  □ Validações

□ Testes de Integração
  □ Edge Functions (cada endpoint)
  □ Supabase queries
  □ External APIs (mock)

□ Testes E2E
  □ Fluxo completo de cobrança
  □ Fluxo de reconciliação
  □ Portal do cliente
  □ Workflow de automação

□ Testes de Segurança
  □ RLS policies
  □ JWT validation
  □ SQL injection
  □ XSS

□ Testes de Performance
  □ Load test (100 req/s)
  □ Query optimization
  □ Edge Function cold start
```

### Exemplo de Teste - Edge Function

```typescript
// supabase/functions/tests/parse-ofx.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"

Deno.test("parseOFX extracts transactions correctly", () => {
  const ofxContent = `
    <OFX>
      <STMTTRN>
        <DTPOSTED>20250114</DTPOSTED>
        <TRNAMT>100.50</TRNAMT>
        <FITID>12345</FITID>
        <MEMO>Pagamento PIX</MEMO>
      </STMTTRN>
    </OFX>
  `

  const transactions = parseOFX(ofxContent)

  assertEquals(transactions.length, 1)
  assertEquals(transactions[0].amount, 100.50)
  assertEquals(transactions[0].description, 'Pagamento PIX')
})
```

---

## 🎯 PROMPT FINAL PARA IA

**Use este prompt quando for implementar qualquer feature:**

```
Você é uma IA desenvolvedor expert em TypeScript, React, Supabase e Edge Functions.

Contexto: Sistema de honorários contábeis com stack React + Supabase + Deno.

Sua missão: Implementar [NOME DA FEATURE] seguindo o guia AI_IMPLEMENTATION_GUIDE.md

Passos obrigatórios:

1. ANÁLISE
   - Leia o checklist técnico da feature
   - Identifique dependências (tabelas, APIs, Edge Functions)
   - Liste arquivos que precisam ser criados/modificados

2. DATABASE
   - Crie migration SQL se necessário
   - Defina RLS policies
   - Crie indexes para performance

3. EDGE FUNCTION (se necessário)
   - Use template padrão do guia
   - Implemente validação JWT se crítico
   - Trate erros com try/catch
   - Adicione logs para debug

4. FRONTEND
   - Crie componente seguindo padrão do guia
   - Use React Query para data fetching
   - Adicione validação com Zod
   - UI com shadcn-ui

5. INTEGRAÇÃO
   - Se integrar API externa, use MCP se disponível
   - Armazene credenciais em env vars
   - Implemente retry com backoff
   - Trate rate limiting

6. TESTES
   - Escreva ao menos 1 teste unitário
   - Teste fluxo completo manualmente
   - Valide RLS policies

7. DOCUMENTAÇÃO
   - Comente código complexo
   - Atualize README se necessário
   - Documente variáveis de ambiente

Regras:
- SEMPRE use TypeScript tipado
- SEMPRE trate erros
- SEMPRE valide inputs
- NUNCA exponha secrets
- NUNCA pule RLS policies

Pronto? Implemente: [FEATURE]
```

---

## 📦 VARIÁVEIS DE AMBIENTE COMPLETAS

```bash
# .env
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# IA
LOVABLE_API_KEY=sk-xxx...

# Banco Cora
CORA_CLIENT_ID=xxx
CORA_CLIENT_SECRET=xxx
CORA_CERTIFICATE_PATH=/path/to/cert.pem
CORA_WEBHOOK_SECRET=xxx

# Open Finance (Pluggy)
PLUGGY_CLIENT_ID=xxx
PLUGGY_CLIENT_SECRET=xxx

# Notificações
SENDGRID_API_KEY=SG.xxx
EVOLUTION_API_URL=https://evolution.xxx
EVOLUTION_API_KEY=xxx
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+5511999999999

# OCR
GOOGLE_VISION_API_KEY=AIzaxxx

# Assinatura Digital
CLICKSIGN_API_KEY=xxx
CLICKSIGN_ENVIRONMENT=production

# Context7 (MCP)
CONTEXT7_API_KEY=xxx

# Database (para MCPs)
DATABASE_URL=postgresql://xxx

# GitHub (para MCPs)
GITHUB_TOKEN=ghp_xxx
```

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

### Sprint 1 (Semana 1-2)
1. ✅ Parser OFX/CNAB
2. ✅ Integração Banco Cora - autenticação
3. ✅ Geração de boleto via Cora
4. ✅ Notificações Email (SendGrid)

### Sprint 2 (Semana 3-4)
5. ✅ Geração de PIX via Cora
6. ✅ Webhook Cora (pagamento recebido)
7. ✅ Régua de cobrança automática
8. ✅ Notificações WhatsApp

### Sprint 3 (Semana 5-6)
9. ✅ Portal do cliente - autenticação
10. ✅ Portal do cliente - dashboard
11. ✅ Portal do cliente - visualizar invoices
12. ✅ Upload de documentos

### Sprint 4 (Semana 7-8)
13. ✅ OCR para NF-e
14. ✅ Parser XML NFe/NFSe
15. ✅ Importação CSV genérico
16. ✅ Storage de documentos

### Sprint 5 (Semana 9-10)
17. ✅ Open Finance (Pluggy) - conexão
18. ✅ Sincronização automática de extrato
19. ✅ Auto-conciliação melhorada
20. ✅ Múltiplas contas bancárias

### Sprint 6 (Semana 11-12)
21. ✅ Workflow Builder - estrutura
22. ✅ Triggers e Actions
23. ✅ UI do Workflow Builder
24. ✅ Teste de workflows

### Sprint 7 (Semana 13-14)
25. ✅ AI Chatbot
26. ✅ AI Churn Predictor
27. ✅ AI Pricing Optimizer
28. ✅ AI Fraud Detector

### Sprint 8 (Semana 15-16)
29. ✅ Fluxo de Caixa Projetado
30. ✅ Dashboard Analytics Avançado
31. ✅ Multi-tenant structure
32. ✅ RBAC e Permissões

---

## 🎓 RECURSOS DE APRENDIZADO

### Documentações Oficiais
- [Supabase Docs](https://supabase.com/docs)
- [Deno Docs](https://deno.land/manual)
- [React Query](https://tanstack.com/query/latest)
- [shadcn/ui](https://ui.shadcn.com/)

### APIs Específicas
- [Banco Cora API](https://developers.cora.com.br/)
- [Pluggy Docs](https://docs.pluggy.ai/)
- [SendGrid API](https://docs.sendgrid.com/)
- [Twilio WhatsApp](https://www.twilio.com/docs/whatsapp)
- [Evolution API](https://doc.evolution-api.com/)

### MCP Servers
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Context7 MCP](https://context7.com/docs)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)

---

## 🏁 CONCLUSÃO

Este guia fornece um roadmap completo para transformar a aplicação em uma super ferramenta de gestão contábil.

**Princípios chave:**
1. **Automação total** - Reduzir trabalho manual
2. **Integração profunda** - APIs bancárias e fiscais
3. **IA everywhere** - Usar IA para classificar, prever, sugerir
4. **Portal do cliente** - Self-service reduz 70% das ligações
5. **Multi-canal** - Email, WhatsApp, SMS automáticos

**Próximos passos:**
1. Escolha uma feature da Fase 1 para começar
2. Siga o checklist técnico
3. Use os códigos de exemplo como base
4. Configure MCPs necessários
5. Teste extensivamente
6. Itere baseado em feedback

**Lembre-se:** Qualidade > Velocidade. Melhor implementar bem 1 feature por semana do que 10 pela metade.

Boa sorte! 🚀
