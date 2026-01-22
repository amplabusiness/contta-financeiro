# CONTTA Financeiro - Análise de Melhorias de Automação

## Visão Executiva

Este documento apresenta uma análise completa do sistema CONTTA Financeiro com propostas de melhorias de automação, seguindo a filosofia de que o **usuário apenas monitora e intervém quando necessário**, similar ao conceito apresentado no material da Ampla Contabilidade sobre Data Lake, RAG e Agentes de IA.

---

## 1. Estado Atual do Sistema

### 1.1 Arquitetura
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Supabase (PostgreSQL 15+) + Deno Edge Functions
- **IA**: Google Gemini 2.5 Flash + Claude AI
- **Multi-tenant**: RLS com isolamento por `tenant_id`

### 1.2 O Plano de Contas - A Base de Tudo

O plano de contas (`chart_of_accounts`) é a **fonte da verdade** do sistema. Toda movimentação financeira deve ter reflexo contábil através dele.

#### Estrutura Atual:
```
1 - ATIVO
├── 1.1 - Ativo Circulante
│   ├── 1.1.1 - Disponibilidades
│   │   └── 1.1.1.05 - Banco Sicredi (analítica)
│   ├── 1.1.2 - Créditos
│   │   └── 1.1.2.01 - Clientes a Receber (sintética)
│   │       ├── 1.1.2.01.001 - Cliente A (analítica)
│   │       └── 1.1.2.01.xxx - Cliente N (analítica)
2 - PASSIVO
├── 2.1 - Passivo Circulante
│   └── 2.1.1 - Fornecedores a Pagar
3 - RECEITAS
├── 3.1 - Receitas Operacionais
│   └── 3.1.1 - Honorários de Contabilidade
4 - DESPESAS
├── 4.1 - Despesas Operacionais
│   ├── 4.1.1 - Salários e Encargos
│   ├── 4.1.2 - Despesas Administrativas
│   └── 4.1.3 - Despesas Financeiras
5 - PATRIMÔNIO LÍQUIDO
```

#### De Onde Vem o Plano de Contas:
1. **Inicialização Manual** - `initializeChartOfAccounts()` cria estrutura base
2. **Template Pré-definido** - Mapeamento em `AccountingService.ts` (EXPENSE_ACCOUNT_MAP)
3. **Criação Dinâmica** - Subcontas de clientes criadas via `findOrCreateClientAccount()`

#### Problemas Identificados:
- Plano de contas não é inicializado automaticamente no onboarding
- Categorias de despesa limitadas ao mapeamento hardcoded
- Não há sincronização com plano referencial da Receita Federal (SPED)
- Clientes sem conta contábil travam conciliação automática

---

## 2. Automações Existentes

### 2.1 Automações Ativas
| Automação | Trigger | O que Faz |
|-----------|---------|-----------|
| Auto-reconciliação Invoice | `auto_reconcile_invoice_payment()` | Casa pagamentos com faturas |
| Auto-reconciliação Despesa | `auto_reconcile_expense_payment()` | Casa pagamentos com despesas |
| Classificação Dr. Cícero | `classify_transaction_on_insert()` | Classifica transações OFX via IA |
| Lançamento Fatura | `create_invoice_accounting_entry()` | Cria partida dobrada ao emitir fatura |
| Provisionamento Despesa | `create_expense_provision_entry()` | Cria lançamento ao cadastrar despesa |
| Conciliação Boletos | `BoletoReconciliationService` | Casa COB com clientes e cria lançamentos |

### 2.2 Agentes de IA (Edge Functions)
- `ai-accountant-agent` - Recomendações contábeis
- `ai-collection-agent` - Sugestões de cobrança
- `ai-churn-predictor` - Previsão de churn
- `ai-fraud-detector` - Detecção de fraudes
- `ai-bank-transaction-processor` - Processamento inteligente de transações

