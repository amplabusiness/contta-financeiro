# Contabilidade Inteligente - Documentação Técnica

## Status Atual: EM CORREÇÃO

**Data:** 2025-11-29
**Versão da função Edge:** v12

---

## Problema Principal

O sistema de **Contabilidade Inteligente** está criando lançamentos contábeis (`accounting_entries`) mas **sem as linhas de débito/crédito** (`accounting_entry_lines`), resultando em "entries órfãos".

### Sintomas Observados:
- 100 lançamentos existem na tabela `accounting_entries`
- 0 linhas existem na tabela `accounting_entry_lines`
- 104 faturas existem para Janeiro/2025
- O processamento retorna "0 lançamentos criados"

---

## Causa Raiz Identificada

### 1. Triggers Automáticos Conflitantes (RESOLVIDO)

Existem **triggers PostgreSQL** que são acionados automaticamente quando invoices/expenses são inseridas:

```sql
-- Triggers problemáticos (criados em migration 20251116142931)
trg_invoice_provision    -- INSERT em invoices
trg_invoice_payment      -- UPDATE em invoices (status = 'paid')
trg_expense_provision    -- INSERT em expenses
trg_expense_payment      -- UPDATE em expenses (status = 'paid')
```

Esses triggers usam **códigos de contas antigos** que não existem no plano de contas atual:
- `1.1.2.02` (não existe)
- `4.1.1` (é sintética, não analítica)

Resultado: Os triggers criam entries mas falham ao criar as linhas.

**Status**: RESOLVIDO via migration `20251129170000_disable_auto_accounting_triggers.sql`

### 4. Trigger em accounting_entry_lines com Função Incorreta (NOVO - 29/11/2025)

**Erro descoberto**: `record "new" has no field "total_debit"`

**Causa**: O trigger `check_balance_after_line_change` na tabela `accounting_entry_lines`
chama a função `check_entry_balance()` que foi modificada na migration `20251121114757`
para acessar `NEW.total_debit` e `NEW.id` - campos que existem em `accounting_entries`,
**não** em `accounting_entry_lines`.

```sql
-- Trigger problemático (migration 20251113145517)
CREATE TRIGGER check_balance_after_line_change
AFTER INSERT OR UPDATE OR DELETE ON public.accounting_entry_lines
FOR EACH ROW
EXECUTE FUNCTION public.check_entry_balance();

-- Função modificada incorretamente (migration 20251121114757)
CREATE OR REPLACE FUNCTION public.check_entry_balance()
-- Esta função tenta acessar NEW.total_debit, que não existe em accounting_entry_lines!
```

**Campos que causam erro**:
- `NEW.total_debit` - existe em `accounting_entries`, não em `accounting_entry_lines`
- `NEW.id` - a linha tem `id`, mas a função espera o `id` do entry

**Status**: Migration criada: `20251129200000_disable_entry_lines_trigger.sql`

### 2. Join Implícito com Tabela Clients

A função `generateRetroactiveEntries` fazia um join implícito:
```typescript
// PROBLEMA: Se client_id não existe em clients, o registro é excluído
.select(`*, clients(id, name)`)
```

**Correção aplicada (v9):** Buscar sem join e depois buscar cliente separadamente:
```typescript
.select('*')  // Sem join
// Depois:
if (invoice.client_id) {
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', invoice.client_id)
    .maybeSingle();
}
```

### 3. Verificação de Existência Não Checava Linhas

A função verificava se já existia um entry, mas não verificava se tinha linhas:
```typescript
// PROBLEMA: Entry órfão era considerado "já processado"
if (existingEntry) { skip; }
```

**Correção aplicada (v10):** Verificar se entry TEM linhas:
```typescript
if (existingEntry) {
  const { count: linesCount } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact', head: true })
    .eq('entry_id', existingEntry.id);

  if (linesCount > 0) {
    skip; // Entry válido
  } else {
    delete(existingEntry); // Órfão - deletar e recriar
  }
}
```

---

## Solução Pendente

### AÇÃO NECESSÁRIA: Executar SQL no Supabase

Acesse: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new

Execute o seguinte SQL:

