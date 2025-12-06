# Ampla Contabilidade - Memória do Projeto

**Última Atualização**: 2025-12-06 (Sessão 14)

---

## ⚠️ INSTRUÇÃO OBRIGATÓRIA PARA TODAS AS IAs

> **TODA IA que trabalhar nesta aplicação DEVE documentar suas alterações neste arquivo.**

### O que documentar:
1. **Data da sessão** (formato: DD/MM/YYYY - Sessão N)
2. **Resumo das alterações** realizadas
3. **Arquivos modificados** com descrição breve
4. **Bugs corrigidos** (se houver)
5. **Commits realizados** (hash e descrição)
6. **Lições aprendidas** para futuras IAs

### Onde documentar:
- Adicione uma nova seção no final deste arquivo antes da seção "Referência Rápida"
- Use o formato: `## Sessão N (DD/MM/YYYY) - Descrição`

### Por que isso é importante:
- Evita que IAs "delirem" ou esqueçam o contexto
- Mantém histórico completo de todas as mudanças
- Permite que qualquer IA continue o trabalho sem perder informações
- Facilita debugging e rollback de alterações

**NÃO PULE ESTA ETAPA. É OBRIGATÓRIO.**

---

## Visão Geral

### 🎯 O QUE É ESTA APLICAÇÃO

**Sistema financeiro de Contas a Pagar e Receber para empresas contábeis, com estrutura preparada para SaaS multi-tenant.**

### Contexto de Negócio

| Aspecto | Descrição |
|---------|-----------|
| **Cliente Principal** | Ampla Contabilidade (Goiânia-GO) |
| **Tipo de Sistema** | ERP Financeiro para Escritórios de Contabilidade |
| **Modelo de Negócio** | SaaS multi-tenant (em evolução) |
| **Usuários** | Contadores, auxiliares, gestores financeiros |

### Módulos Principais

1. **Contas a Receber (Honorários)**
   - Geração automática de faturas mensais para clientes do escritório
   - Controle de inadimplência e cobrança
   - Conciliação com pagamentos bancários (PIX, boleto, transferência)

2. **Contas a Pagar (Despesas)**
   - Cadastro e controle de despesas do escritório
   - Categorização automática com IA
   - Fluxo de aprovação e pagamento

3. **Conciliação Bancária**
   - Importação de extratos (OFX, CNAB)
   - Match automático com honorários e despesas
   - Super Conciliador (split de transações)

4. **Contabilidade Integrada**
   - Lançamentos automáticos (partida dobrada)
   - Balancete, DRE, Balanço Patrimonial
   - Livro Diário e Razão

5. **Inteligência Artificial**
   - 21 agentes especializados (Gemini 2.0)
   - Classificação automática de transações
   - Previsões e análises

### ⚠️ REGRAS DE NEGÓCIO IMPORTANTES

1. **Honorários são mensais** - Competência MM/YYYY
2. **Clientes podem ser Pro-Bono ou Barter** (permuta)
3. **Saldo de abertura vai para PL**, não para Receita
4. **Conciliação pode ter SPLIT** - 1 transação para N honorários
5. **Multi-tenancy via RLS** - `tenant_id` em todas as tabelas

## Stack Tecnológico
- **Frontend**: React 18.3.1 + TypeScript 5.8.3 + Vite 5.4.21 + TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage + **Realtime**)
- **AI**: Google Gemini API direta (gemini-2.0-flash) - migrado de Lovable em 29/11/2025
- **Deploy**: Vercel (ampla.vercel.app) - CI/CD via GitHub Actions
- **Scripts**: Python 3.14 (pandas, openpyxl, supabase-py) para importação de dados

## Arquitetura Atual
```
src/
├── components/     # Componentes UI reutilizáveis
├── contexts/       # React Context (ClientContext, PeriodContext)
├── hooks/          # Custom hooks (incluindo useRealtimeSubscription)
├── integrations/   # Supabase client
├── pages/          # Páginas da aplicação
└── lib/            # Utilitários

supabase/
├── functions/      # Edge Functions (Deno)
└── migrations/     # Migrações SQL

scripts/
├── import_jan2025.py          # Importação despesas Janeiro 2025
├── import_expenses_from_excel.py  # Importação despesas (genérico)
└── ...outros scripts

banco/
├── Controle Despesas-1.xlsx   # Planilha de despesas recorrentes
└── ...outros arquivos
```

## Módulos Principais

### 1. Gestão de Clientes
- Cadastro com CNPJ/CPF, enriquecimento via ReceitaWS
- Pro-Bono e Barter (permuta)
- Grupos Econômicos
- Saldo de Abertura com integração contábil

### 2. Honorários (Invoices)
- Geração recorrente automática
- Importação em lote
- Status: pending, paid, overdue
- Competência mensal

### 3. Conciliação Bancária
- **Super Conciliador**: Split de transações para múltiplos clientes
- Importação OFX/CNAB
- Match automático por valor/CNPJ/nome
- Sugestões com IA

### 4. Contabilidade
- Plano de Contas hierárquico
- Lançamentos débito/crédito
- Balancete, DRE, Balanço Patrimonial
- Livro Diário e Razão
- Smart Accounting (IA)

### 5. Relatórios
- Dashboard executivo
- Análise de inadimplência
- Fluxo de caixa
- Análise de rentabilidade

## Decisões Arquiteturais Importantes

### 1. Fonte Única da Verdade
**Decisão**: Usar `accounting_entries` (razão contábil) como fonte única.
- Views materializadas para consultas rápidas
- CQRS: Commands escrevem em `accounting_entries`, Queries leem de views
- Refresh periódico das views (5 min)

### 2. Multi-Tenancy (SaaS)
**Decisão**: Row Level Security (RLS) com tenant_id
- Tabela `tenants` para organizações
- Tabela `tenant_users` para associação usuário-tenant
- Função `get_current_tenant_id()` para RLS policies

### 3. Event Sourcing
**Decisão**: Capturar todos os eventos de domínio
- Tabela `domain_events` com triggers automáticos
- Auditoria completa de todas as operações
- Replay de eventos para reconstrução de estado

### 4. Saldo de Abertura
**Fluxo implementado**:
1. Cria registro em `client_opening_balance`
2. Cria invoice em `invoices` com `source='opening_balance'`
3. Cria lançamento em `client_ledger`
4. Cria lançamento contábil via `create-accounting-entry`