### 2.3 Lacunas de Automação
```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO IDEAL VS ATUAL                                       │
├─────────────────────────────────────────────────────────────┤
│  📥 Importação OFX                                          │
│     ✅ Automático via upload                                │
│                                                             │
│  🔍 Classificação                                           │
│     ✅ Dr. Cícero (IA) classifica                          │
│     ⚠️  Mas depende de regras aprendidas                    │
│     ❌ Não identifica automaticamente o cliente pelo QSA    │
│                                                             │
│  🔗 Conciliação                                             │
│     ✅ Boletos: COB matching funciona bem                   │
│     ⚠️  PIX: Precisa extrair CNPJ/nome do pagador           │
│     ❌ TED/DOC: Não há lógica de identificação              │
│                                                             │
│  📊 Lançamento Contábil                                     │
│     ✅ Partida dobrada automática                           │
│     ⚠️  Mas só após classificação manual                    │
│                                                             │
│  📈 Relatórios                                              │
│     ✅ DRE, Balancete, Balanço disponíveis                  │
│     ❌ Não há alertas automáticos de anomalias              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Propostas de Melhoria - Ordem de Prioridade

### 3.1 🔴 CRÍTICO - Automação do Plano de Contas

#### Problema:
O plano de contas é criado manualmente e não se adapta automaticamente às necessidades do negócio.

#### Solução Proposta:
```typescript
// Nova funcionalidade: AutoChartService
class AutoChartOfAccountsService {

  // 1. Inicialização automática no onboarding
  async initializeForNewTenant(tenantId: string) {
    // Criar estrutura base completa
    // Mapear CNAE da empresa para contas típicas do segmento
    // Sincronizar com plano referencial SPED
  }

  // 2. Criação automática de contas por categoria
  async ensureAccountExists(category: ExpenseCategory): Promise<Account> {
    // Verificar se conta existe
    // Se não, criar na estrutura correta
    // Retornar conta para uso imediato
  }

  // 3. Sincronização com SPED Referencial
  async syncWithSPEDReferencial(year: number) {
    // Baixar tabela referencial da RFB
    // Mapear contas locais para códigos SPED
    // Sugerir ajustes para compliance
  }
}
```

#### Benefícios:
- Novos tenants já começam com plano de contas completo
- Zero intervenção manual para criação de contas
- Compliance automático com SPED

---

### 3.2 🔴 CRÍTICO - Identificação Automática de Pagadores

#### Problema Atual:
O sistema não consegue identificar automaticamente quem é o pagador de uma transação PIX/TED, causando:
- Transações ficam "a classificar"
- Usuário precisa associar manualmente cliente à transação
- Conciliação só funciona bem para boletos (COB)

#### Solução Proposta: Agente de Identificação de Pagadores

```typescript
// Nova Edge Function: ai-payer-identifier
interface PayerIdentificationResult {
  confidence: number;
  method: 'cnpj_match' | 'cpf_match' | 'qsa_match' | 'name_similarity' | 'pattern_learned';
  clientId?: string;
  clientName?: string;
  suggestedAccountCode?: string;
}

