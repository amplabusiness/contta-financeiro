# Ampla Contabilidade - Memória do Projeto

**Última Atualização**: 2025-12-15 (Sessão 31)

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

---

## Correções Adicionais (06/12/2025) - Sessão 15

### Continuação da Análise de Bugs

Correções adicionais realizadas após a análise inicial da Sessão 14.

### Bugs de Média Prioridade Corrigidos

#### 1. Chamadas Duplicadas de loadClients no Layout.tsx
**Arquivo**: `src/components/Layout.tsx`
**Problema**: `loadClients()` era chamada tanto no `getSession()` quanto no `onAuthStateChange`, causando requisições duplicadas.
**Correção**: Adicionado `useRef` para rastrear estado de carregamento e prevenir chamadas simultâneas.

```tsx
// ANTES:
useEffect(() => {
  supabase.auth.getSession().then(({ session }) => {
    if (session) loadClients(); // Chamada 1
  });
  supabase.auth.onAuthStateChange((_, session) => {
    if (session) loadClients(); // Chamada 2 (duplicada!)
  });
}, []);

// DEPOIS:
const isLoadingClientsRef = useRef(false);
const clientsLoadedRef = useRef(false);

const loadClients = useCallback(async () => {
  if (isLoadingClientsRef.current || clientsLoadedRef.current) return;
  isLoadingClientsRef.current = true;
  // ... carrega clientes
  clientsLoadedRef.current = true;
  isLoadingClientsRef.current = false;
}, []);
```

#### 2. Tipagem Incorreta no AIExecutionHistory.tsx
**Arquivo**: `src/components/AIExecutionHistory.tsx`
**Problema**: Uso de `any` para `details` e casts inseguros com `as any`.
**Correção**: Tipagem correta com `Record<string, unknown>` e eslint-disable para tabela dinâmica.

```tsx
// ANTES:
details: any;
.from('automation_logs' as any)
setLogs((data as any) || []);

// DEPOIS:
details: Record<string, unknown> | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data } = await (supabase as any).from('automation_logs')...
setLogs((data as ExecutionLog[]) || []);
```

#### 3. Código Duplicado no Clients.tsx
**Arquivo**: `src/pages/Clients.tsx`
**Problema**: Condições de filtro duplicadas causando erro de lint.
**Correção**: Remoção do código duplicado.

#### 4. Falso Positivo de React Hooks no VideoContent.tsx
**Arquivo**: `src/pages/VideoContent.tsx`
**Problema**: Função `useSuggestion` interpretada como hook pelo ESLint por começar com "use".
**Correção**: Renomeada para `applySuggestion`.

### Erros de Lint Corrigidos (52 → 35)

| Arquivo | Erro | Correção |
|---------|------|----------|
| `CostCenterAnalysis.tsx` | `no-constant-binary-expression` | eslint-disable comment |
| `EconomicGroupAnalysis.tsx` | `@ts-ignore` | Trocado por `@ts-expect-error` |
| `ai-accounting-engine/index.ts` | `no-case-declarations` (8x) | Blocos `{}` nos cases |
| `ai-automation-agent/index.ts` | `no-case-declarations` (4x) + `prefer-const` | Blocos `{}` e `const` |

### Commits da Sessão 15

| Commit | Descrição |
|--------|-----------|
| `43a4b57` | fix: Corrige bugs adicionais e erros de lint |

### Arquivos Modificados

```
src/components/AIExecutionHistory.tsx  # Tipagem correta
src/components/Layout.tsx              # Previne chamadas duplicadas
src/pages/Clients.tsx                  # Remove código duplicado
src/pages/CostCenterAnalysis.tsx       # eslint-disable
src/pages/EconomicGroupAnalysis.tsx    # @ts-expect-error
src/pages/Invoices.tsx                 # prefer-const
src/pages/VideoContent.tsx             # Renomeia useSuggestion
supabase/functions/ai-accounting-engine/index.ts  # Blocos em cases
supabase/functions/ai-automation-agent/index.ts   # Blocos em cases
```

### Correção Final: Function Types (35 → 0 erros)

Substituído tipo genérico `Function` por `LogFunction` tipado em todas as Edge Functions:

```typescript
// ANTES:
log: Function

// DEPOIS:
type LogFunction = (msg: string) => void;
log: LogFunction
```

**Arquivos corrigidos:**
- `supabase/functions/ai-accounting-engine/index.ts`
- `supabase/functions/ai-automation-agent/index.ts`
- `supabase/functions/ai-bank-transaction-processor/index.ts`
- `supabase/functions/ai-initial-load/index.ts`
- `supabase/functions/ai-orchestrator/index.ts`

### Resultado Final da Sessão 15

| Métrica | Início | Final |
|---------|--------|-------|
| Erros de Lint | 52 | **0** |
| Warnings | 875 | 871 |
| Build | ✅ | ✅ |

### Commits da Sessão 15

| Commit | Descrição |
|--------|-----------|
| `43a4b57` | fix: Corrige bugs adicionais e erros de lint |
| `850bf6c` | docs: Atualiza MEMORY.md com correções da Sessão 15 |
| `5df05e4` | fix: Elimina todos os erros de lint (0 erros restantes) |

---

## Sessão 16 (10/12/2025) - Dr. Cícero Contador IA

### Implementação do Dr. Cícero - Contador IA Guardian

**Conceito**: Dr. Cícero é o contador IA responsável por TODA classificação contábil. Nenhum lançamento é feito sem a aprovação dele.

### Edge Function Criada

**Arquivo**: `supabase/functions/dr-cicero-contador/index.ts`

**Actions disponíveis**:
| Action | Descrição |
|--------|-----------|
| `analyze_transaction` | Analisa e classifica uma transação bancária |
| `create_entry` | Cria lançamento contábil após aprovação |
| `learn_classification` | Aprende novo padrão de classificação |
| `process_batch` | Processa lote de transações |
| `init_database` | Verifica/inicializa tabela de padrões |

### Tabela de Padrões Aprendidos

**Migration**: `supabase/migrations/20250110_ai_learned_patterns.sql`

**Estrutura**:
```sql
CREATE TABLE ai_learned_patterns (
  id UUID PRIMARY KEY,
  description_pattern TEXT NOT NULL UNIQUE,
  entry_type TEXT NOT NULL,
  debit_account TEXT NOT NULL,
  debit_account_name TEXT,
  credit_account TEXT NOT NULL,
  credit_account_name TEXT,
  entry_description TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.9,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

**Padrões Iniciais (10)**:
- TARIFA, TED, DOC → Tarifas Bancárias
- LIQ.COBRANCA, RECEBIMENTO PIX → Recebimentos
- ENERGIA, CEMIG → Energia Elétrica
- TELEFONE, INTERNET → Telefone/Internet
- ALUGUEL → Aluguel

**Padrões da Família Leão (18)**:
- AMPLA SAUDE/SAÚDE → Investimento (1.2.1.01)
- SERGIO AUGUSTO, FACULDADE, MEDICINA → Adiantamento Sérgio Augusto (1.1.3.03)
- VICTOR HUGO → Adiantamento Victor Hugo (1.1.3.04)
- NAYARA, BABA/BABÁ → Adiantamento Nayara (1.1.3.05)
- CARLA LEAO/LEÃO → Adiantamento Carla (1.1.3.02)
- SERGIO CARNEIRO, CASA → Adiantamento Sérgio Carneiro (1.1.3.01)
- SITIO/SÍTIO → Adiantamento Sítio (1.1.3.99)

### Contexto da Família Leão

**REGRA FUNDAMENTAL**: Todo gasto da família = ADIANTAMENTO A SÓCIOS (NUNCA despesa operacional!)

**Membros da Família**:
| Membro | Relação | Conta | Centro de Custo |
|--------|---------|-------|-----------------|
| Sérgio Carneiro Leão | Fundador | 1.1.3.01 | SÉRGIO CARNEIRO |
| Carla Leão | Esposa | 1.1.3.02 | CARLA LEÃO |
| Sérgio Augusto | Filho (Ampla Saúde) | 1.1.3.03 | SÉRGIO AUGUSTO |
| Victor Hugo | Filho (Legalização) | 1.1.3.04 | VICTOR HUGO |
| Nayara | Filha (Admin) | 1.1.3.05 | NAYARA |

**Investimentos**:
- Ampla Saúde (Clínica Médica do Trabalho) → 1.2.1.01 Investimentos

**Imóveis**:
- Sede própria → Despesa da empresa (CC: EMPRESA/SEDE)
- Casa do Sérgio, Sítio → Adiantamento a Sócios

### Integração com SuperConciliador

**Arquivo modificado**: `src/pages/SuperConciliador.tsx`

**Novos recursos**:
1. Botão "Dr. Cícero" para processar todas transações pendentes
2. Dialog de classificação com pergunta/resposta
3. Classificação individual com confirmação
4. Identificação automática de CPF/CNPJ em PIX

**Interface DrCiceroClassification**:
```typescript
interface DrCiceroClassification {
  confidence: number;
  debit_account: string;
  debit_account_name: string;
  credit_account: string;
  credit_account_name: string;
  entry_type: string;
  description: string;
  needs_confirmation: boolean;
  question?: string;
  options?: string[];
  reasoning: string;
}
```

### Funções de Detecção de Família

**Função**: `identificarFamiliaLeao(desc: string)`

Detecta automaticamente:
- Nomes dos membros da família
- Ampla Saúde (investimento)
- Sítio, casa, despesas pessoais
- Babá (despesa da Nayara)

### Plano de Contas Atualizado

**Novas contas de Adiantamento a Sócios**:
- 1.1.3.01 - Sérgio Carneiro Leão
- 1.1.3.02 - Carla Leão
- 1.1.3.03 - Sérgio Augusto
- 1.1.3.04 - Victor Hugo
- 1.1.3.05 - Nayara
- 1.1.3.99 - Família (geral/sítio)

**Nova conta de Investimento**:
- 1.2.1.01 - Investimentos - Ampla Saúde

### Centros de Custo para Família

- EMPRESA/SEDE - Despesas operacionais
- SÓCIOS/FAMÍLIA - Movimentações particulares
- SÉRGIO CARNEIRO - Adiantamentos do fundador
- CARLA LEÃO - Adiantamentos da sócia
- SÉRGIO AUGUSTO - Adiantamentos (Ampla Saúde)
- VICTOR HUGO - Adiantamentos
- NAYARA - Adiantamentos (inclui babá)
- SÍTIO - Despesas do sítio de lazer
- AMPLA SAÚDE - Investimentos na clínica

### Lições Aprendidas

1. **Empresa familiar precisa separar gastos pessoais** - Tudo que for da família vai para Adiantamento a Sócios, nunca para despesa operacional
2. **Investimentos em outras empresas** - Controlados em conta de Ativo (1.2.1.xx) para futura devolução
3. **Centro de Custo é essencial** - Permite rastrear para quem foi cada gasto
4. **IA com contexto** - O Dr. Cícero recebe todo o contexto da família para classificar corretamente

### Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/functions/dr-cicero-contador/index.ts` | Criado | Edge Function do Dr. Cícero |
| `supabase/migrations/20250110_ai_learned_patterns.sql` | Criado | Tabela de padrões |
| `src/pages/SuperConciliador.tsx` | Modificado | Dialog Dr. Cícero, funções IA |
| `src/components/AppSidebar.tsx` | Modificado | Menu simplificado |
| `scripts/run-migration.mjs` | Criado | Script para verificar tabela |