### 5. Conciliação com Split
**Fluxo do Super Conciliador**:
1. Transação bancária de R$ X
2. Usuário seleciona múltiplos honorários que somam X
3. Sistema cria reconciliação e lançamentos contábeis
4. Atualiza status dos honorários para 'paid'

### 6. Automação Contábil (Contabilidade-First)
**Filosofia**: Tudo nasce na contabilidade e distribui para as telas
**Fluxo Contábil**: Diário → Razão → Balancete → DRE → Balanço Patrimonial

**Trigger automático para faturas**:
- Trigger: `trg_auto_accounting_invoice` (AFTER INSERT on invoices)
- Função: `create_invoice_accounting_entry()`
- Cria automaticamente:
  1. Lançamento em `accounting_entries`
  2. Linhas em `accounting_entry_lines` (D: Cliente, C: Receita)
  3. Entrada em `client_ledger`
- Skip automático para `source='opening_balance'` (usa conta PL 5.2.1.02)

**Função para processar faturas existentes**:
- `process_invoices_without_accounting()` - processa em lotes de 500

## Edge Functions Principais

| Função | Propósito |
|--------|-----------|
| `smart-reconciliation` | Sugestões de match com IA |
| `smart-accounting` | Lançamentos contábeis inteligentes |
| `create-accounting-entry` | Criação de lançamentos |
| `client-enrichment` | Enriquecimento via ReceitaWS |

## Ecossistema de IA (21 Edge Functions)

### Agentes Contábeis
| Função | Propósito |
|--------|-----------|
| `ai-accountant-agent` | Agente contador para análises contábeis |
| `ai-accountant-background` | Validação automática de lançamentos em background |
| `ai-accounting-validator` | Validação de conformidade contábil |
| `ai-expense-classifier` | Classificação automática de despesas |
| `ai-invoice-classifier` | Classificação de faturas |

### Agentes Financeiros
| Função | Propósito |
|--------|-----------|
| `ai-financial-analyst` | Análise financeira avançada |
| `ai-cash-flow-analyst` | Análise e projeção de fluxo de caixa |
| `ai-revenue-predictor` | Previsão de receitas |
| `ai-pricing-optimizer` | Otimização de precificação |

### Agentes de Cobrança e Clientes
| Função | Propósito |
|--------|-----------|
| `ai-collection-agent` | Automação de cobrança |
| `ai-churn-predictor` | Previsão de cancelamento de clientes |
| `ai-client-segmenter` | Segmentação inteligente de clientes |
| `ai-partner-analyzer` | Análise de parceiros |

### Agentes de Conciliação
| Função | Propósito |
|--------|-----------|
| `ai-reconciliation-agent` | Conciliação bancária automática |
| `ai-pix-reconciliation` | Conciliação específica de PIX |

### Agentes de Segurança
| Função | Propósito |
|--------|-----------|
| `ai-fraud-detector` | Detecção de fraudes |
| `ai-fraud-analyzer` | Análise aprofundada de fraudes |

### Agentes de Comunicação
| Função | Propósito |
|--------|-----------|
| `ai-chatbot` | Chatbot para atendimento |
| `ai-email-composer` | Composição de e-mails |
| `ai-contract-generator` | Geração de contratos |

### Gestão Empresarial
| Função | Propósito |
|--------|-----------|
| `ai-business-manager` | **Gestor Empresarial IA** - análises MBA, benchmarks, anomalias |

## Páginas de IA

| Página | Rota | Descrição |
|--------|------|-----------|
| `AIAccountant.tsx` | `/ai-accountant` | Contador IA interativo |
| `AIAgents.tsx` | `/ai-agents` | Painel de agentes de IA |
| `AIInsights.tsx` | `/ai-insights` | Insights automáticos da IA |
| `BusinessManager.tsx` | `/business-manager` | Gestor Empresarial IA (MBA) |

## Sistema de IA Autônoma

### Contador IA Automático (Background)
**Filosofia**: "O humano só vê a magia acontecer"

**Componentes**:
1. **Tabela `ai_validation_queue`** - Fila de lançamentos para validação
2. **Tabela `ai_accountant_activity`** - Log de atividades do Contador IA
3. **Colunas em `accounting_entries`**:
   - `ai_validated` - Se foi validado
   - `ai_validation_status` - pending/validating/approved/warning/rejected
   - `ai_validation_score` - Score 0-100
   - `ai_confidence` - Nível de confiança (0.0-1.0)
   - `ai_model` - Modelo usado (gemini-2.5-flash)
   - `ai_generated` - Se foi gerado pela IA

**Funções PostgreSQL**:
- `queue_entry_for_ai_validation(entry_id, priority)` - Adiciona na fila
- `get_next_validation_item()` - Pega próximo item (SKIP LOCKED)
- `complete_ai_validation(queue_id, status, score, confidence, message, model)` - Completa validação
- `fail_ai_validation(queue_id, error_message)` - Marca como falha
- `log_ai_accountant_activity(...)` - Registra atividade

**Trigger automático**: `trg_queue_new_entry` - Adiciona novos lançamentos na fila automaticamente

**Widget React**: `AIAccountantWidget.tsx` - Mostra atividade em tempo real no dashboard

### Gestor Empresarial IA (MBA-Trained)
**Formação de Elite**:
- MBA Harvard Business School (Finance)
- MBA Wharton School (Operations)
- Certificação INSEAD (Strategy)
- CFA Level III (Investment Analysis)
- Six Sigma Black Belt

**Metodologias**:
- Balanced Scorecard (Kaplan & Norton)
- OKRs (Objectives and Key Results)
- Zero-Based Budgeting (ZBB)
- Six Sigma DMAIC
- Lean Management
- Porter's Five Forces
- BCG Matrix

**Benchmarks do Setor Contábil**:
| Categoria | % Receita | Limite Crítico |
|-----------|-----------|----------------|
| Folha de pagamento | 40-50% | >55% = ALERTA |
| Aluguel | 5-10% | >12% = ALERTA |
| Material de consumo | 1-2% | >3% = ALERTA |
| Software/TI | 3-5% | >7% = ALERTA |
| Marketing | 2-5% | >8% = ALERTA |
| Energia | 1-2% | >2.5% = ALERTA |

