# 🗺️ Mapeamento Completo do Banco de Dados

**Data:** 26/12/2025 (Atualizado: 06/01/2026)

## 📊 Visão Geral

| Métrica | Valor |
|--------|-------|
| Total de Tabelas | 16 |
| Total de Registros | 3.098 |
| Clientes | 219 |
| Despesas | 631 |
| Receita em Notas | R$ 136.821,59 |

## ⚠️ ALERTAS DE AUDITORIA

### Tabelas VAZIAS (Sem registros)
- ❌ **cost_center_mapping** (0 registros) - Mapeamento não está sendo usado
- ❌ **recurring_expenses** (0 registros) - Despesas recorrentes não configuradas
- ❌ **debt_confessions** (0 registros) - Acordos de renegociação não utilizados

### Tabelas com BAIXO USO (< 5% de atividade)
- ⚠️ **cost_centers** (13 registros) - Pouco utilizado considerando 631 despesas
- ⚠️ **revenue_categories** (7 registros) - Classificação básica
- ⚠️ **bank_imports** (11 registros) - Importações ocasionais

### ❌ TABELAS INCONSISTENTES COM CÓDIGO
- **journal_entries** - Referenciada no código anterior, MAS NÃO EXISTE
- **journal_entry_lines** - Referenciada no código anterior, MAS NÃO EXISTE
- **accounting_entry_items** - Pode existir, alternativa para `accounting_entry_lines`

---

## 📋 Tabelas Mapeadas (Com Detalhes)

### clients (219 registros)
**Descrição:** Cadastro de clientes/empresas que contratam serviços
**Propósito:** CRM - Gestão de relacionamento com clientes
**Status:** ✅ Ativo e utilizado
**Relacionamentos:**
- `invoices` (1-N): Clientes com múltiplas notas fiscais
- `expenses` (N-1): Alguns custos alocados a clientes específicos
- `chart_of_accounts` (N-1): Contas a receber por cliente

---

### invoices (110 registros)
**Descrição:** Notas Fiscais Eletrônicas (RPS) emitidas
**Propósito:** Faturamento - Emissão de RPS e recebimento
**Status:** ✅ Ativo (Média: ~110 faturas)
**Campos Críticos:**
- `client_id` (FK → clients)
- `amount` (NUMERIC) - Valor da nota
- `status` (pending/paid/overdue)
- `due_date` (DATE)
- `paid_date` (DATE, NULLABLE)

---

### expenses (631 registros)
**Descrição:** Despesas operacionais e contas a pagar
**Propósito:** Contas a pagar - Gestão de despesas
**Status:** ✅ Muito ativo (631 registros)
**Campos Críticos:**
- `category_id` (FK → expense_categories)
- `cost_center_id` (FK → cost_centers, raramente preenchido ⚠️)
- `amount` (NUMERIC)
- `due_date` (DATE)
- `status` (pending/paid/cancelled)

---

### employees (22 registros)
**Descrição:** Funcionários e folha de pagamento
**Propósito:** Folha de pagamento - ESOCIAL
**Status:** ⚠️ Parcialmente utilizado (22 funcionários)
**Nota:** Integração com folha_pagamento_json

---

### bank_accounts (1 registro)
**Descrição:** Contas bancárias cadastradas
**Propósito:** Tesouraria - Controle de contas
**Status:** ✅ Ativo (Sicredi - Agência 3950)
**Única conta:** `748 | SICREDI | Ag. 3950 | CC 27806-8`

---

### bank_transactions (393 registros)
**Descrição:** Movimentações de extrato bancário
**Propósito:** Conciliação bancária automática
**Status:** ✅ Muito ativo (Jan/2025)
**Campos Críticos:**
- `bank_account_id` (FK → bank_accounts)
- `transaction_date` (DATE)
- `description` (TEXT)
- `amount` (NUMERIC) - Positivo: entrada, Negativo: saída
- `balance_after` (NUMERIC) - Saldo pós-transação
- `matched` (BOOLEAN) - Conciliada?
- ⚠️ **journal_entry_id** (FK → ???) - **CAMPO PROBLEMÁTICO** (referencia tabela inexistente)

