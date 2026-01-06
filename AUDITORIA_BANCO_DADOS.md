# AUDITORIA DA ESTRUTURA DO BANCO DE DADOS

## Resumo Executivo
A estrutura do banco usa **`accounting_entries`** e **`accounting_entry_lines`**, NÃO `journal_entries`.
O campo obrigatório é **`competence`** (formato MM/YYYY).

---

## 1. TABELAS PRINCIPAIS

### `accounting_entries` (Lançamentos Contábeis)
**Colunas obrigatórias identificadas:**
- `id` (UUID, PK) - Auto-gerado
- `entry_type` (TEXT) - Tipo: 'provision', 'payment', 'adjustment', 'manual' 
- `description` (TEXT) - Descrição do lançamento
- `entry_date` (DATE) - Data do lançamento
- `reference_type` (TEXT, NULLABLE) - Tipo de referência: 'invoice', 'expense', etc.
- `reference_id` (UUID, NULLABLE) - ID da referência
- `document_number` (TEXT, NULLABLE) - Número do documento
- `total_debit` (NUMERIC) - Soma dos débitos
- `total_credit` (NUMERIC) - Soma dos créditos
- `balanced` (BOOLEAN) - Débito = Crédito?
- **`competence` (VARCHAR, NOT NULL)** - Formato: MM/YYYY (Ex: 01/2025)
- `created_by` (UUID, NULLABLE) - Usuário que criou

### `accounting_entry_lines` (Linhas do Lançamento)
**Colunas obrigatórias:**
- `id` (UUID, PK)
- `entry_id` (UUID, FK → accounting_entries.id)
- `account_id` (UUID, FK → chart_of_accounts.id)
- `debit` (NUMERIC)
- `credit` (NUMERIC)
- `description` (TEXT, NULLABLE)

### `bank_transactions` (Transações Bancárias)
**Colunas relevantes:**
- `id` (UUID, PK)
- `matched` (BOOLEAN) - Conciliada?
- `journal_entry_id` (UUID, FK → journal_entries.id) ❌ **PROBLEMA: Referencia journal_entries que não existe!**

**SOLUÇÃO:** Não vincular `bank_transactions` a lançamentos contábeis diretamente. 
Usar `reference_id` em `accounting_entries` para apontar para `bank_transactions.id`.

### `chart_of_accounts` (Plano de Contas)
**Colunas:**
- `id` (UUID, PK)
- `code` (TEXT) - Código contábil (Ex: 1.1.1, 4.1.1)
- `name` (TEXT) - Nome da conta
- `account_type` (TEXT) - Tipo: 'ATIVO', 'PASSIVO', 'RECEITA', 'DESPESA'
- `is_active` (BOOLEAN)

---

## 2. FLUXO CORRETO PARA LANÇAMENTOS

### Passo 1: Criar `accounting_entries`
```sql
INSERT INTO accounting_entries (
  entry_type,           -- 'manual'
  description,          -- Descrição do lançamento
  entry_date,          -- Data: YYYY-MM-DD
  reference_type,      -- 'bank_transaction' (opcional)
  reference_id,        -- ID da bank_transaction (opcional)
  document_number,     -- Número do documento (opcional)
  total_debit,         -- Soma dos débitos
  total_credit,        -- Soma dos créditos
  balanced,            -- true/false
  competence,          -- ⭐ OBRIGATÓRIO: formato MM/YYYY
  created_by           -- UUID do usuário
) VALUES (...)
RETURNING id;
```

### Passo 2: Criar `accounting_entry_lines`
```sql
INSERT INTO accounting_entry_lines (
  entry_id,     -- ID retornado do passo 1
  account_id,   -- UUID da conta no chart_of_accounts
  debit,        -- Valor do débito
  credit,       -- Valor do crédito
  description   -- Descrição da linha
) VALUES (...)
```