**Detecção de Anomalias**:
- Café: máx 0.5kg/funcionário/mês (20kg para 3 funcionários = ANOMALIA)
- Papel A4: máx 1 resma/funcionário/mês (sem impressora = ANOMALIA)
- Energia: pico 20% > média = investigar

**Gestão de Inadimplência**:
| Atraso | Ação | Canal |
|--------|------|-------|
| D+1 | Lembrete | E-mail |
| D+7 | Cobrança amigável | WhatsApp |
| D+15 | Contato telefônico | Telefone |
| D+30 | Negociação | Reunião |
| D+60 | Suspensão + Jurídico | Formal |

**Ações disponíveis**:
- `analyze_receivables` - Análise de inadimplência
- `analyze_payables` - Análise de fluxo de pagamentos
- `expense_anomaly` - Detecção de anomalias em despesas
- `reduce_delinquency` - Estratégias para reduzir inadimplência
- `full_diagnostic` - Diagnóstico empresarial completo
- `calculate_indicators` - Indicadores de performance
- `closing_analysis` - Análise de fechamento contábil

**Página React**: `BusinessManager.tsx` - Interface do Gestor Empresarial com cards de análises

## Views Materializadas (CQRS)

| View | Propósito | Fonte de Dados | Refresh |
|------|-----------|----------------|---------|
| `mv_client_balances` | Saldos por cliente | `client_ledger` | 5 min |
| `mv_default_summary` | Resumo inadimplência | `invoices` + `clients` | 5 min |
| `mv_dre_monthly` | DRE mensal | `accounting_entry_items` | 5 min |
| `mv_cash_flow` | Fluxo de caixa | `invoices` + `expenses` | 5 min |
| `mv_trial_balance` | Balancete | `accounting_entry_items` | 5 min |

### Funções CQRS Disponíveis

| Função | Tipo | Descrição |
|--------|------|-----------|
| `cmd_create_accounting_entry()` | Command | Criar lançamento contábil |
| `qry_client_dashboard()` | Query | Dashboard do cliente |
| `qry_executive_summary()` | Query | Resumo executivo |
| `refresh_materialized_views()` | Utility | Atualizar todas as views |
| `get_current_tenant_id()` | RLS | Obter tenant atual |
| `user_has_permission()` | RLS | Verificar permissão |

## Padrões de Código

### Componentes React
```tsx
const Page = () => {
  const { selectedClientId } = useClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedClientId]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Conteúdo */}
      </div>
    </Layout>
  );
};
```

### Edge Functions
```typescript
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(url, key);
    const { action, ...data } = await req.json();

    // Lógica

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    });
  }
});
```

## Problemas Conhecidos e Soluções

### 1. Saldo de abertura não aparecia no dashboard
**Causa**: Só criava em `client_opening_balance`, não em `invoices`
**Solução**: Função `createInvoiceAndAccountingEntry` cria em todas as tabelas

### 2. Competência inconsistente
**Causa**: Formatos diferentes (MM/YYYY, YYYY-MM, Date)
**Solução**: Função `normalizeCompetenceLabel` padroniza

### 3. Valor do honorário errado no dashboard
**Causa**: Usava valor do invoice ao invés do `monthly_fee` do cadastro
**Solução**: `aggregateInvoicesByCompetence` usa `monthly_fee` quando disponível

### 4. Erros em Migrações SQL (28/11/2025)

#### 4.1 `ALTER TABLE IF NOT EXISTS` inválido
**Causa**: PostgreSQL não suporta `ALTER TABLE IF NOT EXISTS column`
**Solução**: Usar bloco `DO $$ BEGIN IF NOT EXISTS (SELECT FROM information_schema.columns...) THEN ALTER TABLE... END IF; END $$;`

#### 4.2 Coluna `client_id` não existe em `accounting_entries`
**Causa**: Schema usa `accounting_entry_items` para relação com cliente
**Solução**: Views materializadas devem usar `accounting_entry_items` ou `client_ledger`

#### 4.3 Coluna `transaction_type` não existe em `bank_transactions`
**Causa**: Schema real é diferente do planejado
**Solução**: Simplificar `mv_cash_flow` para usar `invoices` e `expenses`

#### 4.4 Coluna `payment_date` não existe
**Causa**: Invoices usa `due_date` para vencimento
**Solução**: Usar `due_date` ao invés de `payment_date`

#### 4.5 Conflito de timestamp em migrations
**Causa**: Múltiplas migrations com mesmo timestamp base (20251120)
**Solução**: Usar timestamps com precisão de segundos (20251120000200)

#### 4.6 Triggers automáticos criando entries órfãos (29/11/2025)
**Causa**: Triggers `trg_invoice_provision`, `trg_invoice_payment`, `trg_expense_provision`, `trg_expense_payment` buscavam contas por códigos específicos (`1.1.2.02`, `4.1.1`, `1.1.1.02`, `2.1.1.08`) que não existiam no plano de contas, resultando em `accounting_entries` sem linhas de débito/crédito.
**Solução**:
1. Remover os 4 triggers automáticos
2. Limpar entries órfãos: `DELETE FROM accounting_entries WHERE id NOT IN (SELECT DISTINCT entry_id FROM accounting_entry_lines)`
3. Usar "Processar Tudo" na Contabilidade Inteligente para recriar lançamentos
**Migration**: `20251129000000_remove_automatic_accounting_triggers.sql`

#### 4.7 Balancete com cálculo de saldo incorreto (29/11/2025)
**Causa**: Total Saldo Devedor mostrava R$ 209.566,44 (somando débito + crédito) ao invés de R$ 104.783,22
**Problemas identificados**:
1. Totais incluíam contas sintéticas (duplicando valores das contas filhas)
2. Agrupamento mostrava "null" porque contas dinâmicas não tinham campo `type`
3. Receita mostrava "D" ao invés de "C"
**Solução em `src/pages/Balancete.tsx`**:
1. Adicionado campo `isSynthetic` na interface `BalanceteEntry`
2. Cálculo único: `saldo = totalDebito - totalCredito` (positivo = D, negativo = C)
3. Totais filtram apenas contas analíticas: `entries.filter(entry => !entry.isSynthetic)`
4. Inferência de tipo por prefixo: 1=ATIVO, 2=PASSIVO, 3=RECEITA, 4=DESPESA, 5=PL

