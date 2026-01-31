# 🚀 HUB OPERACIONAL - SUPER CONCILIAÇÃO

## Documentação Técnica de Implementação

**Versão:** 1.0.0  
**Data:** 30/01/2026  
**Autor:** Sistema Contta  
**Aprovado por:** Dr. Cícero - Contador Responsável

---

## 📋 Sumário

1. [Visão Geral](#visão-geral)
2. [Componentes Criados](#componentes-criados)
3. [Hooks Implementados](#hooks-implementados)
4. [Fluxo de Trabalho](#fluxo-de-trabalho)
5. [Regras de Negócio](#regras-de-negócio)
6. [Integração](#integração)
7. [Exemplos de Uso](#exemplos-de-uso)

---

## 1. Visão Geral

O HUB Operacional da Super Conciliação centraliza todas as operações de classificação contábil de transações bancárias. Foi projetado seguindo as Regras de Ouro do Dr. Cícero e os princípios de governança do sistema Contta.

### Princípios Fundamentais

1. **Toda transação deve ser classificada** - Nenhuma transação pode ficar sem classificação contábil
2. **PIX de sócio NUNCA vira Receita** - Bloqueio hard-coded
3. **Transitórias devem zerar** - 1.1.9.01 e 2.1.9.01 sempre zeradas ao final
4. **Reclassificação NÃO altera saldo bancário** - Apenas corrige a classificação
5. **Conta nova requer aprovação** - Dr. Cícero é a autoridade final

---

## 2. Componentes Criados

### 2.1 AccountSelector

**Caminho:** `src/components/AccountSelector.tsx`

Componente reutilizável para seleção de contas contábeis.

**Props:**

```typescript
interface AccountSelectorProps {
  value: string | null;               // ID da conta selecionada
  onChange: (account: Account | null) => void;
  transactionType?: 'credit' | 'debit' | 'both';  // Filtra por natureza
  accountTypes?: Account['type'][];   // ASSET, LIABILITY, etc.
  excludeCodes?: string[];            // Códigos a excluir
  analyticalOnly?: boolean;           // Apenas analíticas (default: true)
  placeholder?: string;
  disabled?: boolean;
  showBreadcrumb?: boolean;           // Mostra hierarquia (default: true)
  warningMessage?: string;
  onValidate?: (account: Account) => ValidationResult;
}
```

**Características:**
- ✅ Filtra automaticamente contas inativas
- ✅ Busca por código e nome
- ✅ Exibe breadcrumb da hierarquia
- ✅ Agrupa por tipo de conta
- ✅ Validação customizada via callback
- ✅ Exclui transitórias por padrão

---

### 2.2 ReclassificationSplitModal

**Caminho:** `src/components/ReclassificationSplitModal.tsx`

Modal para reclassificar ou desmembrar (split) transações.

**Props:**

```typescript
interface ReclassificationSplitModalProps {
  transaction: BankTransaction;       // Transação a reclassificar
  currentAccount?: Account;           // Conta atual (se houver)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result) => void;
}
```

**Funcionalidades:**

| Modo | Descrição |
|------|-----------|
| Reclassificar | Altera classificação 1:1 |
| Split | Divide em múltiplas contas |

**Validações:**
- ✅ Split deve somar exatamente o valor original
- ✅ Justificativa obrigatória (mín. 10 caracteres)
- ✅ Opção de enviar para aprovação ou salvar como rascunho

---

### 2.3 CreateAccountAssistant

**Caminho:** `src/components/CreateAccountAssistant.tsx`

Assistente wizard para criação de novas contas contábeis.

**Etapas:**

1. **Tipo** - Seleciona tipo da conta (ATIVO, PASSIVO, RECEITA, DESPESA, PL)
2. **Grupo Pai** - Seleciona grupo sintético pai
3. **Detalhes** - Define código, nome e justificativa
4. **Revisão** - Confirma e envia para aprovação

**Características:**
- ✅ Sugere próximo código disponível
- ✅ Mostra grupos comuns por tipo
- ✅ Toda conta vai para aprovação do Dr. Cícero
- ✅ Valida formato do código (X.X.X.XX)

---

### 2.4 DrCiceroApprovalPanel

**Caminho:** `src/components/DrCiceroApprovalPanel.tsx`

Painel centralizado de aprovações para o contador.

**Tabs:**

| Tab | Descrição |
|-----|-----------|
| Reclassificações | Pendências de reclassificação/split |
| Novas Contas | Solicitações de criação de conta |

**Ações:**
- ✅ Aprovar (com observações opcionais)
- ✅ Rejeitar (motivo obrigatório)
- ✅ Visualizar detalhes completos

---

### 2.5 TransactionActionsHub

**Caminho:** `src/components/TransactionActionsHub.tsx`

Hub de ações para transações na lista.

**Variantes:**

| Variant | Uso |
|---------|-----|
| `buttons` | Painel lateral com botões grandes |
| `dropdown` | Menu dropdown compacto |
| `inline` | Ícones inline na tabela |

**Ações disponíveis:**
- Classificar / Alterar Classificação
- Reclassificar / Split
- Criar Conta
- Usar sugestão da IA

---

## 3. Hooks Implementados

### 3.1 useClassification

**Caminho:** `src/hooks/useClassification.ts`

Hook centralizado para operações de classificação.

```typescript
const {
  loading,
  accounts,
  matchingRules,
  suggestedAccount,
  isIncome,
  transactionType,
  absAmount,
  validateClassification,
  classify,
  createReclassification,
  createLearningRule
} = useClassification(transaction);
```

**Validações do Dr. Cícero:**
- 🚫 PIX de sócio → Receita (BLOQUEADO)
- ⚠️ Conta genérica → Requer justificativa
- ⚠️ Entrada → Despesa (Alerta)
- ⚠️ Saída → Receita (Alerta)

---

### 3.2 useAIClassificationSuggestion

**Caminho:** `src/hooks/useAIClassificationSuggestion.ts`

Hook para sugestões com IA e aprendizado.

```typescript
const {
  suggestion,
  loading,
  getSuggestion,
  submitFeedback,
  checkBlocks,
  clearSuggestion
} = useAIClassificationSuggestion(transaction);
```

**Fontes de Sugestão (em ordem):**
1. Regras do banco (`classification_rules`)
2. Padrões conhecidos (tarifas, impostos, etc.)
3. Histórico de transações similares

---

## 4. Fluxo de Trabalho

### 4.1 Classificação de Transação

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Transação     │────►│   Verificar     │────►│   Classificar   │
│   Importada     │     │   Bloqueios     │     │   Conta         │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                         ┌───────┴───────┐               │
                         │ Bloqueado?    │               │
                         └───────┬───────┘               │
                                 │                       │
                    ┌───[SIM]────┴────[NÃO]───┐         │
                    │                          │         │
                    ▼                          ▼         ▼
            ┌───────────────┐         ┌────────────────────────┐
            │ Mostrar Erro  │         │ Criar Lançamento       │
            │ (não permite) │         │ D/C Transitória↔Conta  │
            └───────────────┘         └────────────────────────┘
```

### 4.2 Reclassificação

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Solicitar     │────►│   Validar       │────►│   Criar         │
│   Reclassif.    │     │   Valores       │     │   Pendência     │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                         ┌───────┴───────┐               │
                         │ Válido?       │               │
                         └───────┬───────┘               │
                                 │                       ▼
                    ┌───[SIM]────┴────[NÃO]───┐  ┌─────────────────┐
                    │                          │  │  Dr. Cícero     │
                    ▼                          ▼  │  Aprova/Rejeita │
            ┌───────────────┐         ┌───────┐  └────────┬────────┘
            │ Salvar Draft  │         │ Erro  │           │
            │ ou Enviar     │         └───────┘           ▼
            └───────────────┘                    ┌─────────────────┐
                                                 │  Aplicar        │
                                                 │  Reclassif.     │
                                                 └─────────────────┘
```

---

## 5. Regras de Negócio

### 5.1 Bloqueios Hard-coded

```typescript
const FORBIDDEN_REVENUE_PATTERNS = [
  { pattern: /sócio|socio/i, reason: 'PIX de sócio' },
  { pattern: /empréstimo|emprestimo/i, reason: 'Empréstimo' },
  { pattern: /aporte/i, reason: 'Aporte de capital' },
  { pattern: /devolução|devoluçao|devolucao/i, reason: 'Devolução' },
  { pattern: /reembolso/i, reason: 'Reembolso' },
  { pattern: /transferência própria/i, reason: 'Transferência entre contas' },
];
```

### 5.2 Contas Genéricas

Contas que requerem justificativa:
- `4.1.1.08` - Outras Despesas Operacionais
- `4.1.1.99` - Outras Despesas
- `3.1.1.99` - Outras Receitas
- `1.1.9.01` - Transitória Débitos
- `2.1.9.01` - Transitória Créditos

---

## 6. Integração

### 6.1 Na SuperConciliation

```tsx
import { 
  TransactionActionsHub,
  useAIClassificationSuggestion 
} from '@/components/hub-conciliacao';

// Na lista de transações
{transactions.map(tx => (
  <TableRow key={tx.id}>
    {/* ... outras colunas ... */}
    <TableCell>
      <TransactionActionsHub
        transaction={tx}
        variant="inline"
        onActionComplete={refetchTransactions}
      />
    </TableCell>
  </TableRow>
))}

// No painel lateral
<TransactionActionsHub
  transaction={selectedTx}
  currentAccount={currentAccount}
  suggestion={suggestion}
  variant="buttons"
  onActionComplete={handleComplete}
/>
```

### 6.2 Adicionar Painel de Aprovações

```tsx
import { DrCiceroApprovalPanel } from '@/components/hub-conciliacao';

// Em uma página ou modal
<DrCiceroApprovalPanel
  statusFilter="pending"
  onAction={refetchData}
/>
```

---

## 7. Exemplos de Uso

### 7.1 Classificação Básica

```typescript
const { classify, validateClassification } = useClassification(transaction);

// Validar antes de classificar
const validation = validateClassification(selectedAccount, justification);
if (!validation.valid) {
  toast.error(validation.error);
  return;
}

// Classificar
const result = await classify(selectedAccount, {
  justification: 'Pagamento de fornecedor mensal',
  createRule: true  // Criar regra de aprendizado
});

if (result.success) {
  toast.success('Classificado!');
}
```

### 7.2 Reclassificação com Split

```typescript
const { createReclassification } = useClassification();

const result = await createReclassification(
  transaction.journal_entry_id,
  [
    { account_id: 'id-conta-1', amount: 5000, description: 'Serviço A' },
    { account_id: 'id-conta-2', amount: 3000, description: 'Serviço B' }
  ],
  'Divisão conforme nota fiscal detalhada',
  true  // Enviar para aprovação
);
```

### 7.3 Usando Sugestão da IA

```typescript
const { suggestion, submitFeedback } = useAIClassificationSuggestion(transaction);

// Se aceitou a sugestão
if (suggestion && userAccepted) {
  await submitFeedback({
    transaction_id: transaction.id,
    suggested_account_id: suggestion.account.id,
    actual_account_id: suggestion.account.id,
    was_correct: true
  });
}

// Se rejeitou e classificou diferente
if (suggestion && userChoseDifferent) {
  await submitFeedback({
    transaction_id: transaction.id,
    suggested_account_id: suggestion.account.id,
    actual_account_id: differentAccount.id,
    was_correct: false,
    user_notes: 'Era pagamento de fornecedor, não despesa bancária'
  });
}
```

---

## 📊 Métricas de Sucesso

| Métrica | Meta | Descrição |
|---------|------|-----------|
| Transitórias Zeradas | 100% | 1.1.9.01 e 2.1.9.01 = R$ 0,00 |
| Classificação Correta | > 95% | Taxa de acerto da IA |
| Tempo de Classificação | < 5s | Click → Classificado |
| Aprovações Pendentes | < 24h | SLA de resposta Dr. Cícero |

---

**Documento elaborado por:** Sistema Contta  
**Aprovado por:** Dr. Cícero - Contador Responsável  
**Data:** 30/01/2026
