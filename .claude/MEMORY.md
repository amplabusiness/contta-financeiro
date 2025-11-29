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
4. Cria lançamento contábil via `create-accounting-entry`

### 5. Conciliação com Split
**Fluxo do Super Conciliador**:
1. Transação bancária de R$ X
2. Usuário seleciona múltiplos honorários que somam X
3. Sistema cria reconciliação e lançamentos contábeis
4. Atualiza status dos honorários para 'paid'

## Edge Functions Principais

| Função | Propósito |
|--------|-----------|
| `smart-reconciliation` | Sugestões de match com IA |
| `smart-accounting` | Lançamentos contábeis inteligentes |
| `create-accounting-entry` | Criação de lançamentos |
| `ai-accountant` | IA para consultas contábeis |
| `client-enrichment` | Enriquecimento via ReceitaWS |

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

#### 4.8 DRE mostrando R$ 0,00 (29/11/2025 - PENDENTE)
**Causa**: DRE usa `invoices.status='paid'` para receitas, mas os honorários não estão marcados como pagos
**Diferença**:
- Balancete usa `accounting_entry_lines` (fonte correta - dados contábeis)
- DRE usa `invoices` (fonte incorreta - dados operacionais)
**Solução pendente**: Refatorar DRE para usar `accounting_entry_lines` como fonte de dados

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