async function identifyPayer(transaction: BankTransaction): Promise<PayerIdentificationResult> {
  const description = transaction.description;

  // 1. Extrair CNPJ/CPF da descrição
  const cnpj = extractCNPJ(description); // Ex: "PIX RECEBIDO - 12.345.678/0001-90"
  const cpf = extractCPF(description);    // Ex: "PIX RECEBIDO - 123.456.789-00"

  // 2. Se achou CNPJ, buscar cliente direto
  if (cnpj) {
    const client = await findClientByCNPJ(cnpj);
    if (client) return { confidence: 100, method: 'cnpj_match', clientId: client.id };
  }

  // 3. Se achou CPF, buscar no QSA dos clientes (sócios)
  if (cpf) {
    const client = await findClientByQSACPF(cpf);
    if (client) return { confidence: 95, method: 'qsa_match', clientId: client.id };
  }

  // 4. Buscar por nome similar
  const nameParts = extractNameFromDescription(description);
  if (nameParts) {
    const match = await findClientByNameSimilarity(nameParts);
    if (match && match.similarity > 0.8) {
      return { confidence: match.similarity * 100, method: 'name_similarity', clientId: match.clientId };
    }
  }

  // 5. Usar regras aprendidas (Dr. Cícero)
  const learnedMatch = await checkLearnedPatterns(description);
  if (learnedMatch) {
    return { confidence: 85, method: 'pattern_learned', ...learnedMatch };
  }

  return { confidence: 0, method: 'name_similarity' };
}
```

#### Trigger Automático:
```sql
-- Trigger que executa ao inserir transação bancária
CREATE OR REPLACE FUNCTION fn_auto_identify_payer()
RETURNS TRIGGER AS $$
BEGIN
  -- Chamar Edge Function de identificação
  PERFORM net.http_post(
    'https://xxx.supabase.co/functions/v1/ai-payer-identifier',
    jsonb_build_object(
      'transaction_id', NEW.id,
      'description', NEW.description,
      'amount', NEW.amount
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### 3.3 🟠 IMPORTANTE - Pipeline de Conciliação Totalmente Automático

#### Fluxo Proposto:
```
┌──────────────────────────────────────────────────────────────────┐
│                    PIPELINE DE CONCILIAÇÃO                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. IMPORTAÇÃO                                                   │
│     └─ Webhook Pluggy (Open Finance)                            │
│         └─ Transações chegam em tempo real                       │
│                                                                  │
│  2. PRÉ-PROCESSAMENTO                                           │
│     └─ Trigger: on_bank_transaction_insert()                    │
│         ├─ Detectar tipo: PIX, TED, DOC, BOLETO, TARIFA         │
│         ├─ Extrair metadados: CNPJ, CPF, COB, nome              │
│         └─ Classificar: receita, despesa, transferência         │
│                                                                  │
│  3. IDENTIFICAÇÃO                                                │
│     └─ Edge Function: ai-payer-identifier                       │
│         ├─ Match por CNPJ/CPF → 100% confiança                  │
│         ├─ Match por QSA → 95% confiança                        │
│         ├─ Match por nome → 70-90% confiança                    │
│         └─ Sem match → Fila para revisão humana                  │
│                                                                  │
│  4. CONCILIAÇÃO                                                  │
│     └─ Service: AutoReconciliationService                       │
│         ├─ Confiança >= 90%: Conciliar automaticamente          │
│         ├─ Confiança 70-89%: Conciliar + Flag para revisão      │
│         └─ Confiança < 70%: Aguardar ação humana                 │
│                                                                  │
│  5. CONTABILIZAÇÃO                                               │
│     └─ AccountingService.createEntry()                          │
│         ├─ Criar partida dobrada                                │
│         ├─ Atualizar saldos                                      │
│         └─ Gerar código de rastreabilidade (Dr. Cícero)         │
│                                                                  │
│  6. NOTIFICAÇÃO                                                  │
│     └─ Diário: Relatório de pendências                          │
│         ├─ Email/WhatsApp: Transações não conciliadas           │
│         └─ Dashboard: Alertas em tempo real                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Implementação - Nova Tabela de Fila:
```sql
CREATE TABLE reconciliation_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, manual_review
  confidence NUMERIC(5,2),
  identification_method VARCHAR(50),
  suggested_client_id UUID REFERENCES clients(id),
  suggested_invoice_id UUID REFERENCES invoices(id),
  ai_reasoning TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID NOT NULL
);

-- View para dashboard de pendências
CREATE VIEW v_reconciliation_dashboard AS
SELECT
  date_trunc('day', created_at) as date,
  status,
  COUNT(*) as count,
  SUM(CASE WHEN confidence >= 90 THEN 1 ELSE 0 END) as auto_reconciled,
  SUM(CASE WHEN confidence < 70 THEN 1 ELSE 0 END) as needs_review
FROM reconciliation_queue
GROUP BY 1, 2;
```

---

### 3.4 🟠 IMPORTANTE - Aprendizado Contínuo (RAG Contábil)

#### Conceito:
Criar um sistema de aprendizado que melhora com o uso, similar ao RAG descrito no material da Ampla.

#### Componentes:
1. **Knowledge Base Contábil**
   - Legislação tributária (RCTE/GO, Lei Kandir, INs)
   - Plano de Contas Referencial SPED
   - Histórico de classificações do escritório

2. **Motor de Aprendizado**
   - Quando usuário corrige uma classificação → Sistema aprende
   - Padrões de descrição → Conta contábil
   - Padrões de valor → Tipo de transação

3. **Consulta Inteligente**
   ```typescript
   // Exemplo de uso
   const suggestion = await drCicero.classify({
     description: "PIX RECEBIDO - EMPRESA XYZ LTDA",
     amount: 1500.00,
     date: "2026-01-15"
   });

   // Retorno:
   {
     type: 'receita',
     accountCode: '1.1.2.01.015',
     accountName: 'EMPRESA XYZ LTDA',
     clientId: 'uuid-xyz',
     confidence: 95,
     reasoning: 'Identificado CNPJ na descrição. Cliente cadastrado com honorário mensal de R$ 1.500,00',
     sources: ['clients.cnpj', 'contracts.monthly_fee']
   }
   ```

#### Tabelas de Aprendizado:
```sql
-- Já existe parcialmente: intelligence_rules
-- Melhorar com:

CREATE TABLE ai_classification_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type VARCHAR(50), -- 'description', 'value_range', 'date_pattern', 'combination'
  pattern_value JSONB,      -- Padrão a ser reconhecido
  target_type VARCHAR(50),  -- 'account', 'client', 'category', 'action'
  target_value JSONB,       -- Resultado quando padrão é detectado
  confidence_boost NUMERIC(3,2) DEFAULT 0.10, -- Quanto adicionar à confiança
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0, -- Vezes que usuário confirmou
  failure_count INTEGER DEFAULT 0, -- Vezes que usuário corrigiu
  effectiveness NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN usage_count > 0
    THEN success_count::NUMERIC / usage_count
    ELSE 0 END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID NOT NULL
);
```

---

### 3.5 🟡 DESEJÁVEL - Agentes Autônomos por Área

Baseado no modelo do material da Ampla, criar agentes especializados:

#### Agente Fiscal (Dr. Cícero)
```typescript
// Responsabilidades:
- Classificar transações bancárias
- Sugerir contas contábeis
- Validar lançamentos (NBC TG 26)
- Detectar inconsistências SPED vs Contabilidade
- Alertar sobre créditos tributários não aproveitados
```

#### Agente Financeiro (Prof. Milton)
```typescript
// Responsabilidades:
- Monitorar fluxo de caixa
- Prever inadimplência (ML)
- Sugerir ações de cobrança
- Calcular projeções
- Alertar sobre contas a vencer
```

#### Agente de Cobrança (Dra. Helena)
```typescript
// Responsabilidades:
- Escalonar cobranças automaticamente
- Enviar lembretes (email, WhatsApp)
- Negociar automaticamente (regras pré-definidas)
- Gerar cartas de cobrança
- Encaminhar para jurídico quando necessário
```

#### Orquestração:
```typescript
// Cron job diário às 6h
await AgentOrchestrator.runDailyTasks([
  { agent: 'dr_cicero', task: 'classify_pending_transactions' },
  { agent: 'prof_milton', task: 'update_cash_flow_projections' },
  { agent: 'dra_helena', task: 'process_collection_queue' },
]);

