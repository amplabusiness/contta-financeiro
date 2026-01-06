# 📊 Mapeamento de Tabelas - MCP Financeiro

## Tabelas Principais do Banco de Dados

### 1. **clients** (Clientes)
- `id` - UUID (chave primária)
- `name` - Texto (nome da empresa)
- `document` - Texto (CNPJ)
- `email` - Texto
- `phone` - Texto
- `monthly_fee` - Número (honorário mensal)
- `is_active` - Booleano (cliente ativo?)
- `is_pro_bono` - Booleano (é pro-bono?)
- `is_barter` - Booleano (é permuta?)
- `created_at` - Data

**Consultada por:**
- `listar_clientes` - Lista todos os clientes
- `buscar_cliente` - Busca por nome, CNPJ ou ID
- `analisar_cliente` - Análise detalhada de um cliente

---

### 2. **invoices** (Faturas/Honorários)
- `id` - UUID (chave primária)
- `client_id` - UUID (FK para clients)
- `amount` - Número (valor da fatura)
- `due_date` - Data (vencimento)
- `paid_date` - Data (data de pagamento)
- `status` - Enum: 'pending', 'paid', 'overdue', 'cancelled'
- `competence_date` - Data (competência contábil)
- `created_at` - Data

**Consultada por:**
- `listar_honorarios` - Lista faturas por período/cliente
- `analisar_cliente` - Extrai honorários de um cliente
- `clientes_inadimplentes` - Busca faturas pendentes
- `CollectionClientBreakdown` (componente) - Busca invoices pagas para desdobramento

---

### 3. **bank_transactions** (Extratos Bancários)
- `id` - UUID (chave primária)
- `amount` - Número (valor: negativo=saída, positivo=entrada)
- `transaction_date` - Data (data da transação)
- `description` - Texto (descrição/comprovante)
- `matched` - Booleano (já foi conciliada?)
- `journal_entry_id` - UUID (FK para accounting_entries)
- `created_at` - Data

**Consultada por:**
- `conciliar_extrato` - Busca transações para conciliação
- `identificar_transacao` - Classifica uma transação
- `CollectionClientBreakdown` - Busca transações de cobrança (COB)

---

### 4. **accounting_entry_lines** (Linhas de Lançamento Contábil)
- `id` - UUID (chave primária)
- `entry_id` - UUID (FK para accounting_entries)
- `account_id` - UUID (FK para chart_of_accounts)
- `debit` - Número (valor debitado)
- `credit` - Número (valor creditado)
- `description` - Texto
- `created_at` - Data

**Consultada por:**
- Dashboard de Contabilidade
- Relatório de Balancete
- DRE (Demonstração de Resultado)

---

### 5. **chart_of_accounts** (Plano de Contas)
- `id` - UUID (chave primária)
- `code` - Texto (código contábil: ex. 1.1.1.01)
- `name` - Texto (nome da conta)
- `category` - Enum: 'ATIVO', 'PASSIVO', 'RECEITA', 'DESPESA', 'PATRIMONIO'
- `nature` - Enum: 'DEVEDORA', 'CREDORA'
- `is_analytical` - Booleano (é conta analítica?)
- `parent_code` - Texto (código da conta sintética pai)
- `created_at` - Data

**Consultada por:**
- `SuperConciliation.tsx` - Para seletor de contas
- Relatórios contábeis
- Balancete e DRE

---

### 6. **accounting_entries** (Cabeçalhos de Lançamento)
- `id` - UUID (chave primária)
- `entry_date` - Data (data do lançamento)
- `competence_date` - Data (competência contábil)
- `entry_type` - Enum: tipo de lançamento
- `description` - Texto
- `reference_type` - Texto: 'invoice', 'expense', 'bank_transaction', etc
- `reference_id` - UUID (ID do documento de origem)
- `user_id` - UUID (quem fez o lançamento)
- `created_at` - Data

**Consultada por:**
- SuperConciliation - Busca lançamentos para transações
- Razão e Diário