---

### bank_imports (11 registros)
**Descrição:** Importações de arquivos OFX/CSV
**Propósito:** Importação de extratos
**Status:** ⚠️ Baixo uso (11 importações)

---

### chart_of_accounts (372 registros)
**Descrição:** Plano de contas contábil
**Propósito:** Estrutura contábil - Base para DRE e Balanço
**Status:** ✅ Muito ativo (372 contas configuradas)
**Campos Críticos:**
- `code` (TEXT UNIQUE) - Ex: 1.1.1, 4.1.1, 2.1.2
- `name` (TEXT)
- `account_type` (TEXT) - ATIVO, PASSIVO, RECEITA, DESPESA
- `is_active` (BOOLEAN)

---

### accounting_entries (474 registros) ✅ **TABELA PRINCIPAL**
**Descrição:** Lançamentos contábeis (diário) - **USE ESTA, NÃO journal_entries**
**Propósito:** Diário contábil - Partidas dobradas
**Status:** ✅ Muito ativo (474 lançamentos)
**Campos Críticos:**
- `id` (UUID, PK)
- `entry_type` (TEXT) - 'provision', 'payment', 'adjustment', 'manual'
- `description` (TEXT)
- `entry_date` (DATE)
- `reference_type` (TEXT NULLABLE) - 'invoice', 'expense', 'bank_transaction'
- `reference_id` (UUID NULLABLE) - ID da referência
- `document_number` (TEXT NULLABLE)
- `total_debit` (NUMERIC)
- `total_credit` (NUMERIC)
- `balanced` (BOOLEAN) - Débito = Crédito?
- **`competence` (VARCHAR, NOT NULL)** - ⭐ **OBRIGATÓRIO: Formato MM/YYYY**
- `created_by` (UUID NULLABLE)
- `created_at` / `updated_at` (TIMESTAMPTZ)

---

### accounting_entry_lines (806 registros) ✅ **TABELA PRINCIPAL**
**Descrição:** Linhas de débito/crédito dos lançamentos - **USE ESTA, NÃO journal_entry_lines**
**Propósito:** Linhas do diário
**Status:** ✅ Muito ativo (806 linhas para 474 lançamentos)
**Campos Críticos:**
- `id` (UUID, PK)
- `entry_id` (UUID, FK → accounting_entries.id)
- `account_id` (UUID, FK → chart_of_accounts.id)
- `debit` (NUMERIC)
- `credit` (NUMERIC)
- `description` (TEXT NULLABLE)

---

### cost_center_mapping (0 registros) ❌
**Descrição:** Mapeamento despesa → centro de custo
**Propósito:** Departamentalização de custos
**Status:** ❌ **NÃO UTILIZADO** - Vazio
**Recomendação:** Pode ser removido ou populado com dados de custo_center_id de expenses

---

### recurring_expenses (0 registros) ❌
**Descrição:** Despesas que se repetem mensalmente
**Propósito:** Automação de despesas mensais
**Status:** ❌ **NÃO UTILIZADO** - Vazio
**Recomendação:** Implementar se necessário automatizar despesas recorrentes

---

### revenue_categories (7 registros) ⚠️
**Descrição:** Categorias de receita
**Propósito:** Classificação de receitas
**Status:** ⚠️ Pouco utilizado (apenas 7 categorias)
**Uso Potencial:** Baixo - Invoices não referencia diretamente

---

### expense_categories (39 registros) ✅
**Descrição:** Categorias de despesa
**Propósito:** Classificação de despesas
**Status:** ✅ Ativo - Referenciado por expenses
**Uso:** 631 despesas classificadas em ~39 categorias

---

### cost_centers (13 registros) ⚠️
**Descrição:** Centros de custo (departamentos)
**Propósito:** Centros de responsabilidade
**Status:** ⚠️ Baixo uso - Apenas 13 centros para 631 despesas
**Problema:** Muitas despesas sem `cost_center_id` preenchido
**Recomendação:** Preencher ou remover

---