// Resultado: Às 8h quando equipe chega, tudo já foi processado
// Dashboard mostra apenas: "5 transações precisam de revisão"
```

---

### 3.6 🟡 DESEJÁVEL - Fechamento Mensal Automático

#### Problema:
Fechamento contábil é manual e trabalhoso.

#### Solução:
```sql
-- Job pg_cron para dia 5 de cada mês
SELECT cron.schedule(
  'monthly_accounting_close',
  '0 3 5 * *', -- 3h da manhã, dia 5
  $$
    SELECT auto_close_previous_month();
  $$
);

CREATE OR REPLACE FUNCTION auto_close_previous_month()
RETURNS VOID AS $$
DECLARE
  v_month TEXT;
  v_pending_count INTEGER;
BEGIN
  v_month := to_char(now() - interval '1 month', 'MM/YYYY');

  -- Verificar pendências
  SELECT COUNT(*) INTO v_pending_count
  FROM reconciliation_queue
  WHERE status = 'pending'
    AND created_at >= date_trunc('month', now() - interval '1 month')
    AND created_at < date_trunc('month', now());

  IF v_pending_count > 0 THEN
    -- Notificar sobre pendências
    PERFORM notify_pending_reconciliation(v_pending_count, v_month);
    RETURN;
  END IF;

  -- Executar fechamento
  PERFORM close_month(v_month);

  -- Notificar sucesso
  PERFORM notify_month_closed(v_month);
