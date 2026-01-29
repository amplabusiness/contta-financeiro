# 📋 ESPECIFICAÇÃO TÉCNICA CONTÁBIL - CONTTA FINANCEIRO

## Documento Oficial de Implementação
**Autor:** Dr. Cícero - Contador Responsável  
**Data:** 29/01/2026  
**Versão:** 1.0

---

# 1. PRINCÍPIOS CONTÁBEIS FUNDAMENTAIS

## 1.1 Método das Partidas Dobradas

> **"Todo débito corresponde a um crédito de igual valor"**

```
┌─────────────────────────────────────────────────────────────┐
│                    EQUAÇÃO CONTÁBIL                         │
│                                                             │
│       ATIVO = PASSIVO + PATRIMÔNIO LÍQUIDO                 │
│                                                             │
│   ∑ Débitos = ∑ Créditos (SEMPRE, em todo lançamento)      │
└─────────────────────────────────────────────────────────────┘
```

### Regras Fundamentais:

| Tipo de Conta | Aumenta com | Diminui com | Natureza |
|---------------|-------------|-------------|----------|
| ATIVO | Débito | Crédito | Devedora |
| PASSIVO | Crédito | Débito | Credora |
| RECEITA | Crédito | Débito | Credora |
| DESPESA | Débito | Crédito | Devedora |
| PATRIMÔNIO LÍQUIDO | Crédito | Débito | Credora |

## 1.2 Rastreabilidade Total

Todo lançamento DEVE ter:
- `internal_code` - Código único de nascimento
- `source_type` - Origem do lançamento
- Data de criação automática
- Vínculo com transação de origem (quando aplicável)

## 1.3 Regime Contábil

- **Regime de Competência**: Receitas e despesas reconhecidas quando incorridas
- **Regime de Caixa**: Aplicado ao fluxo bancário para conciliação
- **Regime Misto**: Provisões (competência) + Banco (caixa)

---

# 2. ARQUITETURA DAS TABELAS

## 2.1 Diagrama de Relacionamento

```
┌─────────────────────┐
│   ofx_file          │ (arquivo original)
└─────────┬───────────┘
          │ importa
          ▼
┌─────────────────────┐         ┌─────────────────────┐
│ bank_transactions   │◄────────│ bank_accounts       │
│ (transações OFX)    │         │ (contas bancárias)  │
└─────────┬───────────┘         └─────────────────────┘
          │
          │ journal_entry_id
          ▼
┌─────────────────────┐         ┌─────────────────────┐
│ accounting_entries  │◄────────│ chart_of_accounts   │
│ (cabeçalho lanç.)   │         │ (plano de contas)   │
└─────────┬───────────┘         └──────────┬──────────┘
          │                                │
          │ entry_id                       │ account_id
          ▼                                │
┌─────────────────────┐                    │
│accounting_entry_lines│◄──────────────────┘
│ (linhas débito/créd)│
└─────────────────────┘
```

## 2.2 Estrutura das Tabelas Principais

### `bank_transactions`
```sql
CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    bank_account_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,  -- positivo=entrada, negativo=saída
    description TEXT,
    fitid VARCHAR(255),              -- ID único do OFX
    internal_code VARCHAR(100),      -- código de rastreio
    journal_entry_id UUID,           -- vínculo com lançamento contábil
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending'
);
```

### `accounting_entries`
```sql
CREATE TABLE accounting_entries (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    internal_code VARCHAR(100) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL,
    entry_type VARCHAR(50),
    reference_type VARCHAR(50),
    reference_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);
```

### `accounting_entry_lines`
```sql
CREATE TABLE accounting_entry_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    entry_id UUID NOT NULL REFERENCES accounting_entries(id),
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    -- Constraint: debit > 0 XOR credit > 0 (nunca ambos)
    CONSTRAINT check_debit_xor_credit CHECK (
        (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
    )
);
```

---

# 3. CONTAS TRANSITÓRIAS

## 3.1 Definição e Propósito

As contas transitórias são **contas de passagem** que permitem:
1. Registrar imediatamente a movimentação bancária
2. Aguardar classificação pelo contador
3. Manter a integridade do saldo bancário

