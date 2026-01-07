# 🗺️ Mapeamento Completo do Banco de Dados

**Data:** 07/01/2026

## 📊 Visão Geral

| Métrica | Valor |
|--------|-------|
| Total de Tabelas | 16 |
| Total de Registros | 9.234 |
| Clientes | 219 |
| Despesas | 535 |
| Receita em Notas | R$ 136.821,59 |

## 📋 Tabelas Mapeadas

### clients (219 registros)
**Descrição:** Cadastro de clientes/empresas que contratam serviços
**Propósito:** CRM - Gestão de relacionamento com clientes
**Colunas:** 0

### invoices (110 registros)
**Descrição:** Notas Fiscais Eletrônicas (RPS) emitidas
**Propósito:** Faturamento - Emissão de RPS e recebimento
**Colunas:** 0

### expenses (535 registros)
**Descrição:** Despesas operacionais e contas a pagar
**Propósito:** Contas a pagar - Gestão de despesas
**Colunas:** 0

### employees (23 registros)
**Descrição:** Funcionários e folha de pagamento
**Propósito:** Folha de pagamento - ESOCIAL
**Colunas:** 0

### bank_accounts (1 registros)
**Descrição:** Contas bancárias cadastradas
**Propósito:** Tesouraria - Controle de contas
**Colunas:** 0

### bank_transactions (1739 registros)
**Descrição:** Movimentações de extrato bancário
**Propósito:** Conciliação bancária automática
**Colunas:** 0

### bank_imports (3 registros)
**Descrição:** Importações de arquivos OFX/CSV
**Propósito:** Importação de extratos
**Colunas:** 0

### chart_of_accounts (635 registros)
**Descrição:** Plano de contas contábil
**Propósito:** Estrutura contábil - Base para DRE e Balanço
**Colunas:** 0

### accounting_entries (1956 registros)
**Descrição:** Lançamentos contábeis (diário)
**Propósito:** Diário contábil - Partidas dobradas
**Colunas:** 0

### accounting_entry_lines (3910 registros)
**Descrição:** Linhas de débito/crédito dos lançamentos
**Propósito:** Linhas do diário
**Colunas:** 0

### cost_center_mapping (0 registros)
**Descrição:** Mapeamento despesa → centro de custo
**Propósito:** Departamentalização de custos
**Colunas:** 0

### recurring_expenses (0 registros)
**Descrição:** Despesas que se repetem mensalmente
**Propósito:** Automação de despesas mensais
**Colunas:** 0

### revenue_categories (7 registros)
**Descrição:** Categorias de receita
**Propósito:** Classificação de receitas
**Colunas:** 0

### expense_categories (39 registros)
**Descrição:** Categorias de despesa
**Propósito:** Classificação de despesas
**Colunas:** 0

### cost_centers (57 registros)
**Descrição:** Centros de custo (departamentos)
**Propósito:** Centros de responsabilidade
**Colunas:** 0

### debt_confessions (0 registros)
**Descrição:** Acordos de renegociação de dívidas
**Propósito:** Renegociação com devedores
**Colunas:** 0

## 🔗 Relacionamentos

- **clients** → **invoices** (1-N): Um cliente pode ter múltiplas notas fiscais
- **clients** → **chart_of_accounts** (N-1): Clientes vinculados a contas a receber
- **expenses** → **cost_centers** (N-1): Despesas classificadas por centro de custo
- **expenses** → **accounting_entries** (1-N): Cada despesa gera lançamentos contábeis
- **bank_transactions** → **bank_accounts** (N-1): Transações associadas a contas bancárias
- **bank_transactions** → **accounting_entries** (1-N): Transações bancárias geram lançamentos
- **employees** → **accounting_entries** (1-N): Folha de pagamento cria lançamentos contábeis

## 📈 Fluxos de Dados

### Fluxo de Honorários
Processo completo de faturamento e recebimento

**Passos:**
1. Client registrado em clients (CNPJ, endereço, email)
2. Invoice criada em invoices (RPS emitida)
3. Lançamento: D: Cliente a Receber | C: Receita em accounting_entries
4. Bank_transaction registra o pagamento
5. Lançamento de recebimento feito automaticamente

### Fluxo de Despesas
Gestão de contas a pagar

**Passos:**
1. Despesa registrada em expenses
2. Classificação em expense_categories e cost_centers
3. Lançamento automático: D: Despesa | C: Contas a Pagar
4. Ao pagar: D: Banco | C: Contas a Pagar
5. Bank_transaction marca como processada

### Fluxo de Folha de Pagamento
Processamento de salários e encargos

**Passos:**
1. Employees cadastrados com dados de salário
2. Folha mensal gerada
3. Lançamentos em accounting_entries para salários
4. Descontos (INSS, IR) registrados
5. Bank_transactions para pagamento via transferência

### Fluxo de Conciliação Bancária
Reconciliação de extratos bancários

**Passos:**
1. Bank_import recebe arquivo de extrato (OFX)
2. Bank_transactions criadas para cada movimento
3. Matching com despesas e receitas
4. Lançamentos contábeis automáticos
5. DRE atualizada em tempo real

