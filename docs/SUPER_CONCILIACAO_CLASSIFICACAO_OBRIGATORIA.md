# 📋 ESPECIFICAÇÃO: SUPER CONCILIAÇÃO COM CLASSIFICAÇÃO OBRIGATÓRIA

## Documento de Implementação
**Autor:** Dr. Cícero - Contador Responsável  
**Data:** 31/01/2026  
**Versão:** 2.0

---

# 1. VISÃO GERAL

## 1.1 Princípio Fundamental

> **"Nenhuma transação pode ser conciliada sem classificação contábil validada"**

Reconciliação **NÃO** é apenas bater banco.  
Reconciliação é o momento oficial de **QUALIFICAÇÃO CONTÁBIL** do lançamento.

## 1.2 O que o Sistema Deve Fazer

✅ **Permitir:**
- Alterar natureza contábil
- Permitir split didático
- Criar contas no momento da conciliação
- Gerar aprendizado (IA)

❌ **Proibir:**
- Alterar valores
- Alterar histórico bancário
- PIX de sócio virar receita
- Contas genéricas sem justificativa

---

# 2. FLUXO DE CLASSIFICAÇÃO OBRIGATÓRIA

## 2.1 Ao Clicar em uma Transação

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PAINEL DE CLASSIFICAÇÃO                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔒 DADOS FIXOS (somente leitura)                                   │
│  ├─ Data: 15/01/2025                                                │
│  ├─ Valor: R$ 15.000,00                                             │
│  ├─ Descrição: PIX - PAGAMENTO FORNECEDOR XYZ                       │
│  └─ CNPJ: 12.345.678/0001-99                                        │
│                                                                      │
│  📊 SITUAÇÃO ATUAL                                                  │
│  ├─ Conta: 4.1.1.08 - Outras Despesas Operacionais                  │
│  └─ ⚠️ AVISO: Conta genérica                                        │
│                                                                      │
│  🔄 AÇÃO OBRIGATÓRIA                                                │
│  ○ ✅ Confirmar esta conta                                          │
│  ○ 🔁 Reclassificar para outra conta                                │
│  ○ ✂️ Desmembrar (split)                                            │
│  ○ ➕ Criar nova conta                                               │
│                                                                      │
│  [ Cancelar ]                    [ Confirmar Classificação ]        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.2 Opções de Ação

### A) ✅ Confirmar Conta Atual

Se o usuário concorda com a classificação sugerida:
- Clica em "Confirmar"
- Sistema valida se não é conta genérica sem justificativa
- Sistema registra aprendizado se checkbox marcado
- Transação é conciliada

### B) 🔁 Reclassificar

Se a conta está errada:
- Usuário seleciona nova conta do Plano de Contas
- Sistema mostra sugestões da IA (regras existentes)
- Pode salvar como regra de aprendizado
- Valor NÃO muda, só a conta destino

### C) ✂️ Desmembrar (Split)

Se o valor deve ser dividido:
- Usuário cria múltiplas linhas
- Cada linha com conta + valor + descrição
- Total OBRIGATÓRIO = valor original
- Exemplo:
  ```
  R$ 15.000,00 total
  ├─ R$  6.000,00 → 4.1.2.01 Software
  ├─ R$  5.000,00 → 4.1.3.01 Terceirizados
  └─ R$  4.000,00 → 4.1.4.01 Manutenção
  ```

### D) ➕ Criar Nova Conta

Se a conta não existe no plano:
- Usuário informa código (X.X.X.XX)
- Usuário informa nome
- Seleciona tipo (Despesa/Receita/Ativo/Passivo)
- Sistema valida NBC TG 26 / IFRS 18
- Conta é criada e selecionada automaticamente

---

# 3. VALIDAÇÕES DO DR. CÍCERO

## 3.1 Regras Invioláveis

```javascript
// REGRA 1: PIX de sócio NUNCA vira receita
if (isIncome && account.type === 'REVENUE') {
    if (description.match(/sócio|empréstimo|aporte/i)) {
        return ERROR: "PIX de sócio não pode ser Receita"
    }
}

// REGRA 2: Conta genérica requer justificativa
if (account.code.startsWith('4.1.1.08')) { // Outras Despesas
    if (!justification || justification.length < 10) {
        return ERROR: "Conta genérica requer justificativa"
    }
}

// REGRA 3: Split deve somar igual ao original
if (action === 'split') {
    if (Math.abs(sumLines - originalAmount) > 0.01) {
        return ERROR: "Total do split difere do original"
    }
}
```