## 3.2 Estrutura das Transitórias

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTAS TRANSITÓRIAS                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1.1.9.01 - Transitória DÉBITOS (ATIVO)                      │   │
│  │ ID: 3e1fd22f-fba2-4cc2-b628-9d729233bca0                    │   │
│  │                                                              │   │
│  │ Uso: SAÍDAS de dinheiro do banco                            │   │
│  │ Natureza: DEVEDORA                                           │   │
│  │ Fluxo: Débito na importação → Crédito na classificação      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 2.1.9.01 - Transitória CRÉDITOS (PASSIVO)                   │   │
│  │ ID: 28085461-9e5a-4fb4-847d-c9fc047fe0a1                    │   │
│  │                                                              │   │
│  │ Uso: ENTRADAS de dinheiro no banco                          │   │
│  │ Natureza: CREDORA                                            │   │
│  │ Fluxo: Crédito na importação → Débito na classificação      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 3.3 REGRA DE OURO

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   AO FINAL DO PROCESSO DE CLASSIFICAÇÃO:                          ║
║                                                                    ║
║   ✓ Conta 1.1.9.01 (Débitos Pendentes) = SALDO ZERO              ║
║   ✓ Conta 2.1.9.01 (Créditos Pendentes) = SALDO ZERO             ║
║                                                                    ║
║   Se houver saldo ≠ 0, existem transações não classificadas!      ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

# 4. FLUXO DE IMPORTAÇÃO OFX

## 4.1 Visão Geral do Processo

```
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌─────────────────┐
│ Arquivo │───►│ Parse    │───►│ Verificação │───►│ Criação         │
│ OFX     │    │ XML      │    │ Duplicidade │    │ Lançamentos     │
└─────────┘    └──────────┘    └─────────────┘    └─────────────────┘
                                     │
                              ┌──────┴──────┐
                              │ FITID já    │
                              │ existe?     │
                              └──────┬──────┘
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                    [SIM]│                       │[NÃO]
                         ▼                       ▼
                  ┌──────────┐           ┌──────────────┐
                  │ IGNORAR  │           │ PROCESSAR    │
                  │ (já imp.)│           │ TRANSAÇÃO    │
                  └──────────┘           └──────────────┘
```

## 4.2 Etapas Detalhadas

### ETAPA 1: Parse do Arquivo OFX
```javascript
// Extrair transações do OFX
const transacoes = parseOFX(arquivo);
// Cada transação tem: date, amount, fitid, memo
```

### ETAPA 2: Verificação de Duplicidade
```javascript
// Verificar se FITID já existe
const existe = await supabase
  .from('bank_transactions')
  .select('id')
  .eq('fitid', transacao.fitid)
  .eq('tenant_id', tenantId);

if (existe.data?.length > 0) {
  return; // Já importado, ignorar
}
```

### ETAPA 3: Inserir em `bank_transactions`
```javascript
const bankTransaction = {
  id: uuid(),
  tenant_id: tenantId,
  bank_account_id: bancoSicrediId,
  transaction_date: transacao.date,
  amount: transacao.amount,
  description: transacao.memo,
  fitid: transacao.fitid,
  internal_code: `OFX_${Date.now()}_${transacao.fitid}`,
  status: 'pending',
  is_reconciled: false
};
```

### ETAPA 4: Criar Lançamento Contábil de Importação

#### Para ENTRADA (amount > 0):
```sql
-- Cabeçalho
INSERT INTO accounting_entries (
  id, tenant_id, entry_date, description, 
  internal_code, source_type, entry_type
) VALUES (
  'uuid-gerado',
  'tenant-id',
  '2025-01-03',
  'OFX: RECEBIMENTO PIX - CLIENTE XYZ',
  'OFX_IMP_1706900000_fitid123',
  'ofx_import',
  'MOVIMENTO'
);

-- Linha 1: Débito no Banco (aumenta ativo)
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'uuid-linha1',
  'tenant-id',
  'uuid-entry',
  '10d5892d-a843-4034-8d62-9fec95b8fd56',  -- Banco Sicredi
  5913.78,  -- DÉBITO
  0,
  'Entrada conforme extrato bancário'
);

-- Linha 2: Crédito na Transitória CRÉDITOS (aumenta passivo)
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'uuid-linha2',
  'tenant-id',
  'uuid-entry',
  '28085461-9e5a-4fb4-847d-c9fc047fe0a1',  -- Transitória Créditos
  0,
  5913.78,  -- CRÉDITO
  'Pendente de classificação'
);
```