### debt_confessions (0 registros) ❌
**Descrição:** Acordos de renegociação de dívidas
**Propósito:** Renegociação com devedores
**Status:** ❌ **NÃO UTILIZADO** - Vazio
**Recomendação:** Remover se não for necessário

---

## 🔗 Relacionamentos Validados

```
clients (219)
├─ invoices (110) - 1-N
├─ chart_of_accounts - N-1 (Contas a receber por cliente)
└─ expenses - N-1 (Custos alocados a clientes)

expenses (631)
├─ expense_categories (39) - N-1
├─ cost_centers (13) - N-1
└─ accounting_entries (474) - 1-N

invoices (110)
└─ accounting_entries (474) - 1-N (Provisionamento + Pagamento)

bank_transactions (393)
├─ bank_accounts (1) - N-1
└─ accounting_entries (474) - 1-N

chart_of_accounts (372)
└─ accounting_entry_lines (806) - 1-N

accounting_entries (474)
└─ accounting_entry_lines (806) - 1-N
```

---

## 📈 Fluxos de Dados

### Fluxo de Honorários
Processo completo de faturamento e recebimento

**Passos:**
1. Client registrado em clients (CNPJ, endereço, email)
2. Invoice criada em invoices (RPS emitida)
3. Lançamento: D: Cliente a Receber | C: Receita em **accounting_entries**
4. Bank_transaction registra o pagamento
5. Lançamento de recebimento feito automaticamente

### Fluxo de Despesas
Gestão de contas a pagar

**Passos:**
1. Despesa registrada em expenses
2. Classificação em expense_categories e cost_centers
3. Lançamento automático: D: Despesa | C: Contas a Pagar em **accounting_entries**
4. Ao pagar: D: Banco | C: Contas a Pagar
5. Bank_transaction marca como processada

### Fluxo de Folha de Pagamento
Processamento de salários e encargos

**Passos:**
1. Employees cadastrados com dados de salário
2. Folha mensal gerada
3. Lançamentos em **accounting_entries** para salários
4. Descontos (INSS, IR) registrados
5. Bank_transactions para pagamento via transferência

### Fluxo de Conciliação Bancária
Reconciliação de extratos bancários

**Passos:**
1. Bank_import recebe arquivo de extrato (OFX)
2. Bank_transactions criadas para cada movimento
3. Matching com despesas e receitas
4. ✅ Lançamentos em **accounting_entries** (NÃO journal_entries)
5. DRE atualizada em tempo real

---

## 🔴 PROBLEMAS IDENTIFICADOS

### 1. Campo Fantasma: journal_entry_id
- **Onde:** `bank_transactions.journal_entry_id`
- **Problema:** Referencia tabela `journal_entries` que **NÃO EXISTE**
- **Impacto:** Causa erro ao tentar vincular transações bancárias a lançamentos
- **Solução:** Usar `accounting_entries.reference_id` em vez disso

### 2. Tabelas Órfãs (sem uso)
- `cost_center_mapping` - Vazia, sem propósito claro
- `recurring_expenses` - Vazia, nunca foi utilizada
- `debt_confessions` - Vazia, nunca foi utilizada

### 3. Baixa Adoção de Centros de Custo
- 13 centros de custo definidos
- Apenas ~30% das 631 despesas estão alocadas a centros
- Recomendação: Implementar política de alocação ou remover

### 4. Falta do Campo competence
- Muitos INSERT em `accounting_entries` não preenchem `competence`
- Erro comum: null value in column "competence" violates not-null constraint
- Solução: Sempre incluir `competence` no formato MM/YYYY

---

## ✅ RECOMENDAÇÕES

1. **Usar `accounting_entries` + `accounting_entry_lines`** para novos lançamentos
2. **Nunca usar `journal_entries`** - Tabela não existe
3. **Sempre preencher `competence`** em formato MM/YYYY
4. **Usar `reference_type` + `reference_id`** para vincular a bank_transactions
5. **Limpar ou remover** tabelas vazias (cost_center_mapping, recurring_expenses, debt_confessions)
6. **Revisar cost_centers** - Aumentar adoção ou remover