## 3.2 Alertas (não bloqueiam)

- ⚠️ Entrada classificada como Despesa (pode ser estorno)
- ⚠️ Saída classificada como Receita (pode ser estorno)
- ⚠️ Conta genérica utilizada (recomenda criar específica)

---

# 4. APRENDIZADO DA IA

## 4.1 Fluxo de Aprendizado

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CICLO DE APRENDIZADO                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Usuário classifica transação                                    │
│     ↓                                                                │
│  2. Marca "Salvar como regra de aprendizado"                        │
│     ↓                                                                │
│  3. Sistema cria regra com:                                         │
│     - Keywords da descrição                                          │
│     - Faixa de valor (opcional)                                      │
│     - Tipo de transação (crédito/débito)                            │
│     - Conta destino                                                  │
│     - confidence_score: 50%                                          │
│     - status: 'learning'                                             │
│     ↓                                                                │
│  4. Próxima transação similar:                                      │
│     - IA sugere a conta                                              │
│     - Usuário confirma ou rejeita                                    │
│     ↓                                                                │
│  5. Sistema atualiza estatísticas:                                  │
│     - times_applied++                                                │
│     - times_approved++ (se confirmou)                                │
│     - times_rejected++ (se rejeitou)                                 │
│     ↓                                                                │
│  6. Recalcula confidence_score:                                     │
│     - score = (approved / applied) * 100                            │
│     ↓                                                                │
│  7. Evolui status:                                                  │
│     - 'learning' → 'semi_auto' (70%+, 3 aprovações)                 │
│     - 'semi_auto' → 'auto' (90%+, 5 aprovações)                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.2 Níveis de Confiança

| Status | Confiança | Aprovações | Comportamento |
|--------|-----------|------------|---------------|
| `learning` | < 70% | < 3 | Sugestão, usuário decide |
| `semi_auto` | 70-90% | 3+ | Pré-seleciona, usuário confirma |
| `auto` | > 90% | 5+ | Classifica automaticamente |

---

# 5. ARQUIVOS CRIADOS

## 5.1 Componentes React

| Arquivo | Descrição |
|---------|-----------|
| `src/components/ClassificationPanel.tsx` | Painel completo de classificação (standalone) |
| `src/components/ClassificationDialog.tsx` | Dialog de classificação (para integração) |
| `src/services/ClassificationService.ts` | Serviço de lógica de negócio |

## 5.2 SQL

| Arquivo | Descrição |
|---------|-----------|
| `sql/migrations/20260130_super_conciliation_v2.sql` | Tabelas e funções RPC |
| `sql/security/HABILITAR_RLS_SUPER_CONCILIATION_V2.sql` | RLS e segurança |

## 5.3 Estrutura de Tabelas

```sql
-- Reclassificações (split)
accounting_reclassifications
├── id UUID PRIMARY KEY
├── tenant_id UUID
├── parent_entry_id UUID (lançamento original)
├── status VARCHAR (draft/pending/approved/rejected/applied)
├── total_amount DECIMAL
├── justification TEXT
├── created_by UUID
├── reviewed_by UUID
└── applied_at TIMESTAMP

-- Linhas de reclassificação
accounting_reclassification_lines
├── id UUID PRIMARY KEY
├── reclassification_id UUID
├── account_id UUID
├── amount DECIMAL
└── description TEXT

-- Regras de classificação
classification_rules
├── id UUID PRIMARY KEY
├── tenant_id UUID
├── rule_name VARCHAR
├── description_keywords TEXT[]
├── amount_min/max DECIMAL
├── payer_name_like TEXT
├── cnpj_cpf VARCHAR
├── transaction_type VARCHAR
├── destination_account_id UUID
├── confidence_score DECIMAL (0-100)
├── status VARCHAR (learning/semi_auto/auto/disabled)
└── times_applied/approved/rejected INTEGER

-- Histórico de aplicações
classification_rule_applications
├── id UUID PRIMARY KEY
├── rule_id UUID
├── bank_transaction_id UUID
├── was_approved BOOLEAN
├── entry_id UUID
└── rejection_reason TEXT
```