#### Para SAÍDA (amount < 0):
```sql
-- Cabeçalho
INSERT INTO accounting_entries (
  id, tenant_id, entry_date, description, 
  internal_code, source_type, entry_type
) VALUES (
  'uuid-gerado',
  'tenant-id',
  '2025-01-02',
  'OFX: PAGAMENTO PIX - FORNECEDOR ABC',
  'OFX_IMP_1706800000_fitid456',
  'ofx_import',
  'MOVIMENTO'
);

-- Linha 1: Débito na Transitória DÉBITOS (aumenta ativo temporário)
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'uuid-linha1',
  'tenant-id',
  'uuid-entry',
  '3e1fd22f-fba2-4cc2-b628-9d729233bca0',  -- Transitória Débitos
  13698.01,  -- DÉBITO (valor absoluto)
  0,
  'Pendente de classificação'
);

-- Linha 2: Crédito no Banco (diminui ativo)
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'uuid-linha2',
  'tenant-id',
  'uuid-entry',
  '10d5892d-a843-4034-8d62-9fec95b8fd56',  -- Banco Sicredi
  0,
  13698.01,  -- CRÉDITO
  'Saída conforme extrato bancário'
);
```

### ETAPA 5: Vincular Transação ao Lançamento
```sql
UPDATE bank_transactions 
SET journal_entry_id = 'uuid-entry-criado'
WHERE id = 'uuid-transacao';
```

## 4.3 Formato do `internal_code`

```
Importação OFX:    OFX_IMP_{timestamp}_{fitid}
Classificação:     CLASS_{timestamp}_{fitid}
Manual:            MANUAL_{timestamp}_{uuid8}
Ajuste:            AJUSTE_{data}_{sequencial}
Abertura:          ABERTURA_{ano}_{conta}
```

---

# 5. FLUXO DE CLASSIFICAÇÃO

## 5.1 Estados da Transação

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PENDING   │────►│ CLASSIFYING │────►│ RECONCILED  │
│ (Importado) │     │ (Em análise)│     │ (Conciliado)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
  - Tem lanç. OFX     - Dr. Cícero        - Tem lanç.
  - Transitória       - Identifica          classificação
    com saldo         - Aprova            - Transitória
                                            zerada
```

## 5.2 Classificação de ENTRADA (Recebimento)

Quando o Dr. Cícero classifica uma entrada:

```sql
-- Exemplo: Recebimento PIX de cliente ACTION R$ 70.046,90

-- Cabeçalho
INSERT INTO accounting_entries (
  id, tenant_id, entry_date, description,
  internal_code, source_type, entry_type,
  reference_type, reference_id
) VALUES (
  'uuid-class',
  'tenant-id',
  '2025-01-07',
  'Classificação: Recebimento ACTION SOLUÇÕES - PIX',
  'CLASS_1706900000_fitid789',
  'classification',
  'CLASSIFICACAO',
  'bank_transaction',
  'uuid-bank-transaction'
);

-- Linha 1: Débito na Transitória CRÉDITOS (zera a pendência)
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'uuid-linha1',
  'tenant-id',
  'uuid-class',
  '28085461-9e5a-4fb4-847d-c9fc047fe0a1',  -- Transitória Créditos
  70046.90,  -- DÉBITO (zera o crédito anterior)
  0,
  'Baixa transitória - identificado origem'
);

-- Linha 2: Crédito na conta de ORIGEM
-- Opção A: Cliente a Receber (baixa de duplicata)
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'uuid-linha2',
  'tenant-id',
  'uuid-class',
  'uuid-conta-cliente-action',  -- Clientes a Receber - ACTION
  0,
  70046.90,  -- CRÉDITO (baixa a dívida)
  'Baixa duplicata - recebimento PIX'
);

-- Opção B: Receita (se não houver provisão anterior)
-- account_id = '3.1.1.01' -- Receita de Honorários
```

## 5.3 Classificação de SAÍDA (Pagamento)

Quando o Dr. Cícero classifica uma saída:

```sql
-- Exemplo: Pagamento de despesa - Pró-labore R$ 13.698,01

-- Cabeçalho
INSERT INTO accounting_entries (
  id, tenant_id, entry_date, description,
  internal_code, source_type, entry_type,
  reference_type, reference_id
) VALUES (
  'uuid-class',
  'tenant-id',
  '2025-01-02',
  'Classificação: Pró-labore - Sérgio Carneiro',
  'CLASS_1706800000_fitid456',
  'classification',
  'CLASSIFICACAO',
  'bank_transaction',
  'uuid-bank-transaction'
);