### Deploy

- Edge Function deployada no Supabase
- Tabela ai_learned_patterns criada com 10 padrões iniciais
- Padrões da família Leão adicionados (18 padrões)

---

## Sessão 17 (10/12/2025) - Correções Dr. Cícero e Período de Abertura

### Correção de Sinais nas Transações Bancárias

**Problema identificado**: Transações de janeiro/2025 com sinais invertidos
- CREDIT (recebimentos) aparecendo como negativos
- DEBIT (pagamentos) aparecendo como positivos

**Causa raiz**:
1. Coluna no banco é `type`, mas código usava `transaction_type`
2. Sinais não estavam sendo convertidos corretamente na importação OFX

**Correções aplicadas**:

1. **SuperConciliador.tsx** - Mapeamento correto ao carregar transações:
```typescript
const mappedData = (data || []).map(tx => ({
  ...tx,
  transaction_type: tx.type as 'credit' | 'debit',
  amount: Math.abs(tx.amount) // Valor sempre positivo para display
}));
```

2. **Correção direta no Supabase** - 31 transações DEBIT corrigidas de positivo para negativo

3. **Nova action no Dr. Cícero**: `validate_transaction_signs`
   - Detecta automaticamente sinais incorretos
   - Pode corrigir com `auto_fix=true`
   - Parâmetros: `bank_account_id`, `date_from`, `date_to`

### Regra de Período de Abertura (Janeiro/2025)

**Conceito**: Janeiro/2025 é o primeiro mês do sistema. Recebimentos são de competências anteriores.

**Lógica contábil correta**:

1. **Saldo de Abertura já registrado**:
   - `D: Clientes a Receber (1.1.2.xx) | C: Saldos de Abertura (5.2.1.02)`

2. **Quando cliente paga em janeiro**:
   - `D: Banco (1.1.1.02) | C: Clientes a Receber (1.1.2.01)`
   - **BAIXA** o saldo do cliente, NÃO gera receita nova

3. **Resultado**:
   - Não distorce o DRE de 2025 (não cria receita fictícia)
   - Saldo de Clientes a Receber diminui conforme pagamentos entram

**Código adicionado ao Dr. Cícero**:
```typescript
const PERIODO_ABERTURA = {
  inicio: '2025-01-01',
  fim: '2025-01-31'
};

function isPeriodoAbertura(date: string): boolean {
  const txDate = new Date(date);
  const inicio = new Date(PERIODO_ABERTURA.inicio);
  const fim = new Date(PERIODO_ABERTURA.fim);
  return txDate >= inicio && txDate <= fim;
}
```

**Classificação automática para recebimentos em janeiro**:
- entry_type: `recebimento_abertura`
- D: Banco (1.1.1.02)
- C: Clientes a Receber (1.1.2.01)
- needs_confirmation: false (regra fixa)

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/SuperConciliador.tsx` | Mapeamento type → transaction_type |
| `supabase/functions/dr-cicero-contador/index.ts` | Action validate_transaction_signs, regra período abertura |

### Lições Aprendidas

1. **Colunas do banco vs código**: Sempre verificar se os nomes das colunas coincidem
2. **Período de abertura**: Recebimentos do primeiro mês não são receita, são baixa de recebíveis
3. **Validação de sinais**: CREDIT = positivo, DEBIT = negativo (padrão contábil)

---

## Sessão 18 (10/12/2025) - Identificação de Sócios nos Pagamentos

### Funcionalidade Implementada

**Problema**: Clientes às vezes pagam pela conta pessoal de sócios/familiares, não pela empresa.
- Ex: Paula Milhomem (filha) paga pelo Restaurante Iuvaci
- Ex: Enzo Donadi (proprietário) paga pela Crystal, ECD ou Verdi

**Solução**: Dr. Cícero agora consulta o QSA (Quadro de Sócios e Administradores) de todos os clientes para identificar quem está pagando.

### Novas Actions no Dr. Cícero

| Action | Descrição |
|--------|-----------|
| `identify_payer_by_name` | Identifica pagador pelo nome na descrição do PIX/TED |
| `build_client_index` | Constrói índice de todos sócios → empresas |

### Lógica de Classificação Automática

**1. Se sócio tem APENAS UMA EMPRESA:**
- Classifica automaticamente como honorário daquela empresa
- Exemplo: IUVACI MILHOMEM → Restaurante Iuvaci (único)
- `needs_confirmation: false`

**2. Se sócio tem MÚLTIPLAS EMPRESAS:**
- Dr. Cícero pergunta ao usuário qual empresa
- Exemplo: ENZO DONADI → Crystal, ECD ou Verdi?
- `needs_confirmation: true`
- Opções incluem todas as empresas do sócio

### Estatísticas do Índice

Dados extraídos do Supabase:
- **217 clientes** no cadastro
- **211 clientes** com QSA preenchido
- **325 sócios** no total
- **207 sócios únicos** (alguns são sócios de múltiplas empresas)

### Exemplos de Identificação Testados

| Descrição do PIX | Resultado |
|------------------|-----------|
| PIX RECEBIDO - ENZO DE AQUINO ALVES DONADI | ⚠️ 3 empresas (Crystal, ECD, Verdi) - pergunta |
| PIX RECEBIDO - IUVACI OLIVEIRA MILHOMEM | ✅ 1 empresa (Restaurante Iuvaci) - classifica |
| PIX RECEBIDO CARLOS HENRY MILHOMEM | ⚠️ Encontrado como Administrador do Restaurante Iuvaci |
| PIX RECEBIDO SERGIO CARNEIRO LEAO | ⚠️ 6 empresas (Ampla, Prest Lixo, etc.) |
| PIX BARBOSA JUNIOR | ⚠️ Múltiplas empresas de Avenir Barbosa Junior |

### Funções Auxiliares Criadas

**`normalizeForSearch(text: string)`**
- Remove acentos
- Converte para minúsculas
- Normaliza espaços

**`extractNamesFromDescription(description: string)`**
- Extrai possíveis nomes da descrição bancária
- Remove prefixos: PIX, TRANSF, TED, DOC, SICREDI
- Remove CPF/CNPJ numéricos
- Remove datas e valores

**`identifyPayerByName(supabase, searchText)`**
- Busca todos clientes com QSA
- Calcula score de match (0-100)
- Match exato = 100
- Match parcial proporcional ao número de partes do nome
- Bônus de +15 se sobrenome bate

### Integração com ruleBasedClassificationAsync

A classificação baseada em regras agora é **assíncrona** e consulta os QSAs:

```typescript
// PRIORIDADE 0: Se é recebimento, tentar identificar pagador pelo nome no QSA
if (isCredit && !clientInfo) {
  const payerResult = await identifyPayerByName(supabase, transaction.description);

  if (payerResult.found && payerResult.confidence >= 0.5) {
    // Se tem APENAS UMA EMPRESA, classificar direto!
    if (uniqueClients.length === 1) {
      return { confidence: 0.90, needs_confirmation: false, ... };
    }

    // Se tem MÚLTIPLAS EMPRESAS, perguntar ao usuário
    if (uniqueClients.length > 1) {
      return { needs_confirmation: true, question: '...', options: [...] };
    }
  }
}
```

### Correção de Schema

**Problema encontrado**: Coluna `fantasy_name` não existe, é `nome_fantasia`

**Correção**: Substituído todas as ocorrências na Edge Function

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/dr-cicero-contador/index.ts` | Novas actions identify_payer_by_name e build_client_index; ruleBasedClassificationAsync; funções de normalização e match |
| `scripts/explore-qsa.mjs` | Script para explorar QSA dos clientes |
| `scripts/test-payer-identification.mjs` | Script de teste das identificações |

### Deploy

- Edge Function `dr-cicero-contador` atualizada no Supabase
- Testado com 11 casos de uso reais
- Todos os testes passaram com sucesso

### Lições Aprendidas

1. **QSA é fonte valiosa** - Contém todos os sócios e administradores das empresas
2. **Nome fantasia vs razão social** - Verificar ambos para identificação
3. **Sócio em múltiplas empresas** - Caso comum, sistema deve perguntar
4. **Normalização de nomes** - Essencial para match (acentos, maiúsculas)
5. **Colunas do banco** - `nome_fantasia` não `fantasy_name`

### Próximos Passos

1. Adicionar campo para selecionar empresa no Dialog do SuperConciliador
2. Salvar padrão aprendido quando usuário confirmar empresa
3. Considerar criar índice de familiares além dos sócios oficiais

---

## Sessão 19 (10/12/2025) - Versionamento e Saldo de Abertura Melhorado

### Sistema de Versionamento

Criado sistema de versionamento semântico:

- **package.json**: Versão atualizada para 1.19.0, nome `ampla-contabilidade`
- **CHANGELOG.md**: Histórico completo de 19 versões documentadas

### Convenções de Versão

| Tipo | Incremento | Exemplo |
|------|------------|---------|
| MAJOR | Mudanças incompatíveis | 2.0.0 |
| MINOR | Novas funcionalidades | 1.19.0 |
| PATCH | Correções de bugs | 1.19.1 |

### Melhoria na Lógica de Saldo de Abertura

**Regra Implementada**:

1. **Janeiro/2025 (Período de Abertura)**: TODOS os recebimentos → baixa de Clientes a Receber
   - Não gera receita nova
   - Lançamento: D: Banco | C: Clientes a Receber

2. **Fevereiro/2025+**: Verificar se cliente tem saldo de abertura pendente
   - Se cliente tem dívida antiga → Dr. Cícero PERGUNTA ao usuário
   - Opções: "É pagamento de dívida antiga" ou "É honorário atual"
   - Permite dividir valor entre dívida antiga e competência atual

