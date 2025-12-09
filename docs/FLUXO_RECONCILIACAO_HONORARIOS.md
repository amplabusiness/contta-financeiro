# Fluxo de Reconciliação de Honorários com Data Diferente

## 📋 Visão Geral

Este fluxo permite reconciliar **transações bancárias de um período com faturas de períodos anteriores**, respeitando o princípio contábil de **competência**.

**Cenário Comum:**
- 📅 **Fatura emitida**: Dezembro/2024 (competência)
- 📅 **Pagamento recebido**: Janeiro/2025 (data bancária)
- ✅ **Resultado**: Fatura de dez/2024 marcada como paga com lançamento contábil de recebimento em jan/2025

---

## 🔄 Fluxo de Uso

### Passo 1: Acessar o Reconciliador
**Menu:** Sidebar → Contas a Receber → **Reconciliar**

Ou acesse diretamente: `/reconcile-honorarios`

### Passo 2: Informar Dados da Transação Bancária

No formulário, preencha:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| **Data da Transação** | Data da transferência/recebimento no banco | 15/01/2025 |
| **Valor** | Valor exato da transação | R$ 5.000,00 |
| **Conta Bancária** | Qual conta recebeu o valor | SICREDI |
| **Descrição** (opcional) | Detalhes da transferência | PIX do Cliente XYZ |

### Passo 3: Buscar Faturas Compatíveis

Clique em **"Buscar Faturas Compatíveis"**

O sistema buscará automaticamente todas as faturas que podem corresponder:
- ✅ Faturas **pendentes** (status = pending)
- ✅ Faturas **recentemente pagas** (últimos 90 dias)

**Critérios de Match:**
1. **Valor exato** → Confiança 95%
2. **CNPJ/Nome do cliente** na descrição → Confiança 85-75%
3. **Valor aproximado** (±10%) → Confiança 50-60%
4. **Período anterior** → Ajuste +5-10% na confiança

### Passo 4: Selecionar Fatura

Clique na fatura que corresponde à transação. O sistema mostrará:

```
📋 Fatura
├─ Cliente: XYZ Advogados
├─ Competência: 12/2024 (IMPORTANTE!)
├─ Valor: R$ 5.000,00
├─ Status: Pendente ou Já Paga
└─ Confiança: 95% - Valor exato correspondente
```

### Passo 5: Reconciliar

Clique em **"Reconciliar Esta Fatura"**

O sistema executará:

1. ✅ **Atualizar fatura** → Status = "paid", payment_date = 15/01/2025
2. ✅ **Registrar lançamento contábil** (recebimento):
   - **Débito:** 1.1.1.02 (Banco SICREDI) → R$ 5.000,00
   - **Crédito:** 1.1.2 (Cliente a Receber) → R$ 5.000,00
   - **Data:** 15/01/2025 (data do pagamento)
   - **Competência:** 12/2024 (mantida na fatura)

---

## 🎯 Exemplos de Uso

### Exemplo 1: Pagamento Simples Defasado

```
Fatura:
  Cliente: Law Office ABC
  Competência: 12/2024
  Valor: R$ 3.500,00
  Status: Pendente

Transação Bancária:
  Data: 05/01/2025
  Valor: R$ 3.500,00
  Descrição: PIX - Law Office ABC

Resultado:
  ✅ Fatura marcada como paga em 05/01/2025
  ✅ Receita de 12/2024 registrada como recebida
  ✅ Lançamento contábil em 05/01/2025
```

### Exemplo 2: Múltiplas Parcelas

```
Faturas:
  1. Cliente: Tech Solutions → 12/2024 → R$ 2.000,00
  2. Cliente: Tech Solutions → 12/2024 → R$ 3.000,00

Transação Bancária:
  Data: 10/01/2025
  Valor: R$ 5.000,00
  Descrição: Transferência Tech Solutions

Procedimento:
  1. Buscar faturas por R$ 5.000,00
  2. Sistema sugere combinação de ambas as faturas
  3. Reconciliar ambas com a mesma transação
```

---

## 🔍 Detalhes Técnicos

### Princípio Contábil de Competência

Este fluxo respeita integralmente o princípio contábil de **competência**:

- **Receita é registrada quando:** A fatura é criada (data de competência)
- **Pagamento é registrado quando:** A transação bancária ocorre (data de pagamento)
- **Diferença é normal:** Pagamentos podem ocorrer em períodos diferentes

### Edge Functions Envolvidas

1. **`smart-reconciliation`** (melhorado)
   - Busca invoices pendentes E pagas (últimos 90 dias)
   - Calcula confidence score para cada match
   - Suporta múltiplas estratégias de matching