-- Linha 1: Débito no DESTINO (despesa ou fornecedor)
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'uuid-linha1',
  'tenant-id',
  'uuid-class',
  'uuid-conta-pro-labore',  -- 4.1.1.01 Pró-labore
  13698.01,  -- DÉBITO (registra despesa)
  0,
  'Pró-labore competência Janeiro/2025'
);

-- Linha 2: Crédito na Transitória DÉBITOS (zera a pendência)
INSERT INTO accounting_entry_lines (
  id, tenant_id, entry_id, account_id, debit, credit, description
) VALUES (
  'uuid-linha2',
  'tenant-id',
  'uuid-class',
  '3e1fd22f-fba2-4cc2-b628-9d729233bca0',  -- Transitória Débitos
  0,
  13698.01,  -- CRÉDITO (zera o débito anterior)
  'Baixa transitória - despesa identificada'
);
```

## 5.4 Finalizar Classificação

Após criar o lançamento de classificação:

```sql
-- Atualizar status da transação bancária
UPDATE bank_transactions 
SET 
  status = 'reconciled',
  is_reconciled = TRUE,
  reconciled_at = NOW()
WHERE id = 'uuid-bank-transaction';
```

---

# 6. ESTRUTURA DOS LANÇAMENTOS

## 6.1 Campos Obrigatórios - `accounting_entries`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✓ | Identificador único |
| tenant_id | UUID | ✓ | Inquilino (empresa) |
| entry_date | DATE | ✓ | Data do fato contábil |
| description | TEXT | ✓ | Descrição do lançamento |
| internal_code | VARCHAR | ✓ | Código único de rastreio |
| source_type | VARCHAR | ✓ | Origem do lançamento |
| entry_type | VARCHAR | | Tipo (MOVIMENTO, ABERTURA, etc.) |
| reference_type | VARCHAR | | Tipo da referência |
| reference_id | UUID | | ID da referência |

## 6.2 Valores de `source_type`

| Valor | Descrição | Quando usar |
|-------|-----------|-------------|
| `ofx_import` | Importação de extrato | Lançamento automático da importação OFX |
| `classification` | Classificação | Lançamento manual de classificação |
| `manual` | Lançamento manual | Criado manualmente pelo usuário |
| `opening_balance` | Saldo de abertura | Lançamentos de abertura do período |
| `provision` | Provisão | Receitas/despesas provisionadas |
| `reversal` | Estorno | Estorno de lançamento anterior |

## 6.3 Campos Obrigatórios - `accounting_entry_lines`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | UUID | ✓ | Identificador único |
| tenant_id | UUID | ✓ | Inquilino |
| entry_id | UUID | ✓ | FK para accounting_entries |
| account_id | UUID | ✓ | FK para chart_of_accounts |
| debit | DECIMAL | ✓ | Valor a débito (ou 0) |
| credit | DECIMAL | ✓ | Valor a crédito (ou 0) |
| description | TEXT | | Descrição específica da linha |

## 6.4 Validações de Integridade

```javascript
// 1. Soma dos débitos = Soma dos créditos
function validarPartidasDobradas(lines) {
  const totalDebito = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredito = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(totalDebito - totalCredito) < 0.01;
}

// 2. Cada linha tem débito OU crédito (nunca ambos)
function validarLinhas(lines) {
  return lines.every(l => 
    (l.debit > 0 && l.credit === 0) || 
    (l.debit === 0 && l.credit > 0)
  );
}

// 3. Mínimo 2 linhas por lançamento
function validarMinLinhas(lines) {
  return lines.length >= 2;
}

// 4. internal_code único
async function validarInternalCode(code, tenantId) {
  const { data } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('internal_code', code)
    .eq('tenant_id', tenantId);
  return data?.length === 0;
}
```

---

# 7. REGRAS DE NEGÓCIO

## 7.1 Regras Invioláveis

```
╔═══════════════════════════════════════════════════════════════════╗
║                    REGRAS INVIOLÁVEIS                              ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  1. TODA transação bancária DEVE ter lançamento contábil          ║
║                                                                    ║
║  2. TODO lançamento DEVE ter `internal_code` único                ║
║                                                                    ║
║  3. Partidas dobradas: ∑ Débitos = ∑ Créditos (sempre)           ║
║                                                                    ║
║  4. Transitórias DEVEM zerar ao final de cada período             ║
║                                                                    ║
║  5. NENHUM ajuste sem autorização do Dr. Cícero                   ║
║                                                                    ║
║  6. Banco + Transitória = Extrato (sempre)                        ║
║                                                                    ║
║  7. Lançamento de importação NÃO pode ser alterado                ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