### Nova Função Implementada

```typescript
// Verificar se cliente tem saldo de abertura pendente
async function clienteTemSaldoAbertura(supabase, clientId): Promise<{ temSaldo: boolean; saldo: number }>
```

**Lógica**:
1. Busca `client_opening_balance` do cliente
2. Verifica quanto já foi pago via `accounting_entry_lines`
3. Calcula saldo pendente
4. Retorna `{ temSaldo: true/false, saldo: valor }`

### Fluxo de Classificação Atualizado

```
Recebimento identificado
    ↓
É Janeiro/2025?
    SIM → Baixa Clientes a Receber (automático)
    NÃO ↓
Cliente tem saldo de abertura?
    SIM → Pergunta: "Dívida antiga ou Competência atual?"
    NÃO → Classificar como honorário regular
```

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `package.json` | Versão 1.19.0, metadados |
| `CHANGELOG.md` | Criado com histórico |
| `supabase/functions/dr-cicero-contador/index.ts` | Verificação de saldo, função sync |
| `.claude/MEMORY.md` | Sessão 19 documentada |

### Commits

| Commit | Descrição |
|--------|-----------|
| `780c82c` | chore: Adiciona sistema de versionamento (v1.18.0) |
| (pendente) | feat: Dr. Cícero verifica saldo de abertura antes de classificar (v1.19.0) |

### Lições Aprendidas

1. **Clientes antigos pagam dívidas antigas** - Muitos clientes devedores vão pagar débitos de períodos anteriores
2. **Saldo de abertura é um ATIVO** - Recebimento deve BAIXAR o ativo, não criar receita nova
3. **Perguntar é melhor que errar** - Quando há dúvida sobre competência, Dr. Cícero pergunta ao usuário
4. **Versionamento é essencial** - Permite rastrear mudanças e facilita comunicação

---

## Sessão 20 (10/12/2025) - Sistema de Honorários Especiais v1.21.0

### Contexto

Usuário solicitou sistema completo para gerenciar honorários diferenciados:
- Honorários Variáveis (% sobre faturamento)
- Abertura/Alteração de Empresas
- Comissões por Indicação
- Declaração de IRPF

### Novas Tabelas Criadas

| Tabela | Descrição |
|--------|-----------|
| `client_variable_fees` | Configuração de honorários variáveis (% sobre faturamento) |
| `client_monthly_revenue` | Faturamento mensal para cálculo de honorário variável |
| `company_services` | Serviços de abertura, alteração e baixa de empresas |
| `company_service_costs` | Taxas e custos de serviços (Junta, DARE, certificados) |
| `referral_partners` | Parceiros/corretores que indicam clientes |
| `client_referrals` | Indicações de clientes com configuração de comissão |
| `referral_commission_payments` | Pagamentos de comissões por indicação |
| `irpf_declarations` | Declarações de IRPF (sócios e particulares) |

### Funcionalidades Implementadas

#### 1. Honorários Variáveis (% sobre faturamento)
- **Exemplo**: Mata Pragas paga honorário fixo + 2.87% do faturamento dia 20
- Tabela `client_variable_fees` configura taxa, dia de vencimento, base de cálculo
- Tabela `client_monthly_revenue` armazena faturamento mensal para cálculo
- Função `calculate_variable_fee()` calcula automaticamente

#### 2. Abertura/Alteração de Empresas
- Recebe valor fixo (ex: R$ 2.500) e paga taxas do governo
- Lucro = Valor Cobrado - Total de Taxas
- Coluna `profit` é GENERATED (calculada automaticamente)
- Trigger `trg_update_service_costs` atualiza total de custos

#### 3. Comissões por Indicação
- 10% do honorário por X meses para quem indicou
- Parceiro tem chave PIX cadastrada para pagamento
- Trigger `trg_calculate_referral_end_date` calcula data fim
- View `vw_pending_commissions` mostra comissões pendentes

#### 4. Declaração de IRPF
- Declarações anuais dos sócios e particulares
- Valor médio R$ 300
- Botão "Gerar dos Sócios" puxa automaticamente do QSA
- Função `generate_irpf_forecast()` cria previsões

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20251210_honorarios_especiais.sql` | Criado - 8 tabelas, triggers, views, funções |
| `src/pages/SpecialFees.tsx` | Criado - Página com 4 abas para gestão |
| `src/App.tsx` | Modificado - Rota `/special-fees` |
| `src/components/AppSidebar.tsx` | Modificado - Menu "Especiais" em Honorários |
| `package.json` | Atualizado - Versão 1.21.0 |
| `CHANGELOG.md` | Atualizado - Documentação v1.21.0 |

### Desafios Técnicos Resolvidos

1. **GENERATED column com INTERVAL** - PostgreSQL não permite expressões não-imutáveis em colunas geradas
   - Solução: Usar trigger em vez de GENERATED ALWAYS AS

2. **Supabase db push** - Conflito de versões de migrations
   - Solução: `supabase migration repair --status applied/reverted`

3. **VIEW com colunas diferentes** - CREATE OR REPLACE VIEW não pode alterar colunas
   - Solução: DROP VIEW IF EXISTS antes de CREATE VIEW

### Diretiva do Usuário

> "para não ter varios menus da mesma coisa procura concentrar as mesmas rotinas em um menu"

- Item "Especiais" adicionado ao grupo "Honorários" no sidebar
- Página única com 4 abas (Variáveis, Abertura, Indicações, IRPF)

### Versão

- **Anterior**: 1.20.0
- **Atual**: 1.21.0
- **Tipo**: MINOR (nova funcionalidade)

---

## Sessão 21 (10/12/2025) - Sistema Profissional de Contratos v1.22.0

### Contexto

Implementação de sistema completo de contratos profissionais para o escritório contábil, seguindo normas do CFC e legislação brasileira.

### Documentos Implementados

1. **Proposta de Serviços (NBC PG 01)** - Proposta comercial antes do contrato
2. **Contrato com Aceite Tácito (Art. 111 CC)** - Contrato que entra em vigor sem assinatura
3. **Distrato/Rescisão (Resolução CFC 1.590/2020)** - Rescisão com obrigações finais
4. **Carta de Responsabilidade (ITG 1000)** - Responsabilidade da administração
5. **Confissão de Dívida (Título Executivo)** - Documento com força de execução

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Contracts.tsx` | Página principal com 5 abas |
| `src/pages/DebtConfession.tsx` | Gerador de confissão de dívida |
| `supabase/migrations/20251210_contratos_profissionais.sql` | Tabelas contracts, service_proposals |

### Fundamentação Legal

- **Art. 111 Código Civil** - Aceite tácito por comportamento concludente
- **Art. 784 CPC** - Força executiva de documentos
- **NBC PG 01** - Normas para propostas de serviços contábeis
- **Resolução CFC 1.590/2020** - Procedimentos para rescisão
- **ITG 1000** - Contabilidade para pequenas empresas

---

## Sessão 22 (10/12/2025) - Configurações do Escritório e Usuários v1.23.0/v1.24.0

### Contexto

Dados do escritório contábil estavam hardcoded nos contratos. Usuário solicitou:
1. Dados do escritório vindos do banco de dados
2. Sistema de gerenciamento de usuários com geração de senha

### Tabelas Criadas

| Tabela | Descrição |
|--------|-----------|
| `accounting_office` | Dados do escritório (razão social, CNPJ, CRC, responsável técnico, endereço, etc.) |
| `system_users` | Usuários do sistema com perfis de acesso |

### Dados do Escritório

```
Razão Social: AMPLA ASSESSORIA CONTABIL LTDA
Nome Fantasia: Ampla Business
CNPJ: 21.565.040/0001-07
CRC: CRC/GO 007640/O
Responsável Técnico: Sergio Carneiro Leão
CRC Responsável: CRC/GO 008074
Endereço: Rua 1, Qd. 24, Lt. 08, S/N - Setor Maracanã
CEP: 74.680-320 - Goiânia/GO
E-mail: contato@amplabusiness.com.br
Telefone: (62) 3932-1365
```

### Sistema de Usuários

**Perfis de Acesso:**
| Perfil | Descrição |
|--------|-----------|
| admin | Acesso total ao sistema |
| manager | Gerencia equipe e relatórios |
| operator | Operações do dia a dia |
| viewer | Apenas consulta |