#### 4.8 DRE mostrando R$ 0,00 (29/11/2025 - RESOLVIDO)
**Causa**: DRE usava `invoices.status='paid'` para receitas, mas os honorários não estavam marcados como pagos
**Diferença**:
- Balancete usa `accounting_entry_lines` (fonte correta - dados contábeis)
- DRE usava `invoices` (fonte incorreta - dados operacionais)
**Solução implementada**: Refatorado DRE para usar `accounting_entry_lines` como fonte de dados
- Buscar todas as contas e filtrar 3.x/4.x em JavaScript
- Buscar todos os lançamentos e filtrar por data em JavaScript
- DRE agora mostra corretamente R$ 79.188,97 em receitas

#### 4.9 Supabase `.or()` e `!inner` não funcionam corretamente (29/11/2025)
**Problema identificado**: Filtros Supabase não retornavam resultados esperados
**Exemplos que falharam**:
```javascript
// NÃO FUNCIONA corretamente:
.or('code.like.3%,code.like.4%')
.select('entry_id!inner(entry_date, competence_date)')
.gte('entry_id.competence_date', startDate)
```
**Solução definitiva**: Buscar TODOS os dados e filtrar em JavaScript
```javascript
// FUNCIONA corretamente:
const { data: allAccounts } = await supabase.from('chart_of_accounts').select('*');
const accounts = allAccounts?.filter(acc =>
  acc.code.startsWith('3') || acc.code.startsWith('4')
) || [];

const { data: allLines } = await supabase.from('accounting_entry_lines').select('*');
const filteredLines = allLines?.filter(line => {
  const lineDate = line.entry_id?.competence_date || line.entry_id?.entry_date;
  return lineDate >= startDate && lineDate <= endDate;
}) || [];
```
**Arquivos afetados**: DRE.tsx, BalanceSheet.tsx
**Lição**: Para filtros complexos (OR, datas em joins, nulls), preferir filtrar em JavaScript

#### 4.10 Saldo de Abertura aparecendo na DRE (29/11/2025 - RESOLVIDO)
**Causa**: `smart-accounting` tratava `saldo_abertura` igual a `receita_honorarios`, creditando Receita (3.1.1.01)
**Problema contábil**:
- Saldo de abertura representa um ATIVO que já existia de período anterior
- A receita já foi reconhecida no período anterior
- Creditar Receita novamente = duplicação de receita na DRE

**Lançamento ERRADO (antes)**:
| | Conta | Valor |
|---|---|---|
| D | Clientes a Receber (1.1.2.01.xxx) | R$ X |
| C | Honorários Contábeis (3.1.1.01) | R$ X | ← ERRADO!

**Lançamento CORRETO (agora)**:
| | Conta | Valor |
|---|---|---|
| D | Clientes a Receber (1.1.2.01.xxx) | R$ X |
| C | Saldos de Abertura (5.2.1.02) | R$ X | ← PL, não Receita!

**Solução implementada**:
1. Adicionadas contas de Patrimônio Líquido (5.x) ao plano de contas padrão
2. Separado case `saldo_abertura` de `receita_honorarios` na edge function
3. Criada migration `20251129100000_fix_opening_balance_to_pl.sql` para corrigir entries existentes

**Arquivos afetados**:
- `supabase/functions/smart-accounting/index.ts`
- `supabase/migrations/20251129100000_fix_opening_balance_to_pl.sql`

**Lição**: Saldo de abertura é um ATIVO pré-existente, não receita do período atual

#### 4.11 Balanço Patrimonial desbalanceado (29/11/2025 - RESOLVIDO)
**Causa**: Balanço não incluía "Resultado do Exercício" na seção de Patrimônio Líquido
**Problema**: Ativo = R$ X, Passivo + PL = R$ Y (diferença de R$ 130.563,90)
**Solução**: Adicionada seção "Resultado do Exercício" no PL que busca da DRE
**Arquivo afetado**: `src/pages/BalanceSheet.tsx`
**Lição**: Resultado do Exercício (Receitas - Despesas) faz parte do PL até ser distribuído

## Migração Lovable → Gemini (29/11/2025)

### Contexto
O projeto Lovable foi descontinuado. Todas as Edge Functions que usavam o `ai.gateway.lovable.dev` foram migradas para usar a API do **Google Gemini diretamente**.

### Mudanças Principais
1. **Variáveis de ambiente**: `LOVABLE_API_KEY` → `GEMINI_API_KEY`
2. **URL da API**: `ai.gateway.lovable.dev` → `generativelanguage.googleapis.com`
3. **Formato da requisição**: OpenAI-compatible → Gemini native format
4. **Modelo**: `google/gemini-2.5-flash` → `gemini-2.0-flash`

### Helper Gemini Criado
Arquivo `supabase/functions/_shared/gemini.ts` com funções:
- `callGemini(messages, config)` - Chamada com mensagens
- `askGemini(prompt, systemPrompt)` - Chamada simples
- `askGeminiJSON<T>(prompt)` - Para respostas JSON estruturadas

### Funções Totalmente Migradas
- `ai-business-manager` - Gestor Empresarial IA
- `ai-accountant-background` - Contador IA Background
- `ai-chatbot` - Chatbot de atendimento

### Funções Parcialmente Migradas (22)
Variáveis de ambiente atualizadas, mas formato de requisição pode precisar ajuste:
- `ai-accountant-agent`, `ai-accounting-engine`, `ai-accounting-validator`
- `ai-automation-agent`, `ai-cash-flow-analyst`, `ai-churn-predictor`
- `ai-client-segmenter`, `ai-collection-agent`, `ai-contract-generator`
- `ai-email-composer`, `ai-expense-classifier`, `ai-financial-analyst`
- `ai-fraud-analyzer`, `ai-fraud-detector`, `ai-invoice-classifier`
- `ai-orchestrator`, `ai-partner-analyzer`, `ai-pix-reconciliation`
- `ai-pricing-optimizer`, `ai-reconciliation-agent`, `ai-revenue-predictor`
- `process-bank-statement`, `smart-reconciliation`

---

## Novas Funcionalidades (29/11/2025)

### Contador IA Automático
**Migrations**:
- `20251129120000_ai_accountant_automation.sql` - Base do sistema
- `20251129130000_ai_validation_queue.sql` - Sistema de fila

**Edge Functions**:
- `ai-accountant-background/index.ts` - Processamento em background

**Componentes**:
- `AIAccountantWidget.tsx` - Widget no dashboard