END;
$$ LANGUAGE plpgsql;
```

---

### 3.7 🟢 FUTURO - Dashboard de Monitoramento "Piloto Automático"

#### Conceito:
O usuário deve poder ver a "saúde" do sistema em um único lugar, intervindo apenas quando necessário.

#### Wireframe:
```
┌─────────────────────────────────────────────────────────────────┐
│  CONTTA - PAINEL DE MONITORAMENTO                    🟢 Saudável │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 HOJE (21/01/2026)                                           │
│  ├─ Transações processadas: 47/50 (94%)                        │
│  ├─ Conciliação automática: 45/47 (96%)                        │
│  └─ Aguardando revisão: 3                          [Ver →]     │
│                                                                 │
│  💰 FLUXO DE CAIXA                                              │
│  ├─ Saldo atual: R$ 125.430,00                                 │
│  ├─ Previsão 7 dias: R$ 98.200,00 (⚠️ -21%)                    │
│  └─ Contas a vencer: 12 (R$ 27.230,00)            [Ver →]      │
│                                                                 │
│  📈 COBRANÇA                                                    │
│  ├─ Em dia: 180 clientes (85%)                                 │
│  ├─ Atrasados 1-30d: 25 clientes (12%)                         │
│  ├─ Atrasados 30+d: 7 clientes (3%)               [Cobrar →]   │
│  └─ Ações automáticas hoje: 15 lembretes enviados              │
│                                                                 │
│  🤖 AGENTES IA                                                  │
│  ├─ Dr. Cícero: 47 classificações, 98% precisão                │
│  ├─ Prof. Milton: Alerta - cliente XYZ pode atrasar            │
│  └─ Dra. Helena: 15 cobranças enviadas                         │
│                                                                 │
│  ⚠️ ATENÇÃO NECESSÁRIA                                         │
│  ├─ 3 transações não identificadas                 [Resolver →]│
│  ├─ 1 cliente sem conta contábil                   [Criar →]   │
│  └─ Fechamento 12/2025 pendente                    [Fechar →]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Roadmap de Implementação

### Fase 1: Quick Wins (0-30 dias)
| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 1 | Trigger de identificação automática de pagador (CNPJ/CPF) | 3 dias | Alto |
| 2 | Criar conta contábil automaticamente para novos clientes | 2 dias | Alto |
| 3 | Job de alerta diário de pendências | 1 dia | Médio |
| 4 | Melhorar extração de metadados das transações | 2 dias | Alto |

### Fase 2: Fundação (30-90 dias)
| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 5 | Pipeline completo de conciliação automática | 2 semanas | Alto |
| 6 | Sistema de aprendizado contínuo (RAG simplificado) | 2 semanas | Alto |
| 7 | Dashboard de monitoramento | 1 semana | Médio |
| 8 | Integração tempo real Pluggy (Open Finance) | 1 semana | Alto |

### Fase 3: Inteligência (90-180 dias)
| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 9 | Agentes autônomos (Dr. Cícero, Prof. Milton, Dra. Helena) | 4 semanas | Alto |
| 10 | Fechamento mensal automático | 1 semana | Médio |
| 11 | Previsão de inadimplência (ML) | 2 semanas | Médio |
| 12 | Sincronização SPED Referencial | 2 semanas | Médio |

---

## 5. Métricas de Sucesso

### KPIs de Automação
| Métrica | Atual | Meta 30d | Meta 90d | Meta 180d |
|---------|-------|----------|----------|-----------|
| % Transações auto-conciliadas | 40% | 70% | 85% | 95% |
| Tempo médio de classificação | 5min | 30seg | 5seg | Automático |
| Intervenções manuais/dia | 50+ | 20 | 10 | 5 |
| Precisão do Dr. Cícero | 70% | 85% | 92% | 98% |

### KPIs de Negócio
| Métrica | Atual | Meta |
|---------|-------|------|
| Inadimplência (>30d) | 12% | 5% |
| Tempo para fechar mês | 5 dias | 1 dia |
| Satisfação do cliente | ? | NPS 70+ |

---

## 6. Conclusão

O CONTTA Financeiro já possui uma base sólida de automação, especialmente:
- Partida dobrada automática
- Conciliação de boletos (COB)
- Classificação via Dr. Cícero

As melhorias propostas focam em:
1. **Eliminar gargalos manuais** - Identificação de pagadores PIX/TED
2. **Aprendizado contínuo** - Sistema melhora com uso
3. **Agentes autônomos** - Trabalho executado antes do usuário chegar
4. **Monitoramento passivo** - Usuário só intervém em exceções

O objetivo final é transformar o sistema em um **"piloto automático" financeiro**, onde o usuário:
- **Monitora** o dashboard
- **Valida** decisões de alta confiança
- **Decide** apenas em casos complexos
- **Treina** o sistema com suas correções

---

*Documento gerado em 21/01/2026 - Análise baseada no código-fonte do CONTTA Financeiro v1.0*
