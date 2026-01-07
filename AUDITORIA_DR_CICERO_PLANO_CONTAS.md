# AUDITORIA DR. CÍCERO - PLANO DE CONTAS COMO FONTE DA VERDADE

**Data:** 01/01/2025
**Auditor:** Dr. Cícero (IA Contábil)
**Fundamentação:** NBC TG 26, ITG 2000, NBC TG 00

---

## REGRA SUPREMA

> **TODO lançamento DEVE ter um DÉBITO e um CRÉDITO com o número da conta do Plano de Contas**

```
NENHUMA entrada de dados pode existir sem:
1. Conta de DÉBITO (account_id do chart_of_accounts)
2. Conta de CRÉDITO (account_id do chart_of_accounts)
3. Registro em accounting_entries + accounting_entry_lines
```

### Fluxo Obrigatório
```
PLANO DE CONTAS → LIVRO DIÁRIO → LIVRO RAZÃO → BALANCETE → DRE → BALANÇO PATRIMONIAL
```

---

## VIOLAÇÕES CRÍTICAS

### 1. Clients.tsx - Cadastro de Clientes
**Tabela:** `clients`
**Violação:** Cadastro de cliente não cria conta contábil vinculada
**Impacto:** Cliente existe no sistema mas não tem conta "A Receber" no plano de contas

**Correção Proposta:**
```typescript
// Ao cadastrar cliente, criar lançamento de abertura se houver saldo
const handleSaveClient = async (client: Client) => {
  // 1. Inserir cliente
  const { data: newClient } = await supabase.from('clients').insert(client);

  // 2. Se houver saldo inicial, criar lançamento contábil
  if (client.opening_balance > 0) {
    await registrarSaldoAbertura({
      client_id: newClient.id,
      valor: client.opening_balance,
      conta_debito: '1.1.2.01', // Clientes a Receber
      conta_credito: '2.3.03.02' // Saldo de Abertura - Clientes (PL)
    });
  }
};
```

---

### 2. Import.tsx - Importação de Clientes
**Tabela:** `clients`
**Violação:** Importação em lote não cria lançamentos contábeis
**Impacto:** Clientes importados sem rastreabilidade contábil

**Correção Proposta:**
```typescript
// Após importar clientes, verificar se há saldos de abertura
for (const client of importedClients) {
  if (client.opening_balance > 0) {
    await useAccounting().registrarSaldoAbertura({
      client_id: client.id,
      valor: client.opening_balance,
      conta_debito: '1.1.2.01',
      conta_credito: '2.3.03.02'
    });
  }
}
```

---

### 3. RecurringExpenses.tsx - Despesas Recorrentes
**Tabela:** `accounts_payable`
**Violação:** Despesas geradas sem lançamentos D/C
**Impacto:** Despesas existem mas não aparecem na contabilidade

**Correção Proposta:**
```typescript
// Ao gerar despesa recorrente
const generateExpense = async (expense: RecurringExpense) => {
  // 1. Inserir em accounts_payable
  const { data: newExpense } = await supabase.from('accounts_payable').insert(expense);

  // 2. Criar lançamento contábil
  await useAccounting().registrarDespesa({
    expense_id: newExpense.id,
    valor: expense.amount,
    conta_debito: expense.chart_of_accounts_id, // Conta de despesa (4.x.x.xx)
    conta_credito: '2.1.1.01', // Fornecedores a Pagar
    description: expense.description,
    competence_date: expense.competence_date
  });
};
```

---

### 4. ImportHonorarios.tsx - Importação de Honorários
**Tabela:** `clients`
**Violação:** Atualiza monthly_fee sem criar provisões retroativas
**Impacto:** Honorários não reconhecidos contabilmente

**Correção Proposta:**
```typescript
// Após importar honorários, gerar faturas retroativas
for (const record of importedRecords) {
  const { data: invoice } = await supabase.from('invoices').insert({
    client_id: record.client_id,
    amount: record.monthly_fee,
    competence_month: record.competence
  });

  // Lançamento contábil
  await useAccounting().registrarHonorario({
    invoice_id: invoice.id,
    valor: invoice.amount,
    conta_debito: '1.1.2.01', // Clientes a Receber
    conta_credito: '3.1.1.01' // Receita de Honorários
  });
}
```

---

### 5. CashFlow.tsx - Fluxo de Caixa
**Tabela:** `cash_flow_transactions`
**Violação:** Transações manuais sem lançamentos contábeis
**Impacto:** Movimentações de caixa não rastreáveis