### Gestor Empresarial IA (MBA)
**Edge Functions**:
- `ai-business-manager/index.ts` - Análises empresariais

**Páginas**:
- `BusinessManager.tsx` - Interface do Gestor

**Rotas**: `/business-manager` (menu: Gestor IA)

---

## Novas Funcionalidades (30/11/2025) - VSCode Session

### Equipe de 8 Agentes IA

A Ampla Contabilidade agora possui uma equipe completa de agentes IA:

| Agente | Nome | Função | Especialidades |
|--------|------|--------|----------------|
| 🧮 | **Dr. Cícero** | Contador IA | Lançamentos, Plano de Contas, NBC/CFC, Balanço, DRE |
| 🧠 | **Prof. Milton** | MBA Finanças | Fluxo de Caixa, Custos, KPIs, Projeções, Orçamentos |
| 🤖 | **Dra. Helena** | Gestora IA | Metas, Indicadores, Processos, Estratégia |
| 🌐 | **Atlas** | Rede Neural | Aprendizado, Padrões, Classificação, Automação |
| ⚖️ | **Dr. Advocato** | Advogado Trabalhista | CLT, Jurisprudência TST/TRT, Riscos, Contratos |
| 🏢 | **Sr. Empresário** | Estrategista | Sociedades, Holdings, Terceirização, MEI/ME |
| 📈 | **Sr. Vendedor** | Comercial IA | Vendas, Prospecção, Retenção, Indicações |
| 📢 | **Sra. Marketing** | Marketing IA | Incentivos, PLR, Vídeos, Campanhas |

### Componentes de Interface IA

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `AITeamBadge` | `src/components/AITeamBadge.tsx` | Badge da equipe IA (compact/minimal/full) |
| `AIAssistantChat` | `src/components/AIAssistantChat.tsx` | Chat IA-Humano para formulários |
| `AIClassificationDialog` | `src/components/AIClassificationDialog.tsx` | Diálogo de classificação de transações |

### Sistema de Diálogo IA-Humano

**Conceito**: A IA aprende com o humano nos primeiros momentos.

**Exemplo**:
- Transação: "PAGAMENTO PIX - SERGIO CARNEIRO LEAO"
- IA pergunta: "Quem é Sérgio Carneiro Leão?"
- Humano responde: "É um sócio da empresa"
- IA salva o padrão e usa nas próximas classificações

**Tabelas de Aprendizado** (Migration `20251129280000`):
- `ai_known_entities` - Entidades conhecidas (pessoas, empresas)
- `ai_classification_patterns` - Padrões de classificação aprendidos
- `ai_classification_history` - Histórico para treinamento
- `ai_pending_questions` - Perguntas da IA aguardando resposta

### Novas Páginas Criadas

| Página | Rota | Descrição |
|--------|------|-----------|
| `Payroll.tsx` | `/payroll` | Folha de Pagamento com CRUD completo |
| `Inventory.tsx` | `/inventory` | Estoque e Compras com CRUD |
| `VideoContent.tsx` | `/video-content` | Vídeos e TVs com aba IA |
| `LaborAdvisory.tsx` | `/labor-advisory` | Consultoria Trabalhista IA |
| `FeatureRequests.tsx` | `/feature-requests` | Solicitações de Melhoria |
| `AINetwork.tsx` | `/ai-network` | Visualização Rede Neural (21 agentes) |

### Sistema de Folha de Pagamento (eSocial)

**Conceito**: Ao cadastrar funcionário, especifica:
- Quanto recebe **dentro da carteira** (oficial)
- Quanto recebe **por fora** (não registrado)
- A IA já sabe e gera a folha automaticamente

**Tabelas** (Migration `20251130070000`):
- `esocial_rubricas` - Códigos de eventos eSocial (32 rubricas)
- `payroll` - Folha de pagamento mensal
- `payroll_events` - Eventos/lançamentos da folha
- `tabela_inss` - Alíquotas INSS progressivo 2024
- `tabela_irrf` - Alíquotas IRRF 2024

**Rubricas eSocial**:
- 1xxx: Proventos oficiais (salário, hora extra, férias)
- 2xxx: Descontos oficiais (INSS, IRRF, VT)
- 9xxx: Pagamentos "por fora" (complemento, bonificação)

### Sistema de Estoque e Compras

**Tabelas** (Migration `20251130050000`):
- `office_products` - 36 produtos cadastrados
- `product_purchases` - Histórico de compras
- `product_consumption` - Registro de consumo
- `purchase_lists` - Listas de compras
- `suppliers` - Fornecedores (Atacadão, Bretas, Kalunga)

**Responsável**: Lilian (Faxineira) - registra consumo e informa estoque baixo

### Sistema de Consultoria Trabalhista

**Agentes Especializados**:
- **Dr. Advocato**: CLT, jurisprudência TST/TRT, riscos
- **Sr. Empresário**: Estruturação societária, holdings, MEI

**Estratégias de Solução**:
| Código | Nome | Eficácia |
|--------|------|----------|
| `MEI_FORMALIZATION` | Formalização como MEI | 9/10 |
| `CLT_REGULARIZATION` | Regularização via CLT | 10/10 |
| `PARTNER_INTEGRATION` | Integração Societária | 7/10 |
| `SERVICE_COMPANY` | Empresa Prestadora | 8/10 |
| `DIARISTA_CONTRACT` | Contrato Diarista | 9/10 |
| `STRUCTURED_OUTSOURCING` | Terceirização | 7/10 |

### Sistema de PLR e Incentivos

**Políticas para Funcionários**:
- `referral_bonus` - 15% do 1º honorário (máx R$ 1.000)
- `sales_commission` - 5% do valor
- `performance_bonus` - 10% sobre avaliação
- `retention_bonus` - 3% do honorário anual

**Pré-requisito**: Maturidade empresarial mínima de 70+ (score)

### Integração OpenAI Sora 2

**Capacidades**:
- Geração de vídeos de alta qualidade
- Áudio sincronizado automaticamente
- Duração: 5-60 segundos
- Resolução: até 4K

**Templates de Vídeo**:
| Template | Duração | Uso |
|----------|---------|-----|
| `VIDEO_INDICACAO` | 30s | Motivar funcionários |
| `VIDEO_TREINAMENTO_VENDAS` | 2 min | Ensinar técnicas |
| `VIDEO_INSTITUCIONAL` | 60s | Apresentar empresa |
| `VIDEO_PLR` | 45s | Explicar programa |