**Funcionalidades:**
- Geração automática de senha temporária (8 caracteres)
- Flag `must_change_password` força troca no primeiro acesso
- Vínculo opcional com funcionário (`employee_id`)
- Ativar/desativar usuários
- Redefinir senha

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20251220130000_accounting_office_settings.sql` | Criado - Tabela accounting_office |
| `supabase/migrations/20251220140000_system_users.sql` | Criado - Tabela system_users |
| `src/pages/Contracts.tsx` | Modificado - Busca dados do escritório dinamicamente |
| `src/pages/Settings.tsx` | Modificado - Aba Usuários funcional |

### Versão v1.24.0 - Período de Abertura

**Problema**: Janeiro/2025 é mês de abertura, receitas são de competências anteriores.

**Regra Implementada no Dr. Cícero:**
1. Janeiro/2025 = Período de abertura
2. Recebimentos não identificados → Dr. Cícero pergunta se é saldo de abertura
3. Se cliente tem saldo devedor pendente → pergunta se é pagamento da dívida antiga
4. Evita cobrança dupla (não envia automaticamente para saldo de abertura)

**Opções apresentadas ao usuário:**
- "Sim, é saldo de abertura (competência anterior)"
- "Não, é receita nova de janeiro/2025"
- "É honorário de cliente específico"

**A partir de Fevereiro**: Comportamento volta ao normal (receitas são do período corrente)

### Commits

| Hash | Mensagem |
|------|----------|
| `3728ecd` | feat: Sistema de Gerenciamento de Usuários v1.23.0 |
| `23637bc` | feat: Dr. Cícero verifica saldo de abertura antes de classificar (v1.24.0) |

### Versão Final

- **Anterior**: 1.21.0
- **Atual**: 1.24.0
- **Tipo**: MINOR (novas funcionalidades)

---

## Sessão 23 (10/12/2025) - Sistema de Boletos Liquidados e Reconciliação v1.25.0

### Contexto

O usuário identificou um problema crítico na conciliação bancária:
- Quando o banco recebe múltiplos boletos no mesmo dia, agrupa tudo em uma única linha no extrato
- Isso torna impossível saber quais clientes específicos pagaram
- Exemplo: Extrato mostra "Crédito R$ 50.000,00" mas são 10 boletos de clientes diferentes

### Solução Implementada

Sistema completo para importar lista de boletos liquidados do relatório bancário e reconciliar com o extrato.

### Tabelas Criadas

| Tabela | Descrição |
|--------|-----------|
| `boletos_liquidados` | Pagamentos de boletos identificados individualmente |
| `boletos_agregados` | Agregação de boletos por dia para reconciliação |

### Views Criadas

| View | Descrição |
|------|-----------|
| `v_boletos_composicao_diaria` | Mostra composição dos boletos por dia |
| `v_reconciliacao_pendente` | Transações de crédito pendentes com boletos do mesmo dia |

### Funções RPC

| Função | Descrição |
|--------|-----------|
| `import_boletos_liquidados` | Importa lote de boletos do relatório bancário |
| `reconcile_boletos_with_transaction` | Reconcilia múltiplos boletos com uma transação |
| `find_boletos_for_transaction` | Encontra boletos candidatos para reconciliação |

### Páginas Criadas

| Página | Rota | Descrição |
|--------|------|-----------|
| `ImportBoletosLiquidados.tsx` | `/import-boletos-liquidados` | Importar lista de boletos colando texto |
| `BoletosComposicao.tsx` | `/boletos-composicao` | Visualizar composição diária e reconciliar |

### Integração com Dr. Cícero

**Prioridade 0** na classificação de créditos: Antes de tentar identificar por CNPJ, verificar se há boletos liquidados importados para a data.

**Comportamento:**
1. Dr. Cícero busca boletos da data da transação
2. Se valor bate exatamente → mostra composição e pergunta confirmação
3. Se valor não bate → mostra boletos disponíveis para seleção manual
4. Se boletos são "saldo de abertura" → baixa em Clientes a Receber (não receita)

### Formato de Importação

O usuário cola o texto do relatório bancário no formato:
```
TIPO    NÚMERO      NOSSO Nº    CLIENTE                              VENCIMENTO  PAGAMENTO   VALOR       STATUS
SIMPLES 0025200008  25/200008-1 ACTION SOLUCOES INDUSTRIAIS LTDA    10/02/2025  10/02/2025  12.143,72   LIQUIDADO COMPE
```

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20251220150000_boletos_liquidados.sql` | Criado - Sistema completo |
| `src/pages/ImportBoletosLiquidados.tsx` | Criado - Importação de boletos |
| `src/pages/BoletosComposicao.tsx` | Criado - Visualização e reconciliação |
| `src/App.tsx` | Modificado - Novas rotas |
| `supabase/functions/dr-cicero-contador/index.ts` | Modificado - Integração com boletos |

### Versão Final

- **Anterior**: 1.24.0
- **Atual**: 1.25.0
- **Tipo**: MINOR (nova funcionalidade de reconciliação)

---

## Sessão 24 (10/12/2025) - Padronização: Contabilidade como Fonte Única de Verdade

### Contexto

O usuário identificou inconsistências de valores entre diferentes telas do sistema:
- Dashboard Executivo mostrava um valor de despesas
- Página de Despesas mostrava outro valor
- Análise de Rentabilidade usava outra fonte

**Decisão arquitetural**: Todas as fontes de dados (extrato bancário, folha de pagamento, honorários, despesas) ALIMENTAM a contabilidade. Todos os relatórios e dashboards LÊEM da contabilidade.

### Arquitetura de Dados Padronizada

```
FONTES DE ENTRADA (escrevem):
├── Extrato Bancário → bank_transactions → accounting_entries
├── Folha de Pagamento → payroll → accounting_entries
├── Honorários → invoices → accounting_entries
└── Despesas → expenses → accounting_entries

         ↓ (alimentam)

CONTABILIDADE (fonte única de verdade):
├── accounting_entries (lançamentos)
└── accounting_entry_lines (partidas dobradas)
    ├── Contas 1.x = Ativo
    ├── Contas 2.x = Passivo
    ├── Contas 3.x = Receitas (crédito aumenta)
    └── Contas 4.x = Despesas (débito aumenta)

         ↓ (lêem)

RELATÓRIOS/DASHBOARDS:
├── ExecutiveDashboard ✅
├── DRE ✅
├── CashFlow ✅
├── ProfitabilityAnalysis ✅
├── Balancete ✅
└── Balanço Patrimonial ✅
```

### Cálculos Padrão para Contabilidade

```typescript
// Buscar contas do plano de contas
const { data: chartAccounts } = await supabase
  .from('chart_of_accounts')
  .select('id, code, name, type')
  .eq('is_active', true)
  .eq('is_analytical', true);

// Separar contas por tipo
const revenueAccountIds = chartAccounts?.filter(a => a.code.startsWith('3')).map(a => a.id) || [];
const expenseAccountIds = chartAccounts?.filter(a => a.code.startsWith('4')).map(a => a.id) || [];

// Buscar lançamentos contábeis
const { data: allLines } = await supabase
  .from('accounting_entry_lines')
  .select(`
    debit,
    credit,
    account_id,
    entry_id(entry_date, competence_date)
  `);

// Filtrar por período
const periodLines = allLines?.filter((line: any) => {
  const lineDate = line.entry_id?.competence_date || line.entry_id?.entry_date;
  return lineDate >= startDateStr && lineDate <= endDateStr;
}) || [];

// RECEITA = crédito - débito nas contas 3.x
const totalRevenue = periodLines
  .filter((line: any) => revenueAccountIds.includes(line.account_id))
  .reduce((sum: number, line: any) => sum + (Number(line.credit) || 0) - (Number(line.debit) || 0), 0);

// DESPESA = débito - crédito nas contas 4.x
const totalExpenses = periodLines
  .filter((line: any) => expenseAccountIds.includes(line.account_id))
  .reduce((sum: number, line: any) => sum + (Number(line.debit) || 0) - (Number(line.credit) || 0), 0);
```

### Páginas Modificadas

| Página | Antes | Depois | Status |
|--------|-------|--------|--------|
| `ExecutiveDashboard.tsx` | `invoices` + `expenses` | `accounting_entry_lines` | ✅ Atualizado |
| `ProfitabilityAnalysis.tsx` | `invoices` + `expenses` | `accounting_entry_lines` | ✅ Atualizado |
| `CashFlow.tsx` | `expenses` + `accounts_payable` | `accounting_entry_lines` + fallback | ✅ Atualizado |
| `DRE.tsx` | Já usava contabilidade | Sem alteração | ✅ OK |
| `Dashboard.tsx` | `bank_transactions` para "a classificar" | Sem alteração | ✅ OK (operacional) |
| `Expenses.tsx` | Tabela `expenses` direta | Sem alteração | ✅ OK (gerencial) |

### Páginas que Mantêm Comportamento Específico

1. **Dashboard.tsx** - Mostra "Débitos a Classificar" de `bank_transactions` (débitos não conciliados)
   - Correto porque é uma métrica operacional, não financeira

2. **Expenses.tsx** - Gerencia cadastro de despesas na tabela `expenses`
   - Correto porque é o ponto de entrada que alimenta a contabilidade

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ExecutiveDashboard.tsx` | Usar `accounting_entry_lines` para KPIs e gráficos |
| `src/pages/ProfitabilityAnalysis.tsx` | Usar `accounting_entry_lines` para lucro e margem |
| `src/pages/CashFlow.tsx` | Adicionar busca em `accounting_entry_lines` para projeções |

### Lições Aprendidas

1. **Sempre usar competence_date OU entry_date** - A contabilidade usa competence_date quando disponível
2. **Receitas = Contas 3.x** - Crédito aumenta, débito diminui
3. **Despesas = Contas 4.x** - Débito aumenta, crédito diminui
4. **Filtrar por is_analytical = true** - Só contas analíticas têm lançamentos
5. **Manter tabelas operacionais separadas** - `expenses`, `invoices`, `bank_transactions` alimentam a contabilidade, mas relatórios lêem de `accounting_entry_lines`

### Correção CashFlow.tsx (Duplicação Removida)

O Fluxo de Caixa estava combinando 3 fontes de despesas criando duplicação:
1. `accounting_entry_lines` (despesas contábeis)
2. `accounts_payable` (contas a pagar)
3. `expenses` (despesas)

**Solução**: Fluxo de caixa é para **PROJEÇÃO FUTURA**, então usa apenas despesas **PENDENTES DE PAGAMENTO** da tabela `expenses`. A contabilidade registra despesas já realizadas, não serve para projeção.

| Relatório | Fonte | Motivo |
|-----------|-------|--------|
| Dashboard Executivo | `accounting_entry_lines` | Valores realizados |
| DRE | `accounting_entry_lines` | Valores realizados |
| Fluxo de Caixa | `expenses` (pendentes) | Projeção futura |

### Versão Final

- **Anterior**: 1.25.0
- **Atual**: 1.25.0 (sem bump - refatoração interna)
- **Tipo**: Refatoração de arquitetura de dados

---

## Sessão 25 (11/12/2025) - Correção de Saldo Bancário e Transações

### Contexto

O saldo bancário no Balanço Patrimonial não correspondia ao extrato real do banco (OFX). O sistema mostrava valores incorretos tanto no saldo da conta quanto nas transações importadas.

### Problemas Identificados

1. **Transações com sinal invertido**: Ao importar do OFX, muitas transações de saída (PAGAMENTO PIX, LIQUIDAÇÃO BOLETO) foram registradas com valor positivo ao invés de negativo.

2. **Saldo da conta bancária incorreto**: O `current_balance` em `bank_accounts` estava R$ 585.858,46, quando deveria ser R$ 18.553,58.

3. **Lançamentos contábeis duplicados**: 38 lançamentos de receita foram criados para transações que na verdade eram saídas (após correção dos sinais).

### Correções Realizadas

#### 1. Correção dos Sinais das Transações (bank_transactions)

**Transações corrigidas para negativo:**
- 83 transações de "PAGAMENTO PIX-PIX_DEB"
- 27 transações de "LIQUIDACAO BOLETO" (pagamentos de contas)
- 2 transações de "PAGAMENTO PIX SICREDI"
- 19 transações de "TARIFA"
- 13 transações de "DEBITO CONVENIOS"
- 7 transações de "MANUTENCAO DE TITULOS"
- 1 transação de "DEBITO ARRECADACAO"

**Resultado:**
- Saldo Inicial: R$ 90.725,10
- Movimentação: R$ -72.171,52
- **Saldo Final: R$ 18.553,58** (OFX: R$ 18.553,54) ✅

#### 2. Atualização do Saldo da Conta Bancária

```sql
UPDATE bank_accounts
SET current_balance = 18553.58
WHERE account_number = '39500000000278068';
```

#### 3. Remoção de Lançamentos Duplicados

Removidos 38 lançamentos de `entry_type = 'receipt'` que apontavam para transações que agora são negativas (saídas).

#### 4. Balanço Patrimonial - Filtro de Período

Adicionado filtro de **Data Inicial** e **Data Final** na página `BalanceSheet.tsx`.

### Validação Final

| Métrica | Valor |
|---------|-------|
| Receitas (DRE) | R$ 136.821,59 ✅ |
| Despesas (DRE) | R$ 137.297,65 ✅ |
| Resultado | -R$ 476,06 ✅ |
| Saldo Bancário | R$ 18.553,58 ✅ |

### Lições Aprendidas

1. **Importação OFX**: Verificar sempre o sinal das transações ao importar. "LIQUIDACAO BOLETO" pode ser tanto entrada quanto saída dependendo do tipo (pagamento de conta vs recebimento de cobrança).

2. **Padrões de transações**:
   - `RECEBIMENTO PIX` / `PIX_CRED` = entrada (positivo)
   - `PAGAMENTO PIX` / `PIX_DEB` = saída (negativo)
   - `LIQ.COBRANCA SIMPLES` = entrada (recebimento de boleto emitido)
   - `LIQUIDACAO BOLETO` = saída (pagamento de boleto recebido)
   - `TARIFA` / `DEBITO CONVENIOS` / `MANUTENCAO` = saída

3. **Saldo de abertura em janeiro**: Conforme documentado anteriormente, entradas de dinheiro em janeiro são tratadas como saldo de abertura (baixa em Clientes a Receber), não como receita nova.

### Migrations Criadas

| Migration | Descrição |
|-----------|-----------|
| `20251211110000_verify_bank_ledger.sql` | Análise do razão contábil do banco |
| `20251211160000_fix_transaction_signs.sql` | Correção de sinais (PAGAMENTO PIX, TARIFA, etc) |
| `20251211190000_fix_all_liquidacao_boleto.sql` | Correção de LIQUIDACAO BOLETO |
| `20251211210000_fix_bank_account_balance.sql` | Atualização do current_balance e limpeza de duplicados |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/BalanceSheet.tsx` | Adicionado filtro de Data Inicial e Data Final |

