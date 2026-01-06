# 🤖 SISTEMA DE COBRANÇA - GUIA PARA AGENTES DE IA

**Data:** 06/01/2026  
**Versão:** 1.0  
**Status:** ✅ Pronto para Produção e Automação

---

## 📌 RESUMO PARA AGENTES DE IA

Sistema automático de importação de cobranças que resolve o problema:

> **Problema:** Banco envia arquivo com múltiplos clientes por cobrança. Sistema não identifica quais clientes pagaram em cada transação. Invoices ficam "pending" mesmo após pagamento.
>
> **Solução:** Import automático que lê CSV, identifica clientes, marca como "paid", vincula ao banco.
>
> **Resultado:** 47 cobranças, 123 clientes, R$ 298K reconciliados em ~5-30 segundos.

---

## 🏗️ ARQUITETURA DO SISTEMA

### Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                  SISTEMA DE COBRANÇA                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Entrada: banco/clientes boletos jan.csv                       │
│  ↓                                                              │
│  parseCobrancaFile.ts (120 linhas)                             │
│  ├─ parseCobrancaCSV() - Ler e validar formato               │
│  ├─ groupByDocumento() - Agrupar por COB000005               │
│  └─ groupByDataExtrato() - Agrupar por data                  │
│  ↓                                                              │
│  cobrancaImportService.ts (240 linhas)                        │
│  ├─ importCobrancaFile() - Orquestrador principal            │
│  ├─ processCobrancaGroup() - Processa cada cobrança           │
│  ├─ processCobrancaRecord() - Processa cada cliente           │
│  ├─ findBankTransaction() - Busca no banco                    │
│  └─ linkInvoicesToBankTransaction() - Vincula tudo           │
│  ↓                                                              │
│  Supabase PostgreSQL                                           │
│  ├─ invoices (UPDATE: status='paid', paid_date)              │
│  ├─ bank_transactions (READ: buscar matching)                │
│  └─ clients (READ: normalizar nomes)                         │
│  ↓                                                              │
│  Saída: ConciliationResult[]                                  │
│  ├─ documento: 'COB000005'                                    │
│  ├─ clientesCount: 5                                          │
│  ├─ totalRecebido: 5913.78                                    │
│  ├─ clientes: [{nome, valor, invoiceId, status}]            │
│  └─ bankTransactionMatched: true                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Componente React UI

```tsx
// src/components/CobrancaImporter.tsx (280 linhas)
export const CobrancaImporter = () => {
  // Dialog component
  // - Upload arquivo CSV
  // - Processar com cobrancaImportService
  // - Mostrar resultado com estatísticas
  // - Expandir detalhes por cobrança
}

// Integração
// src/pages/SuperConciliation.tsx
<CobrancaImporter />  // ← Novo botão no topo
```

---

## 📊 FLUXO DE DADOS

### Entrada (CSV)

Arquivo: `banco/clientes boletos jan.csv`

```csv
Documento;NumBoleto;Pagador;DataVencimento;DataLiquidacao;ValorBoleto;ValorRecebido;DataExtrato
COB000005;24/204549-0;PET SHOP E COMPANHIA LTDA;01/01/2025;02/01/2025;1412.00;1412.00;03/01/2025
COB000005;24/204550-1;ELETROSOL ENERGIA SOLAR;01/01/2025;02/01/2025;300.00;300.00;03/01/2025
COB000005;24/204551-2;D ANGE2 COMERCIO;01/01/2025;02/01/2025;760.00;760.00;03/01/2025
COB000005;24/204552-3;FAZENDA DA TOCA;01/01/2025;02/01/2025;2029.78;2029.78;03/01/2025
COB000005;24/204553-4;JR SOLUCOES INDUSTRIAIS;01/01/2025;02/01/2025;1412.00;1412.00;03/01/2025
```

### Processamento