**Playlist por TV**:
- Recepção: Institucional, Dicas para clientes
- DP: Programa de indicações, Treinamentos
- Fiscal: Dicas fiscais, Atualizações legais
- RH: PLR, Incentivos, Treinamentos
- Diretoria: Resultados, KPIs, Estratégia

### CI/CD GitHub Actions

**Arquivos criados**:
- `.github/workflows/deploy.yml` - Deploy automático
- `.github/workflows/feature-implementation.yml` - Feature requests
- `.github/SETUP_CI_CD.md` - Documentação
- `scripts/setup-cicd.ps1` - Script de configuração

**Fluxo**:
```
Commit → GitHub → Actions → Supabase (migrations) + Vercel (frontend)
```

### Tela de Login Redesenhada

**Auth.tsx** com layout split:
- Lado esquerdo: Gradiente azul, diferenciais, serviços, missão
- Lado direito: Formulário de login/cadastro
- Logos SVG: `/public/logo-ampla.svg` e `/public/logo-ampla-white.svg`
- Mobile responsive com fallback

### Migrations Aplicadas (30/11/2025)

| Migration | Descrição |
|-----------|-----------|
| `20251130000000` | Limpeza contas bancárias duplicadas |
| `20251130010000` | Reset transações Janeiro |
| `20251130020000` | Contas e centros de custo sócios |
| `20251130030000` | Categorias despesas Sergio |
| `20251130040000` | Perfil empresa, funcionários |
| `20251130050000` | Sistema estoque e compras |
| `20251130060000` | Consultoria trabalhista IA |
| `20251130070000` | Folha pagamento eSocial |
| `20251130080000` | Governança IA, reuniões |
| `20251130090000` | Soluções de negócios |
| `20251130100000` | Incentivos, PLR |
| `20251130110000` | Geração conteúdo IA |
| `20251130120000` | Análise maturidade empresarial |
| `20251130130000` | OpenAI Sora 2 vídeos |
| `20251130140000` | Sistema evolução contínua |

---

## Novas Funcionalidades (09/06/2025) - Sessão 13

### Sistema de Realtime (Supabase Realtime)

**Conceito**: Atualizações em tempo real no frontend quando dados mudam no banco.

**Hook Criado**: `src/hooks/useRealtimeSubscription.ts`

```typescript
// Para múltiplas tabelas
export function useRealtimeSubscription(
  tables: Array<{ table: string; events?: ('INSERT' | 'UPDATE' | 'DELETE')[]; }>,
  onDataChange: (payload: any, table: string) => void
): void

// Para uma tabela única (mais simples)
export function useTableRealtime(
  table: string,
  onDataChange: (payload: any) => void,
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[]
): void
```

**Uso nos componentes**:
```typescript
import { useTableRealtime } from '@/hooks/useRealtimeSubscription';

// Dentro do componente
useTableRealtime('accounts_payable', () => {
  refetch(); // Recarrega dados quando há mudanças
});
```

**Páginas com Realtime Ativo**:
| Página | Tabela | Indicador Visual |
|--------|--------|------------------|
| `RecurringExpenses.tsx` | `accounts_payable` | Badge "Ao vivo 🟢" |
| `AccountsPayable.tsx` | `accounts_payable` | Badge "Ao vivo 🟢" |
| `Clients.tsx` | `clients` | Badge "Ao vivo 🟢" |
| `Invoices.tsx` | `invoices` | Badge "Ao vivo 🟢" |

**Nota Técnica**: O Supabase client TypeScript tem tipagem estrita. Usamos `(channel as any).on()` para bypass quando necessário.

### Importação de Despesas (Janeiro 2025)

**Script**: `scripts/import_jan2025.py`

**Características**:
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS
- Busca user_id via `s.auth.admin.list_users()`
- Processa planilha Excel com múltiplas categorias

**Resultado da Importação**:
| Categoria | Qtd | Valor Total |
|-----------|-----|-------------|
| SERGIO (pessoais) | 12 | R$ 12.845,55 |
| AMPLA - CONTAS FIXAS | 4 | R$ 10.628,33 |
| AMPLA - IMPOSTOS | 9 | R$ 24.655,44 |
| AMPLA - CONTAS VARIÁVEIS | 3 | R$ 3.218,62 |
| AMPLA - SERVIÇO TERCEIROS | 7 | R$ 52.300,00 |
| AMPLA - FOLHA PAGAMENTO | 7 | R$ 58.276,55 |
| AMPLA - MATERIAL DE CONSUMO | 4 | R$ 4.232,88 |
| **TOTAL** | **46** | **R$ 166.157,37** |

**User ID para Importações**: `e3a168e5-4339-4c7c-a8e2-dd2ee84daae9`

### Limpeza do Repositório GitHub

**Branches removidos**: 42 branches do Copilot coding agent
- Formato: `copilot/fix-*`
- Comando: `gh api -X DELETE repos/amplabusiness/data-bling-sheets-3122699b/git/refs/heads/BRANCH_NAME`

**Status do Deploy**:
- Deploy #78 bem-sucedido no Vercel
- Build passa em ~10.81s
- URL: https://ampla.vercel.app

### Commits da Sessão 13

| Commit | Descrição |
|--------|-----------|
| `e2b3152` | feat: add realtime subscriptions to main data pages |
| `5dbd1e8` | feat: add January 2025 expense import script |

---

## Variáveis de Ambiente Críticas

### .env (Local e Produção)
```env
# Supabase
VITE_SUPABASE_URL=https://xdtlhzysrpoinqtsglmr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...  # Anon key (pública)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Service role (NUNCA expor no frontend!)

# Google Gemini
GEMINI_API_KEY=AIza...

# API Brasil (enriquecimento de dados)
API_BRASIL_TOKEN=...

# Vercel (gerado automaticamente)
VERCEL_TOKEN=...
```

**Importante**: `SUPABASE_SERVICE_ROLE_KEY` só deve ser usado em scripts backend e Edge Functions!

---

## Próximos Passos (Roadmap)
Ver arquivo ROADMAP.md

## Configuração do Ambiente

### Supabase
- **Project ID**: xdtlhzysrpoinqtsglmr
- **URL**: https://xdtlhzysrpoinqtsglmr.supabase.co
- **CLI**: v2.58.5 instalado

