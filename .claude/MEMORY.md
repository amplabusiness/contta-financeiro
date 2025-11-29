# Ampla Contabilidade - Memória do Projeto

## Visão Geral
Sistema de gestão financeira e contábil para escritório de contabilidade, em evolução para SaaS multi-tenant.

## Stack Tecnológico
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **AI**: Lovable API Gateway (Gemini 2.5 Flash)
- **Deploy**: Vercel (planejado)

## Arquitetura Atual
```
src/
├── components/     # Componentes UI reutilizáveis
├── contexts/       # React Context (ClientContext, PeriodContext)
├── hooks/          # Custom hooks
├── integrations/   # Supabase client
├── pages/          # Páginas da aplicação
└── lib/            # Utilitários

supabase/
├── functions/      # Edge Functions (Deno)
└── migrations/     # Migrações SQL
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
4. Cria lançamento contábil via `smart-accounting` (generate_retroactive)

### 5. Negociação de Dívidas
**Fluxo implementado**:
1. Seleciona cliente com faturas em atraso
2. Configura parcelamento (entrada + parcelas)
3. Cria registro em `debt_negotiations`
4. Gera parcelas em `debt_negotiation_installments`
5. Cria 13º honorário automático se aplicável

### 6. Reajuste de Honorários
**Fluxo implementado**:
1. Busca salário mínimo vigente via API BCB
2. Calcula novo valor baseado em múltiplo configurado
3. Atualiza `monthly_fee` dos clientes elegíveis
4. Registra histórico em `fee_adjustments`

### 7. Conciliação com Split
**Fluxo do Super Conciliador**:
1. Transação bancária de R$ X
2. Usuário seleciona múltiplos honorários que somam X
3. Sistema cria reconciliação e lançamentos contábeis
4. Atualiza status dos honorários para 'paid'

## Arquitetura Contábil Integrada (v7 - 29/11/2025)

### Filosofia
**TODO dado que entra no sistema nasce com seu lançamento contábil.**
Não existe processamento retroativo - a contabilidade acontece no momento da inserção.

### Serviço Central: AccountingService
Localização: `src/services/AccountingService.ts`

```typescript
import { useAccounting } from '@/hooks/useAccounting';

// Em qualquer componente:
const { registrarHonorario, registrarRecebimento, registrarDespesa } = useAccounting();

// Ao criar um honorário:
const result = await registrarHonorario({
  invoiceId: newInvoice.id,
  clientId: client.id,
  clientName: client.name,
  amount: 1500,
  competence: '01/2025',
  dueDate: '2025-01-10',
});
```

### Tipos de Lançamento Suportados
| Tipo | Descrição | Débito | Crédito |
|------|-----------|--------|---------|
| `receita_honorarios` | Fatura emitida | Cliente a Receber | Receita de Honorários |
| `recebimento` | Pagamento recebido | Caixa/Banco | Cliente a Receber |
| `saldo_abertura` | Saldo inicial | Cliente a Receber | Receita |
| `despesa` | Despesa provisionada | Conta de Despesa | Fornecedor a Pagar |
| `pagamento_despesa` | Despesa paga | Fornecedor a Pagar | Caixa/Banco |
| `transferencia_bancaria` | Transferência | Banco Destino | Banco Origem |
| `importacao_ofx` | Lançamento OFX | Variável | Variável |

### Integração nos Formulários

| Página | Método | Quando |
|--------|--------|--------|
| Invoices.tsx | `registrarHonorario` | Ao criar honorário |
| Invoices.tsx | `registrarRecebimento` | Ao marcar como pago |
| ClientOpeningBalance.tsx | `registrarSaldoAbertura` | Ao criar saldo |
| Expenses.tsx | `registrarDespesa` | Ao criar despesa |
| Expenses.tsx | `registrarPagamentoDespesa` | Ao marcar como paga |

### Idempotência
O serviço verifica `reference_type + reference_id + entry_type` antes de criar.
Não cria duplicatas mesmo se chamado múltiplas vezes.

## Edge Functions Principais

| Função | Propósito | Versão |
|--------|-----------|--------|
| `smart-reconciliation` | Sugestões de match com IA | - |
| `smart-accounting` | Lançamentos contábeis inteligentes | v7 |
| `ai-accountant` | IA para consultas contábeis | - |
| `client-enrichment` | Enriquecimento via ReceitaWS | - |

### smart-accounting (v7)
Funções disponíveis:
- `init_chart` - Inicializa plano de contas padrão
- `ensure_account` - Garante que conta existe (cria se necessário)
- `ensure_client_account` - Cria conta específica para cliente
- `create_entry` - Cria lançamento contábil inteligente
- `generate_retroactive` - Gera lançamentos para dados históricos (legacy)
- `ai_analyze` - Sugere conta contábil para transação
- `debug_status` - Diagnóstico do estado das tabelas contábeis

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

### 4. Contabilidade Inteligente - Lançamentos não criados (29/11/2025)
**Causa**: `.single()` do Supabase retorna erro quando não encontra registro
**Problema**: Código não verificava o erro, assumia que registro existia
**Solução**: Usar `.maybeSingle()` que retorna `null` sem erro + verificação explícita

```typescript
// ERRADO
const { data: existing } = await supabase.from('table').select().eq('id', x).single();
if (existing) skip(); // Bug: existing pode ser undefined por erro, não por não existir

