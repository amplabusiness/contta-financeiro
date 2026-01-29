# ESPECIFICAÇÃO CONTÁBIL - SISTEMA CONTTA FINANCEIRO

**Documento Técnico de Referência**  
**Versão:** 1.0  
**Data:** 29/01/2026  
**Responsável:** Dr. Cícero - Contador  
**Tenant:** Ampla Contabilidade (`a53a4957-fe97-4856-b3ca-70045157b421`)

---

## SUMÁRIO

1. [Princípios Contábeis Fundamentais](#1-princípios-contábeis-fundamentais)
2. [Arquitetura das Tabelas](#2-arquitetura-das-tabelas)
3. [Contas Transitórias - Conceito e Uso](#3-contas-transitórias---conceito-e-uso)
4. [Fluxo de Importação OFX](#4-fluxo-de-importação-ofx)
5. [Fluxo de Classificação](#5-fluxo-de-classificação)
6. [Estrutura dos Lançamentos](#6-estrutura-dos-lançamentos)
7. [Regras de Negócio](#7-regras-de-negócio)
8. [Exemplos Práticos Completos](#8-exemplos-práticos-completos)
9. [Conciliação Bancária](#9-conciliação-bancária)
10. [Fechamento de Período](#10-fechamento-de-período)
11. [Validações e Controles](#11-validações-e-controles)

---

## 1. PRINCÍPIOS CONTÁBEIS FUNDAMENTAIS

### 1.1 Método das Partidas Dobradas

> **"Para cada débito, há um crédito de igual valor."**

Todo lançamento contábil no sistema DEVE seguir esta regra fundamental:
- A soma dos débitos DEVE ser igual à soma dos créditos
- Não existe lançamento com apenas um lado
- O sistema deve validar o balanceamento antes de gravar

### 1.2 Rastreabilidade Total

Cada lançamento contábil DEVE ter:
- **`internal_code`**: Código único que permite rastrear a origem
- **`source_type`**: Classificação da origem do lançamento
- **`description`**: Descrição clara do fato contábil

### 1.3 Competência vs Caixa

O sistema opera em **REGIME MISTO**:
- **Receitas**: Reconhecidas na competência (faturamento)
- **Conciliação**: Baseada no caixa (extrato bancário)

### 1.4 Princípio da Entidade

- Todo registro pertence a um `tenant_id` específico
- Não há cruzamento de dados entre tenants
- Tenant Ampla: `a53a4957-fe97-4856-b3ca-70045157b421`

---

## 2. ARQUITETURA DAS TABELAS

### 2.1 Diagrama de Relacionamento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE DADOS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   [Arquivo OFX]                                                         │
│        │                                                                │
│        ▼                                                                │
│   ┌────────────────────┐         ┌─────────────────────────┐           │
│   │ bank_transactions  │────────▶│   accounting_entries    │           │
│   │                    │         │     (cabeçalho)         │           │
│   │ • id               │         │                         │           │
│   │ • transaction_date │         │ • id                    │           │
│   │ • description      │         │ • entry_date            │           │
│   │ • amount           │         │ • description           │           │
│   │ • journal_entry_id │◀────────│ • internal_code         │           │
│   │ • is_reconciled    │         │ • source_type           │           │
│   │ • bank_account_id  │         │ • status                │           │
│   └────────────────────┘         └──────────┬──────────────┘           │
│                                             │                           │
│                                             │ 1:N                       │
│                                             ▼                           │
│                                  ┌─────────────────────────┐           │
│                                  │ accounting_entry_lines  │           │
│                                  │       (linhas)          │           │
│                                  │                         │           │
│                                  │ • id                    │           │
│                                  │ • entry_id (FK)         │           │
│                                  │ • account_id (FK)       │◀──┐       │
│                                  │ • type (debit/credit)   │   │       │
│                                  │ • amount                │   │       │
│                                  └─────────────────────────┘   │       │
│                                                                │       │
│                                  ┌─────────────────────────┐   │       │
│                                  │   chart_of_accounts     │───┘       │
│                                  │                         │           │
│                                  │ • id                    │           │
│                                  │ • code                  │           │
│                                  │ • name                  │           │
│                                  │ • type (asset/liability)│           │
│                                  │ • is_analytic           │           │
│                                  └─────────────────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tabela: `bank_transactions`

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `id` | UUID | Identificador único | Sim |
| `tenant_id` | UUID | Tenant da transação | Sim |
| `bank_account_id` | UUID | Conta bancária | Sim |
| `transaction_date` | DATE | Data da transação | Sim |
| `description` | TEXT | Descrição do extrato | Sim |
| `amount` | DECIMAL(15,2) | Valor (+ entrada, - saída) | Sim |
| `fitid` | VARCHAR | ID único do OFX | Sim |
| `journal_entry_id` | UUID | Lançamento contábil vinculado | Não* |
| `is_reconciled` | BOOLEAN | Transação conciliada | Não |
| `reconciled` | BOOLEAN | Flag auxiliar de reconciliação | Não |
| `created_at` | TIMESTAMP | Data de criação | Auto |

> **\*Nota**: Toda transação DEVE ter `journal_entry_id` após a importação. Se não tem, está pendente de processamento.

### 2.3 Tabela: `accounting_entries`

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `id` | UUID | Identificador único | Sim |
| `tenant_id` | UUID | Tenant do lançamento | Sim |
| `entry_date` | DATE | Data do lançamento | Sim |
| `competence_date` | DATE | Data de competência | Sim |
| `description` | TEXT | Descrição do lançamento | Sim |
| `internal_code` | VARCHAR | Código de rastreabilidade | **SIM** |
| `source_type` | VARCHAR | Tipo de origem | Sim |
| `status` | VARCHAR | posted, draft, cancelled | Sim |
| `created_at` | TIMESTAMP | Data de criação | Auto |
| `created_by` | UUID | Usuário que criou | Auto |

### 2.4 Tabela: `accounting_entry_lines`

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `id` | UUID | Identificador único | Sim |
| `entry_id` | UUID | FK para accounting_entries | Sim |
| `account_id` | UUID | FK para chart_of_accounts | Sim |
| `type` | ENUM | 'debit' ou 'credit' | Sim |
| `amount` | DECIMAL(15,2) | Valor da linha | Sim |
| `description` | TEXT | Descrição específica da linha | Não |
| `cost_center_id` | UUID | Centro de custo | Não |
| `client_id` | UUID | Cliente relacionado | Não |

---

## 3. CONTAS TRANSITÓRIAS - CONCEITO E USO

### 3.1 O Que São Contas Transitórias?

Contas transitórias são contas **intermediárias** que servem como "sala de espera" para valores que ainda não foram classificados. Elas permitem:

1. **Registrar imediatamente** qualquer movimentação bancária
2. **Postergar a classificação** para um momento apropriado
3. **Manter a conciliação** entre banco e contabilidade
4. **Garantir rastreabilidade** de cada centavo

### 3.2 As Duas Contas Transitórias

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTAS TRANSITÓRIAS DO SISTEMA                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────┐    ┌────────────────────────────┐│
│   │  1.1.9.01 - TRANSITÓRIA DÉBITOS │    │ 2.1.9.01 - TRANS. CRÉDITOS ││
│   │         (ATIVO CIRCULANTE)      │    │    (PASSIVO CIRCULANTE)    ││
│   ├─────────────────────────────────┤    ├────────────────────────────┤│
│   │                                 │    │                            ││
│   │  Recebe DÉBITOS quando há       │    │  Recebe CRÉDITOS quando há ││
│   │  SAÍDAS no banco                │    │  ENTRADAS no banco         ││
│   │                                 │    │                            ││
│   │  ID: 3e1fd22f-fba2-4cc2-        │    │  ID: 28085461-9e5a-4fb4-   ││
│   │      b628-9d729233bca0          │    │      847d-c9fc047fe0a1     ││
│   │                                 │    │                            ││
│   │  Saldo DEVE ser ZERO após       │    │  Saldo DEVE ser ZERO após  ││
│   │  classificação completa         │    │  classificação completa    ││
│   │                                 │    │                            ││
│   └─────────────────────────────────┘    └────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Por Que Usar Contas Transitórias?

| Situação | Sem Transitória | Com Transitória |
|----------|-----------------|-----------------|
| Importação OFX | Precisa classificar na hora | Importa e classifica depois |
| Extrato grande | Processo demorado | Importação imediata |
| Dúvida na classificação | Fica pendente | Contabilizado, mas pendente de classificação |
| Conciliação bancária | Incompleta | Sempre batida |
| Auditoria | Difícil rastrear | Rastreabilidade total |

### 3.4 Regra de Ouro

> **⚠️ REGRA INVIOLÁVEL**
> 
> Ao final do processo de classificação de um período, AMBAS as contas transitórias devem ter saldo ZERO:
> - `1.1.9.01` (Débitos Pendentes) = R$ 0,00
> - `2.1.9.01` (Créditos Pendentes) = R$ 0,00
>
> Se houver saldo, significa que existem transações não classificadas.

---

## 4. FLUXO DE IMPORTAÇÃO OFX

### 4.1 Visão Geral do Processo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUXO COMPLETO DE IMPORTAÇÃO OFX                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [1. UPLOAD DO ARQUIVO OFX]                                             │
│           │                                                             │
│           ▼                                                             │
│  [2. PARSING DO OFX]                                                    │
│           │                                                             │
│           ├──────────────────────────────────────────────────┐          │
│           │                                                  │          │
│           ▼                                                  ▼          │
│  [3A. ENTRADA (amount > 0)]                    [3B. SAÍDA (amount < 0)] │
│           │                                                  │          │
│           ▼                                                  ▼          │
│  ┌────────────────────┐                       ┌────────────────────┐    │
│  │ D: Banco Sicredi   │                       │ D: Trans. Débitos  │    │
│  │ C: Trans. Créditos │                       │ C: Banco Sicredi   │    │
│  │    (2.1.9.01)      │                       │    (1.1.9.01)      │    │
│  └────────────────────┘                       └────────────────────┘    │
│           │                                                  │          │
│           └──────────────────────┬───────────────────────────┘          │
│                                  │                                      │
│                                  ▼                                      │
│              [4. GRAVA TRANSAÇÃO + LANÇAMENTO]                          │
│                                  │                                      │
│                                  ▼                                      │
│              [5. AGUARDA CLASSIFICAÇÃO]                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Etapa 1: Upload e Parsing do OFX

O arquivo OFX contém transações no formato:

```xml
<STMTTRN>
  <TRNTYPE>CREDIT</TRNTYPE>
  <DTPOSTED>20250115120000</DTPOSTED>
  <TRNAMT>1500.00</TRNAMT>
  <FITID>2025011512345678</FITID>
  <MEMO>PIX RECEBIDO - JOAO SILVA</MEMO>
</STMTTRN>
```

**Campos extraídos:**
- `DTPOSTED` → `transaction_date`
- `TRNAMT` → `amount`
- `FITID` → `fitid` (identificador único)
- `MEMO` → `description`

### 4.3 Etapa 2: Verificação de Duplicidade

```sql
-- Antes de inserir, verificar se já existe
SELECT id FROM bank_transactions 
WHERE tenant_id = :tenant_id 
  AND fitid = :fitid 
  AND bank_account_id = :bank_account_id;
```

Se já existe, **NÃO** importar novamente.

### 4.4 Etapa 3: Criação do Lançamento Contábil

#### 4.4.1 Para ENTRADA (amount > 0) - Dinheiro ENTRANDO no banco

```
┌─────────────────────────────────────────────────────────────┐
│            LANÇAMENTO DE IMPORTAÇÃO - ENTRADA               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Data: [transaction_date do OFX]                            │
│  Descrição: "OFX: [descrição do extrato]"                   │
│  Internal Code: OFX-[bank_account_code]-[fitid]             │
│  Source Type: "ofx_import"                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  DÉBITO:  1.1.1.05 - Banco Sicredi     R$ 1.500,00  │    │
│  │  CRÉDITO: 2.1.9.01 - Trans. Créditos  R$ 1.500,00  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Significado Contábil:                                      │
│  → O banco AUMENTOU (débito em conta de ativo)              │
│  → A origem está PENDENTE de classificação                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4.4.2 Para SAÍDA (amount < 0) - Dinheiro SAINDO do banco

```
┌─────────────────────────────────────────────────────────────┐
│             LANÇAMENTO DE IMPORTAÇÃO - SAÍDA                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Data: [transaction_date do OFX]                            │
│  Descrição: "OFX: [descrição do extrato]"                   │
│  Internal Code: OFX-[bank_account_code]-[fitid]             │
│  Source Type: "ofx_import"                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  DÉBITO:  1.1.9.01 - Trans. Débitos   R$ 1.500,00  │    │
│  │  CRÉDITO: 1.1.1.05 - Banco Sicredi    R$ 1.500,00  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Significado Contábil:                                      │
│  → O banco DIMINUIU (crédito em conta de ativo)             │
│  → O destino está PENDENTE de classificação                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 Etapa 4: Gravação no Banco de Dados

**Ordem de operações (dentro de uma transação):**

```sql
BEGIN;

-- 1. Criar o lançamento contábil (cabeçalho)
INSERT INTO accounting_entries (
  id, tenant_id, entry_date, competence_date, 
  description, internal_code, source_type, status
) VALUES (
  :entry_id, :tenant_id, :transaction_date, :transaction_date,
  'OFX: ' || :description, :internal_code, 'ofx_import', 'posted'
);

-- 2. Criar as linhas do lançamento
-- Linha de DÉBITO
INSERT INTO accounting_entry_lines (
  id, entry_id, account_id, type, amount
) VALUES (
  :line_debit_id, :entry_id, :debit_account_id, 'debit', ABS(:amount)
);

-- Linha de CRÉDITO
INSERT INTO accounting_entry_lines (
  id, entry_id, account_id, type, amount
) VALUES (
  :line_credit_id, :entry_id, :credit_account_id, 'credit', ABS(:amount)
);

-- 3. Criar a transação bancária vinculada ao lançamento
INSERT INTO bank_transactions (
  id, tenant_id, bank_account_id, transaction_date,
  description, amount, fitid, journal_entry_id, is_reconciled
) VALUES (
  :transaction_id, :tenant_id, :bank_account_id, :transaction_date,
  :description, :amount, :fitid, :entry_id, false
);

COMMIT;
```

### 4.6 Formato do Internal Code

```
┌─────────────────────────────────────────────────────────────┐
│               FORMATO DO INTERNAL_CODE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Padrão: [TIPO]-[CONTEXTO]-[IDENTIFICADOR]-[TIMESTAMP]      │
│                                                             │
│  Exemplos:                                                  │
│                                                             │
│  OFX-SICREDI-2025011512345678                               │
│  └─┬─┘ └──┬──┘ └──────┬─────┘                               │
│    │     │           │                                      │
│    │     │           └─ FITID do OFX                        │
│    │     └─ Código da conta bancária                        │
│    └─ Tipo de origem                                        │
│                                                             │
│  CLASS-2025011512345678-1706540000000                       │
│  └─┬──┘ └──────┬─────┘ └──────┬─────┘                       │
│    │          │              │                              │
│    │          │              └─ Timestamp Unix              │
│    │          └─ FITID da transação original                │
│    └─ Tipo (classificação)                                  │
│                                                             │
│  MANUAL-HON-202501-001                                      │
│  └─┬──┘ └┬┘ └──┬──┘ └┬┘                                     │
│    │     │     │     │                                      │
│    │     │     │     └─ Sequencial                          │
│    │     │     └─ Período                                   │
│    │     └─ Categoria (Honorários)                          │
│    └─ Tipo (manual)                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. FLUXO DE CLASSIFICAÇÃO

### 5.1 O Que é Classificação?

Classificação é o processo de **identificar a origem/destino** de uma transação bancária e criar o lançamento contábil que **zera a conta transitória**.

### 5.2 Estados de uma Transação

```
┌─────────────────────────────────────────────────────────────┐
│              CICLO DE VIDA DE UMA TRANSAÇÃO                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [IMPORTADA]                                                │
│       │                                                     │
│       │  Tem journal_entry_id (lançamento transitório)      │
│       │  is_reconciled = false                              │
│       │                                                     │
│       ▼                                                     │
│  [PENDENTE DE CLASSIFICAÇÃO]                                │
│       │                                                     │
│       │  Dr. Cícero analisa e classifica                    │
│       │  Cria lançamento de classificação                   │
│       │                                                     │
│       ▼                                                     │
│  [CLASSIFICADA]                                             │
│       │                                                     │
│       │  Transitória zerada                                 │
│       │  is_reconciled = true                               │
│       │                                                     │
│       ▼                                                     │
│  [CONCILIADA]                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Classificação de ENTRADA (Recebimento)

Quando o cliente paga e o dinheiro ENTRA no banco:

```
┌─────────────────────────────────────────────────────────────┐
│          CLASSIFICAÇÃO DE ENTRADA - RECEBIMENTO             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SITUAÇÃO APÓS IMPORTAÇÃO OFX:                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  D: 1.1.1.05 Banco         R$ 1.500,00 ✓           │    │
│  │  C: 2.1.9.01 Trans.Créd    R$ 1.500,00 (pendente)  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  LANÇAMENTO DE CLASSIFICAÇÃO:                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  D: 2.1.9.01 Trans.Créd    R$ 1.500,00 (ZERA)      │    │
│  │  C: 1.1.2.01.xxx Cliente   R$ 1.500,00 (baixa)     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  OU SE FOR RECEITA DIRETA (sem contas a receber):           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  D: 2.1.9.01 Trans.Créd    R$ 1.500,00 (ZERA)      │    │
│  │  C: 3.1.1.01 Receita Hon   R$ 1.500,00 (receita)   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  RESULTADO FINAL:                                           │
│  → Banco com saldo correto                                  │
│  → Transitória Créditos = ZERO                              │
│  → Cliente baixado OU receita reconhecida                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Classificação de SAÍDA (Pagamento)

Quando pagamos algo e o dinheiro SAI do banco:

```
┌─────────────────────────────────────────────────────────────┐
│            CLASSIFICAÇÃO DE SAÍDA - PAGAMENTO               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SITUAÇÃO APÓS IMPORTAÇÃO OFX:                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  D: 1.1.9.01 Trans.Déb     R$ 500,00 (pendente)    │    │
│  │  C: 1.1.1.05 Banco         R$ 500,00 ✓             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  LANÇAMENTO DE CLASSIFICAÇÃO (DESPESA):                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  D: 4.1.1.xx Despesa       R$ 500,00 (reconhece)   │    │
│  │  C: 1.1.9.01 Trans.Déb     R$ 500,00 (ZERA)        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  OU SE FOR PAGAMENTO A FORNECEDOR:                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  D: 2.1.1.xx Fornecedor    R$ 500,00 (baixa)       │    │
│  │  C: 1.1.9.01 Trans.Déb     R$ 500,00 (ZERA)        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  RESULTADO FINAL:                                           │
│  → Banco com saldo correto                                  │
│  → Transitória Débitos = ZERO                               │
│  → Despesa reconhecida OU fornecedor baixado                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.5 Dados do Lançamento de Classificação

```sql
-- Cabeçalho
INSERT INTO accounting_entries (
  id, tenant_id, entry_date, competence_date,
  description, internal_code, source_type, status
) VALUES (
  :entry_id, 
  :tenant_id,
  :transaction_date,           -- mesma data da transação
  :transaction_date,           -- ou data de competência específica
  'Classificação: ' || :descricao_detalhada,
  'CLASS-' || :fitid || '-' || :timestamp,
  'classification',
  'posted'
);
```

### 5.6 Atualização da Transação Bancária

Após a classificação, atualizar a transação:

```sql
UPDATE bank_transactions
SET is_reconciled = true,
    reconciled = true
WHERE id = :transaction_id;
```

> **Nota**: O `journal_entry_id` permanece apontando para o lançamento de IMPORTAÇÃO, não para o de classificação. A ligação entre eles é feita via `internal_code`.

---

## 6. ESTRUTURA DOS LANÇAMENTOS

### 6.1 Campos Obrigatórios - accounting_entries

| Campo | Obrigatório | Validação |
|-------|-------------|-----------|
| `id` | ✅ | UUID válido |
| `tenant_id` | ✅ | Deve existir |
| `entry_date` | ✅ | Data válida |
| `competence_date` | ✅ | Data válida |
| `description` | ✅ | Não pode ser vazio |
| `internal_code` | ✅ | **ÚNICO** por tenant |
| `source_type` | ✅ | Enum válido |
| `status` | ✅ | 'draft', 'posted', 'cancelled' |

### 6.2 Campos Obrigatórios - accounting_entry_lines

| Campo | Obrigatório | Validação |
|-------|-------------|-----------|
| `id` | ✅ | UUID válido |
| `entry_id` | ✅ | FK válida |
| `account_id` | ✅ | FK válida + conta analítica |
| `type` | ✅ | 'debit' ou 'credit' |
| `amount` | ✅ | > 0 |

### 6.3 Validações de Integridade

```sql
-- 1. Soma dos débitos = Soma dos créditos
SELECT 
  SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as debits,
  SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as credits
FROM accounting_entry_lines
WHERE entry_id = :entry_id;
-- debits DEVE ser igual a credits

-- 2. Pelo menos uma linha de débito E uma de crédito
SELECT 
  COUNT(CASE WHEN type = 'debit' THEN 1 END) as debit_count,
  COUNT(CASE WHEN type = 'credit' THEN 1 END) as credit_count
FROM accounting_entry_lines
WHERE entry_id = :entry_id;
-- Ambos devem ser >= 1

-- 3. Conta deve ser analítica
SELECT is_analytic FROM chart_of_accounts WHERE id = :account_id;
-- Deve ser TRUE
```

### 6.4 Valores de source_type

| source_type | Descrição | Quando usar |
|-------------|-----------|-------------|
| `ofx_import` | Importação de OFX | Lançamento automático na importação |
| `classification` | Classificação | Quando Dr. Cícero classifica |
| `manual` | Manual | Lançamentos manuais |
| `invoice` | Faturamento | Emissão de nota fiscal |
| `system` | Sistema | Lançamentos automáticos do sistema |
| `adjustment` | Ajuste | Correções autorizadas |
| `opening` | Abertura | Saldos iniciais |
| `closing` | Fechamento | Encerramento de período |

---

## 7. REGRAS DE NEGÓCIO

### 7.1 Regras Invioláveis

```
┌─────────────────────────────────────────────────────────────┐
│                   REGRAS INVIOLÁVEIS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. TODO lançamento DEVE ter internal_code único            │
│                                                             │
│  2. TODO lançamento DEVE estar balanceado                   │
│     (débitos = créditos)                                    │
│                                                             │
│  3. TODA transação bancária DEVE ter lançamento contábil    │
│     (journal_entry_id não pode ficar NULL)                  │
│                                                             │
│  4. Contas transitórias DEVEM zerar ao final do período     │
│                                                             │
│  5. NENHUM ajuste sem autorização do Dr. Cícero             │
│                                                             │
│  6. Lançamentos 'posted' NÃO podem ser alterados            │
│     (apenas estornados)                                     │
│                                                             │
│  7. Exclusão de lançamentos é PROIBIDA                      │
│     (usar status = 'cancelled' + lançamento de estorno)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Regras de Importação OFX

1. Verificar duplicidade pelo `fitid` antes de importar
2. Criar lançamento contábil SEMPRE (nunca deixar transação sem lançamento)
3. Usar conta transitória apropriada (créditos para entradas, débitos para saídas)
4. Gerar `internal_code` no formato `OFX-[BANCO]-[FITID]`
5. Marcar `is_reconciled = false` até classificação

### 7.3 Regras de Classificação

1. Somente transações não reconciliadas podem ser classificadas
2. Criar NOVO lançamento (não alterar o de importação)
3. O novo lançamento DEVE zerar a conta transitória
4. Atualizar `is_reconciled = true` após classificação
5. Usar `source_type = 'classification'`

### 7.4 Regras de Estorno

```
┌─────────────────────────────────────────────────────────────┐
│                    REGRAS DE ESTORNO                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Para corrigir um lançamento ERRADO:                        │
│                                                             │
│  1. NÃO EXCLUIR o lançamento original                       │
│                                                             │
│  2. Marcar como cancelled:                                  │
│     UPDATE accounting_entries                               │
│     SET status = 'cancelled',                               │
│         cancelled_at = NOW(),                               │
│         cancelled_reason = 'Motivo...'                      │
│     WHERE id = :entry_id;                                   │
│                                                             │
│  3. Criar lançamento de ESTORNO (valores invertidos):       │
│     - O que era DÉBITO vira CRÉDITO                         │
│     - O que era CRÉDITO vira DÉBITO                         │
│     - internal_code: 'ESTORNO-' + original_internal_code    │
│     - description: 'Estorno: ' + motivo                     │
│                                                             │
│  4. Criar lançamento CORRETO                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. EXEMPLOS PRÁTICOS COMPLETOS

### 8.1 Recebimento de Cliente via PIX

**Cenário**: Cliente "ABC Ltda" pagou R$ 2.500,00 de honorários via PIX

#### Passo 1: Importação do OFX

O extrato mostra:
```
Data: 15/01/2025
Descrição: PIX RECEBIDO - ABC LTDA
Valor: +2.500,00
FITID: 2025011598765432
```

**Lançamento de Importação (automático):**

| # | Conta | Débito | Crédito | Descrição |
|---|-------|--------|---------|-----------|
| 1 | 1.1.1.05 Banco Sicredi | R$ 2.500,00 | | Entrada no banco |
| 2 | 2.1.9.01 Trans. Créditos | | R$ 2.500,00 | Pendente de classificação |

```json
{
  "internal_code": "OFX-SICREDI-2025011598765432",
  "source_type": "ofx_import",
  "description": "OFX: PIX RECEBIDO - ABC LTDA"
}
```

#### Passo 2: Classificação pelo Dr. Cícero

Dr. Cícero identifica que é recebimento do cliente ABC Ltda.

**Lançamento de Classificação:**

| # | Conta | Débito | Crédito | Descrição |
|---|-------|--------|---------|-----------|
| 1 | 2.1.9.01 Trans. Créditos | R$ 2.500,00 | | Zerando transitória |
| 2 | 1.1.2.01.015 Clientes - ABC Ltda | | R$ 2.500,00 | Baixa do recebível |

```json
{
  "internal_code": "CLASS-2025011598765432-1706540000000",
  "source_type": "classification",
  "description": "Classificação: Recebimento ABC Ltda - PIX ref. honorários Jan/2025"
}
```

#### Resultado Final:

| Conta | Saldo Antes | Movimento | Saldo Depois |
|-------|-------------|-----------|--------------|
| 1.1.1.05 Banco | R$ 10.000,00 | +R$ 2.500,00 | R$ 12.500,00 |
| 2.1.9.01 Trans. Créditos | R$ 0,00 | +R$ 2.500,00 -R$ 2.500,00 | R$ 0,00 ✓ |
| 1.1.2.01.015 Clientes ABC | R$ 2.500,00 | -R$ 2.500,00 | R$ 0,00 ✓ |

---

### 8.2 Pagamento de Despesa (Energia Elétrica)

**Cenário**: Pagamento de conta de luz R$ 450,00

#### Passo 1: Importação do OFX

```
Data: 20/01/2025
Descrição: PGTO COPEL ENERGIA
Valor: -450,00
FITID: 2025012011223344
```

**Lançamento de Importação:**

| # | Conta | Débito | Crédito |
|---|-------|--------|---------|
| 1 | 1.1.9.01 Trans. Débitos | R$ 450,00 | |
| 2 | 1.1.1.05 Banco Sicredi | | R$ 450,00 |

#### Passo 2: Classificação

| # | Conta | Débito | Crédito |
|---|-------|--------|---------|
| 1 | 4.1.1.05 Energia Elétrica | R$ 450,00 | |
| 2 | 1.1.9.01 Trans. Débitos | | R$ 450,00 |

---

### 8.3 Tarifa Bancária

**Cenário**: Tarifa de manutenção de conta R$ 35,00

#### Importação + Classificação em um passo

Como tarifas são identificáveis automaticamente, pode-se fazer:

**Lançamento único (se identificação automática):**

| # | Conta | Débito | Crédito |
|---|-------|--------|---------|
| 1 | 4.1.2.01 Tarifas Bancárias | R$ 35,00 | |
| 2 | 1.1.1.05 Banco Sicredi | | R$ 35,00 |

```json
{
  "internal_code": "OFX-SICREDI-2025012055667788-TARIFA",
  "source_type": "ofx_import",
  "description": "Tarifa bancária - Manutenção de conta"
}
```

> **Nota**: Para tarifas identificáveis, pode-se pular a transitória e ir direto para a despesa.

---

### 8.4 Transferência entre Contas

**Cenário**: Transferência de R$ 5.000,00 da conta Sicredi para conta Bradesco

#### Na conta de ORIGEM (Sicredi - Saída):

| # | Conta | Débito | Crédito |
|---|-------|--------|---------|
| 1 | 1.1.1.06 Banco Bradesco | R$ 5.000,00 | |
| 2 | 1.1.1.05 Banco Sicredi | | R$ 5.000,00 |

```json
{
  "internal_code": "TRANSF-SICREDI-BRADESCO-20250115-001",
  "source_type": "manual",
  "description": "Transferência entre contas - Sicredi para Bradesco"
}
```

> **Importante**: Transferência entre contas próprias NÃO usa transitória, pois ambas as contas são conhecidas.

---

### 8.5 Pagamento de Fornecedor (com provisão prévia)

**Cenário**: Pagamento ao fornecedor XYZ que já estava provisionado

#### Quando recebeu a NF (competência):

| # | Conta | Débito | Crédito |
|---|-------|--------|---------|
| 1 | 4.1.3.xx Despesa serviços | R$ 1.200,00 | |
| 2 | 2.1.1.xx Fornecedor XYZ | | R$ 1.200,00 |

#### Quando pagou (caixa):

Importação OFX:
| # | Conta | Débito | Crédito |
|---|-------|--------|---------|
| 1 | 1.1.9.01 Trans. Débitos | R$ 1.200,00 | |
| 2 | 1.1.1.05 Banco | | R$ 1.200,00 |

Classificação:
| # | Conta | Débito | Crédito |
|---|-------|--------|---------|
| 1 | 2.1.1.xx Fornecedor XYZ | R$ 1.200,00 | |
| 2 | 1.1.9.01 Trans. Débitos | | R$ 1.200,00 |

---

### 8.6 Recebimento Parcial de Cliente

**Cenário**: Cliente devia R$ 3.000,00 e pagou R$ 2.000,00

#### Classificação do recebimento parcial:

| # | Conta | Débito | Crédito |
|---|-------|--------|---------|
| 1 | 2.1.9.01 Trans. Créditos | R$ 2.000,00 | |
| 2 | 1.1.2.01.xxx Cliente | | R$ 2.000,00 |

**Saldo remanescente**: R$ 1.000,00 continua em Clientes a Receber

---

## 9. CONCILIAÇÃO BANCÁRIA

### 9.1 Conceito

Conciliação bancária é o processo de **verificar** se o saldo contábil do banco está igual ao saldo do extrato bancário.

### 9.2 Checklist de Conciliação

```
┌─────────────────────────────────────────────────────────────┐
│              CHECKLIST DE CONCILIAÇÃO MENSAL                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ 1. Importar TODOS os extratos do período                 │
│                                                             │
│  □ 2. Verificar se todas transações têm journal_entry_id    │
│                                                             │
│  □ 3. Classificar todas transações pendentes                │
│                                                             │
│  □ 4. Verificar saldo das transitórias = ZERO               │
│       - 1.1.9.01 = R$ 0,00                                  │
│       - 2.1.9.01 = R$ 0,00                                  │
│                                                             │
│  □ 5. Comparar saldo contábil vs extrato                    │
│       - Saldo inicial + movimentos = saldo final            │
│                                                             │
│  □ 6. Investigar e corrigir diferenças                      │
│                                                             │
│  □ 7. Gerar relatório de conciliação                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Query de Verificação

```sql
-- Verificar transações sem lançamento
SELECT * FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND journal_entry_id IS NULL;

-- Verificar saldo das transitórias
SELECT 
  coa.code,
  coa.name,
  SUM(CASE WHEN ael.type = 'debit' THEN ael.amount ELSE -ael.amount END) as saldo
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ae.id = ael.entry_id
JOIN chart_of_accounts coa ON coa.id = ael.account_id
WHERE ae.tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND ae.status = 'posted'
  AND coa.code IN ('1.1.9.01', '2.1.9.01')
GROUP BY coa.code, coa.name;
```

---

## 10. FECHAMENTO DE PERÍODO

### 10.1 Etapas do Fechamento Mensal

```
┌─────────────────────────────────────────────────────────────┐
│              ROTEIRO DE FECHAMENTO MENSAL                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SEMANA 1 DO MÊS SEGUINTE:                                  │
│                                                             │
│  □ 1. Importar extratos bancários do mês anterior           │
│                                                             │
│  □ 2. Classificar todas as transações                       │
│                                                             │
│  □ 3. Verificar contas transitórias = ZERO                  │
│                                                             │
│  □ 4. Emitir notas fiscais pendentes                        │
│                                                             │
│  □ 5. Lançar provisões de despesas                          │
│                                                             │
│  □ 6. Conciliar contas a receber                            │
│                                                             │
│  □ 7. Conciliar contas a pagar                              │
│                                                             │
│  □ 8. Gerar balancete de verificação                        │
│                                                             │
│  □ 9. Analisar e corrigir inconsistências                   │
│                                                             │
│  □ 10. Marcar período como FECHADO                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Validações de Fechamento

Antes de fechar o período, verificar:

1. **Transitórias zeradas**
2. **Todas transações bancárias classificadas**
3. **Balancete equilibrado** (soma débitos = soma créditos)
4. **Sem lançamentos em 'draft'**
5. **Backup realizado**

---

## 11. VALIDAÇÕES E CONTROLES

### 11.1 Validações Automáticas do Sistema

```javascript
// Antes de gravar qualquer lançamento
function validateEntry(entry, lines) {
  const errors = [];
  
  // 1. Verificar campos obrigatórios
  if (!entry.internal_code) {
    errors.push('internal_code é obrigatório');
  }
  
  // 2. Verificar unicidade do internal_code
  const exists = await checkInternalCodeExists(entry.tenant_id, entry.internal_code);
  if (exists) {
    errors.push('internal_code já existe');
  }
  
  // 3. Verificar balanceamento
  const totalDebits = lines
    .filter(l => l.type === 'debit')
    .reduce((sum, l) => sum + l.amount, 0);
  const totalCredits = lines
    .filter(l => l.type === 'credit')
    .reduce((sum, l) => sum + l.amount, 0);
  
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    errors.push(`Lançamento desbalanceado: D=${totalDebits} C=${totalCredits}`);
  }
  
  // 4. Verificar contas analíticas
  for (const line of lines) {
    const account = await getAccount(line.account_id);
    if (!account.is_analytic) {
      errors.push(`Conta ${account.code} não é analítica`);
    }
  }
  
  return errors;
}
```

### 11.2 Relatório de Inconsistências

```sql
-- Transações sem lançamento
SELECT 'Transação sem lançamento' as tipo, 
       COUNT(*) as quantidade
FROM bank_transactions
WHERE journal_entry_id IS NULL
  AND tenant_id = :tenant_id

UNION ALL

-- Lançamentos desbalanceados
SELECT 'Lançamento desbalanceado' as tipo,
       COUNT(*) as quantidade
FROM (
  SELECT entry_id,
         SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as d,
         SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as c
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  WHERE ae.tenant_id = :tenant_id
  GROUP BY entry_id
  HAVING ABS(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) - 
             SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END)) > 0.01
) sub

UNION ALL

-- Lançamentos sem internal_code
SELECT 'Lançamento sem internal_code' as tipo,
       COUNT(*) as quantidade
FROM accounting_entries
WHERE (internal_code IS NULL OR internal_code = '')
  AND tenant_id = :tenant_id;
```

---

## APÊNDICE A: IDs DAS CONTAS PRINCIPAIS

| Código | Nome | UUID |
|--------|------|------|
| 1.1.1.05 | Banco Sicredi | `10d5892d-a843-4034-8d62-9fec95b8fd56` |
| 1.1.9.01 | Transitória Débitos (ATIVO) | `3e1fd22f-fba2-4cc2-b628-9d729233bca0` |
| 2.1.9.01 | Transitória Créditos (PASSIVO) | `28085461-9e5a-4fb4-847d-c9fc047fe0a1` |

---

## APÊNDICE B: TEMPLATES DE INTERNAL_CODE

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Importação OFX | `OFX-[BANCO]-[FITID]` | `OFX-SICREDI-2025011512345678` |
| Classificação | `CLASS-[FITID]-[TIMESTAMP]` | `CLASS-2025011512345678-1706540000` |
| Manual | `MANUAL-[CAT]-[PERIODO]-[SEQ]` | `MANUAL-HON-202501-001` |
| Estorno | `ESTORNO-[ORIGINAL_CODE]` | `ESTORNO-OFX-SICREDI-2025011512345678` |
| Faturamento | `FAT-[NUMERO_NF]` | `FAT-2025-000123` |
| Abertura | `ABERTURA-[PERIODO]` | `ABERTURA-2025` |

---

## APÊNDICE C: GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| **Débito** | Lado esquerdo do lançamento. Aumenta ATIVO e DESPESA. Diminui PASSIVO, PL e RECEITA. |
| **Crédito** | Lado direito do lançamento. Aumenta PASSIVO, PL e RECEITA. Diminui ATIVO e DESPESA. |
| **Transitória** | Conta intermediária para valores pendentes de classificação |
| **FITID** | Financial Institution Transaction ID - identificador único da transação no OFX |
| **Balancete** | Relatório que mostra saldos de todas as contas |
| **Conciliação** | Processo de conferência entre dois registros |

---

**Documento aprovado por:**

```
Dr. Cícero
Contador Responsável
CRC-PR XXXXX/O-X
Ampla Contabilidade

Data: 29/01/2026
```

---

*Este documento é a especificação oficial do fluxo contábil do Sistema Contta Financeiro.*
*Qualquer alteração deve ser aprovada pelo Dr. Cícero.*