**Correção Proposta:**
```typescript
// Transação manual DEVE passar pela contabilidade
const addTransaction = async (transaction: CashFlowTransaction) => {
  // Criar lançamento contábil PRIMEIRO
  const { data: entry } = await supabase.from('accounting_entries').insert({
    description: transaction.description,
    entry_date: transaction.date,
    competence_date: transaction.date,
    reference_type: 'cash_flow',
    reference_id: transaction.id
  });

  // Linhas do lançamento
  await supabase.from('accounting_entry_lines').insert([
    { entry_id: entry.id, account_id: transaction.debit_account_id, debit: transaction.amount, credit: 0 },
    { entry_id: entry.id, account_id: transaction.credit_account_id, debit: 0, credit: transaction.amount }
  ]);

  // Depois inserir na tabela de fluxo de caixa com referência
  await supabase.from('cash_flow_transactions').insert({
    ...transaction,
    accounting_entry_id: entry.id
  });
};
```

---

### 6. NFSe.tsx - Notas Fiscais
**Tabela:** `nfse`, `nfse_tomadas`
**Violação:** Emissão de NFS-e sem lançamento automático
**Impacto:** Receita emitida sem reconhecimento contábil

**Correção Proposta:**
```typescript
// Ao emitir NFS-e, criar lançamento
const emitirNFSe = async (nfse: NFSe) => {
  const { data: newNFSe } = await supabase.from('nfse').insert(nfse);

  // Lançamento de receita
  await useAccounting().registrarReceita({
    nfse_id: newNFSe.id,
    valor: nfse.valor_servicos,
    conta_debito: '1.1.2.01', // Clientes a Receber
    conta_credito: '3.1.1.01', // Receita de Serviços
    description: `NFS-e ${nfse.numero} - ${nfse.tomador_razao_social}`
  });

  // Se houver impostos retidos, criar lançamentos adicionais
  if (nfse.iss_retido > 0) {
    await useAccounting().registrarRetencao({
      conta_debito: '3.1.1.01', // Dedução da receita
      conta_credito: '2.1.2.01', // ISS a Recolher
      valor: nfse.iss_retido
    });
  }
};
```

---

### 7. DebtNegotiation.tsx - Negociação de Dívidas
**Tabela:** `debt_negotiations`
**Violação:** Negociação sem ajuste contábil
**Impacto:** Descontos e parcelamentos não refletidos na contabilidade

**Correção Proposta:**
```typescript
// Ao criar negociação com desconto
const createNegotiation = async (negotiation: DebtNegotiation) => {
  const { data: newNeg } = await supabase.from('debt_negotiations').insert(negotiation);

  // Se houver desconto, lançar perda
  if (negotiation.discount_amount > 0) {
    await useAccounting().registrarDesconto({
      negotiation_id: newNeg.id,
      valor: negotiation.discount_amount,
      conta_debito: '4.9.1.01', // Perdas com Clientes
      conta_credito: '1.1.2.01', // Clientes a Receber (baixa parcial)
      description: `Desconto negociação ${newNeg.id}`
    });
  }
};
```

---

### 8. DebtConfession.tsx - Confissão de Dívida
**Tabela:** `debt_confessions`
**Violação:** Apenas lê lançamentos, não cria novos
**Impacto:** Confissão formalizada sem registro contábil

**Correção Proposta:**
```typescript
// Ao criar confissão de dívida
const createConfession = async (confession: DebtConfession) => {
  const { data: newConf } = await supabase.from('debt_confessions').insert(confession);

  // Registrar evento contábil de formalização
  await supabase.from('accounting_entries').insert({
    description: `Confissão de dívida - ${confession.client_name}`,
    entry_date: new Date(),
    reference_type: 'debt_confession',
    reference_id: newConf.id,
    // Apenas memo, sem D/C pois o saldo já existe
    is_memo_entry: true
  });

  // Se houver juros acordados, provisionar
  if (confession.interest_amount > 0) {
    await useAccounting().registrarJuros({
      conta_debito: '1.1.2.02', // Juros a Receber
      conta_credito: '3.2.1.01', // Receita de Juros
      valor: confession.interest_amount
    });
  }
};
```

---

### 9. FeeAdjustment.tsx - Ajuste de Honorários
**Tabela:** `fee_adjustment_history`
**Violação:** Ajuste de valor sem reconhecimento contábil
**Impacto:** Mudança de receita esperada não documentada