### Context7 MCP (Claude Code)
- **Config**: `/root/.claude/settings.json`
- **API Key**: `ctx7sk-1830c450-44b8-4e4a-b92c-883bac1ee356`
- **URL**: `https://mcp.context7.com/mcp`

### GitHub
- **Repo**: amplabusiness/data-bling-sheets-3122699b
- **Branch principal**: main

### Credenciais (NUNCA no Git!)
```
.env              → Local (ignorado pelo git)
.env.example      → Template (vai pro git)
Vercel Env Vars   → Produção
Supabase Secrets  → Edge Functions
```

### Setup para Nova Máquina
```bash
# 1. Clonar repositório
git clone https://github.com/amplabusiness/data-bling-sheets-3122699b.git

# 2. Instalar dependências
npm install

# 3. Copiar variáveis de ambiente
cp .env.example .env
# Editar .env com as credenciais corretas

# 4. Linkar Supabase (obter token em supabase.com/dashboard/account/tokens)
supabase link --project-ref xdtlhzysrpoinqtsglmr

# 5. Rodar localmente
npm run dev
```

### Deploy para Produção
```bash
# Frontend (Vercel)
vercel --prod

# Edge Functions (Supabase)
supabase functions deploy

# Migrations (Supabase)
supabase db push
```

---

## Guia Rápido para Novos Agentes IA

### ⚡ Início Rápido

1. **Leia este arquivo primeiro** - Contém toda a arquitetura e decisões importantes
2. **Leia `.claude/ROADMAP.md`** - Para entender o que está planejado
3. **Leia `IMPLEMENTACAO_HONORARIOS.md`** - Documentação técnica detalhada do sistema de honorários

### 📁 Arquivos Mais Importantes

| Arquivo | Por quê? |
|---------|----------|
| `src/App.tsx` | Todas as rotas da aplicação |
| `src/components/AppSidebar.tsx` | Menu de navegação |
| `src/integrations/supabase/client.ts` | Cliente Supabase |
| `src/hooks/useRealtimeSubscription.ts` | Realtime subscriptions |
| `.env` | Variáveis de ambiente (não commitado) |

### 🗄️ Tabelas Principais do Supabase

| Tabela | Propósito |
|--------|-----------|
| `clients` | Clientes do escritório |
| `invoices` | Faturas/honorários |
| `accounts_payable` | Despesas a pagar |
| `accounting_entries` | Lançamentos contábeis |
| `accounting_entry_lines` | Linhas de débito/crédito |
| `chart_of_accounts` | Plano de contas |
| `bank_transactions` | Transações bancárias |

### 🔧 Comandos Úteis

```bash
# Rodar frontend local
npm run dev

# Build para verificar erros
npm run build

# Importar dados com Python
python scripts/import_jan2025.py

# Deploy frontend
vercel --prod

# Deploy Edge Functions
supabase functions deploy

# Ver logs do Supabase
supabase functions logs FUNCTION_NAME
```

### 🚫 O que NÃO fazer

1. **Nunca commitar `.env`** - Tem credenciais sensíveis
2. **Nunca usar `anon_key` para bypass de RLS** - Use `service_role_key` em scripts
3. **Nunca modificar views materializadas diretamente** - Use as funções de refresh
4. **Nunca criar triggers que buscam contas por código fixo** - Contas podem não existir

### ✅ Padrões a Seguir

1. **Realtime**: Use `useTableRealtime()` para atualizar dados em tempo real
2. **Filtros complexos**: Busque todos os dados e filtre em JavaScript (Supabase `.or()` tem limitações)
3. **Imports de dados**: Use Python com `service_role_key` e especifique `created_by`
4. **Lançamentos contábeis**: Sempre use `smart-accounting` Edge Function

### 📊 Sessões Anteriores (Resumo)

| Sessão | Data | Principais Entregas |
|--------|------|---------------------|
| 1-10 | Nov/2025 | Base do sistema, migrações, equipe IA |
| 11 | 30/11/2025 | CI/CD, folha de pagamento, estoque |
| 12 | 30/11/2025 | Correção de logo, deploy #78 |
| 13 | 09/06/2025 | Realtime, import Jan/2025, limpeza GitHub |

### 🎯 Próximas Prioridades

1. Completar RLS por tenant (Multi-tenancy)
2. Criar interfaces pendentes (Estoque, Folha, etc.)
3. Implementar conciliação 100% automática
4. Fechamento contábil automatizado

**Para mais detalhes**: Ver `.claude/ROADMAP.md`

---

## Correções de Bugs (06/12/2025) - Sessão 14

### Análise Completa de Código

Foi realizada uma análise completa do codebase identificando **13 bugs**, sendo **5 críticos**. Todos os bugs críticos e de alta prioridade foram corrigidos.

### Bugs Críticos Corrigidos

#### 1. Rotas Duplicadas no App.tsx
**Arquivos**: `src/App.tsx`
**Problema**: Rotas `/import-invoices`, `/ai-agents`, `/settings` estavam definidas duas vezes, causando conflitos de navegação.
**Correção**: Removidas as rotas duplicadas (linhas 137, 169, 193).

```tsx
// REMOVIDO (duplicatas):
<Route path="/import-invoices" element={<ImportInvoices />} />  // linha 137
<Route path="/ai-agents" element={<AIAgents />} />              // linha 169
<Route path="/settings" element={<Settings />} />                // linha 193
```

#### 2. Memory Leak no DefaultReportImporter.tsx
**Arquivos**: `src/components/DefaultReportImporter.tsx`
**Problema**: `setInterval` criado para simular progresso não era limpo nos early returns, causando vazamento de memória.
**Correção**: Adicionado `clearInterval(progressInterval)` antes de cada `return` nas condições de erro.

```tsx
// ANTES (vazamento):
if (!user) {
  toast.error("Usuário não autenticado");
  return;  // interval continua rodando!
}

// DEPOIS (corrigido):
if (!user) {
  clearInterval(progressInterval);  // ADICIONADO
  toast.error("Usuário não autenticado");
  return;
}
```

#### 3. DOMParser Indisponível em Ambientes Não-Browser
**Arquivos**: `src/lib/ofxParser.ts`
**Problema**: `DOMParser` é uma API exclusiva de browser, causando erro em Node.js/Workers/SSR.
**Correção**: Adicionada verificação de disponibilidade antes de usar.