// CORRETO
const { data: existing, error } = await supabase.from('table').select().eq('id', x).maybeSingle();
if (existing && !error) skip(); // Só pula se realmente encontrou
```

### 5. competence_date NULL constraint (29/11/2025)
**Causa**: Campo obrigatório mas não estava sendo preenchido
**Solução**: Função `extractDate()` para parsing robusto + fallback para data atual

### 6. Erros em Migrações SQL (28/11/2025)

#### 6.1 `ALTER TABLE IF NOT EXISTS` inválido
**Causa**: PostgreSQL não suporta `ALTER TABLE IF NOT EXISTS column`
**Solução**: Usar bloco `DO $$ BEGIN IF NOT EXISTS (SELECT FROM information_schema.columns...) THEN ALTER TABLE... END IF; END $$;`

#### 6.2 Coluna `client_id` não existe em `accounting_entries`
**Causa**: Schema usa `accounting_entry_items` para relação com cliente
**Solução**: Views materializadas devem usar `accounting_entry_items` ou `client_ledger`

#### 6.3 Coluna `transaction_type` não existe em `bank_transactions`
**Causa**: Schema real é diferente do planejado
**Solução**: Simplificar `mv_cash_flow` para usar `invoices` e `expenses`

#### 6.4 Coluna `payment_date` não existe
**Causa**: Invoices usa `due_date` para vencimento
**Solução**: Usar `due_date` ao invés de `payment_date`

#### 6.5 Conflito de timestamp em migrations
**Causa**: Múltiplas migrations com mesmo timestamp base (20251120)
**Solução**: Usar timestamps com precisão de segundos (20251120000200)

## Problemas em Andamento (29/11/2025)

### URGENTE: Contabilidade Inteligente - Entries Órfãos

**Status**: EM CORREÇÃO - Ver [CONTABILIDADE_INTELIGENTE.md](./CONTABILIDADE_INTELIGENTE.md)

**Problema**: Lançamentos sendo criados sem linhas de débito/crédito

**Causas Identificadas**:
1. Triggers PostgreSQL (`trg_invoice_provision`, etc) criando entries órfãos
2. Join implícito excluindo registros sem cliente
3. Verificação de existência não checava se tinha linhas

**Ação Necessária**: Executar SQL no Supabase Dashboard para desabilitar triggers:
```sql
DROP TRIGGER IF EXISTS trg_invoice_provision ON invoices;
DROP TRIGGER IF EXISTS trg_invoice_payment ON invoices;
DROP TRIGGER IF EXISTS trg_expense_provision ON expenses;
DROP TRIGGER IF EXISTS trg_expense_payment ON expenses;

DELETE FROM accounting_entries
WHERE id NOT IN (SELECT DISTINCT entry_id FROM accounting_entry_lines);
```

**Versão da função Edge**: v11 (smart-accounting)

---

## Próximos Passos (Roadmap)
Ver arquivo ROADMAP.md

## Configuração do Ambiente

### Supabase
- **Project ID**: xdtlhzysrpoinqtsglmr
- **URL**: https://xdtlhzysrpoinqtsglmr.supabase.co
- **CLI**: v2.58.5 instalado

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
