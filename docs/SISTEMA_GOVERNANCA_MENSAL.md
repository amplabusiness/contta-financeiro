# 🛡️ Sistema de Governança Mensal - CONTTA

**Versão:** 3.0  
**Data:** 02/02/2026  
**Autor:** Dr. Cícero - Contador Responsável

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Fluxo de Processamento](#fluxo-de-processamento)
4. [Matriz de Classificação](#matriz-de-classificação)
5. [RPCs Disponíveis](#rpcs-disponíveis)
6. [Como Usar](#como-usar)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O Sistema de Governança Mensal automatiza o processo de fechamento contábil, garantindo:

- ✅ **Classificação automática** via matriz de regras
- ✅ **Bloqueios de segurança** para transações ambíguas
- ✅ **Validação de transitórias** antes do fechamento
- ✅ **Auditabilidade total** com trail de decisões

### Princípios

| Princípio | Descrição |
|-----------|-----------|
| **Contabilidade é verdade** | Sempre prevalece sobre operacional |
| **Transitórias devem zerar** | Ao fim do período, saldo = 0 |
| **PIX de sócio NUNCA é receita** | Bloqueio obrigatório |
| **Dr. Cícero decide** | Ambiguidades requerem aprovação |

---

## 🏗️ Arquitetura do Sistema

```
┌──────────────────────────────────────────────────────────────────┐
│                     SISTEMA DE GOVERNANÇA                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐ │
│  │   OFX Import   │───▶│  Classification │───▶│  Fechamento   │ │
│  │  (automático)  │    │    (regras)     │    │  (guardado)   │ │
│  └────────────────┘    └────────────────┘    └────────────────┘ │
│         │                     │                     │           │
│         ▼                     ▼                     ▼           │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐ │
│  │ bank_transact  │    │classification_ │    │monthly_closings│ │
│  │ + journal_     │    │   rules        │    │ status=closed  │ │
│  │   entry_id     │    │ (50+ regras)   │    │                │ │
│  └────────────────┘    └────────────────┘    └────────────────┘ │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                        RPCs DISPONÍVEIS                          │
│                                                                  │
│  • get_month_status()              - Status completo do mês      │
│  • validate_transitory_zero()      - Validação pré-fechamento    │
│  • classify_month_from_rules()     - Classificação em lote       │
│  • list_unclassified_transactions()- Transações sem regra        │
│  • close_month_guarded()           - Fechamento com validação    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 Fluxo de Processamento

### Passo a Passo

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. IMPORTAÇÃO OFX                                                │
│    ├── Arquivo OFX → bank_transactions                          │
│    ├── Cria accounting_entries (source_type='ofx_import')       │
│    └── Atribui journal_entry_id à transação                     │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. PRÉ-VALIDAÇÃO                                                 │
│    ├── Todas transações têm journal_entry_id?                   │
│    ├── Existem regras na classification_rules?                  │
│    └── get_month_status() → diagnóstico inicial                 │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. CLASSIFICAÇÃO EM LOTE                                         │
│    ├── classify_month_from_rules()                              │
│    ├── Para cada transação sem classificação:                   │
│    │   ├── Busca regra por prioridade (menor primeiro)          │
│    │   ├── Match: contains, ilike, regex, exact                 │
│    │   ├── Se requires_approval=TRUE → fila de aprovação        │
│    │   └── Se match ok → cria entry + lines                     │
│    └── Retorna: created, skipped, approval_queue                │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. VALIDAÇÃO TRANSITÓRIAS                                        │
│    ├── validate_transitory_zero()                               │
│    ├── 1.1.9.01 (Débitos) deve ser = 0                          │
│    ├── 2.1.9.01 (Créditos) deve ser = 0                         │
│    └── Se ≠ 0 → BLOQUEIA fechamento                             │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. FECHAMENTO DO MÊS                                             │
│    ├── close_month_guarded()                                    │
│    ├── Valida transitórias automaticamente                      │
│    ├── Grava em monthly_closings (status='closed')              │
│    └── Bloqueia alterações no período                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📋 Matriz de Classificação

### Estrutura das Regras

```sql
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  priority INT NOT NULL,           -- Menor = maior prioridade
  rule_name TEXT NOT NULL,
  match_type TEXT NOT NULL,        -- contains, ilike, regex, exact
  match_value TEXT NOT NULL,       -- Padrão de busca
  direction TEXT NOT NULL,         -- credit (entrada), debit (saída), any
  debit_account_id UUID,           -- Conta para débito
  credit_account_id UUID,          -- Conta para crédito
  requires_approval BOOLEAN,       -- TRUE = fila do Dr. Cícero
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
```

### Faixas de Prioridade

| Prioridade | Tipo | Descrição |
|------------|------|-----------|
| 10-29 | 🔴 BLOQUEIO | PIX sócio, transferências grupo, empréstimos |
| 30-49 | 🟡 ESPECÍFICO | Pró-labore, salários nominais |
| 50-69 | 🟢 RECEITA | PIX recebido, boletos, cobranças |
| 70-89 | 🔵 DESPESA | Tarifas, fornecedores, utilidades |
| 90-99 | ⚪ GENÉRICO | Catch-all, requer revisão |

### Regras de Bloqueio Obrigatório

| Padrão | Ação | Motivo |
|--------|------|--------|
| PIX + nome de sócio | 🚫 BLOQUEIA | Nunca é receita |
| Transferência + grupo | 🚫 BLOQUEIA | Verificar natureza |
| APORTE | 🚫 BLOQUEIA | Documentação societária |
| EMPRÉSTIMO | 🚫 BLOQUEIA | Análise documental |

---

## 📡 RPCs Disponíveis

### 1. `get_month_status(p_tenant, p_start, p_end)`

Retorna diagnóstico completo do mês.

```sql
SELECT * FROM get_month_status(
  'a53a4957-fe97-4856-b3ca-70045157b421'::uuid,
  '2025-02-01'::date,
  '2025-02-28'::date
);
```

**Retorno:**
```json
{
  "total_transactions": 211,
  "pending_transactions": 0,
  "reconciled_transactions": 211,
  "classified_transactions": 195,
  "transitory_debits_balance": 15000.00,
  "transitory_credits_balance": 8500.00,
  "transitories_zero": false
}
```

### 2. `classify_month_from_rules(p_tenant, p_start, p_end)`

Aplica regras de classificação em lote.

```sql
SELECT * FROM classify_month_from_rules(
  'a53a4957-fe97-4856-b3ca-70045157b421'::uuid,
  '2025-02-01'::date,
  '2025-02-28'::date
);
```

**Retorno:**
```json
{
  "ok": true,
  "created_classifications": 180,
  "skipped_no_rule": 15,
  "sent_to_approval": 16
}
```

### 3. `validate_transitory_zero(p_tenant, p_start, p_end)`

Valida se transitórias estão zeradas.

```sql
SELECT * FROM validate_transitory_zero(
  'a53a4957-fe97-4856-b3ca-70045157b421'::uuid,
  '2025-02-01'::date,
  '2025-02-28'::date
);
```

### 4. `list_unclassified_transactions(p_tenant, p_start, p_end, p_limit)`

Lista transações sem regra aplicável.

```sql
SELECT * FROM list_unclassified_transactions(
  'a53a4957-fe97-4856-b3ca-70045157b421'::uuid,
  '2025-02-01'::date,
  '2025-02-28'::date,
  50
);
```

### 5. `close_month_guarded(p_tenant, p_year, p_month, p_user_id, p_notes)`

Fecha o mês com validação prévia.

```sql
SELECT * FROM close_month_guarded(
  'a53a4957-fe97-4856-b3ca-70045157b421'::uuid,
  2025,
  2,
  NULL,
  'Fechamento Fev/2025 via script'
);
```

---

## 🚀 Como Usar

### Opção 1: Via Script Node.js

```bash
# 1. Executar a migration (cria RPCs)
# Execute no Supabase Dashboard:
# supabase/migrations/20260202_GOVERNANCA_FECHAMENTO_FEV2025.sql

# 2. Inserir regras de classificação
# Execute no Supabase Dashboard:
# supabase/migrations/20260202_INSERT_CLASSIFICATION_RULES.sql

# 3. Rodar o processamento
node run_fev2025.mjs

# 4. Para fechar o mês ao final
node run_fev2025.mjs --close
```

### Opção 2: Via SQL Direto

```sql
-- 1. Verificar status
SELECT * FROM get_month_status(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2025-02-01', '2025-02-28'
);

-- 2. Classificar
SELECT * FROM classify_month_from_rules(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2025-02-01', '2025-02-28'
);

-- 3. Ver não classificadas
SELECT * FROM list_unclassified_transactions(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2025-02-01', '2025-02-28', 50
);

-- 4. Validar transitórias
SELECT * FROM validate_transitory_zero(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  '2025-02-01', '2025-02-28'
);

-- 5. Fechar (se transitórias zeradas)
SELECT * FROM close_month_guarded(
  'a53a4957-fe97-4856-b3ca-70045157b421',
  2025, 2, NULL, 'Fechamento via SQL'
);
```

---

## 🔧 Troubleshooting

### Problema: "Transitórias não zeradas"

**Causa:** Existem transações sem classificação.

**Solução:**
1. Listar transações pendentes:
   ```sql
   SELECT * FROM list_unclassified_transactions(...);
   ```
2. Criar regras para os padrões encontrados
3. Rodar classificação novamente
4. OU classificar manualmente

### Problema: "Muitas transações enviadas para aprovação"

**Causa:** Regras com `requires_approval=TRUE` casando demais.

**Solução:**
1. Revisar regras de bloqueio (prioridade 10-29)
2. Criar regras mais específicas com prioridade menor
3. Aprovar manualmente via interface

### Problema: "Regra não está casando"

**Verificação:**
```sql
-- Testar match manualmente
SELECT 
  r.rule_name,
  r.match_type,
  r.match_value,
  CASE 
    WHEN r.match_type = 'ilike' AND 'PAGAMENTO PIX-SERGIO CARNEIRO' ILIKE r.match_value 
    THEN 'CASA'
    ELSE 'NÃO CASA'
  END as resultado
FROM classification_rules r
WHERE r.is_active = true
ORDER BY r.priority;
```

### Problema: "Erro ao fechar mês fechado"

**Causa:** Mês já está fechado.

**Solução:**
```sql
-- Verificar status
SELECT * FROM monthly_closings 
WHERE reference_month = '2025-02-01';

-- Se precisar reabrir (com cuidado!)
UPDATE monthly_closings 
SET status = 'reopened', 
    reopened_at = NOW(),
    reopen_reason = 'Correção necessária'
WHERE reference_month = '2025-02-01';
```

---

## 📁 Arquivos do Sistema

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/20260202_GOVERNANCA_FECHAMENTO_FEV2025.sql` | Migration com RPCs |
| `supabase/migrations/20260202_INSERT_CLASSIFICATION_RULES.sql` | Regras de classificação |
| `run_fev2025.mjs` | Script de processamento mensal |
| `docs/SISTEMA_GOVERNANCA_MENSAL.md` | Esta documentação |

---

## 📞 Suporte

Para dúvidas ou ajustes na matriz de regras, consulte:

- **Dr. Cícero** - Contador Responsável
- Documentação: `ESPECIFICACAO_CONTABIL_DR_CICERO.md`
- Prompts: `.github/copilot-instructions.md`

---

*Documento gerado automaticamente pelo Sistema Contta*  
*Última atualização: 02/02/2026*