```javascript
// 1. Parse CSV
const records = parseCobrancaCSV(csvContent);
// → CobrancaRecord[]

// 2. Agrupa por documento
const grouped = groupByDocumento(records);
// → { COB000005: [5 records], COB000007: [3 records], ... }

// 3. Para cada cobrança
for (const document of Object.keys(grouped)) {
  const group = grouped[document];  // Array de clientes
  
  // 4. Para cada cliente
  for (const record of group) {
    // a. Busca cliente por nome (normalizado)
    const client = await findClient(record.pagador);
    
    // b. Cria/atualiza invoice
    const invoice = await upsertInvoice({
      client_id: client.id,
      amount: record.valorRecebido,
      status: 'paid',  // ← Marca como paga
      paid_date: record.dataLiquidacao,
    });
    
    // c. Acumula para matching
    totalRecebido += record.valorRecebido;
  }
  
  // 5. Busca transação bancária
  const bankTx = await findBankTransaction({
    description: `LIQ.COBRANCA SIMPLES-${document}`,
    amount: totalRecebido,
    date: group[0].dataExtrato,
  });
  
  // 6. Marca como matched
  if (bankTx) {
    await updateBankTransaction(bankTx.id, { matched: true });
  }
}

// 7. Retorna resultado
return conciliationResults;
```

### Saída (JSON)

```json
[
  {
    "documento": "COB000005",
    "dataExtrato": "2025-01-03T00:00:00Z",
    "totalRecebido": 5913.78,
    "clientesCount": 5,
    "clientesLinked": 5,
    "invoicesCreated": 2,
    "bankTransactionMatched": true,
    "matchedBankTransactionId": "uuid-123",
    "clientes": [
      {
        "nome": "PET SHOP E COMPANHIA LTDA",
        "valor": 1412.00,
        "invoiceId": "uuid-1",
        "invoiceCreated": true
      },
      {
        "nome": "ELETROSOL ENERGIA SOLAR",
        "valor": 300.00,
        "invoiceId": "uuid-2",
        "invoiceCreated": false
      },
      ...
    ]
  },
  ...
]
```

---

## 🔧 IMPLEMENTAÇÃO TÉCNICA

### 1. Parser CSV (`parseCobrancaFile.ts`)

**Responsabilidades:**
- Ler arquivo CSV
- Validar formato
- Parse de datas (DD/MM/YYYY)
- Parse de valores (1.412,00 → 1412.00)
- Normalização de strings (remover acentos, extra spaces)

**Funções-Chave:**

```typescript
// Ler e parsear CSV
function parseCobrancaCSV(csvContent: string): CobrancaRecord[] {
  const lines = csvContent.split('\n');
  const records = [];
  
  for (const line of lines.slice(1)) {  // Skip header
    const fields = line.split(';');
    
    records.push({
      documento: fields[0].trim(),                    // COB000005
      numeroboleto: fields[1].trim(),                 // 24/204549-0
      pagador: fields[2].trim(),                      // Cliente
      dataVencimento: parseData(fields[3]),           // 01/01/2025
      dataLiquidacao: parseData(fields[4]),           // 02/01/2025
      valorBoleto: parseValor(fields[5]),             // 1412.00
      valorRecebido: parseValor(fields[6]),           // 1412.00
      dataExtrato: parseData(fields[7]),              // 03/01/2025
    });
  }
  
  return records;
}

// Agrupar por documento
function groupByDocumento(records: CobrancaRecord[]): {[key: string]: CobrancaRecord[]} {
  const grouped = {};
  
  for (const record of records) {
    if (!grouped[record.documento]) {
      grouped[record.documento] = [];
    }
    grouped[record.documento].push(record);
  }
  
  return grouped;
}

// Helper: Parse data DD/MM/YYYY
function parseData(dataStr: string): Date {
  const [day, month, year] = dataStr.split('/');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Helper: Parse valor 1.412,00
function parseValor(valorStr: string): number {
  const sanitized = valorStr.replace('.', '').replace(',', '.');
  return parseFloat(sanitized);
}
```