## 7.2 Regras de Estorno

Se um lançamento precisar ser corrigido:

1. **NUNCA deletar** o lançamento original
2. Criar lançamento de ESTORNO com:
   - `source_type = 'reversal'`
   - `internal_code = 'ESTORNO_' + codigo_original`
   - Linhas invertidas (débito vira crédito e vice-versa)
3. Criar novo lançamento correto

## 7.3 Proibições

❌ **PROIBIDO:**
- Lançamento sem contrapartida
- Deletar lançamentos de importação OFX
- Alterar data de lançamento fechado
- Movimentar banco sem passar pela transitória
- Criar ajustes genéricos sem identificação
- Modificar `internal_code` após criação

---

# 8. EXEMPLOS PRÁTICOS COMPLETOS

## 8.1 Recebimento de Cliente via PIX

**Situação:** ACTION SOLUÇÕES pagou R$ 70.046,90 via PIX em 07/01/2025

### Lançamento 1 - Importação OFX:
```
┌─────────────────────────────────────────────────────────────┐
│ Data: 07/01/2025                                            │
│ Descrição: OFX: RECEBIMENTO PIX - ACTION SOLUCOES           │
│ internal_code: OFX_IMP_1736272800_16492847365               │
│ source_type: ofx_import                                     │
├─────────────────────────────────────────────────────────────┤
│ D - 1.1.1.05 Banco Sicredi           R$ 70.046,90          │
│ C - 2.1.9.01 Transitória Créditos    R$ 70.046,90          │
└─────────────────────────────────────────────────────────────┘
```

### Lançamento 2 - Classificação pelo Dr. Cícero:
```
┌─────────────────────────────────────────────────────────────┐
│ Data: 07/01/2025                                            │
│ Descrição: Class.: Recebimento ACTION - Honorários Jan/25   │
│ internal_code: CLASS_1736272800_16492847365                 │
│ source_type: classification                                 │
├─────────────────────────────────────────────────────────────┤
│ D - 2.1.9.01 Transitória Créditos    R$ 70.046,90          │
│ C - 1.1.2.01.xxx Clientes - ACTION   R$ 70.046,90          │
└─────────────────────────────────────────────────────────────┘
```

**Resultado:** Transitória zerada, banco aumentou, duplicata baixada.

## 8.2 Pagamento de Despesa

**Situação:** Pagamento de pró-labore R$ 13.698,01 em 02/01/2025

### Lançamento 1 - Importação OFX:
```
┌─────────────────────────────────────────────────────────────┐
│ Data: 02/01/2025                                            │
│ Descrição: OFX: PAGAMENTO PIX - SERGIO CARNEIRO             │
│ internal_code: OFX_IMP_1735844400_16489123456               │
│ source_type: ofx_import                                     │
├─────────────────────────────────────────────────────────────┤
│ D - 1.1.9.01 Transitória Débitos     R$ 13.698,01          │
│ C - 1.1.1.05 Banco Sicredi           R$ 13.698,01          │
└─────────────────────────────────────────────────────────────┘
```

### Lançamento 2 - Classificação pelo Dr. Cícero:
```
┌─────────────────────────────────────────────────────────────┐
│ Data: 02/01/2025                                            │
│ Descrição: Class.: Pró-labore Sérgio - Janeiro/2025         │
│ internal_code: CLASS_1735844400_16489123456                 │
│ source_type: classification                                 │
├─────────────────────────────────────────────────────────────┤
│ D - 4.1.1.01 Pró-labore              R$ 13.698,01          │
│ C - 1.1.9.01 Transitória Débitos     R$ 13.698,01          │
└─────────────────────────────────────────────────────────────┘
```

**Resultado:** Transitória zerada, banco diminuiu, despesa registrada.

## 8.3 Tarifa Bancária

**Situação:** Tarifa de cobrança R$ 9,45 em 02/01/2025