### Versão

- **Anterior**: 1.25.0
- **Atual**: 1.26.0
- **Tipo**: PATCH (correção de dados)

---

## Sessão 26 (11/12/2025) - Correção de Adiantamentos no DRE

### Contexto

O DRE estava mostrando R$ 233.873,02 em "Outras Despesas Administrativas" (4.1.2.99), quando a maioria eram adiantamentos pessoais da família Leão que deveriam estar em contas de Adiantamento a Sócios (1.1.3.04.xx).

### Problemas Identificados

1. **Lançamentos pessoais em conta de despesa**: Gastos da família (Sergio, Nayara, Victor, etc.) estavam em 4.1.2.99
2. **Duplicatas**: "AMPLA CONTABILIDADE" tinha lançamentos duplicados (Provisionamento + Adiantamento)
3. **Energia pessoal**: Energia da casa do Sergio estava em Energia Elétrica (4.1.2.02)

### Correções Realizadas

#### 1. Reclassificação de Adiantamentos (Migration 20251211220000)

Movidos 23 lançamentos de 4.1.2.99 para contas corretas:

| Conta Destino | Lançamentos | Valor |
|---------------|-------------|-------|
| 1.1.3.04.01 (Sergio Carneiro) | 9 | ~R$ 30.000 |
| 1.1.3.04.03 (Victor Hugo) | 3 | ~R$ 15.000 |
| 1.1.3.04.04 (Nayara) | 9 | ~R$ 18.000 |
| 1.1.3.04.05 (Sérgio Augusto) | 1 | ~R$ 18.000 |
| 1.1.3.04.02 (Outros/Scala) | 1 | R$ 1.000 |

#### 2. Remoção de Duplicatas (Migration 20251211230000)

Removidos R$ 143.827,26 em lançamentos duplicados de "AMPLA CONTABILIDADE".

#### 3. Energia do Sergio (Migration 20251211240000)

Movido R$ 868,11 de "Energia - Sergio" para Adiantamento a Sócios.

### Resultado Final do DRE

| Métrica | Antes | Depois |
|---------|-------|--------|
| Receitas | R$ 136.821,59 | R$ 136.821,59 |
| Despesas | R$ 286.881,16 | **R$ 142.185,79** |
| Resultado | -R$ 150.059,57 | **-R$ 5.364,20** |

### Esclarecimentos do Dr. Cícero

**NÃO são adiantamentos pessoais (ficam como despesa):**
- Dep. Pessoal (Terceirizado) - R$ 12.968,01 → É departamento de RH, não "pessoal"
- Anuidade CRC - Carla/Sergio → São contadores da Ampla, despesa da empresa
- IPTU Sede → Imposto do imóvel da empresa

**SÃO adiantamentos pessoais (movidos para 1.1.3.04.xx):**
- Condomínios (Lago, Mundi)
- IPVA de veículos pessoais
- Energia de residências
- Babá da Nayara
- Plano de Saúde pessoal
- Obras em imóveis pessoais

### Migrations Criadas

| Migration | Descrição |
|-----------|-----------|
| `20251211220000_fix_adiantamentos_to_correct_accounts.sql` | Move 23 lançamentos para Adiantamento |
| `20251211230000_remove_duplicate_ampla_contabilidade.sql` | Remove duplicatas |
| `20251211240000_fix_energia_sergio_to_adiantamento.sql` | Move energia pessoal |

### Scripts Criados

| Script | Descrição |
|--------|-----------|
| `scripts/investigate-dre-adiantamentos.mjs` | Investiga conta 4.1.2.99 |
| `scripts/analyze-dre-deep.mjs` | Análise profunda com Dr. Cícero |

### Lições Aprendidas

1. **"Dep. Pessoal" ≠ "Pessoal"**: Departamento de RH terceirizado é despesa operacional
2. **Anuidades de funcionários**: CRC de contadores que trabalham na empresa é despesa
3. **Dr. Cícero deve perguntar**: Em caso de dúvida, perguntar ao usuário antes de classificar
4. **Verificar duplicatas**: Mesmo descrição com tipos diferentes pode indicar duplicata

### Versão

- **Anterior**: 1.26.0
- **Atual**: 1.27.0
- **Tipo**: PATCH (correção de classificação contábil)

---

## Sessão 27 (11-12/12/2025) - Sistema de Rescisão + Correções DRE

### Novas Funcionalidades

#### 1. Sistema de Rescisão de Contrato (v1.28.0)

**Implementação completa** de rescisão de funcionários CLT integrada com Dr. Advocato:

**Tabela criada**: `employee_terminations`
- Armazena dados completos da rescisão
- Cálculo automático de todas as verbas rescisórias
- Integração com Dr. Advocato para orientação jurídica

**8 tipos de rescisão suportados**:
1. `dispensa_sem_justa_causa` - Aviso prévio + multa 40% FGTS
2. `dispensa_com_justa_causa` - Sem multa FGTS, sem aviso
3. `pedido_demissao` - Sem multa FGTS
4. `acordo_mutuo` - Multa 20% FGTS (CLT 484-A)
5. `termino_contrato` - Contrato determinado
6. `morte_empregado` - Rescisão por falecimento
7. `rescisao_indireta` - Falta grave do empregador
8. `aposentadoria` - Aposentadoria do empregado

**Verbas calculadas automaticamente**:
- Saldo de salário
- Aviso prévio (indenizado ou trabalhado)
- Férias vencidas + proporcionais + 1/3
- 13º proporcional
- Multa FGTS (40% ou 20%)
- Descontos: INSS, IRRF

**Funções PostgreSQL**:
- `calcular_rescisao(employee_id, termination_date, last_working_day, termination_type, notice_type)`
- `aprovar_rescisao(termination_id)` - Gera lançamentos contábeis
- `pagar_rescisao(termination_id, payment_date, bank_account_id)`

**Contas contábeis criadas**:
- 2.1.2.10.xx - Rescisões a Pagar (Passivo)
- 4.2.10.xx - Indenizações Trabalhistas (Despesa)

**Rubricas eSocial para rescisão** (códigos 3000-4040):
- 3000: Saldo de Salário
- 3010: Aviso Prévio Indenizado
- 3020-3025: Férias (vencidas, proporcionais, 1/3)
- 3030: 13º Proporcional
- 3040: Multa FGTS
- 4000-4040: Descontos (INSS, IRRF, FGTS, Pensão)

**Arquivos modificados**:
- `src/pages/Payroll.tsx` - Dialog de rescisão, funções de cálculo/aprovação
- `supabase/migrations/20251211300000_employee_termination_system.sql` - Tabelas, funções, rubricas

#### 2. Edição de Honorário Variável (v1.28.1)

**Problema**: Botão de edição não funcionava na página de Honorários Especiais

**Correção em** `src/pages/SpecialFees.tsx`:
- Adicionado estado `editingVariableFee`
- Criada função `openEditVariableFee(fee)`
- Dialog atualizado para mostrar "Editar" vs "Novo"
- Botão "Atualizar" vs "Salvar" conforme contexto

### Correções de DRE

#### Reclassificação de AMPLA CONTABILIDADE

**Problema identificado**: R$ 143.827,26 (R$ 70.000 + R$ 73.827,26) da AMPLA CONTABILIDADE estava em "Outras Despesas Administrativas" (4.1.2.99), mas são adiantamentos para Sergio Carneiro Leão.

**Correção aplicada diretamente no banco**:
- Movidas 2 linhas de `accounting_entry_lines`
- De: 4.1.2.99 (Despesas)
- Para: 1.1.3.04.01 (Adiantamentos - Sergio Carneiro Leão)

**Resultado**:
| Conta | Antes | Depois |
|-------|-------|--------|
| 4.1.2.99 - Outras Despesas | R$ 149.664,96 | R$ 5.837,70 |
| 1.1.3.04.01 - Adiant. Sergio | - | +R$ 143.827,26 |

#### Esclarecimentos sobre Despesas da Ampla