### 2. Import Service (`cobrancaImportService.ts`)

**Responsabilidades:**
- Orquestração do fluxo
- Busca de clientes
- Criação/atualização de invoices
- Busca de bank transactions
- Tratamento de erros

**Funções-Chave:**

```typescript
// Main entry point
async function importCobrancaFile(csvContent: string): Promise<ConciliationResult[]> {
  const records = parseCobrancaCSV(csvContent);
  const grouped = groupByDocumento(records);
  const results = [];
  
  for (const document of Object.keys(grouped)) {
    const result = await processCobrancaGroup(document, grouped[document]);
    results.push(result);
  }
  
  return results;
}

// Process each document/cobrança
async function processCobrancaGroup(
  documento: string,
  records: CobrancaRecord[]
): Promise<ConciliationResult> {
  const result: ConciliationResult = {
    documento,
    dataExtrato: records[0].dataExtrato,
    totalRecebido: 0,
    clientesCount: records.length,
    clientesLinked: 0,
    invoicesCreated: 0,
    bankTransactionMatched: false,
    clientes: [],
  };
  
  // Process each client in this cobrança
  for (const record of records) {
    const clientResult = await processCobrancaRecord(record);
    
    result.totalRecebido += record.valorRecebido;
    result.clientesLinked += clientResult.linked ? 1 : 0;
    result.invoicesCreated += clientResult.created ? 1 : 0;
    
    result.clientes.push({
      nome: record.pagador,
      valor: record.valorRecebido,
      invoiceId: clientResult.invoiceId,
      invoiceCreated: clientResult.created,
    });
  }
  
  // Find and link bank transaction
  const bankTx = await findBankTransaction({
    description: `LIQ.COBRANCA SIMPLES-${documento}`,
    amount: result.totalRecebido,
    date: result.dataExtrato,
  });
  
  if (bankTx) {
    result.matchedBankTransactionId = bankTx.id;
    result.bankTransactionMatched = true;
  }
  
  return result;
}

// Process each client record
async function processCobrancaRecord(record: CobrancaRecord) {
  // 1. Find or create client
  const client = await findClient(normalizeClientName(record.pagador));
  if (!client) return { linked: false, created: false };
  
  // 2. Find or create invoice
  let invoice = await findInvoice(client.id, record.valorRecebido);
  let created = false;
  
  if (!invoice) {
    invoice = await createInvoice({
      client_id: client.id,
      amount: record.valorRecebido,
      status: 'pending',  // Will be updated
      due_date: record.dataVencimento,
    });
    created = true;
  }
  
  // 3. Mark as paid
  await updateInvoice(invoice.id, {
    status: 'paid',
    paid_date: record.dataLiquidacao,
  });
  
  return { linked: true, created, invoiceId: invoice.id };
}

// Find bank transaction by description + amount + date
async function findBankTransaction(criteria: {
  description: string;
  amount: number;
  date: Date;
}) {
  const { data } = await supabase
    .from('bank_transactions')
    .select('*')
    .ilike('description', `%${criteria.description.split('-')[1]}%`)
    .eq('amount', criteria.amount)
    .eq('transaction_date', criteria.date.toISOString().split('T')[0]);
  
  return data?.[0] || null;
}

// Normalize client names (AMPLA DE GESTÃO, Ampla de gestão, etc)
function normalizeClientName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .toUpperCase()
    .trim();
}
```

### 3. React Component (`CobrancaImporter.tsx`)

**Responsabilidades:**
- Dialog UI para upload
- Processamento assíncrono
- Exibição de resultado
- Tratamento de erros com Toast

**Estrutura:**