**Correção Proposta:**
```typescript
// Ajuste de honorários é cadastral, não contábil
// Porém, se gerar fatura com valor diferente do anterior,
// o lançamento contábil será feito na geração da fatura
// Manter histórico apenas para auditoria, não para contabilidade
```

---

### 10. PixReconciliation.tsx - Conciliação PIX
**Tabela:** `client_ledger`
**Violação:** Insere em razão auxiliar sem accounting_entries
**Impacto:** Recebimentos não contabilizados

**Correção Proposta:**
```typescript
// Ao conciliar PIX com fatura
const reconcilePix = async (transaction: BankTransaction, invoice: Invoice) => {
  // 1. PRIMEIRO: Criar lançamento contábil
  await useAccounting().registrarRecebimento({
    invoice_id: invoice.id,
    valor: transaction.amount,
    conta_debito: '1.1.1.02', // Banco (conta específica)
    conta_credito: '1.1.2.01', // Clientes a Receber
    description: `Recebimento PIX - ${invoice.client_name}`
  });

  // 2. Atualizar fatura
  await supabase.from('invoices').update({
    status: 'paid',
    payment_date: transaction.date
  }).eq('id', invoice.id);

  // 3. Atualizar transação bancária
  await supabase.from('bank_transactions').update({
    matched: true,
    matched_invoice_id: invoice.id
  }).eq('id', transaction.id);

  // NÃO inserir diretamente em client_ledger - será derivado do accounting_entries
};
```

---

### 11. ImportInvoices.tsx - Importação de Faturas
**Tabela:** `invoices`, `client_ledger`
**Violação:** Insere em client_ledger sem accounting_entries
**Impacto:** Faturas importadas sem rastreabilidade contábil

**Correção Proposta:**
```typescript
// Importar faturas COM lançamentos contábeis
for (const invoice of importedInvoices) {
  const { data: newInvoice } = await supabase.from('invoices').insert(invoice);

  // Criar lançamento de provisão
  await useAccounting().registrarHonorario({
    invoice_id: newInvoice.id,
    valor: invoice.amount,
    conta_debito: '1.1.2.01', // Clientes a Receber
    conta_credito: '3.1.1.01', // Receita de Honorários
    competence_date: invoice.competence_date
  });

  // NÃO inserir diretamente em client_ledger
}
```

---

### 12. OpeningBalanceReconciliation.tsx - Conciliação de Saldo de Abertura
**Tabela:** `client_ledger`, `bank_transaction_matches`
**Violação:** Reconciliação ignora accounting_entries
**Impacto:** Baixa de saldos sem contabilização

**Correção Proposta:**
```typescript
// Ao reconciliar saldo de abertura com transação bancária
const reconcileOpeningBalance = async (balance: ClientOpeningBalance, transaction: BankTransaction) => {
  // 1. Criar lançamento de baixa
  await useAccounting().registrarBaixaSaldoAbertura({
    balance_id: balance.id,
    valor: transaction.amount,
    conta_debito: '1.1.1.02', // Banco
    conta_credito: '1.1.2.01', // Clientes a Receber
    description: `Baixa saldo abertura - ${balance.client_name}`
  });

  // 2. Atualizar saldo
  await supabase.from('client_opening_balance').update({
    reconciled: true
  }).eq('id', balance.id);

  // NÃO inserir em client_ledger diretamente
};
```

---

## PÁGINAS PARCIALMENTE INTEGRADAS

### 13. SpecialFees.tsx
**Problema:** Cria lançamentos manualmente com fallbacks para contas antigas
**Correção:** Usar `useAccounting()` ao invés de inserção manual

### 14. ImportExpensesSpreadsheet.tsx
**Problema:** Delega para edge function sem validar conta
**Correção:** Edge function deve retornar erro se conta não existir

### 15. BoletoReconciliation.tsx
**Problema:** Edge function não auditada
**Correção:** Auditar edge function `process-boleto-report`

---

## PÁGINAS CORRETAS (MODELO A SEGUIR)

| Página | Hook/Método |
|--------|-------------|
| Invoices.tsx | `useAccounting().registrarHonorario()` |
| Payroll.tsx | `usePayrollAccounting().registrarFolhaProvisao()` |
| BankImport.tsx | Edge function `create-accounting-entry` |
| ImportBoletos.tsx | Edge function com provisão D/C |
| ReconcileHonorarios.tsx | `useAccounting().registrarRecebimento()` |
| PendingReconciliations.tsx | Insere em `accounting_entries` com `chart_of_accounts_id` |
| HonorariosFlow.tsx | `useAccounting()` completo |
| ClientOpeningBalance.tsx | `useAccounting().registrarSaldoAbertura()` |