2. **`reconcile-cross-period-invoice`** (novo)
   - `action: "find_invoices"` → Busca faturas compatíveis
   - `action: "reconcile_transaction"` → Executa reconciliação
   - `action: "get_reconciliation_details"` → Detalhes da fatura

3. **`AccountingService.registrarRecebimento()`**
   - Cria lançamento contábil de recebimento
   - Débito em conta bancária, crédito em cliente a receber

### Bancos de Dados Envolvidos

```sql
-- Tabela: invoices
UPDATE invoices 
SET status = 'paid', payment_date = '2025-01-15'
WHERE id = 'invoice_id';

-- Tabela: accounting_entries
INSERT INTO accounting_entries (
  entry_type, amount, date, competence,
  reference_type, reference_id, ...
) VALUES (
  'recebimento', 5000, '2025-01-15', '12/2024',
  'invoice_payment', 'payment_id', ...
);
```

---

## 📊 Visibilidade Contábil

Após a reconciliação, a fatura aparecerá:

### Em Contas a Receber (Fluxo de Honorários)
- Status: **Recebido** ✅
- Data de Recebimento: 15/01/2025
- Data da Competência: 12/2024

### Em Lançamentos Contábeis
```
Data: 15/01/2025
Competência: 12/2024
Descrição: Recebimento de XYZ Advogados - Honorários 12/2024

D: 1.1.1.02 - Banco SICREDI          R$ 5.000,00
  C: 1.1.2 - Cliente a Receber (XYZ) R$ 5.000,00
```

### Em Relatórios
- **DRE (Dezembro):** Receita registrada em 12/2024 ✅
- **Fluxo de Caixa (Janeiro):** Entrada de caixa em 15/01/2025 ✅
- **Balanço (Janeiro):** Sem títulos a receber de XYZ (fechados) ✅

---

## ❓ Dúvidas Frequentes

### P: Posso reconciliar uma fatura que já foi marcada como paga?
**R:** Sim! O sistema busca faturas "recentemente pagas" (últimos 90 dias) para permitir reprocessamento ou correção.

### P: E se houver múltiplas faturas do mesmo cliente no mesmo período?
**R:** O sistema encontrará todas as combinações possíveis. Você seleciona qual corresponde à transação.

### P: Como é tratado o imposto retido?
**R:** Este fluxo registra o valor completo. Se houver retenção, crie uma fatura separada ou registre via Contas a Pagar.

### P: Posso desfazer uma reconciliação?
**R:** Você pode editar a fatura e mudar o status de volta para "pending". Os lançamentos contábeis ficarão como histórico.

### P: E se a transação for parcial?
**R:** Se for menor que a fatura, marque como parcial via manual no Fluxo de Honorários ou crie ajuste.

---

## 📋 Scenario 2: Alterar Cliente na Reconciliação

Se a fatura encontrada pertence ao cliente errado, você pode:

1. **Na seção "Faturas Encontradas"**, há um campo para alterar o cliente
2. Clique em **"Buscar Novamente"** com o novo cliente
3. Selecione a fatura correta entre os novos resultados
4. Proceda com a reconciliação

Isso é útil quando:
- A transação foi digitada com nome genérico
- Múltiplos clientes com nomes similares
- Pagamento consolidado de múltiplos clientes

---

## 📝 Scenario 3: Criar Recebimento SEM Fatura

Se **nenhuma fatura for encontrada**, você pode criar uma nova:

### Quando Usar
- Você recebeu um pagamento mas não tem fatura registrada
- Fatura foi emitida em período anterior não mais pesquisável
- Pagamento espontâneo sem prévia emissão de fatura

### Como Usar

1. **Executar busca** → Sistema encontrará 0 faturas
2. **Clicar em "Criar Nova Fatura"**
3. **Preencher dados:**
   - **Cliente:** Seleção obrigatória
   - **Competência:** Mês/Ano (MM/YYYY) - obrigatório
   - **Data de Vencimento:** Opcional
   - **Valor:** Preenchido automaticamente da transação
   - **Descrição:** Opcional

4. **Clicar em "Criar Fatura e Reconciliar"**

O sistema executará:
- ✅ Criar nova fatura com competência especificada
- ✅ Marcar como "paid" (status = paga)
- ✅ Registrar data de pagamento = data da transação
- ✅ Criar lançamento contábil de recebimento automaticamente

### Exemplo