### Passo 3: (OPCIONAL) Atualizar `bank_transactions`
Se o lançamento é para conciliar uma transação bancária:
```sql
UPDATE bank_transactions
SET matched = true
WHERE id = '...'
-- ❌ NÃO usar journal_entry_id (não existe)
-- ✅ Usar reference_id em accounting_entries para vincular
```

---

## 3. PROBLEMA ATUAL NO CÓDIGO

### Erro 1: Tabela errada
```tsx
// ❌ ERRADO
.from('journal_entries')  // Esta tabela não existe!

// ✅ CORRETO
.from('accounting_entries')
```

### Erro 2: Campo obrigatório ausente
```tsx
// ❌ ERRADO
.insert({
  entry_date: selectedTx.date,
  description: ...
  // Falta o campo 'competence'!
})

// ✅ CORRETO
.insert({
  entry_date: selectedTx.date,
  description: ...,
  competence: 'MM/YYYY', // ⭐ OBRIGATÓRIO
  entry_type: 'manual',
  reference_type: 'bank_transaction',
  reference_id: selectedTx.id,
  total_debit: ...,
  total_credit: ...,
  balanced: true,
  created_by: userId // Se tiver
})
```

### Erro 3: Tabela de linhas errada
```tsx
// ❌ ERRADO
.from('journal_entry_lines')

// ✅ CORRETO
.from('accounting_entry_lines')
```

---

## 4. MAPEAMENTO CORRETO DE CAMPOS

| Código (SuperConciliation.tsx) | Campo BD | Tipo | Obrigatório |
|---|---|---|---|
| `selectedTx.date` | `entry_date` | DATE | ✅ Sim |
| `selectedTx.date` (mês) | `competence` | VARCHAR(7) | ✅ **SIM** |
| `suggestion.description` | `description` | TEXT | ✅ Sim |
| Tipo entrada/saída | `entry_type` | TEXT | ✅ Sim |
| `selectedTx.id` | `reference_id` | UUID | ❌ Não |
| Saldo Débito | `total_debit` | NUMERIC | ✅ Sim |
| Saldo Crédito | `total_credit` | NUMERIC | ✅ Sim |
| Débito = Crédito | `balanced` | BOOLEAN | ✅ Sim |

---

## 5. COMPETENCE FORMAT

**Formato obrigatório:** `MM/YYYY`

Exemplos:
- Janeiro 2025: `01/2025`
- Dezembro 2024: `12/2024`

**Conversão em TypeScript:**
```typescript
const date = new Date(selectedTx.date);
const competence = String(date.getMonth() + 1).padStart(2, '0') + '/' + date.getFullYear();
// Resultado: "01/2025"
```

---

## 6. TABELAS QUE NÃO EXISTEM
- ❌ `journal_entries`
- ❌ `journal_entry_lines`

**Tabelas que existem e devem ser usadas:**
- ✅ `accounting_entries`
- ✅ `accounting_entry_lines`
- ✅ `accounting_entry_items` (alternativa para linhas)

---

## 7. VINCULAR TRANSAÇÃO BANCÁRIA

**Opção 1: Usar `reference_type` + `reference_id` em `accounting_entries`**
```sql
INSERT INTO accounting_entries (
  reference_type,  -- 'bank_transaction'
  reference_id,    -- selectedTx.id (UUID da transação)
  ...
)
```

**Opção 2: ❌ NÃO USAR** (tende a erros)
```sql
-- ❌ ERRADO
UPDATE bank_transactions
SET journal_entry_id = entryData.id  -- Campo não existe ou está quebrado
```

---

## 8. SOLUÇÃO RECOMENDADA

1. **Usar `accounting_entries`** (nunca `journal_entries`)
2. **Sempre incluir `competence`** no formato MM/YYYY
3. **Incluir `entry_type`** = 'manual'
4. **Calcular `total_debit` e `total_credit`** antes de inserir
5. **Guardar `reference_type`** = 'bank_transaction' + `reference_id` = ID da transação
6. **NÃO** tentar atualizar campos inexistentes em `bank_transactions`