### Lançamento 1 - Importação OFX:
```
┌─────────────────────────────────────────────────────────────┐
│ Data: 02/01/2025                                            │
│ Descrição: OFX: TARIFA COM R LIQUIDACAO-COB000005           │
│ internal_code: OFX_IMP_1735844400_16489000001               │
│ source_type: ofx_import                                     │
├─────────────────────────────────────────────────────────────┤
│ D - 1.1.9.01 Transitória Débitos     R$ 9,45               │
│ C - 1.1.1.05 Banco Sicredi           R$ 9,45               │
└─────────────────────────────────────────────────────────────┘
```

### Lançamento 2 - Classificação (pode ser automática):
```
┌─────────────────────────────────────────────────────────────┐
│ Data: 02/01/2025                                            │
│ Descrição: Class.: Tarifa bancária - COB000005              │
│ internal_code: CLASS_1735844400_16489000001                 │
│ source_type: classification                                 │
├─────────────────────────────────────────────────────────────┤
│ D - 4.2.1.01 Despesas Bancárias      R$ 9,45               │
│ C - 1.1.9.01 Transitória Débitos     R$ 9,45               │
└─────────────────────────────────────────────────────────────┘
```

## 8.4 Transferência Entre Contas

**Situação:** Transferência para outra conta da empresa R$ 70.000,00

### Lançamento 1 - Importação OFX:
```
┌─────────────────────────────────────────────────────────────┐
│ Data: 08/01/2025                                            │
│ Descrição: OFX: PAGAMENTO PIX - AMPLA CONTABILIDADE         │
│ internal_code: OFX_IMP_1736358000_16500000001               │
│ source_type: ofx_import                                     │
├─────────────────────────────────────────────────────────────┤
│ D - 1.1.9.01 Transitória Débitos     R$ 70.000,00          │
│ C - 1.1.1.05 Banco Sicredi           R$ 70.000,00          │
└─────────────────────────────────────────────────────────────┘
```

### Lançamento 2 - Classificação (transferência interna):
```
┌─────────────────────────────────────────────────────────────┐
│ Data: 08/01/2025                                            │
│ Descrição: Class.: Transferência para conta Ampla           │
│ internal_code: CLASS_1736358000_16500000001                 │
│ source_type: classification                                 │
├─────────────────────────────────────────────────────────────┤
│ D - 1.1.1.xx Outro Banco/Caixa       R$ 70.000,00          │
│ C - 1.1.9.01 Transitória Débitos     R$ 70.000,00          │
└─────────────────────────────────────────────────────────────┘
```

## 8.5 Pagamento de Fornecedor (com provisão prévia)

**Situação:** Pagamento de fornecedor já provisionado R$ 10.836,96

### Lançamento 1 - Importação OFX:
```
┌─────────────────────────────────────────────────────────────┐
│ D - 1.1.9.01 Transitória Débitos     R$ 10.836,96          │
│ C - 1.1.1.05 Banco Sicredi           R$ 10.836,96          │
└─────────────────────────────────────────────────────────────┘
```

### Lançamento 2 - Classificação (baixa fornecedor):
```
┌─────────────────────────────────────────────────────────────┐
│ D - 2.1.1.xx Fornecedores a Pagar    R$ 10.836,96          │
│ C - 1.1.9.01 Transitória Débitos     R$ 10.836,96          │
└─────────────────────────────────────────────────────────────┘
```

## 8.6 Recebimento Parcial

**Situação:** Cliente devia R$ 10.000,00 e pagou R$ 5.913,78

### Lançamento 1 - Importação OFX:
```
┌─────────────────────────────────────────────────────────────┐
│ D - 1.1.1.05 Banco Sicredi           R$ 5.913,78           │
│ C - 2.1.9.01 Transitória Créditos    R$ 5.913,78           │
└─────────────────────────────────────────────────────────────┘
```

### Lançamento 2 - Classificação (baixa parcial):
```
┌─────────────────────────────────────────────────────────────┐
│ D - 2.1.9.01 Transitória Créditos    R$ 5.913,78           │
│ C - 1.1.2.01.xxx Clientes a Receber  R$ 5.913,78           │
└─────────────────────────────────────────────────────────────┘
```

**Resultado:** Cliente continua devendo R$ 4.086,22 (10.000 - 5.913,78)

---

# 9. CONCILIAÇÃO BANCÁRIA

## 9.1 Checklist Mensal