```typescript
// ADICIONADO:
if (typeof DOMParser === 'undefined') {
  return {
    success: false,
    error: 'XML parsing not available in this environment. DOMParser is only available in browser contexts.'
  };
}
```

#### 4. Race Condition no ExpenseUpdateContext.tsx
**Arquivos**: `src/contexts/ExpenseUpdateContext.tsx`
**Problema**: Usar `useState` para `listeners` causava stale closures - callbacks antigos eram chamados quando listeners mudavam.
**Correção**: Substituído `useState` por `useRef` para evitar recriação de callbacks.

```tsx
// ANTES (race condition):
const [listeners, setListeners] = useState<Set<() => void>>(new Set());
const notifyExpenseChange = useCallback(() => {
  listeners.forEach(listener => listener());  // pode estar desatualizado
}, [listeners]);  // recria função a cada mudança

// DEPOIS (corrigido):
const listenersRef = useRef<Set<() => void>>(new Set());
const notifyExpenseChange = useCallback(() => {
  listenersRef.current.forEach(listener => listener());  // sempre atual
}, []);  // callback estável
```

#### 5. Variável Não Utilizada no AccountingService.ts
**Arquivos**: `src/services/AccountingService.ts`
**Problema**: Variável `entryType` declarada mas não usada, ternário recalculado desnecessariamente.
**Correção**: Uso da variável declarada ao invés de recalcular.

```typescript
// ANTES:
const entryType = params.isCredit ? 'recebimento' : 'pagamento_despesa';
return this.createEntry({
  entryType: params.isCredit ? 'recebimento' : 'pagamento_despesa',  // recalculado!
  ...
});

// DEPOIS:
const entryType = params.isCredit ? 'recebimento' : 'pagamento_despesa';
return this.createEntry({
  entryType,  // usa a variável declarada
  ...
});
```

### Bugs de Alta Prioridade Corrigidos

#### 6. Null Safety no FileImporter.tsx
**Arquivos**: `src/components/FileImporter.tsx`
**Problema**: Acesso a propriedades de `data` sem verificação de null.
**Correção**: Adicionado optional chaining (`?.`).

```typescript
// ANTES:
if (data.success) { ... }

// DEPOIS:
if (data?.success) { ... }
```

#### 7. Error Handling no Auth.tsx
**Arquivos**: `src/pages/Auth.tsx`
**Problema**: `getSession()` não tratava erros, usuário ficava preso na tela de login.
**Correção**: Adicionado tratamento de erro com `.catch()`.

```typescript
// ANTES:
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) navigate("/dashboard");
});

// DEPOIS:
supabase.auth.getSession().then(({ data: { session }, error }) => {
  if (error) {
    console.error("Session check error:", error);
    return;
  }
  if (session) navigate("/dashboard");
}).catch(err => {
  console.error("Unexpected error checking session:", err);
});
```

#### 8. Validação NaN no AppSidebar.tsx
**Arquivos**: `src/components/AppSidebar.tsx`
**Problema**: `parseInt` poderia retornar `NaN` se sessionStorage tivesse valor corrompido.
**Correção**: Validação do resultado antes de usar.

```typescript
// ANTES:
scrollContainerRef.current.scrollTop = parseInt(savedPosition, 10);

// DEPOIS:
const position = parseInt(savedPosition, 10);
if (!isNaN(position) && position >= 0) {
  scrollContainerRef.current.scrollTop = position;
}
```

### Bugs Identificados mas Não Corrigidos (Menor Prioridade)

| Bug | Arquivo | Descrição | Impacto |
|-----|---------|-----------|---------|
| Tipo `any` excessivo | Vários | 30+ instâncias de `any` em Expenses.tsx, Clients.tsx | Fraco |
| JSON.stringify em deps | useRealtimeSubscription.ts | Performance em comparação de subscriptions | Médio |
| Erro silencioso | Invoices.tsx | Catch block só loga, não mostra ao usuário | Médio |
| loadClients repetido | Layout.tsx | Chamado múltiplas vezes sem debounce | Baixo |
| Cast inseguro | AIExecutionHistory.tsx | Uso de `as any` para tabelas | Baixo |

### Commit da Sessão 14

| Commit | Branch | Descrição |
|--------|--------|-----------|
| `9b4c668` | `claude/analyze-code-bugs-01YaXKxfLR6PhBJT4MEPn4uJ` | fix: Corrige múltiplos bugs críticos identificados na análise |

### Arquivos Modificados

```
src/App.tsx                              # Rotas duplicadas removidas
src/components/AppSidebar.tsx            # Validação NaN
src/components/DefaultReportImporter.tsx # Memory leak corrigido
src/components/FileImporter.tsx          # Null safety
src/contexts/ExpenseUpdateContext.tsx    # Race condition corrigido
src/lib/ofxParser.ts                     # DOMParser check
src/pages/Auth.tsx                       # Error handling
src/services/AccountingService.ts        # Variável não usada
```

### Lições Aprendidas

1. **setInterval sempre precisa de cleanup** - Principalmente em early returns
2. **useState vs useRef para callbacks** - Use `useRef` quando callbacks precisam acessar valores mutáveis
3. **APIs de browser não existem em todos os ambientes** - Sempre verificar disponibilidade
4. **Rotas React Router não validam duplicatas** - Só a primeira definição é usada
5. **Optional chaining (`?.`) é essencial** - Sempre usar ao acessar dados de APIs

---

## Referência Rápida para Correção de Bugs

### Checklist de Análise de Código

- [ ] Memory leaks (setInterval, setTimeout, event listeners)
- [ ] Race conditions (useCallback com dependências mutáveis)
- [ ] Null/undefined safety (optional chaining)
- [ ] Error handling (try/catch, .catch())
- [ ] Rotas duplicadas (React Router)
- [ ] APIs de ambiente específico (DOMParser, window, document)
- [ ] Variáveis não utilizadas
- [ ] Tipos `any` desnecessários

### Ferramentas de Análise

```bash
# ESLint para análise estática
npm run lint

# Build para verificar erros de tipo
npm run build

# Buscar padrões problemáticos
grep -r "setInterval" src/ --include="*.tsx"
grep -r "useState.*Set\|Map" src/ --include="*.tsx"
grep -r ": any" src/ --include="*.tsx" | wc -l
```