**SÃO despesas legítimas da Ampla** (não são adiantamentos):
- R$ 26.000 - Outsider Construtora (reforma prédio Ampla)
- R$ 12.968 - Dep. Pessoal
- R$ 11.338 - Dep. Contábil
- R$ 10.500 - Dep. Fiscal
- R$ 6.736 - Rescisão
- Nayara: R$ 6.000/mês (salário - trabalha na Ampla)
- Victor Hugo: R$ 6.000/mês (salário - trabalha na Ampla)

**É adiantamento a sócio** (não é despesa):
- Sérgio Augusto: R$ 6.000/mês (mesada - NÃO trabalha na Ampla)
- AMPLA CONTABILIDADE: pagamentos → adiantamento Sergio Carneiro Leão

**Pendente de verificação**:
- R$ 8.499,64 - Sistemas/Aplicativos - Ampla (usuário vai investigar)

### Correções Técnicas

#### Migration de Rescisão (v1.28.2)

**Problema**: Migration falhava ao inserir contas contábeis

**Erros corrigidos**:
1. `type` tinha check constraint - removido do INSERT (campo nullable)
2. `account_type` deve ser MAIÚSCULO (PASSIVO, DESPESA)
3. `nature` deve ser MAIÚSCULO (CREDORA, DEVEDORA)
4. `level` é obrigatório (adicionado)
5. `dependents` não existe em `employees` - substituído por 0

### Commits Realizados

| Hash | Mensagem | Versão |
|------|----------|--------|
| 353d7ed | feat: sistema de rescisão de contrato | v1.28.0 |
| (fix) | fix: botão editar honorário variável | v1.28.1 |
| 74424cf | fix: corrige colunas da migration de rescisão | v1.28.2 |

### Estrutura da Família Leão (Atualizada)

| Pessoa | Relação | Trabalha na Ampla | Tipo de Pagamento |
|--------|---------|-------------------|-------------------|
| Sergio Carneiro Leão | Fundador | Sim | Pró-labore |
| Nayara | Filha | Sim (R$ 6.000/mês) | Salário |
| Victor Hugo Leão | Filho | Sim (R$ 6.000/mês) | Salário |
| Sérgio Augusto | Filho | **Não** | Mesada (Adiantamento) |
| AMPLA CONTABILIDADE | Empresa relacionada | - | Adiantamento Sergio |

### Lições Aprendidas

1. **chart_of_accounts tem constraints rígidos**:
   - `type` tem check constraint (valores específicos)
   - `account_type` e `nature` devem ser MAIÚSCULAS
   - Melhor não incluir `type` e deixar NULL

2. **Separar despesas de adiantamentos**:
   - Salários de quem trabalha = Despesa
   - Pagamentos para quem não trabalha = Adiantamento a Sócios
   - Pagamentos para empresas relacionadas a sócios = Adiantamento

3. **AMPLA CONTABILIDADE** (CNPJ 23893032000169):
   - É empresa dos sócios
   - Pagamentos para ela são adiantamentos, não despesas

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/20251211300000_employee_termination_system.sql` | Sistema completo de rescisão |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Payroll.tsx` | Dialog de rescisão, estados, funções |
| `src/pages/SpecialFees.tsx` | Edição de honorário variável |

### Versão

- **Anterior**: 1.27.0
- **Atual**: 1.28.2
- **Tipo**: FEAT (rescisão) + FIX (edição honorário + DRE)

---

## Sessão 28 (15/12/2025) - Sistema NFS-e Completo

### Resumo

Implementação completa do sistema de emissão de NFS-e (Nota Fiscal de Serviços Eletrônica) para a Ampla Contabilidade, incluindo:
- Integração com webservice ABRASF 2.04
- ISS Fixo (Sociedade de Profissionais)
- Simples Nacional (sem retenções federais)
- Códigos de serviço LC 116/2003
- Referência à Reforma Tributária LC 214/2025

### Regras Tributárias da Ampla

| Aspecto | Configuração |
|---------|--------------|
| **Regime Tributário** | Simples Nacional |
| **ISS** | Fixo mensal (Sociedade de Profissionais - Art. 9º, §3º DL 406/68) |
| **ExigibilidadeISS** | 4 (ISS Fixo) |
| **valor_iss na nota** | R$ 0,00 (pago mensalmente ao município) |
| **aliquota na nota** | 0% |
| **Retenções PIS/COFINS/CSLL/IR** | R$ 0,00 (Simples Nacional não sofre retenção) |
| **valor_liquido** | = valor_servicos (sem deduções) |
| **Aviso obrigatório** | "DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL" |

### Tabelas Criadas

| Tabela | Descrição |
|--------|-----------|
| `nfse` | Notas fiscais emitidas |
| `nfse_config` | Configuração do prestador (CNPJ 23893032000169) |
| `nfse_log` | Log de comunicação com webservice |
| `codigos_servico_lc116` | 200 códigos de serviço da LC 116/2003 |

### Migrations Aplicadas

| Migration | Descrição |
|-----------|-----------|
| `20251215000000_nfse_system.sql` | Sistema base NFS-e |
| `20251215000001_nfse_iss_fixo.sql` | Campos ISS Fixo |
| `20251215000002_codigos_servico_lc116.sql` | Códigos de serviço |
| `20251215000003_retencoes_federais.sql` | Configuração Simples Nacional |

### Configuração da Ampla no nfse_config

```json
{
  "prestador_cnpj": "23893032000169",
  "prestador_razao_social": "AMPLA CONTABILIDADE LTDA",
  "prestador_inscricao_municipal": "6241034",
  "optante_simples_nacional": true,
  "regime_tributario": "simples_nacional",
  "usar_iss_fixo": true,
  "iss_fixo": 70.00,
  "ambiente": "homologacao"
}
```

### Discriminação Padrão da NFS-e

```
SERVIÇOS DE CONTABILIDADE - COMPETÊNCIA DEZEMBRO/2025

Serviços prestados conforme contrato de prestação de serviços contábeis:
- Escrituração contábil e fiscal
- Apuração de impostos federais e municipais
- Elaboração de balancetes e demonstrações contábeis
- Obrigações acessórias (SPED, DCTFWeb, EFD, etc.)
- Assessoria e consultoria contábil

Código do Serviço: 17.18 - Contabilidade, inclusive serviços técnicos e auxiliares
CNAE: 6920602

DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL
NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI/IBS/CBS E ISS
ISS: Regime de ISS Fixo (Sociedade de Profissionais) - Art. 9º, §3º do DL 406/68
Ref: LC 116/2003, LC 214/2025 (Reforma Tributária)
```

### Edge Function nfse-emitir

Localização: `supabase/functions/nfse-emitir/index.ts`

Gera XML no padrão ABRASF 2.04 com:
- ExigibilidadeISS = 4 (ISS Fixo)
- ValorIss = 0
- Aliquota = 0
- IssRetido = 2 (não retido)
- ItemListaServico (sem ponto: 1718)
- CodigoCnae
- Envelope SOAP para RecepcionarLoteRps

### Commits Realizados

| Hash | Mensagem | Versão |
|------|----------|--------|
| 733ec85 | feat: sistema completo NFS-e | v1.29.0 |
| 7d25f9c | feat: ISS fixo e códigos LC 116 | v1.29.1 |
| 0e93474 | fix: ISS Fixo Sociedade Profissionais | v1.29.2 |
| 79a2de7 | feat: Simples Nacional e Reforma Tributária | v1.29.3 |

### Arquivos Criados/Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/NFSe.tsx` | Página completa de emissão/consulta NFS-e |
| `src/components/NFSeWidget.tsx` | Widget para dashboard |
| `supabase/functions/nfse-emitir/index.ts` | Edge Function emissão |
| `scripts/run-nfse-migration.mjs` | Script verificação tabelas |

### Lições Aprendidas

1. **Simples Nacional não sofre retenção**:
   - PIS, COFINS, CSLL, IR = 0
   - Tributação via DAS mensal, não por nota

2. **ISS Fixo (Sociedade de Profissionais)**:
   - ExigibilidadeISS = 4
   - valor_iss = 0 na nota
   - ISS é pago mensalmente ao município

3. **supabase db push com migrations antigas**:
   - Use `--include-all` para aplicar migrations com timestamp anterior

4. **Códigos LC 116/2003**:
   - 17.18 = Contabilidade
   - Remover ponto no XML: 1718

### Versão

- **Anterior**: 1.28.2
- **Atual**: 1.29.3
- **Tipo**: FEAT (NFS-e completo)

---

## Sessão 28.2 (15/12/2025) - Portal Nacional NFS-e (SEFIN)

### Contexto

Após a implementação do sistema ABRASF, foi necessário verificar se a Ampla poderia emitir pelo **Portal Nacional da NFS-e** (gov.br/nfse), que usa um formato diferente (DPS - Declaração de Prestação de Serviço) em vez do RPS tradicional.

### Descoberta Importante: Goiânia NÃO está no Portal Nacional

**Goiânia (cód. IBGE 5208707) NÃO está conveniada ao Portal Nacional NFS-e.**

A partir de outubro/2025, Goiânia adotou o sistema **SGISS (ISSNet Online)** com padrão **ABRASF 2.04**, que é um sistema municipal próprio, não o Portal Nacional da Receita Federal.

### Diferença entre os Sistemas

| Aspecto | Portal Nacional (SEFIN) | ABRASF Municipal |
|---------|-------------------------|------------------|
| **Endpoint** | sefin.nfse.gov.br | nfse.goiania.go.gov.br |
| **Documento** | DPS (Declaração de Prestação de Serviço) | RPS (Recibo Provisório de Serviço) |
| **ID Formato** | TSIdDPS (45 chars): DPS + cMun(7) + tipo(1) + CNPJ(14) + serie(5) + num(15) | LoteID |
| **Layout** | XSD Nacional v1.00 | ABRASF 2.04 |
| **Assinatura** | RSA-SHA256 | RSA-SHA1 |
| **Payload** | JSON com XML GZip+Base64 | SOAP Envelope |

### Código Desenvolvido (Para Referência Futura)

O código para integração com o Portal Nacional foi desenvolvido e está funcional, apenas aguardando a adesão de Goiânia ao convênio:

| Arquivo | Descrição |
|---------|-----------|
| `nfes_servico/nfse/dps_builder.py` | Construtor do XML DPS v1.00 |
| `nfes_servico/nfse/client_nacional.py` | Cliente API SEFIN Nacional |
| `nfes_servico/nfse/cli_nacional.py` | CLI para testes |

### Erros Resolvidos Durante Desenvolvimento

