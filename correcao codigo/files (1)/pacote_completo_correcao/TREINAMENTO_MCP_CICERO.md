# 📚 TREINAMENTO: MCP Financeiro & Agente Cícero Contador

**Versão:** 2.0  
**Data:** 11/01/2026  
**Autor:** Sérgio Carneiro Leão / Análise Claude  
**Objetivo:** Documentar a arquitetura contábil correta para garantir consistência nos lançamentos

---

## 🎯 VISÃO GERAL

Este documento define as **regras obrigatórias** que o MCP Financeiro e o Agente Cícero devem seguir para criar lançamentos contábeis corretos, evitando duplicações e mantendo a integridade da equação contábil.

---

## 📋 ÍNDICE

1. [Princípios Fundamentais](#1-princípios-fundamentais)
2. [Estrutura do Plano de Contas](#2-estrutura-do-plano-de-contas)
3. [Fluxos de Lançamento](#3-fluxos-de-lançamento)
4. [Regras de Negócio](#4-regras-de-negócio)
5. [Validações Obrigatórias](#5-validações-obrigatórias)
6. [Exemplos Práticos](#6-exemplos-práticos)
7. [Erros a Evitar](#7-erros-a-evitar)

---

## 1. PRINCÍPIOS FUNDAMENTAIS

### 1.1 Partidas Dobradas (SEMPRE)

Todo lançamento contábil DEVE ter:
- **Débito = Crédito** (obrigatório)
- Mínimo 2 linhas por entry
- Referência clara à origem (`reference_type`, `reference_id`)

### 1.2 Contas Sintéticas vs Analíticas

| Tipo | Pode Receber Lançamentos? | Exemplo |
|------|---------------------------|---------|
| **Sintética** | ❌ NÃO | 1.1.2.01 (Clientes a Receber) |
| **Analítica** | ✅ SIM | 1.1.2.01.0001 (Cliente: ACME LTDA) |

**REGRA DE OURO:** Lançamentos SEMPRE em contas analíticas, NUNCA em sintéticas.

### 1.3 Fonte da Verdade

- **OFX/Extrato Bancário** = Fonte da verdade para saldo do banco
- **Sistema** deve SEMPRE refletir o extrato
- Se há divergência, o problema está no sistema, não no banco

### 1.4 Idempotência

Todo lançamento deve ter:
- `reference_type` + `reference_id` únicos
- Verificar se já existe ANTES de criar
- Evitar duplicações a todo custo

---

## 2. ESTRUTURA DO PLANO DE CONTAS

### 2.1 Contas Principais

```
1. ATIVO
├── 1.1 ATIVO CIRCULANTE
│   ├── 1.1.1 DISPONIBILIDADES
│   │   ├── 1.1.1.01 Caixa Geral
│   │   └── 1.1.1.05 Banco Sicredi ← Conta do banco
│   │
│   ├── 1.1.2 CLIENTES A RECEBER
│   │   ├── 1.1.2.01 Clientes a Receber (SINTÉTICA - NÃO USAR!)
│   │   ├── 1.1.2.01.0001 Cliente: ACME LTDA (analítica)
│   │   ├── 1.1.2.01.0002 Cliente: XYZ CORP (analítica)
│   │   └── 1.1.2.01.9999 Pendente de Identificação (analítica)
│   │
│   └── 1.1.9 VALORES TRANSITÓRIOS
│       └── 1.1.9.01 Recebimentos a Conciliar ← NOVA CONTA TRANSITÓRIA

3. RECEITAS
├── 3.1 RECEITAS OPERACIONAIS
│   └── 3.1.1.01 Receita de Honorários Contábeis
```

### 2.2 Contas Especiais

| Código | Nome | Propósito |
|--------|------|-----------|
| `1.1.1.05` | Banco Sicredi | Movimentações bancárias |
| `1.1.2.01` | Clientes a Receber | **SINTÉTICA** - Apenas para totais |
| `1.1.2.01.xxxx` | Cliente: [Nome] | Conta analítica por cliente |
| `1.1.9.01` | Recebimentos a Conciliar | Transitória para OFX |
| `1.1.2.01.9999` | Pendente de Identificação | Recebimentos não identificados |

---

## 3. FLUXOS DE LANÇAMENTO

### 3.1 Fluxo: Gerar Honorários (Regime de Competência)

**Quando:** Geração mensal de faturas/RPS

**Lançamento:**
```
D - 1.1.2.01.xxxx (Cliente específico)     R$ 1.500,00
C - 3.1.1.01 (Receita de Honorários)       R$ 1.500,00
```

**Campos obrigatórios:**
```javascript
{
  entry_type: 'receita_honorarios',
  reference_type: 'invoice',
  reference_id: '<invoice_id>',
  source_type: 'geracao_honorarios',
  client_id: '<client_id>'
}
```

### 3.2 Fluxo: Importar OFX (Extrato Bancário)

**Quando:** Importação de arquivo OFX do banco

**Para recebimentos de cobrança (COB):**
```
D - 1.1.1.05 (Banco Sicredi)               R$ 5.913,78
C - 1.1.9.01 (Recebimentos a Conciliar)    R$ 5.913,78
```

**Para outras transações (identificáveis):**
```
D - 1.1.1.05 (Banco Sicredi)               R$ 500,00
C - 2.1.1.xx (Fornecedor específico)       R$ 500,00
```

**Campos obrigatórios:**
```javascript
{
  entry_type: 'importacao_ofx',
  reference_type: 'bank_transaction',
  reference_id: '<fitid_do_ofx>',
  source_type: 'ofx_import'
}
```

### 3.3 Fluxo: Super Conciliação (Desmembramento)

**Quando:** Conciliar cobrança agregada (COB000027) com clientes individuais

**Lançamento:**
```
D - 1.1.9.01 (Recebimentos a Conciliar)    R$ 5.913,78 (estorno)
C - 1.1.2.01.0001 (Cliente A)              R$ 760,00
C - 1.1.2.01.0002 (Cliente B)              R$ 300,00
C - 1.1.2.01.0003 (Cliente C)              R$ 500,00
... (demais clientes)
C - 1.1.2.01.xxxx (Cliente N)              R$ 4.353,78
```

**Campos obrigatórios:**
```javascript
{
  entry_type: 'recebimento',
  reference_type: 'cobranca_desmembramento',
  reference_id: 'COB000027',
  source_type: 'super_conciliacao'
}
```

### 3.4 Fluxo: Recebimento Individual (PIX, TED, Boleto Avulso)

**Quando:** Cliente paga diretamente (não via cobrança agrupada)

**Lançamento:**
```
D - 1.1.1.05 (Banco Sicredi)               R$ 1.500,00
C - 1.1.2.01.xxxx (Cliente específico)     R$ 1.500,00
```

**Campos obrigatórios:**
```javascript
{
  entry_type: 'recebimento',
  reference_type: 'bank_transaction',
  reference_id: '<fitid>',
  source_type: 'bank_transaction',
  client_id: '<client_id>'
}
```

---

## 4. REGRAS DE NEGÓCIO

### 4.1 Regras para AccountingService

```typescript
// REGRA 1: Nunca criar lançamento em conta sintética
async function validarConta(account_id: string): Promise<boolean> {
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('is_synthetic, is_analytical, accepts_entries')
    .eq('id', account_id)
    .single();
  
  if (conta.is_synthetic || !conta.accepts_entries) {
    throw new Error(`Conta ${account_id} não aceita lançamentos diretos`);
  }
  return true;
}

// REGRA 2: Verificar idempotência antes de criar
async function verificarDuplicidade(
  reference_type: string, 
  reference_id: string
): Promise<boolean> {
  const { count } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact' })
    .eq('reference_type', reference_type)
    .eq('reference_id', reference_id);
  
  return count === 0; // true = pode criar, false = já existe
}

// REGRA 3: Validar equação antes de salvar
function validarEquacao(linhas: EntryLine[]): boolean {
  const totalDebitos = linhas.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCreditos = linhas.reduce((s, l) => s + (l.credit || 0), 0);
  
  if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
    throw new Error(`Lançamento desbalanceado: D=${totalDebitos} C=${totalCreditos}`);
  }
  return true;
}
```

### 4.2 Regras para Importação OFX

```typescript
// Identificar tipo de transação OFX
function classificarTransacaoOFX(descricao: string, valor: number): ClassificacaoOFX {
  // Cobrança agrupada -> Conta transitória
  if (descricao.includes('COBRANCA') || descricao.match(/COB\d+/)) {
    return {
      tipo: 'cobranca_agrupada',
      contaCredito: '1.1.9.01', // Recebimentos a Conciliar
      precisaDesmembramento: true
    };
  }
  
  // PIX identificável -> Tentar identificar cliente
  if (descricao.includes('PIX')) {
    const cliente = identificarClientePorDescricao(descricao);
    if (cliente) {
      return {
        tipo: 'recebimento_identificado',
        contaCredito: cliente.conta_analitica,
        client_id: cliente.id
      };
    }
  }
  
  // Não identificado -> Pendente
  return {
    tipo: 'nao_identificado',
    contaCredito: '1.1.2.01.9999', // Pendente de Identificação
    precisaRevisaoManual: true
  };
}
```

### 4.3 Regras para Conciliação

```typescript
// Validar desmembramento de cobrança
function validarDesmembramento(
  valorCobranca: number,
  clientes: { client_id: string; valor: number }[]
): boolean {
  const totalClientes = clientes.reduce((s, c) => s + c.valor, 0);
  
  if (Math.abs(valorCobranca - totalClientes) > 0.01) {
    throw new Error(
      `Desmembramento inválido: Cobrança=${valorCobranca} Clientes=${totalClientes}`
    );
  }
  return true;
}
```

---

## 5. VALIDAÇÕES OBRIGATÓRIAS

### 5.1 Antes de Criar Qualquer Lançamento

| # | Validação | Ação se Falhar |
|---|-----------|----------------|
| 1 | Conta é analítica? | Rejeitar |
| 2 | Conta aceita lançamentos? | Rejeitar |
| 3 | Já existe lançamento com mesmo reference_type + reference_id? | Retornar existente |
| 4 | Débitos = Créditos? | Rejeitar |
| 5 | Todas as contas existem? | Rejeitar |
| 6 | reference_type e reference_id preenchidos? | Rejeitar |

### 5.2 Após Criar Lançamento

| # | Verificação | Ação se Falhar |
|---|-------------|----------------|
| 1 | Entry criado com sucesso? | Rollback |
| 2 | Todas as linhas criadas? | Rollback |
| 3 | Soma das linhas = 0? | Alertar |

### 5.3 Verificação Periódica (Diária)

```sql
-- 1. Verificar equação contábil geral
SELECT 
  SUM(debit) as total_debitos,
  SUM(credit) as total_creditos,
  SUM(debit) - SUM(credit) as diferenca
FROM accounting_entry_lines;
-- ESPERADO: diferenca = 0

-- 2. Verificar lançamentos na sintética
SELECT COUNT(*) as lancamentos_sintetica
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.2.01';
-- ESPERADO: 0

-- 3. Verificar saldo da conta transitória
SELECT SUM(debit) - SUM(credit) as saldo_transitoria
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.9.01';
-- ESPERADO: 0 (após conciliação completa)

-- 4. Verificar entries desbalanceados
SELECT ae.id, ae.description,
       SUM(ael.debit) as debitos,
       SUM(ael.credit) as creditos
FROM accounting_entries ae
JOIN accounting_entry_lines ael ON ae.id = ael.entry_id
GROUP BY ae.id, ae.description
HAVING ABS(SUM(ael.debit) - SUM(ael.credit)) > 0.01;
-- ESPERADO: 0 registros
```

---

## 6. EXEMPLOS PRÁTICOS

### 6.1 Exemplo: Gerar Honorários Janeiro/2025

**Cenário:** Gerar fatura de R$ 1.500 para cliente "ACME LTDA"

**Dados:**
- Cliente: ACME LTDA (id: abc123)
- Conta analítica: 1.1.2.01.0015
- Valor: R$ 1.500,00
- Competência: 01/2025

**Lançamento correto:**
```javascript
const entry = await accountingService.createEntry({
  entryType: 'receita_honorarios',
  entryDate: '2025-01-31',
  competenceDate: '2025-01-01',
  description: 'Honorários contábeis Janeiro/2025 - ACME LTDA',
  referenceType: 'invoice',
  referenceId: 'inv_abc123_202501',
  sourceType: 'geracao_honorarios',
  clientId: 'abc123',
  lines: [
    { accountCode: '1.1.2.01.0015', debit: 1500.00, credit: 0 },
    { accountCode: '3.1.1.01', debit: 0, credit: 1500.00 }
  ]
});
```

### 6.2 Exemplo: Importar OFX com Cobrança Agrupada

**Cenário:** OFX contém "LIQ.COBRANCA SIMPLES-COB000027" de R$ 5.913,78

**Lançamento correto (na importação):**
```javascript
const entry = await accountingService.createEntry({
  entryType: 'importacao_ofx',
  entryDate: '2025-01-02',
  description: 'LIQ.COBRANCA SIMPLES-COB000027',
  referenceType: 'bank_transaction',
  referenceId: 'fitid_xyz123',
  sourceType: 'ofx_import',
  lines: [
    { accountCode: '1.1.1.05', debit: 5913.78, credit: 0 },      // Banco
    { accountCode: '1.1.9.01', debit: 0, credit: 5913.78 }       // Transitória
  ]
});
```

### 6.3 Exemplo: Desmembrar Cobrança na Super Conciliação

**Cenário:** Conciliar COB000027 com 5 clientes identificados via CSV

**Clientes:**
- PET SHOP: R$ 1.412,00 (conta 1.1.2.01.0001)
- ELETROSOL: R$ 300,00 (conta 1.1.2.01.0002)
- D ANGE: R$ 760,00 (conta 1.1.2.01.0003)
- FAZENDA: R$ 2.029,78 (conta 1.1.2.01.0004)
- JR SOLUÇÕES: R$ 1.412,00 (conta 1.1.2.01.0005)

**Lançamento correto:**
```javascript
const entry = await accountingService.createEntry({
  entryType: 'recebimento',
  entryDate: '2025-01-02',
  description: 'Desmembramento COB000027 - 5 clientes',
  referenceType: 'cobranca_desmembramento',
  referenceId: 'COB000027',
  sourceType: 'super_conciliacao',
  lines: [
    { accountCode: '1.1.9.01', debit: 5913.78, credit: 0 },         // Estorno transitória
    { accountCode: '1.1.2.01.0001', debit: 0, credit: 1412.00 },    // PET SHOP
    { accountCode: '1.1.2.01.0002', debit: 0, credit: 300.00 },     // ELETROSOL
    { accountCode: '1.1.2.01.0003', debit: 0, credit: 760.00 },     // D ANGE
    { accountCode: '1.1.2.01.0004', debit: 0, credit: 2029.78 },    // FAZENDA
    { accountCode: '1.1.2.01.0005', debit: 0, credit: 1412.00 }     // JR SOLUÇÕES
  ]
});
```

---

## 7. ERROS A EVITAR

### 7.1 ❌ NUNCA Fazer

| Erro | Por quê é Errado | Consequência |
|------|------------------|--------------|
| Lançar na conta 1.1.2.01 (sintética) | Viola NBC TG 26 | Saldo incorreto, relatórios errados |
| Criar lançamento sem reference_id | Impossível rastrear origem | Duplicações, auditoria impossível |
| Débitar o banco 2x para mesmo recebimento | Duplicação | Saldo inflado |
| Ignorar a conta transitória | Pular etapa de conciliação | Clientes não baixados corretamente |
| Criar entry com apenas 1 linha | Não é partida dobrada | Equação desbalanceada |

### 7.2 ⚠️ Armadilhas Comuns

1. **Cobrança agrupada tratada como individual**
   - ❌ Creditar direto em 1 cliente
   - ✅ Usar conta transitória, depois desmembrar

2. **PIX com nome diferente do cadastro**
   - ❌ Criar novo cliente
   - ✅ Usar conta "Pendente de Identificação"

3. **Mesmo boleto processado 2x**
   - ❌ Criar 2 lançamentos
   - ✅ Verificar idempotência por reference_id

4. **Estorno sem contrapartida**
   - ❌ Deletar só a linha do banco
   - ✅ Deletar entry inteiro (todas as linhas)

---

## 📎 ANEXOS

### A. Mapeamento de source_types

| source_type | Descrição | Origem |
|-------------|-----------|--------|
| `geracao_honorarios` | Geração de faturas mensais | GenerateRecurringInvoices |
| `ofx_import` | Importação de OFX | BankImport |
| `bank_transaction` | Transação bancária processada | IA ou manual |
| `super_conciliacao` | Desmembramento de cobrança | SuperConciliation |
| `opening_balance` | Saldo de abertura | Configuração inicial |
| `manual` | Lançamento manual | Usuário |

### B. Mapeamento de reference_types

| reference_type | Descrição | reference_id esperado |
|----------------|-----------|----------------------|
| `invoice` | Fatura/RPS | UUID da invoice |
| `bank_transaction` | Transação OFX | fitid do OFX |
| `cobranca_desmembramento` | Cobrança conciliada | COB000xxx |
| `expense` | Despesa | UUID da expense |
| `payroll` | Folha de pagamento | competência (YYYY-MM) |

### C. Queries Úteis

```sql
-- Buscar conta analítica de um cliente
SELECT coa.id, coa.code, coa.name
FROM chart_of_accounts coa
WHERE coa.code LIKE '1.1.2.01.%'
  AND coa.name ILIKE '%ACME%';

-- Criar conta analítica para novo cliente
INSERT INTO chart_of_accounts (
  code, name, account_type, nature, 
  parent_id, level, is_analytical, is_synthetic, 
  is_active, accepts_entries
)
SELECT 
  '1.1.2.01.' || LPAD((MAX(CAST(SPLIT_PART(code, '.', 5) AS INT)) + 1)::TEXT, 4, '0'),
  'Cliente: NOVO CLIENTE LTDA',
  'ATIVO', 'DEVEDORA',
  (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01'),
  5, true, false, true, true
FROM chart_of_accounts
WHERE code LIKE '1.1.2.01.%';

-- Verificar saldo de um cliente
SELECT 
  coa.code, coa.name,
  SUM(ael.debit) - SUM(ael.credit) as saldo
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.2.01.0015'
GROUP BY coa.code, coa.name;
```

---

**Fim do documento de treinamento**

*Este documento deve ser atualizado sempre que houver mudanças na arquitetura contábil.*