```
┌─────────────────────────────────────────────────────────────┐
│               CHECKLIST DE CONCILIAÇÃO                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ □ 1. Importar OFX do período                               │
│ □ 2. Verificar se todas transações foram importadas        │
│ □ 3. Conferir saldo inicial = saldo final mês anterior     │
│ □ 4. Classificar TODAS as transações pendentes             │
│ □ 5. Verificar transitória DÉBITOS = 0                     │
│ □ 6. Verificar transitória CRÉDITOS = 0                    │
│ □ 7. Comparar saldo contábil x saldo extrato               │
│ □ 8. Assinar conciliação                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 9.2 Query de Verificação

```sql
-- Verificar situação das transitórias
SELECT 
  c.code,
  c.name,
  COALESCE(SUM(l.debit), 0) as total_debitos,
  COALESCE(SUM(l.credit), 0) as total_creditos,
  COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as saldo
FROM chart_of_accounts c
LEFT JOIN accounting_entry_lines l ON l.account_id = c.id
LEFT JOIN accounting_entries e ON e.id = l.entry_id
WHERE c.code IN ('1.1.9.01', '2.1.9.01')
  AND c.tenant_id = 'tenant-id'
  AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY c.id, c.code, c.name;

-- Resultado esperado: saldo = 0 para ambas
```

---

# 10. FECHAMENTO DE PERÍODO

## 10.1 Roteiro de Fechamento Mensal

```
╔═══════════════════════════════════════════════════════════════════╗
║              ROTEIRO DE FECHAMENTO - Dr. Cícero                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ETAPA 1: VERIFICAÇÕES PRÉVIAS                                    ║
║  ───────────────────────────────                                  ║
║  □ Todas as transações bancárias importadas?                      ║
║  □ Todas as transações classificadas?                             ║
║  □ Provisões de receitas lançadas?                                ║
║  □ Provisões de despesas lançadas?                                ║
║                                                                    ║
║  ETAPA 2: CONFERÊNCIAS                                            ║
║  ─────────────────────                                            ║
║  □ Transitória Débitos = R$ 0,00?                                 ║
║  □ Transitória Créditos = R$ 0,00?                                ║
║  □ Saldo Banco Contábil = Saldo Extrato?                          ║
║  □ ∑ Débitos = ∑ Créditos (por conta)?                           ║
║                                                                    ║
║  ETAPA 3: RELATÓRIOS                                              ║
║  ──────────────────                                               ║
║  □ Balancete do período                                           ║
║  □ Razão analítico                                                ║
║  □ DRE mensal                                                     ║
║  □ Conciliação bancária assinada                                  ║
║                                                                    ║
║  ETAPA 4: FECHAMENTO                                              ║
║  ──────────────────                                               ║
║  □ Bloquear período para edições                                  ║
║  □ Transferir saldos para próximo período                         ║
║  □ Arquivar documentação                                          ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

# 11. VALIDAÇÕES E CONTROLES

## 11.1 Código de Validação

```javascript
// Validação completa antes de criar lançamento
async function validarLancamento(entry, lines, tenantId) {
  const erros = [];
  
  // 1. Campos obrigatórios do cabeçalho
  if (!entry.entry_date) erros.push('Data é obrigatória');
  if (!entry.description) erros.push('Descrição é obrigatória');
  if (!entry.internal_code) erros.push('internal_code é obrigatório');
  if (!entry.source_type) erros.push('source_type é obrigatório');
  
  // 2. internal_code único
  const { data: existing } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('internal_code', entry.internal_code)
    .eq('tenant_id', tenantId);
  if (existing?.length > 0) {
    erros.push('internal_code já existe: ' + entry.internal_code);
  }
  
  // 3. Mínimo 2 linhas
  if (lines.length < 2) {
    erros.push('Lançamento deve ter no mínimo 2 linhas');
  }
  
  // 4. Cada linha tem débito XOR crédito
  lines.forEach((l, i) => {
    if (l.debit > 0 && l.credit > 0) {
      erros.push(`Linha ${i+1}: não pode ter débito E crédito`);
    }
    if (l.debit === 0 && l.credit === 0) {
      erros.push(`Linha ${i+1}: deve ter débito OU crédito`);
    }
  });
  
  // 5. Partidas dobradas
  const totalDebito = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredito = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebito - totalCredito) > 0.01) {
    erros.push(`Débitos (${totalDebito}) ≠ Créditos (${totalCredito})`);
  }
  
  // 6. Contas válidas
  const accountIds = lines.map(l => l.account_id);
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .in('id', accountIds)
    .eq('tenant_id', tenantId);
  
  const validIds = new Set(accounts?.map(a => a.id) || []);
  lines.forEach((l, i) => {
    if (!validIds.has(l.account_id)) {
      erros.push(`Linha ${i+1}: conta inválida ${l.account_id}`);
    }
  });
  
  return {
    valido: erros.length === 0,
    erros
  };
}
```