---

### 7. **expenses** (Despesas)
- `id` - UUID (chave primária)
- `description` - Texto (descrição)
- `amount` - Número (valor)
- `expense_date` - Data
- `status` - Enum: 'pending', 'paid', 'cancelled'
- `category` - Texto (categoria de despesa)
- `created_at` - Data

**Consultada por:**
- Relatório de despesas
- Fluxo de caixa
- DRE

---

## 🔍 Relacionamentos Entre Tabelas

```
clients (1) ─────── (N) invoices
                       │
                       └──→ accounting_entries (via reference_id)
                             │
                             └──→ accounting_entry_lines (1)─────┐
                                                                  │
chart_of_accounts ◄──────────────────────────────────────────────┘

bank_transactions
    │
    ├─→ accounting_entries (via journal_entry_id)
    │   │
    │   └─→ accounting_entry_lines
    │       │
    │       └─→ chart_of_accounts
    │
    └─→ invoices (via match: amount + date)
```

---

## 📝 Exemplo de Consulta: Cobrança COB000005

**Fluxo de dados:**

1. **SuperConciliation.tsx** seleciona transação de cobrança
   ```typescript
   // Descrição: "LIQ.COBRANCA SIMPLES-COB000005"
   // Valor: R$ 5.913,78
   ```

2. **CollectionClientBreakdown** busca:
   ```typescript
   // Busca 1: bank_transactions
   WHERE description ILIKE '%COB000005%'
   
   // Busca 2: invoices
   WHERE status = 'paid'
     AND amount = 5913.78
     AND paid_date <= '2025-01-02'
   
   // Resultado: 5 clientes
   - PET SHOP E COMPANHIA LTDA: R$ 1.412,00
   - ELETROSOL ENERGIA SOLAR LTDA: R$ 300,00
   - D ANGE2 COMERCIO DE BICHO DE PELUCIA: R$ 760,00
   - FAZENDA DA TOCA PARTICIPACOES: R$ 2.029,78
   - JR SOLUCOES INDUSTRIAIS LTDA: R$ 1.412,00
   ```

3. **SuperConciliation** cria lançamento:
   ```typescript
   // Débito: Banco Sicredi (1.1.1.02) - R$ 5.913,78
   // Crédito: 
   //   - Clientes a Receber (1.1.2.01) - R$ 5.913,78
   //   (Desdobrado em 5 clientes conforme invoices)
   ```

---

## 🛠️ Ferramentas MCP que Usam Essas Tabelas

| Ferramenta | Tabelas Usadas |
|-----------|----------------|
| `listar_clientes` | clients |
| `buscar_cliente` | clients |
| `analisar_cliente` | clients, invoices |
| `clientes_inadimplentes` | invoices, clients |
| `listar_honorarios` | invoices, clients |
| `conciliar_extrato` | bank_transactions, invoices |
| `identificar_transacao` | bank_transactions |
| `dashboard_okrs` | Múltiplas tabelas |
| `relatorio_cobrancas_mes` | bank_transactions, invoices, clients |
| `importar_cobrancas` | bank_transactions, invoices |

---

## 📚 Estrutura de Código no MCP

Arquivo: `mcp-financeiro/src/index.ts`

**Seções:**
1. **CLIENTES** (linhas ~300-400) - `listar_clientes`, `buscar_cliente`, `analisar_cliente`
2. **HONORÁRIOS** (linhas ~400-500) - `listar_honorarios`
3. **CONTABILIDADE** (linhas ~600-800) - `balancete`, `dre`, `razao`
4. **CONCILIAÇÃO** (linhas ~1000-1200) - `conciliar_extrato`, `identificar_transacao`
5. **COBRANÇA** (linhas ~1900-2100) - `importar_cobrancas`, `detalhe_cobranca`, etc

---

**Última atualização:** January 6, 2026
**Banco de dados:** Supabase PostgreSQL
**Framework:** MCP (Model Context Protocol)