---

## PRÓXIMOS PASSOS

1. **PRIORIDADE ALTA:** Corrigir PixReconciliation.tsx e ImportInvoices.tsx (usam client_ledger sem contabilidade)
2. **PRIORIDADE ALTA:** Corrigir RecurringExpenses.tsx (despesas sem lançamentos)
3. **PRIORIDADE MÉDIA:** Corrigir CashFlow.tsx (transações manuais)
4. **PRIORIDADE MÉDIA:** Corrigir NFSe.tsx (emissão sem lançamento)
5. **PRIORIDADE BAIXA:** Documentar regra em todos os demais arquivos

---

## RESUMO

```
TOTAL AUDITADO: 24 páginas
├── 🔴 VIOLAÇÕES CRÍTICAS: 12 (50%)
├── 🟡 PARCIALMENTE OK: 3 (12.5%)
└── 🟢 CORRETAS: 9 (37.5%)

META: 100% das entradas passando pelo Plano de Contas
```

---

## MAPEAMENTO OBRIGATÓRIO DE PESSOAL (DR. CÍCERO)

### Regras de Classificação de Pessoas (PJ e CLT)
**Fonte da Verdade:** Atualizado em 07/01/2026

#### 1. Prestadores de Serviço (PJ) -> Conta `4.1.2.13.99` (Outros Terceirizados)
Os pagamentos para as seguintes pessoas/empresas devem ser classificados como **Serviços de Terceiros**, e NÃO como Salários ou Adiantamento de Sócios.

| Nome no Extrato/Favorecido | Colaborador Real | Função | Valor Base (Ref) |
|----------------------------|------------------|--------|------------------|
| **DANIEL RODRIGUES** / DANIEL RIBEIRO | Daniel Rodrigues | Fiscal | R$ 10.500,00 |
| **ROSE** / ROSEMEIRE | Rose | DP | R$ 6.677,55 |
| **DANIELLE RODRIGUES** | **Sueli Amaral** | SC Leg. | R$ 3.668,77 |
| **ALEXSSANDRA** | Alexssandra Ramos | DP | R$ 2.733,39 |
| **TATIANA** / TATIANE COELHO | Tatiana | DP | R$ 1.829,79 |
| **ANDREA FERREIRA** | Andrea Ferreira | Adm | R$ 1.518,00 |
| **ALINE** / CORACI ALINE | Aline | DP | R$ 1.438,23 |
| **TAYLANE** | Taylane | Fin | R$ 1.300,00 |

> **ATENÇÃO CRÍTICA:** Pagamentos para **DANIELLE RODRIGUES** refere-se à prestadora **SUELI AMARAL**.

#### 2. Funcionários CLT (Líquido) -> Conta `4.1.1.01` (Salários e Ordenados)
Pagamentos identificados com estes valores/nomes devem ir para Salários.

**Departamento Administrativo**
| Nome | Valor Líquido Aprox. | Função |
|------|----------------------|--------|
| Amanda Ambrosio | R$ 3.800,00 | Adm |
| Jordana Teixeira | R$ 3.500,00 | Adm |
| Raimundo Pereira | R$ 2.687,50 | Adm |
| Lilian | R$ 2.612,50 | Adm |
| Claudia | R$ 2.500,00 | Adm |
| Fabiana Maria | R$ 2.300,00 | Adm |

**Departamento Pessoal (DP)**
| Nome | Valor Líquido Aprox. | Função |
|------|----------------------|--------|
| Erick Fabricio | R$ 4.000,00 | DP |
| Thaniny | R$ 4.000,00 | DP |
| Jessyca de Freitas | R$ 3.700,00 | DP |
| Luciana | R$ 3.500,00 | DP |
| Luciane Rosa | R$ 3.300,00 | DP |
| Deuza | R$ 3.000,00 | DP |

**Departamento Contábil**
| Nome | Valor Líquido Aprox. | Função |
|------|----------------------|--------|
| Josimar | R$ 3.762,00 | Contábil |
| Thaynara | R$ 3.727,75 | Contábil |


---

**Assinado:** Dr. Cícero - Agente IA Contábil
**Fundamentação:** NBC TG 26, ITG 2000, NBC TG 00