## 11.2 Query de Inconsistências

```sql
-- Relatório de inconsistências
WITH transacoes_sem_lancamento AS (
  SELECT 
    id, transaction_date, amount, description,
    'Transação sem lançamento' as problema
  FROM bank_transactions
  WHERE tenant_id = 'tenant-id'
    AND journal_entry_id IS NULL
    AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
),
lancamentos_sem_transacao AS (
  SELECT 
    e.id, e.entry_date, e.description,
    'Lançamento OFX sem transação vinculada' as problema
  FROM accounting_entries e
  LEFT JOIN bank_transactions bt ON bt.journal_entry_id = e.id
  WHERE e.tenant_id = 'tenant-id'
    AND e.source_type = 'ofx_import'
    AND bt.id IS NULL
    AND e.entry_date BETWEEN '2025-01-01' AND '2025-01-31'
),
lancamentos_desbalanceados AS (
  SELECT 
    e.id, e.entry_date, e.description,
    'Lançamento com débitos ≠ créditos' as problema
  FROM accounting_entries e
  JOIN (
    SELECT entry_id, 
           SUM(debit) as total_d, 
           SUM(credit) as total_c
    FROM accounting_entry_lines
    WHERE tenant_id = 'tenant-id'
    GROUP BY entry_id
    HAVING ABS(SUM(debit) - SUM(credit)) > 0.01
  ) l ON l.entry_id = e.id
  WHERE e.tenant_id = 'tenant-id'
)
SELECT * FROM transacoes_sem_lancamento
UNION ALL
SELECT id, entry_date::date, description, problema 
FROM lancamentos_sem_transacao
UNION ALL
SELECT id, entry_date::date, description, problema 
FROM lancamentos_desbalanceados;
```

---

# APÊNDICE A: UUIDs das Contas Principais

| Conta | Código | UUID |
|-------|--------|------|
| Banco Sicredi | 1.1.1.05 | `10d5892d-a843-4034-8d62-9fec95b8fd56` |
| Transitória Débitos | 1.1.9.01 | `3e1fd22f-fba2-4cc2-b628-9d729233bca0` |
| Transitória Créditos | 2.1.9.01 | `28085461-9e5a-4fb4-847d-c9fc047fe0a1` |

---

# APÊNDICE B: Templates de `internal_code`

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Importação OFX | `OFX_IMP_{timestamp}_{fitid}` | `OFX_IMP_1736272800_16492847365` |
| Classificação | `CLASS_{timestamp}_{fitid}` | `CLASS_1736272800_16492847365` |
| Manual | `MANUAL_{timestamp}_{uuid8}` | `MANUAL_1736272800_a1b2c3d4` |
| Estorno | `ESTORNO_{codigo_original}` | `ESTORNO_OFX_IMP_1736272800` |
| Abertura | `ABERTURA_{ano}_{conta_code}` | `ABERTURA_2025_1.1.1.05` |

---

# APÊNDICE C: Glossário Contábil

| Termo | Definição |
|-------|-----------|
| **Débito** | Lado esquerdo do lançamento. Aumenta Ativo/Despesa, diminui Passivo/Receita |
| **Crédito** | Lado direito do lançamento. Aumenta Passivo/Receita, diminui Ativo/Despesa |
| **Partidas Dobradas** | Método onde todo débito tem crédito de igual valor |
| **Transitória** | Conta temporária para classificação posterior |
| **Conciliação** | Conferência entre saldo contábil e saldo bancário |
| **FITID** | Financial Institution Transaction ID - identificador único da transação no OFX |
| **Razão** | Livro contábil com movimentação por conta |
| **Balancete** | Demonstrativo de saldos de todas as contas |

---

**Documento elaborado por:**  
**Dr. Cícero**  
Contador Responsável - Ampla Contabilidade  
CRC-GO 000000/O-0

**Data:** 29/01/2026  
**Versão:** 1.0