```
Transação: 15/01/2025 → R$ 2.500,00
Resultado da Busca: Nenhuma fatura encontrada

Ação:
1. Clicar "Criar Nova Fatura"
2. Cliente: "ABC Advogados"
3. Competência: "01/2025"
4. Data Vencimento: (deixar em branco ou 31/01/2025)
5. Clicar "Criar Fatura e Reconciliar"

Resultado:
✅ Fatura criada: ABC Advogados | 01/2025 | R$ 2.500,00
✅ Status: Paga em 15/01/2025
✅ Lançamento contábil registrado
```

---

## 🔀 Scenario 4: Dividir Transação entre Múltiplos Clientes

Quando uma única transação bancária contém pagamentos de múltiplos clientes, você pode dividir o valor entre eles.

### Quando Usar
- Transferência consolidada de múltiplos clientes
- Pagamento agrupado que pertence a vários clientes
- Integração de valores de diferentes fontes em uma transação única

### Como Usar

1. **Executar busca** → Sistema não encontrará correspondência (ou encontrará para apenas 1 cliente)
2. **Clicar em "Dividir entre Múltiplos Clientes"**
3. **Consultar o Contador IA** (recomendado):
   - Clique em "Consultar IA"
   - O Contador IA fornecerá orientações contábeis sobre:
     - Forma correta de contabilizar a divisão
     - Tratamento da competência e data de pagamento
     - Requisitos de auditoria
     - Validações necessárias

4. **Adicionar Linhas de Divisão:**
   - Clique em "+ Adicionar Linha" para cada cliente
   - Preencha:
     - **Cliente:** Seleção do cliente
     - **Valor:** Valor específico deste cliente
     - **Competência:** Mês/Ano da fatura original (MM/YYYY)

5. **Validação Automática:**
   - Sistema verifica que o total das linhas = valor da transação
   - Barra vermelha indica diferença
   - Barra verde indica total correto

6. **Clicar em "Dividir e Reconciliar"**

O sistema executará:
- ✅ Criar uma fatura para cada linha (com seu cliente e competência)
- ✅ Marcar cada fatura como "paid"
- ✅ Registrar data de pagamento = data da transação
- ✅ Criar lançamentos contábeis separados por cliente

### Exemplo Prático

```
Transação: 15/01/2025 → R$ 10.000,00
Descrição: Transferência de honorários

Divisão:
┌─────────────────────────────────────────┐
│ Cliente A → R$ 4.000,00 | 12/2024      │
│ Cliente B → R$ 3.500,00 | 12/2024      │
│ Cliente C → R$ 2.500,00 | 01/2025      │
│ TOTAL    → R$ 10.000,00 ✓              │
└─────────────────────────────────────────┘

Resultado:
✅ Fatura 1: Cliente A | 12/2024 | R$ 4.000,00 | Paga em 15/01/2025
✅ Fatura 2: Cliente B | 12/2024 | R$ 3.500,00 | Paga em 15/01/2025
✅ Fatura 3: Cliente C | 01/2025 | R$ 2.500,00 | Paga em 15/01/2025

Lançamentos Contábeis (3 separados):
D: 1.1.1.02 - Banco SICREDI          R$ 4.000,00
  C: 1.1.2 - Cliente A (a Receber)   R$ 4.000,00
  Data: 15/01/2025 | Competência: 12/2024

D: 1.1.1.02 - Banco SICREDI          R$ 3.500,00
  C: 1.1.2 - Cliente B (a Receber)   R$ 3.500,00
  Data: 15/01/2025 | Competência: 12/2024

D: 1.1.1.02 - Banco SICREDI          R$ 2.500,00
  C: 1.1.2 - Cliente C (a Receber)   R$ 2.500,00
  Data: 15/01/2025 | Competência: 01/2025
```

### Validações Contábeis (orientadas pelo Contador IA)

- ✅ Cada fatura mantém sua competência original
- ✅ Cada pagamento é registrado separadamente por cliente
- ✅ Data de pagamento é a mesma para todas as linhas
- ✅ Total da transação é distribuído sem resíduos
- ✅ Rastreabilidade completa (cada linha gera um lançamento)

---

## 🚀 Próximos Passos

Após implementar este fluxo:

1. **Processar extratos de janeiro** com este reconciliador
2. **Validar no Fluxo de Honorários** que as faturas aparecem como pagas
3. **Gerar DRE de dezembro** para confirmar que receita aparece no período correto
4. **Testar com AI Accountant** para análise de transações específicas

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique se a **fatura existe** no sistema (Scenario 1 e 2)
2. Confirme o **valor exato** da transação
3. Verifique se a **conta bancária** está correta
4. Ao criar nova fatura (Scenario 3), verifique **competência** no formato MM/YYYY
5. Consulte os **logs de erro** em Auditoria

---

**Versão:** 1.1
**Atualizado:** Janeiro 2025
**Sistema:** Ampla Contabilidade