```sql
-- =================================================
-- PASSO 1: Desabilitar trigger problemático em accounting_entry_lines
-- =================================================
-- Este trigger chama check_entry_balance() que tenta acessar
-- NEW.total_debit - campo que não existe em accounting_entry_lines
DROP TRIGGER IF EXISTS check_balance_after_line_change ON accounting_entry_lines;

-- =================================================
-- PASSO 2: Desabilitar triggers de invoice/expense (se ainda existirem)
-- =================================================
DROP TRIGGER IF EXISTS trg_invoice_provision ON invoices;
DROP TRIGGER IF EXISTS trg_invoice_payment ON invoices;
DROP TRIGGER IF EXISTS trg_expense_provision ON expenses;
DROP TRIGGER IF EXISTS trg_expense_payment ON expenses;

-- =================================================
-- PASSO 3: Limpar entries órfãos existentes
-- =================================================
DELETE FROM accounting_entries
WHERE id NOT IN (
  SELECT DISTINCT entry_id FROM accounting_entry_lines WHERE entry_id IS NOT NULL
);

-- =================================================
-- PASSO 4: Verificar resultado
-- =================================================
SELECT
  (SELECT COUNT(*) FROM accounting_entries) as entries,
  (SELECT COUNT(*) FROM accounting_entry_lines) as lines;

-- =================================================
-- PASSO 5: Verificar que não há mais triggers problemáticos
-- =================================================
SELECT tgname, tgrelid::regclass as tabela
FROM pg_trigger
WHERE tgname IN (
  'check_balance_after_line_change',
  'trg_invoice_provision',
  'trg_invoice_payment',
  'trg_expense_provision',
  'trg_expense_payment'
);
-- Resultado esperado: 0 linhas
```

### Status dos Triggers e Cleanup (ATUALIZADO)

A rotina de limpeza com triggers foi consolidada no arquivo `supabase/sql/cleanup_accounting_entries.sql` e já executa automaticamente todos os passos abaixo:

1. Drop permanente do trigger `check_balance_after_line_change` em `accounting_entry_lines`.
2. Drop dos quatro triggers legados em `invoices/expenses`.
3. Remoção dos `accounting_entries` órfãos.
4. Queries de verificação (contagem e lista de triggers) para evidência.

> Resultado da última execução (30/11/2025): `entries = 178`, `lines = 356` e **nenhum** dos triggers problemáticos permanece cadastrado.

Como essa rotina virou redundante, **não precisa ser reexecutada** a cada sessão; basta rodar o script se novos triggers forem criados no futuro ou se surgirem entries sem linhas.

### Próximos Passos após o Cleanup

1. Voltar para **Contabilidade Inteligente** e clicar em **"Testar 1"** para validar um único lançamento.
2. Se o teste for bem-sucedido (entry com duas linhas), clicar em **"Processar Tudo"**.
3. Registrar os resultados (logs/toasts) e atualizar o CONTEXT.
4. Prosseguir com o bloco de **CI/CD + migrations** descrito em `.github/SETUP_CI_CD.md` e na seção de Migrations abaixo.

---

## Arquitetura do Sistema

### Fluxo de Dados

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│    invoices     │────>│ smart-accounting │────>│ accounting_entries  │
│ (104 faturas)   │     │  Edge Function   │     │                     │
└─────────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                           │
┌─────────────────┐                              ┌─────────▼──────────┐
│ client_opening  │────────────────────────────> │ accounting_entry   │
│    _balance     │                              │      _lines        │
└─────────────────┘                              └────────────────────┘
```

### Tabelas Envolvidas

| Tabela | Descrição |
|--------|-----------|
| `invoices` | Faturas/honorários dos clientes |
| `client_opening_balance` | Saldos de abertura de clientes |
| `accounting_entries` | Lançamentos contábeis (cabeçalho) |
| `accounting_entry_lines` | Linhas de débito/crédito |
| `chart_of_accounts` | Plano de contas |
| `clients` | Cadastro de clientes |

### Função Edge: smart-accounting

**Localização:** `supabase/functions/smart-accounting/index.ts`

**Ações disponíveis:**

| Action | Descrição |
|--------|-----------|
| `init_chart` | Inicializa plano de contas padrão |
| `generate_retroactive` | Gera lançamentos para registros existentes |
| `cleanup_orphans` | Remove entries sem linhas |
| `debug_status` | Mostra contagem das tabelas |
| `disable_triggers` | Retorna SQL para desabilitar triggers |
| `create_entry` | Cria um lançamento contábil |
| `ensure_account` | Garante que uma conta existe |
| `ensure_client_account` | Cria conta analítica para cliente |

---

## Lançamentos Contábeis - Regras NBC

### Estrutura de um Lançamento

```
accounting_entries (cabeçalho)
├── id
├── entry_date          (data do lançamento)
├── competence_date     (mês de competência)
├── entry_type          (receita_honorarios, recebimento, etc)
├── description         (histórico)
├── reference_type      (invoice, opening_balance, etc)
├── reference_id        (UUID da origem)
├── total_debit         (soma dos débitos)
├── total_credit        (soma dos créditos)
└── balanced            (true se D=C)