| Erro | Causa | Solução |
|------|-------|---------|
| E6154 | XML sem declaração UTF-8 | Adicionado `xml_declaration=True` no signer |
| RNG9997 TSIdDPS | ID com 37 chars, precisava 45 | Adicionado cMun(7) + tipoInsc(1) |
| RNG9997 serie | "UNICA" inválido | Alterado para numérico "80000" |
| RNG9997 dhEmi | Faltava timezone | Adicionado "-03:00" |
| RNG9997 cLocEmi | Campo obrigatório faltando | Adicionado antes de prest |
| RNG9997 cLocPrestacao | cMun errado | Renomeado para cLocPrestacao |
| RNG9997 cServ/xDescServ | xDescServ fora de cServ | Movido para dentro de cServ |
| RNG9997 vServPrest | Estrutura errada | Adicionado vServ dentro de vServPrest |
| RNG9997 exigISS | Campo inexistente | Removido, adicionado tpRetISSQN |
| **E0037** | Município não conveniado | **GOIÂNIA NÃO ESTÁ NO PORTAL NACIONAL** |

### APIs do Portal Nacional (Para Futuro)

| Ambiente | URL |
|----------|-----|
| Produção | https://sefin.nfse.gov.br/SefinNacional |
| Homologação | https://sefin.producaorestrita.nfse.gov.br/SefinNacional |
| Swagger | https://www.producaorestrita.nfse.gov.br/swagger/contribuintesissqn/ |

### Municípios de GO Conveniados (Para Referência)

Anápolis e Aparecida de Goiânia já utilizam sistema integrado.

### Conclusão

**Para a Ampla Contabilidade em Goiânia, deve-se usar o sistema ABRASF municipal (ISSNet Online), não o Portal Nacional.**

O código para o Portal Nacional está pronto para quando/se Goiânia aderir ao convênio federal.

### Links Importantes

- Portal Nacional: https://www.gov.br/nfse/pt-br
- ISSNet Goiânia: https://www.issnetonline.com.br/goiania/Online/
- Biblioteca nfelib: https://github.com/akretion/nfelib

### Versão

- **Anterior**: 1.29.3
- **Atual**: 1.29.3 (sem mudança de versão, apenas documentação)
- **Tipo**: RESEARCH (Portal Nacional)
---

## Sessão 29 (15/12/2025) - Eventos Manuais na Folha de Pagamento

### Contexto

O usuário precisava de flexibilidade para adicionar eventos manuais na folha de pagamento que não estavam contemplados nas rubricas padrão do eSocial. Além disso, foi identificado um erro na função `aprovar_rescisao` que impedia a aprovação de rescisões.

### Problemas Identificados

1. **Folha de Pagamento Rígida**: Não havia forma de adicionar eventos personalizados além das rubricas do eSocial
2. **Erro aprovar_rescisao**: Função retornava `column "history" of relation "accounting_entry_lines" does not exist`

### Soluções Implementadas

#### 1. Feature "Adicionar Evento" na Folha de Pagamento

**Arquivo modificado**: `src/pages/Payroll.tsx`

**Novos estados adicionados**:
```typescript
const [showAddEventDialog, setShowAddEventDialog] = useState(false);
const [addingEvent, setAddingEvent] = useState(false);
const [newEventForm, setNewEventForm] = useState({
  tipo: 'provento' as 'provento' | 'desconto',
  descricao: '',
  valor: '',
  observacao: ''
});
```

**Novas funções**:
- `openAddEventDialog()` - Abre modal para adicionar evento
- `handleAddEvent()` - Salva o evento manual na tabela `payroll_events`
- `handleDeleteEvent()` - Exclui eventos manuais (apenas para eventos com `is_oficial=false`)

**Funcionalidades**:
- Botão "Adicionar Evento" na tela de detalhes da folha
- Modal com seleção de tipo (Provento +/Desconto -)
- Campo para descrição e valor
- Campo opcional para observações
- Eventos manuais podem ser excluídos (botão X vermelho)
- Eventos oficiais (eSocial) não podem ser excluídos
- Recálculo automático dos totais após adicionar/excluir eventos

**Campos utilizados na tabela `payroll_events`**:
- `is_oficial` (boolean) - false para eventos manuais
- `is_desconto` (boolean) - true para descontos
- `descricao` (text) - descrição do evento
- `observacao` (text) - observações opcionais

#### 2. Correção da Função aprovar_rescisao

**Arquivo criado**: `supabase/migrations/20251215190000_fix_aprovar_rescisao_function.sql`

**Problema**: A função tentava inserir na coluna `history` que não existe em `accounting_entry_lines`

**Solução**: Alterado para usar a coluna correta `description`:
```sql
INSERT INTO accounting_entry_lines (..., description)
VALUES (..., v_description);
```

**Status**: Após testes, verificou-se que a função já estava corrigida em produção (retornou "Rescisão não encontrada" em vez do erro de coluna).

### Commit e Deploy

- **Commit**: `3ea64bb` - "feat: adicionar eventos manuais na folha de pagamento e corrigir funcao aprovar_rescisao"
- **Push**: origin/main
- **Deploy Vercel**: https://data-bling-sheets-3122699b-n1isrpmx7.vercel.app

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Payroll.tsx` | Adicionada feature completa de eventos manuais |
| `supabase/migrations/20251215190000_fix_aprovar_rescisao_function.sql` | Correção da função (column history → description) |

### Análise de Despesas dos Sócios (Contexto Adicional)

Durante a sessão, foi analisado o tratamento contábil das despesas pessoais dos sócios:
- **184 despesas** na categoria "Despesa Particular Socio" totalizando **R$ 482.520,67**
- **26 entradas existentes** na conta Adiantamento Sergio (código 100107) com **R$ 76.358,82**
- **177 despesas** precisariam de lançamentos contábeis (R$ 467.907,49)
- **Decisão**: Não criar os lançamentos agora - despesas estão provisionadas até 2027 conforme acordo com sócios

### Versão

- **Anterior**: 1.29.3
- **Atual**: 1.29.4
- **Tipo**: FEATURE (Eventos Manuais Folha) + BUGFIX (aprovar_rescisao)

---

## Sessão 30 (15/12/2025) - Portal Nacional NFS-e (SEFIN): testes reais + divergências RTC/Produção

### Contexto

Foi executado o fluxo fim-a-fim de emissão no **Portal Nacional NFS-e (SEFIN Nacional)** usando certificado **A1 (PFX)** via **mTLS**, com payload **DPS XML** em **GZIP+Base64** enviado em JSON.

Esta sessão atualiza e complementa a Sessão 28.2 com o estado real dos testes e a descoberta de divergências entre **Homologação (Produção Restrita / RTC)** e **Produção**.

### Descobertas / Comportamento por Ambiente

1. **Versão do layout (atributo `versao`) diverge por ambiente**
  - **Homologação/RTC**: aceita/valida **apenas 1.01** (mudança reportada em 10/12/2025)
  - **Produção**: validação observada exigindo **1.00** (1.01 falhou em validação de schema/pattern)

2. **Produção retorna E0037 para Goiânia (IBGE 5208707)**
  - Erro: `E0037 - Município emissor inexistente no cadastro de convênio municipal do sistema nacional`
  - Interpretação prática: reforça a conclusão de que **Goiânia não está habilitada/conveniada** no backend do Portal Nacional para emissão via API.

3. **Endpoint de parâmetros do município retorna 404 para 5208707**
  - O endpoint auxiliar de “consultar parâmetros do município” retornou **HTTP 404** em **Homologação e Produção** para o município informado.

4. **Homologação/RTC ainda retorna E0004 (ID divergente)**
  - Erro: `E0004 - ID da DPS difere da concatenação dos campos`
  - Apesar de validação local confirmar que o `Id` bate com a regra de concatenação, o backend continua acusando divergência.

### Ajustes Implementados no Código (DPS/ID/ambiente)

1. **Validação e formatação estrita do TSIdDPS**
  - `numero_dps`: 15 dígitos e não pode começar com 0
  - `serie_dps`: numérico, 1 a 5 dígitos, não pode ser “00000”; padding para 5 dígitos
  - A `serie` agora é emitida no XML já **padded** (consistente com a montagem do ID)

2. **Alinhamento de município de emissão entre `Id` e XML**
  - Adicionado suporte a `codigo_municipio_emissao` para garantir que o município usado no `Id` seja o mesmo usado em `<cLocEmi>`

3. **`tpAmb` e `versao` agora dependem do ambiente**
  - `ambiente=producao` → `tpAmb=1` e `versao=1.00`
  - `ambiente=homologacao` → `tpAmb=2` e `versao=1.01`

### Arquivos Criados/Modificados

| Arquivo | Alteração |
|---------|-----------|
| `nfes_servico/nfse/dps_builder.py` | Validações/normalizações do `TSIdDPS`, `tpAmb`, `versao`, `cLocEmi` |
| `nfes_servico/test_nacional.py` | Teste e2e com troca de ambiente via `NFSE_AMBIENTE` |
| `nfes_servico/debug_id.py` | Debug local para decompor `Id` e comparar com campos do XML |
| `nfes_servico/nfse/client_nacional.py` | Cliente REST mTLS para SEFIN (confirmado operacional para requests) |

### Como Reproduzir (sem expor segredos)

- Usar variáveis de ambiente (não commitar senha/certificado no repositório):
  - `NFSE_AMBIENTE=homologacao|producao`
  - `NFSE_CERT_PATH=.../certificados/...pfx`
  - `NFSE_CERT_PASSWORD=...`
- Executar o teste e2e (script Python do projeto): `python nfes_servico/test_nacional.py`

### Estado Atual / Próximos Passos

1. **Produção (Goiânia)**: sem convênio no cadastro nacional → caminho mais realista continua sendo **NFS-e municipal (ABRASF/ISSNet/SGISS)**.
2. **Homologação (E0004)**: investigar hipótese de divergência de regra no backend (ex.: campo de município esperado, normalização de série/número, ou leitura de outro campo para concatenação).

### Lições Aprendidas

1. Não assumir que **Produção** e **RTC** compartilham a mesma versão de XSD (na prática, não compartilham).
2. Sempre normalizar `serie`/`nDPS` para evitar discrepâncias invisíveis em validações de ID.
3. Evitar gravar segredos (senha PFX, tokens) na memória do projeto; usar env vars/secret manager local.

---

## Sessão 31 (15/12/2025) - Integração municipal Goiânia (ABRASF 2.04) via SOAP + mTLS + assinatura

### Contexto

Como Goiânia não está conveniada ao Portal Nacional NFS-e (SEFIN), foi iniciada a integração **direta** com o webservice municipal (padrão **ABRASF 2.04**), usando:
- **SOAP** (`nfse.asmx`)
- **mTLS** com certificado **A1 (PFX)**
- **Assinatura XML** (RSA-SHA1) dos elementos obrigatórios

### Principais Decisões Técnicas

1. **Não usar Supabase Edge Function para mTLS**
  - As Edge Functions estavam simulando homologação e falhando em produção por ausência de mTLS.
  - A emissão/consulta passou a ser feita por **Vercel Serverless Functions** em `/api`, com suporte a `https.request` + `pfx`.

2. **Certificado via env vars (sem arquivo no repo)**
  - O PFX deve ser fornecido ao backend via `NFSE_CERT_PFX_B64` e `NFSE_CERT_PASSWORD`.

3. **Assinatura conforme validação real (Goiânia/ISSNet/SGISS)**
  - Assina `InfDeclaracaoPrestacaoServico` com assinatura inserida **after** (irmão do elemento)
  - Assina `LoteRps` com assinatura inserida **append** (dentro do elemento)

### Arquivos Criados/Modificados

| Arquivo | Alteração |
|---------|-----------|
| `api/_shared/nfse-abrasf204.js` | Builder do XML ABRASF 2.04 + assinatura + envio SOAP mTLS + parsers |
| `api/nfse/emitir.js` | Endpoint `/api/nfse/emitir`: gera XML, assina, envia, atualiza `nfse` e `nfse_log` |
| `api/nfse/consultar.js` | Endpoint `/api/nfse/consultar`: consulta (por lote ou RPS), atualiza status |
| `src/pages/NFSe.tsx` | Troca de chamadas: `supabase.functions.invoke(...)` → `fetch('/api/nfse/...')` com Bearer token |

### Observações Importantes

1. **Em dev local (`npm run dev`) os endpoints `/api` não existem** (só no deploy Vercel ou via `vercel dev`).
2. O endpoint escolhe automaticamente:
  - **Homologação**: ISSNet Online (base `issnetonline.com.br/...`) com SOAPAction ABRASF
  - **Produção**: Goiânia (base `nfse.goiania.go.gov.br/ws`) com namespace/soapAction específicos

### Próximos Passos

1. Configurar as variáveis de ambiente no Vercel (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NFSE_CERT_PFX_B64`, `NFSE_CERT_PASSWORD`).
2. Ajustar/confirmar parâmetros de produção (série RPS, IM, itemListaServico, etc.) de acordo com o cadastro no portal de Goiânia.
---