---

# 6. COMO USAR

## 6.1 Passo a Passo para Desenvolvedores

### 1. Executar a Migration

```bash
# No Supabase SQL Editor
# Copiar e executar: sql/migrations/20260130_super_conciliation_v2.sql
```

### 2. Aplicar RLS

```bash
# Copiar e executar: sql/security/HABILITAR_RLS_SUPER_CONCILIATION_V2.sql
```

### 3. Integrar o Dialog

```tsx
import { ClassificationDialog } from '@/components/ClassificationDialog';

// No SuperConciliation.tsx
const [classificationOpen, setClassificationOpen] = useState(false);

// Ao clicar em uma transação
<ClassificationDialog
  open={classificationOpen}
  onOpenChange={setClassificationOpen}
  transaction={selectedTx}
  suggestedAccount={suggestedAccount}
  onClassificationComplete={(result) => {
    // Processar resultado
    if (result.action === 'split') {
      // Criar lançamentos do split
    } else {
      // Classificar na conta selecionada
    }
  }}
/>
```

## 6.2 Funções RPC Disponíveis

```sql
-- Buscar regras que correspondem à transação
SELECT * FROM rpc_find_matching_rule(
    p_tenant_id := 'uuid',
    p_amount := 5000.00,
    p_description := 'PIX PAGAMENTO FORNECEDOR',
    p_transaction_type := 'debit'
);

-- Criar reclassificação (split)
SELECT * FROM rpc_create_reclassification(
    p_tenant_id := 'uuid',
    p_parent_entry_id := 'uuid',
    p_lines := '[{"account_id":"uuid","amount":3000,"description":"Software"}]'::JSONB,
    p_justification := 'Desmembramento para melhor controle gerencial',
    p_created_by := 'uuid'
);

-- Aprovar reclassificação
SELECT * FROM rpc_approve_reclassification(
    p_reclassification_id := 'uuid',
    p_reviewed_by := 'uuid',
    p_review_notes := 'Aprovado conforme política'
);

-- Criar nova regra de aprendizado
SELECT * FROM rpc_create_classification_rule(
    p_tenant_id := 'uuid',
    p_rule_name := 'Regra: Software',
    p_destination_account_id := 'uuid',
    p_created_by := 'uuid',
    p_description_keywords := ARRAY['software', 'licenca', 'saas'],
    p_transaction_type := 'debit'
);
```

---

# 7. BENEFÍCIOS

## 7.1 Para o Usuário

- Deixa de ser passivo, participa ativamente
- Pode corrigir erros no momento
- Cria contas quando necessário
- Ensina o sistema para o futuro

## 7.2 Para o Contador (Dr. Cícero)

- Supervisão clara das reclassificações
- Trilha de auditoria completa
- Justificativas documentadas
- Controle sobre regras automáticas

## 7.3 Para a IA

- Aprende com cada classificação
- Evolui confiança ao longo do tempo
- Melhora sugestões automaticamente
- Reduz trabalho repetitivo

## 7.4 Para os Relatórios

- DRE mais precisa (menos "Outras Despesas")
- Balancete gerencial detalhado
- Rastreabilidade total
- Compliance aprimorado

---

# 8. CONCLUSÃO

Esta implementação transforma o Contta Financeiro em um sistema:

| Característica | Antes | Depois |
|----------------|-------|--------|
| Classificação | Passiva | Ativa e obrigatória |
| Contas genéricas | Aceitas livremente | Requerem justificativa |
| Criação de contas | Só em tela separada | No momento da conciliação |
| Aprendizado | Manual | Automático com IA |
| Split | Não existia | Integrado com auditoria |
| Reclassificação | Altera lançamento | Cria trilha de auditoria |

---

**Documento elaborado por:**  
**Dr. Cícero**  
Contador Responsável - Ampla Contabilidade  
CRC-GO 000000/O-0

**Data:** 31/01/2026  
**Versão:** 2.0