accounting_entry_lines (linhas)
├── entry_id            (FK para accounting_entries)
├── account_id          (FK para chart_of_accounts)
├── description         (D - xxx ou C - xxx)
├── debit               (valor se débito)
└── credit              (valor se crédito)
```

### Exemplo: Lançamento de Honorários

**Fato contábil:** Provisionamento de receita de honorários

```
D - 1.1.2.01.XXX  Cliente: Nome     R$ 1.500,00
C - 3.1.1.01      Honorários        R$ 1.500,00
```

### Contas Utilizadas

| Código | Nome | Tipo | Natureza |
|--------|------|------|----------|
| 1.1.2.01 | Clientes a Receber | ATIVO | DEVEDORA |
| 1.1.2.01.XXX | Cliente: [Nome] | ATIVO | DEVEDORA |
| 3.1.1.01 | Honorários Contábeis | RECEITA | CREDORA |
| 1.1.1.01 | Caixa Geral | ATIVO | DEVEDORA |

---

## Histórico de Versões

### v12 (atual - 29/11/2025)
- Corrigido `ensureClientAccount` para usar `.maybeSingle()` ao invés de `.single()`
- Adicionada ação `test_single_entry` para debug isolado
- Identificado trigger problemático `check_balance_after_line_change`

### v11
- Validação de IDs de contas antes de inserir linhas
- Limpeza automática de entry órfão se inserção de linhas falhar
- Logging detalhado para debug

### v10
- Verificação se entry existente tem linhas
- Deleção de entries órfãos durante processamento

### v9
- Removido join implícito com tabela clients
- Busca separada do nome do cliente

### v8
- Adicionada ação `cleanup_orphans`
- Adicionada ação `debug_status`

---

## Troubleshooting

### Problema: "0 lançamentos criados"

1. Verifique se há triggers ativos:
```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE 'trg_%';
```

2. Verifique entries órfãos:
```sql
SELECT COUNT(*) as orfaos
FROM accounting_entries e
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_entry_lines l
  WHERE l.entry_id = e.id
);
```

3. Verifique logs da função Edge no dashboard Supabase

### Problema: Linhas não são inseridas

1. Verifique se as contas existem no plano:
```sql
SELECT * FROM chart_of_accounts
WHERE code IN ('1.1.2.01', '3.1.1.01');
```

2. Verifique se são contas analíticas:
```sql
SELECT code, name, is_analytical
FROM chart_of_accounts
WHERE code LIKE '%.01';
```

---

## Próximos Passos

1. [x] Executar SQL para desabilitar triggers de invoice/expense
2. [ ] **URGENTE**: Executar SQL para desabilitar trigger `check_balance_after_line_change`
3. [ ] Testar com botão "Testar 1" na Contabilidade Inteligente
4. [ ] Se funcionar, rodar "Processar Tudo"
5. [ ] Verificar se lançamentos foram criados com linhas
6. [ ] Implementar processamento em lotes (atualmente limite de 50)

---

## Contato

Para continuar este trabalho, a IA deve:
1. Ler este documento
2. Verificar se o trigger `check_balance_after_line_change` foi desabilitado
3. Testar o processamento com botão "Testar 1"
4. Verificar logs no Supabase Dashboard

### Migrations Criadas

| Migration | Propósito | Status |
|-----------|-----------|--------|
| `20251129210000_disable_auto_accounting_triggers.sql` | Desabilita triggers de invoice/expense | Aplicar |
| `20251129220000_disable_entry_lines_trigger.sql` | Desabilita `check_balance_after_line_change` | Aplicar |
| `20251129230000_auto_accounting_for_invoices.sql` | Auto-contabilidade para faturas | Aplicar |
| `20251129240000_ai_validation_columns.sql` | Colunas de validação IA + fila | Aplicar |

### Edge Functions Deployadas

| Function | Propósito | Status |
|----------|-----------|--------|
| `smart-accounting` | Contabilidade inteligente | Deployed |
| `ai-accountant-background` | Validação em background | Deployed |
| `ai-accountant-agent` | Análise contábil com IA | Deployed |

---

## SQL para Aplicar Migrations (Execute no SQL Editor)

Acesse: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new

### Migration 1: Validação IA

```sql
-- Colunas de validação IA na tabela accounting_entries
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_validated') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_validated BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_validated_at') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_validated_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_validation_result') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_validation_result TEXT CHECK (ai_validation_result IN ('valid', 'invalid', 'warning', 'pending'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_validation_message') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_validation_message TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_confidence') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_confidence DECIMAL(3,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_generated') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_generated BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'ai_model') THEN
    ALTER TABLE accounting_entries ADD COLUMN ai_model TEXT;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_accounting_entries_ai_validated
  ON accounting_entries(ai_validated)
  WHERE ai_validated = false;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_ai_result
  ON accounting_entries(ai_validation_result);
```

### Migration 2: Fila de Validação

```sql
-- Tabela de fila
CREATE TABLE IF NOT EXISTS ai_validation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(entry_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_validation_queue_status
  ON ai_validation_queue(status, priority)
  WHERE status IN ('pending', 'retry');

-- RLS
ALTER TABLE ai_validation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON ai_validation_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ai_validation_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Processar Faturas Sem Contabilidade

Após aplicar as migrations, execute:

```sql
SELECT * FROM process_invoices_without_accounting(500);
```
