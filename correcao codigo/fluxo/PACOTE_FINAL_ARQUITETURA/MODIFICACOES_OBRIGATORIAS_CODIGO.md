# 🔧 MODIFICAÇÕES OBRIGATÓRIAS NO CÓDIGO

**ATENÇÃO:** A base foi corrigida, mas se o código não for modificado, os erros vão voltar!

---

## 📋 STATUS DAS MODIFICAÇÕES

| Componente | Status | Prioridade | Ação |
|------------|--------|------------|------|
| Scripts externos (boleto_sicredi) | ⚠️ DESATIVAR | 🔴 CRÍTICA | Parar de usar |
| BankImport.tsx | ⚠️ MODIFICAR | 🔴 CRÍTICA | Usar transitória |
| SuperConciliation.tsx | ⚠️ MODIFICAR | 🔴 CRÍTICA | Desmembrar correto |
| AccountingService.ts | ⚠️ MODIFICAR | 🟡 ALTA | Validar sintética |
| GenerateRecurringInvoices.tsx | ⚠️ VERIFICAR | 🟡 ALTA | Usar analíticas |
| MCP Financeiro | ⚠️ ATUALIZAR | 🟡 ALTA | Novas ferramentas |
| Agente Cícero | ⚠️ ATUALIZAR | 🟡 ALTA | Novo system prompt |

---

## 🔴 PRIORIDADE CRÍTICA

### 1. DESATIVAR SCRIPTS EXTERNOS

**Arquivos a desativar/deletar:**
```
gerar_lancamentos_boletos_v2.mjs
processar_boletos_sicredi.mjs
import_baixa_clientes.mjs
```

**Por quê:** Esses scripts criam lançamentos `source_type='boleto_sicredi'` que DUPLICAM os débitos no banco.

**Ação:** 
- Renomear para `.mjs.DESATIVADO`
- Ou deletar completamente
- Toda contabilização passa pela Super Conciliação

---

### 2. MODIFICAR BankImport.tsx

**Arquivo:** `src/pages/BankImport.tsx`

**Localização:** Linha ~229 (chamada da Edge Function)

**Modificação necessária:**

```typescript
// ANTES (errado):
const { data, error } = await supabase.functions.invoke('ai-bank-transaction-processor', {
  body: {
    action: 'process_transactions',
    transactions: txnsForAI,
    bank_account_id: selectedAccount,
    import_id: importId,
    opening_date: '2024-12-31'
  }
});

// DEPOIS (correto):
const { data, error } = await supabase.functions.invoke('ai-bank-transaction-processor', {
  body: {
    action: 'process_transactions',
    transactions: txnsForAI,
    bank_account_id: selectedAccount,
    import_id: importId,
    opening_date: '2024-12-31',
    // NOVAS CONFIGURAÇÕES:
    usar_conta_transitoria: true,
    conta_transitoria_code: '1.1.9.01',
    regras_classificacao: {
      cobranca_pattern: /COB\d+|COBRANCA/i,
      acao_cobranca: 'TRANSITORIA'  // Não baixar cliente direto
    }
  }
});
```

**Lógica na Edge Function:**

```typescript
// Na Edge Function ai-bank-transaction-processor
function classificarTransacao(descricao: string, valor: number) {
  // Se for cobrança agrupada → Conta transitória
  if (/COB\d+|COBRANCA|LIQ\.COBRANCA/i.test(descricao)) {
    return {
      conta_credito: '1.1.9.01',  // Transitória
      tipo: 'cobranca_agrupada',
      precisa_desmembramento: true
    };
  }
  
  // Se for PIX/TED identificável → Tentar identificar cliente
  // ... resto da lógica
}
```

---

### 3. MODIFICAR SuperConciliation.tsx

**Arquivo:** `src/pages/SuperConciliation.tsx`

**Modificações necessárias:**

#### 3.1 Adicionar botão "Criar Conta"

```typescript
// Após linha ~1370 (dentro do AccountSelector ou próximo)
<Button
  size="sm"
  variant="outline"
  onClick={() => setShowCriarContaDialog(true)}
  className="h-6 text-[10px] gap-1"
>
  <Plus className="h-3 w-3" />
  Nova Conta
</Button>
```

#### 3.2 Modificar função de conciliação

```typescript
// Quando conciliar cobrança agrupada:
async function conciliarCobrancaAgrupada(
  transacaoId: string,
  cobrancaDoc: string,  // COB000027
  clientes: Array<{ clientId: string; valor: number; contaCode: string }>
) {
  // 1. Validar que soma = valor da transação
  const totalClientes = clientes.reduce((s, c) => s + c.valor, 0);
  const transacao = await getTransacao(transacaoId);
  
  if (Math.abs(totalClientes - transacao.amount) > 0.01) {
    throw new Error(`Soma dos clientes (${totalClientes}) ≠ valor da cobrança (${transacao.amount})`);
  }

  // 2. Buscar conta transitória
  const contaTransitoria = await getContaByCodigo('1.1.9.01');

  // 3. Criar lançamento de desmembramento
  const entry = await accountingService.createEntry({
    entryType: 'recebimento',
    entryDate: transacao.transaction_date,
    description: `Desmembramento ${cobrancaDoc} - ${clientes.length} clientes`,
    referenceType: 'cobranca_desmembramento',
    referenceId: cobrancaDoc,
    sourceModule: 'SuperConciliation',
    originContext: 'csv_breakdown',
    lines: [
      // Débito na transitória (estorno)
      { accountId: contaTransitoria.id, debit: totalClientes, credit: 0 },
      // Créditos nos clientes
      ...clientes.map(c => ({
        accountId: c.contaId,
        debit: 0,
        credit: c.valor
      }))
    ]
  });

  // 4. Marcar transação como conciliada
  await markTransactionAsMatched(transacaoId, entry.id);

  return entry;
}
```