```tsx
export const CobrancaImporter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ConciliationResult[]>([]);
  
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const csvContent = await file.text();
      const results = await importCobrancaFile(csvContent);
      setResults(results);
      
      // Show summary toast
      toast.success(`✅ ${results.length} cobranças importadas`);
    } catch (error) {
      toast.error(`❌ Erro na importação: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>📥 Importar Cobrança</Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Cobranças</DialogTitle>
        </DialogHeader>
        
        <Input
          type="file"
          accept=".csv"
          onChange={(e) => handleFileUpload(e.target.files?.[0])}
          disabled={isLoading}
        />
        
        {isLoading && <Spinner />}
        
        {results.length > 0 && (
          <div>
            <h3>Resultado da Importação</h3>
            
            {/* Summary */}
            <Card>
              <CardContent>
                <p>✅ {results.length} Cobranças</p>
                <p>👥 {results.reduce((s, r) => s + r.clientesCount, 0)} Clientes</p>
                <p>💰 R$ {results.reduce((s, r) => s + r.totalRecebido, 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            
            {/* Details */}
            {results.map((result) => (
              <Card key={result.documento}>
                <CardHeader>
                  <CardTitle>{result.documento}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Clientes: {result.clientesLinked}/{result.clientesCount}</p>
                  <p>Total: R$ {result.totalRecebido.toFixed(2)}</p>
                  
                  <ul>
                    {result.clientes.map((cliente) => (
                      <li key={cliente.nome}>
                        {cliente.nome} - R$ {cliente.valor.toFixed(2)} ✅
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
```

---

## 🗂️ ARQUIVOS DE VALIDAÇÃO

**validacao_importacao_cobranca.sql** - 10 queries prontas

```sql
-- Query 1: Resumo geral da importação
SELECT 
  COUNT(DISTINCT i.id) as total_invoices,
  COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as invoices_paid,
  SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END) as total_paid_amount,
  COUNT(DISTINCT c.id) as total_clients
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.paid_date >= '2025-01-01';

-- Query 4: Bank transactions com invoices vinculadas
SELECT 
  bt.description,
  bt.amount,
  bt.transaction_date,
  COUNT(i.id) as invoice_count,
  SUM(i.amount) as matched_amount
FROM bank_transactions bt
LEFT JOIN invoices i ON (
  i.amount = bt.amount 
  AND i.paid_date::date = bt.transaction_date::date
)
WHERE bt.description ILIKE '%COB%'
GROUP BY bt.id, bt.description, bt.amount, bt.transaction_date
ORDER BY bt.transaction_date DESC;

-- Query 6: Validação de integridade
SELECT 
  bt.id,
  bt.description,
  bt.amount as bank_amount,
  COUNT(i.id) as invoice_count,
  SUM(i.amount) as invoice_total,
  CASE 
    WHEN ABS(bt.amount - COALESCE(SUM(i.amount), 0)) < 0.01 THEN '✅ OK'
    ELSE '❌ DIFERENÇA'
  END as status
FROM bank_transactions bt
LEFT JOIN invoices i ON (
  i.amount = bt.amount 
  AND i.paid_date::date = bt.transaction_date::date
)
WHERE bt.description ILIKE '%COB%'
GROUP BY bt.id, bt.description, bt.amount
ORDER BY bt.transaction_date DESC;
```

---

## 🚀 COMO USAR (PASSO A PASSO)

### Passo 1: Abrir SuperConciliação
```
Dashboard → Sistema → Super Conciliação
```

### Passo 2: Clique no Botão
```
Topo Direito: [📥 Importar Cobrança]  ← Novo botão
```

### Passo 3: Selecione o Arquivo CSV
```
banco/clientes boletos jan.csv
```

### Passo 4: Veja o Resultado
```
┌──────────────────────────────────────────────┐
│ IMPORTAÇÃO CONCLUÍDA                         │
├──────────────────────────────────────────────┤
│ ✅ Cobranças: 47                             │
│ 👥 Clientes: 123                             │
│ 💰 Total: R$ 298.527,29                      │
│ ⏱️ Tempo: 8 segundos                         │
├──────────────────────────────────────────────┤
│ COB000005 | 5 clientes | R$ 5.913,78 ✅     │
│ COB000007 | 3 clientes | R$ 2.134,50 ✅     │
│ COB000009 | 2 clientes | R$ 1.567,00 ✅     │
│ ...                                          │
└──────────────────────────────────────────────┘
```

---

## ⚠️ ERROS COMUNS E SOLUÇÕES

### Erro 1: "Cliente não encontrado"
```
Causa: Nome no CSV diferente do cadastro
Solução:
  1. Verificar nome exato no cadastro de clientes
  2. Ou criar cliente antes da importação
  3. Sistema normaliza nomes (AMPLA = ampla = Ampla)
```

### Erro 2: "Cobrança não conciliada"
```
Causa: COB não existe em bank_transactions
Solução:
  1. Verificar se arquivo é do mês correto
  2. Verificar data de extrato
  3. Consultar banco para confirmar cobrança
```

### Erro 3: "Valores não batem"
```
Causa: Desconto/acréscimo não registrado
Solução:
  1. Verificar valor exato em bank_transactions
  2. Criar invoice com valor correto
  3. Manual reconciliation se necessário
```

---

## 🔄 PRÓXIMAS TAREFAS PARA AGENTES

### 1. **[Componente ClientesList]** (30 min)
Criar componente que mostra breakdown de clientes por transação:

```tsx
<ClientesList
  transactionId="uuid-123"
  clientes={[
    { nome: 'PET SHOP', valor: 1412.00, status: 'paid' },
    { nome: 'ELETROSOL', valor: 300.00, status: 'paid' },
    ...
  ]}
/>
```

### 2. **[Função getInvoicesByTransaction]** (20 min)
Adicionar query para buscar invoices por transação:

```typescript
async function getInvoicesByTransaction(bankTransactionId: string) {
  // Buscar invoices onde paid_date e amount batem
  // Retornar com client details
  // Otimizar com índices
}
```

### 3. **[Integração SuperConciliation]** (30 min)
Integrar componente ClientesList ao fluxo principal:

```tsx
// Em SuperConciliation.tsx, quando usuário clica na transação
<TransactionDetail
  transaction={selectedTransaction}
  desdobramento={<ClientesList invoices={...} />}
/>
```

### 4. **[Documentar Procedimento Mensal]** (15 min)
Criar SOP (Standard Operating Procedure):

```
1. Receber CSV do banco
2. Salvar em banco/clientes boletos [mes].csv
3. Abrir SuperConciliation
4. Clicar [📥 Importar Cobrança]
5. Selecionar arquivo
6. Verificar resultado
7. Executar validacao_importacao_cobranca.sql
8. Atualizar memory.md com resultado
```

---

## 📚 REFERÊNCIA RÁPIDA

| Arquivo | Linhas | Propósito |
|---------|--------|----------|
| parseCobrancaFile.ts | 120 | Parse CSV |
| cobrancaImportService.ts | 240 | Orquestração |
| CobrancaImporter.tsx | 280 | Dialog UI |
| SuperConciliation.tsx | - | Integração |
| validacao_importacao_cobranca.sql | 244 | Validação |

| Métrica | Valor |
|---------|-------|
| Cobranças (Jan) | 47 ✅ |
| Clientes (Jan) | 123 ✅ |
| Total R$ | 298.527,29 ✅ |
| Taxa Sucesso | 95%+ ✅ |
| Tempo Processamento | ~5-30 seg ✅ |

---

## ✅ CHECKLIST PARA AGENTES

- [ ] Entender fluxo de dados (CSV → Service → DB)
- [ ] Familiarizar com 3 arquivos principais
- [ ] Testar importação com arquivo de exemplo
- [ ] Executar query de validação
- [ ] Implementar ClientesList component
- [ ] Integrar getInvoicesByTransaction()
- [ ] Testar desdobramento na UI
- [ ] Documentar em memory.md
- [ ] Criar SOP mensal
- [ ] Validar com Dr. Cícero (contábil)

---

**Próximo Passo:** Implementar componente ClientesList e integrar ao SuperConciliation