## Sessão 32 (22/12/2025) - Correções de saldo bancário, folha de pagamento e classificação de despesas

### Contexto

Sessão focada em corrigir problemas de saldo bancário, reverter lançamentos duplicados de folha de pagamento e classificar despesas corretamente.

### Problemas Identificados e Corrigidos

#### 1. Lançamentos Duplicados da Folha de Pagamento
- **Problema**: 34 lançamentos contábeis e 15 registros de folha foram criados automaticamente, mas a folha já havia sido lançada manualmente via conciliação bancária
- **Solução**: Deletados todos os registros de `accounting_entries` e `payroll` criados em 22/12/2025
- **Impacto**: A DRE voltou ao valor correto

#### 2. Saldo Bancário Incorreto
- **Problema**: O saldo mostrava R$ 192.646,32, mas o extrato de Janeiro/2025 mostra R$ 18.553,54
- **Solução**: Ajustado `current_balance` para R$ 18.553,54 (valor do extrato OFX de Jan/2025)
- **Data do saldo**: 31/01/2025 (período que está sendo fechado)
- **Nota**: Quando mudar para outro mês, precisa atualizar o saldo conforme o extrato daquele mês

#### 3. Classificação da Despesa de Água Mineral
- **Problema**: 2 despesas de R$ 96,00 (água mineral) estavam em "Outras Despesas Administrativas"
- **Solução**: Movidas para conta **4.1.2.07 - Água Mineral**
- **Categoria**: Copa e Cozinha → Água Mineral
- **Marcadas como recorrentes**

### Cadastro no Módulo de Estoque e Compras

#### Produto Cadastrado
- **Código**: ALIM010
- **Nome**: Galão Água Mineral 20L
- **Fornecedor**: LUIZ ALVES TAVEIRA
- **Preço unitário**: R$ 9,60
- **Quantidade por compra**: 10 galões
- **Total por compra**: R$ 96,00
- **Frequência**: Quinzenal (2x por mês)
- **Estoque**: Mínimo 5, Ideal 15, Atual 10

#### Movimentações Registradas
- Compra 1 - Janeiro/2025: 10 galões
- Compra 2 - Janeiro/2025: 10 galões

### Nova Tela Criada: Conciliação de Saldo de Abertura

**Rota**: `/opening-balance-reconciliation`

**Funcionalidades**:
1. Lista entradas de Janeiro/2025 (saldo de abertura) pendentes de conciliação
2. Permite selecionar múltiplos honorários de clientes para cada depósito consolidado
3. Auto-identificação de cliente via CPF/CNPJ extraído do PIX
4. Validação de diferença zerada antes de confirmar
5. Registro no razão do cliente e atualização do saldo de abertura

**Arquivos criados**:
- `src/pages/OpeningBalanceReconciliation.tsx`
- `supabase/migrations/20251222191000_opening_balance_january.sql`

### Commits Realizados

| Hash | Descrição |
|------|-----------|
| `e2a1e6e` | feat: adicionar tela de Conciliação de Saldo de Abertura |

### Saldos Bancários por Mês (Referência OFX)

| Mês | Saldo Final |
|-----|-------------|
| Jan/2025 | R$ 18.553,54 |
| Fev/2025 | R$ 2.578,93 |
| Mar/2025 | R$ 28.082,64 |
| Abr/2025 | R$ 5.533,07 |
| Mai/2025 | R$ 10.119,92 |
| Jun/2025 | R$ 2.696,75 |
| Jul/2025 | R$ 8.462,05 |
| Ago/2025 | R$ 10.251,53 |
| Set/2025 | R$ 14.796,07 |
| Nov/2025 | R$ 54.849,25 |

### Lições Aprendidas

1. **Folha de pagamento já conciliada manualmente**: Não gerar lançamentos automáticos quando já existe lançamento manual via conciliação bancária
2. **Saldo bancário deve vir do extrato**: Nunca calcular/adivinhar saldo - sempre usar o valor do extrato OFX
3. **Saldo muda por período**: O current_balance deve refletir o saldo do período que está sendo fechado
4. **Classificação de despesas recorrentes**: Identificar e classificar corretamente despesas recorrentes como água mineral no módulo de estoque

### Pendências para Próxima Sessão

1. Continuar fechamento de Janeiro/2025
2. Importar extratos OFX faltantes (Out/2025 está junto com Nov/2025)
3. Verificar se há mais despesas classificadas incorretamente
4. Configurar alerta de estoque mínimo para água mineral

---

## Sessão 33 (26/12/2025) - Correção de Despesas Deletadas no DRE + Auditoria de Dependências

### Contexto

Sessão focada em dois problemas: corrigir bug onde despesas deletadas continuavam aparecendo no DRE e realizar auditoria completa das dependências do projeto.

### Problema Principal: Despesas Deletadas no DRE

#### Causa Raiz
Quando uma despesa era deletada da tabela `expenses`, os lançamentos contábeis associados em `accounting_entries` e `accounting_entry_lines` permaneciam. Como o DRE lê de `accounting_entry_lines` (fonte única da verdade), a despesa deletada continuava aparecendo.

**Fluxo antes da correção:**
1. Criar despesa → `registrarDespesa()` → cria lançamento em `accounting_entries`
2. Deletar despesa → deleta apenas de `expenses` → **lançamento permanece**
3. DRE lê de `accounting_entry_lines` → **despesa "fantasma" aparece**

#### Solução Implementada

1. **Novo método no AccountingService** (`src/services/AccountingService.ts`):
   - `deletarLancamentoPorReferencia()` - deleta lançamentos por reference_type e reference_id
   - `deletarLancamentosDespesa()` - deleta provisionamento + pagamento de uma despesa

2. **Novo método no hook useAccounting** (`src/hooks/useAccounting.ts`):
   - Expõe `deletarLancamentosDespesa` e `deletarLancamentoPorReferencia`

3. **Modificações em Expenses.tsx** (`src/pages/Expenses.tsx`):
   - `handleDelete` agora chama `deletarLancamentosDespesa()` antes de deletar
   - `handleRecurringAction` também deleta lançamentos ao excluir despesas recorrentes

### Auditoria de Dependências

Criado relatório completo (`DEPENDENCY_AUDIT.md`) identificando:

#### Vulnerabilidades de Segurança (5 total)
| Severidade | Pacote | Problema |
|------------|--------|----------|
| **ALTA** | `xlsx` | Prototype Pollution + ReDoS - sem correção |
| **ALTA** | `glob` | Injeção de comando |
| **MODERADA** | `esbuild` (via vite) | Vulnerabilidade dev server |
| **MODERADA** | `mdast-util-to-hast` | Classe não sanitizada |

#### Dependências Não Utilizadas (12 pacotes, ~540KB)
- `@dnd-kit/*` (drag-and-drop não usado)
- `react-hot-toast` (duplicado - sonner é usado)
- `axios`, `crypto-js`, `zustand`, etc.

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/services/AccountingService.ts` | +90 linhas: métodos de exclusão de lançamentos |
| `src/hooks/useAccounting.ts` | +25 linhas: exposição dos métodos de exclusão |
| `src/pages/Expenses.tsx` | Modificado handleDelete e handleRecurringAction |
| `DEPENDENCY_AUDIT.md` | Novo arquivo: relatório de auditoria |

### Commits Realizados

| Hash | Descrição |
|------|-----------|
| `f59347a` | docs: add comprehensive dependency audit report |
| `890bc98` | fix: deletar lançamentos contábeis ao excluir despesas |

### Lições Aprendidas

1. **Integridade contábil**: Ao deletar registros operacionais (expenses, invoices), SEMPRE deletar os lançamentos contábeis associados
2. **Fonte única da verdade**: O DRE lê de `accounting_entry_lines`, não de `expenses` - manter consistência
3. **xlsx tem vulnerabilidades críticas**: Considerar migração para `exceljs`

### Próximos Passos

1. Remover dependências não utilizadas (`npm uninstall react-hot-toast ...`)
2. Rodar `npm audit fix` para corrigir vulnerabilidades automáticas
3. Avaliar substituição do pacote `xlsx` por alternativa segura