---

## 🟡 PRIORIDADE ALTA

### 4. MODIFICAR AccountingService.ts

**Arquivo:** `src/services/AccountingService.ts`

**Adicionar validação de conta sintética:**

```typescript
// No método createEntry, ANTES de criar o lançamento:

async createEntry(params: AccountingEntryParams): Promise<AccountingResult> {
  // NOVA VALIDAÇÃO: Verificar se alguma conta é sintética
  for (const line of params.lines) {
    const conta = await this.getContaById(line.accountId);
    
    if (conta.is_synthetic || conta.code === '1.1.2.01') {
      throw new Error(
        `ERRO: Conta ${conta.code} (${conta.name}) é SINTÉTICA. ` +
        `Use uma conta analítica (ex: 1.1.2.01.xxxx).`
      );
    }
    
    if (!conta.accepts_entries) {
      throw new Error(
        `ERRO: Conta ${conta.code} não aceita lançamentos diretos.`
      );
    }
  }

  // ... resto do código existente
}
```

---

### 5. VERIFICAR GenerateRecurringInvoices.tsx

**Arquivo:** `src/pages/GenerateRecurringInvoices.tsx`

**Verificar se está usando conta analítica:**

```typescript
// Na geração de honorários, garantir que usa conta analítica do cliente
async function gerarHonorarios(cliente: Client, competencia: string) {
  // Buscar ou criar conta analítica
  let contaCliente = await buscarContaAnalitica(cliente.id);
  
  if (!contaCliente) {
    contaCliente = await criarContaAnalitica(cliente);
  }

  // Lançamento DEVE ser na analítica, NUNCA na 1.1.2.01
  return accountingService.createEntry({
    entryType: 'receita_honorarios',
    lines: [
      { accountCode: contaCliente.code, debit: valor, credit: 0 },  // 1.1.2.01.xxxx
      { accountCode: '3.1.1.01', debit: 0, credit: valor }
    ],
    // ...
  });
}
```

---

### 6. ATUALIZAR MCP FINANCEIRO

**Arquivo:** `mcp-financeiro/src/index.ts`

**Adicionar novas ferramentas:**

```typescript
// Ferramentas obrigatórias a adicionar:

tools: [
  // Consultas
  'buscar_conta_cliente',
  'verificar_saldo_transitoria',
  'verificar_equacao_contabil',
  
  // Criação com validação
  'criar_conta_cliente',
  'criar_lancamento_honorarios',
  'criar_lancamento_cobranca_transitoria',
  
  // Conciliação
  'desmembrar_cobranca',
  
  // Validação
  'validar_lancamento_antes_criar',
  'diagnostico_completo'
]
```

**Ver especificação completa em:** `MCP_FINANCEIRO_FERRAMENTAS.md`

---

### 7. ATUALIZAR AGENTE CÍCERO

**Onde:** System prompt do agente

**Ação:** Substituir o system prompt atual pelo conteúdo de `SYSTEM_PROMPT_CICERO.md`

---

## 📊 CHECKLIST DE IMPLEMENTAÇÃO

```
□ Scripts externos desativados
□ BankImport.tsx modificado para usar transitória
□ SuperConciliation.tsx com desmembramento correto
□ AccountingService.ts validando conta sintética
□ GenerateRecurringInvoices.tsx usando analíticas
□ MCP Financeiro com novas ferramentas
□ Agente Cícero com novo system prompt
□ Teste: criar lançamento na sintética → deve dar erro
□ Teste: importar OFX com cobrança → deve ir para transitória
□ Teste: conciliar cobrança → deve desmembrar corretamente
```

---

## ⚠️ SE NÃO MODIFICAR O CÓDIGO

Os seguintes problemas VÃO VOLTAR:

1. **Duplicação de débitos no banco** - Scripts externos rodando em paralelo
2. **Lançamentos na conta sintética** - Violação NBC TG 26
3. **Equação desbalanceada** - Lançamentos incompletos
4. **Saldo do banco divergente** - Não bate com OFX

---

## 🔍 MONITORAMENTO SUGERIDO

Adicionar verificação diária automática:

```typescript
// cron job ou Edge Function scheduled
async function verificacaoDiaria() {
  // 1. Equação contábil
  const { data } = await supabase.rpc('verificar_equacao_contabil');
  if (data.diferenca > 0.01) {
    await enviarAlerta('Equação contábil desbalanceada!');
  }

  // 2. Lançamentos na sintética
  const { count } = await supabase
    .from('accounting_entry_lines')
    .select('id', { count: 'exact' })
    .eq('account_id', CONTA_SINTETICA_ID);
  
  if (count > 0) {
    await enviarAlerta(`${count} lançamentos na conta sintética!`);
  }

  // 3. Duplicatas boleto_sicredi
  const { count: duplicatas } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact' })
    .eq('source_type', 'boleto_sicredi');
  
  if (duplicatas > 0) {
    await enviarAlerta(`${duplicatas} lançamentos boleto_sicredi detectados!`);
  }
}
```

---

*Documento gerado em 11/01/2026 - Revisão obrigatória antes de deploy*
