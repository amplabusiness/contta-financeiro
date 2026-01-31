# 📋 ARQUITETURA: SEPARAÇÃO BANCO × CONTABILIDADE × HONORÁRIOS

## Documento de Implementação - Dr. Cícero
**Data:** 30/01/2026  
**Versão:** 1.0  
**Aprovação:** Pendente Dr. Cícero

---

# 🔴 DIAGNÓSTICO DO PROBLEMA CENTRAL

## O Que Está Acontecendo Hoje

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ❌ FLUXO ATUAL (ERRADO)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PIX ENTRA NO BANCO                                                 │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────┐                                                │
│  │ SISTEMA DECIDE  │ ◄── ERRO FATAL: Banco "decidindo" natureza    │
│  │ AUTOMATICAMENTE │                                                 │
│  │ QUE É RECEITA   │                                                 │
│  └─────────────────┘                                                │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────┐                                                │
│  │ DRE INFLADA     │                                                │
│  │ R$ 600.000,00   │ ◄── Deveria ser ~R$ 136.000,00                 │
│  └─────────────────┘                                                │
│                                                                      │
│  INCLUINDO ERRONEAMENTE:                                            │
│  • Empréstimos de sócios                                            │
│  • Aportes de capital                                               │
│  • Adiantamentos                                                    │
│  • Transferências internas                                          │
│  • Pagamentos de exercícios anteriores                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Princípio Contábil Sendo Violado

| ❌ Regra Atual (ERRADA) | ✅ Regra Correta (NBC) |
|-------------------------|------------------------|
| "Se entrou dinheiro → Receita" | Receita só existe com fato gerador + competência + contrato |
| Banco define natureza | Conta contábil define natureza |
| PIX = Honorário | PIX = Meio de pagamento (neutro) |

---

# 🎯 NOVA ARQUITETURA - 3 CAMADAS SEPARADAS

```
╔═════════════════════════════════════════════════════════════════════╗
║                    ARQUITETURA DE 3 CAMADAS                          ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ CAMADA 1: BANCO (Financeiro)                                  │  ║
║  ├───────────────────────────────────────────────────────────────┤  ║
║  │ • Apenas: Entrada | Saída | Saldo                             │  ║
║  │ • NÃO define: Receita, Despesa, Empréstimo, Honorário        │  ║
║  │ • Tabela: bank_transactions                                   │  ║
║  │ • Contas: 1.1.1.xx (SEMPRE patrimoniais)                     │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                           │                                          ║
║                           │ Contrapartida SEMPRE transitória        ║
║                           ▼                                          ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ CAMADA 2: CONTÁBIL (Natureza)                                 │  ║
║  ├───────────────────────────────────────────────────────────────┤  ║
║  │ • Define natureza pela CONTA escolhida                        │  ║
║  │ • Classificação manual ou assistida por IA                    │  ║
║  │ • Tabelas: accounting_entries + accounting_entry_lines        │  ║
║  │ • Transitórias: 1.1.9.01 (débitos) + 2.1.9.01 (créditos)    │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                           │                                          ║
║                           │ Receita NASCE do cadastro               ║
║                           ▼                                          ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ CAMADA 3: HONORÁRIOS (Competência)                            │  ║
║  ├───────────────────────────────────────────────────────────────┤  ║
║  │ • Receita NASCE EXCLUSIVAMENTE aqui                           │  ║
║  │ • Baseado em: contrato + recorrência + competência            │  ║
║  │ • Tabelas: invoices + clients + fee_configurations            │  ║
║  │ • Contas: D 1.1.2.01 (Cliente) / C 3.1.1.01 (Receita)        │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
╚═════════════════════════════════════════════════════════════════════╝
```

---

# 📜 REGRAS DE OURO (AI-FIRST / INVIOLÁVEIS)

## Regra 1: Banco NUNCA Gera Receita/Despesa

```sql
-- ❌ PROIBIDO (atual)
D Banco / C Receita de Honorários

-- ✅ CORRETO (novo)
D Banco / C Transitória Créditos (2.1.9.01)
-- Depois, classificação:
D Transitória / C [Conta de Origem]
```

## Regra 2: Receita de Honorários Nasce do Cadastro

```
MOMENTO 1 - COMPETÊNCIA (quando o mês "vira"):
┌─────────────────────────────────────────────────────────────┐
│ D - 1.1.2.01.xxx  Clientes a Receber - [Cliente]           │
│ C - 3.1.1.01      Receita de Honorários                    │
│                                                             │
│ Valor = exatamente o cadastro (fee_configurations)         │
│ Data = primeiro dia do mês de competência                  │
└─────────────────────────────────────────────────────────────┘

MOMENTO 2 - RECEBIMENTO (quando o PIX cai):
┌─────────────────────────────────────────────────────────────┐
│ D - 1.1.1.05      Banco Sicredi                            │
│ C - 1.1.2.01.xxx  Clientes a Receber - [Cliente]           │
│                                                             │
│ ✓ NÃO afeta DRE                                            │
│ ✓ Apenas LIQUIDA o direito                                 │
└─────────────────────────────────────────────────────────────┘
```

## Regra 3: PIX de Sócio = PASSIVO (nunca receita)

```sql
-- Empréstimo de sócio
D - 1.1.1.05 Banco Sicredi
C - 2.1.2.03 Empréstimos de Sócios

-- Aporte para futuro aumento de capital
D - 1.1.1.05 Banco Sicredi
C - 2.4.1.01 Adiantamento para Futuro Aumento de Capital
```

## Regra 4: Transitórias DEVEM Zerar

```
VERIFICAÇÃO OBRIGATÓRIA (todo fechamento):

┌─────────────────────────────────────────────────────────────┐
│  1.1.9.01 Transitória Débitos   = R$ 0,00  ✓               │
│  2.1.9.01 Transitória Créditos  = R$ 0,00  ✓               │
│                                                             │
│  Se ≠ 0 → Existem transações NÃO classificadas!            │
└─────────────────────────────────────────────────────────────┘
```

---

# 🖥️ SUPER-CONCILIAÇÃO: TELA PROPOSTA

## 4.1 Funcionalidades Obrigatórias

### A. Reclassificação SEM Alterar Saldo

```
┌─────────────────────────────────────────────────────────────┐
│ LANÇAMENTO ORIGINAL (bloqueado, não editável)              │
│ R$ 15.000,00 - Conta de Despesas                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ RECLASSIFICAÇÕES (filhos):                                 │
│                                                             │
│  ├── R$ 5.000,00  → 4.2.1.01 Energia Elétrica             │
│  ├── R$ 4.000,00  → 4.2.1.02 Internet/Telecom             │
│  └── R$ 6.000,00  → 4.2.1.03 Serviços Terceiros           │
│                                                             │
│  TOTAL: R$ 15.000,00 ✓ (saldo preservado)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### B. Split Contábil Controlado (Estrutura de Dados)

```typescript
interface ReclassificationEntry {
  id: string;
  parent_entry_id: string;      // Lançamento original (imutável)
  child_entries: {
    id: string;
    account_id: string;
    amount: number;
    description: string;
  }[];
  
  // Trilha de auditoria
  audit: {
    created_at: Date;
    created_by: string;         // Usuário que fez
    approved_by?: string;       // Dr. Cícero aprovou
    approved_at?: Date;
    justification: string;
    ai_suggestion_id?: string;  // Se veio de sugestão IA
  };
}
```

### C. Estados da Reclassificação

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  RASCUNHO   │───►│ PENDENTE    │───►│  APROVADO   │
│ (editável)  │    │ APROVAÇÃO   │    │ Dr. Cícero  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       │                  ▼                  ▼
       │           ┌─────────────┐    ┌─────────────┐
       └──────────►│  REJEITADO  │    │  EFETIVADO  │
                   │ (volta p/   │    │ (imutável)  │
                   │  rascunho)  │    └─────────────┘
                   └─────────────┘
```

---

# 🤖 APRENDIZADO ASSISTIDO (IA)

## 5.1 Fluxo de Aprendizado

```
┌─────────────────────────────────────────────────────────────┐
│ CICLO DE APRENDIZADO ASSISTIDO                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. USUÁRIO CLASSIFICA                                      │
│     └── "Este PIX de R$ 15.000 é empréstimo do sócio"      │
│                                                             │
│  2. SISTEMA REGISTRA PADRÃO                                 │
│     └── pattern: "PIX + nome_sócio + valor > 10k"          │
│         → conta: 2.1.2.03 Empréstimos de Sócios            │
│         → confiança: 75%                                    │
│                                                             │
│  3. PRÓXIMO MÊS: SISTEMA SUGERE                            │
│     └── "Detectei padrão similar. Sugestão: Empréstimo"    │
│         [Aplicar] [Revisar] [Rejeitar]                     │
│                                                             │
│  4. DR. CÍCERO VALIDA                                       │
│     └── Se aprovar: confiança sobe para 85%                │
│     └── Se rejeitar: ajusta regra ou remove                │
│                                                             │
│  5. APÓS 3 APROVAÇÕES                                       │
│     └── Regra vira "semi-automática"                       │
│     └── Aplica automaticamente, mas SEMPRE mostra          │
│         na fila de revisão                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 5.2 Estrutura de Dados para Aprendizado

```typescript
interface ClassificationRule {
  id: string;
  tenant_id: string;
  
  // Padrão de identificação
  pattern: {
    description_keywords?: string[];
    amount_range?: { min: number; max: number };
    payer_name_like?: string;
    cnpj_cpf?: string;
    transaction_type: 'credit' | 'debit';
  };
  
  // Classificação sugerida
  suggested_classification: {
    destination_account_id: string;
    destination_account_code: string;
    destination_account_name: string;
  };
  
  // Estatísticas de aprendizado
  stats: {
    times_applied: number;
    times_approved: number;
    times_rejected: number;
    confidence_score: number;  // 0-100%
    last_applied_at: Date;
    last_reviewed_at: Date;
  };
  
  // Controle
  status: 'learning' | 'semi_auto' | 'disabled';
  created_by: string;
  approved_by?: string;
}
```

## 5.3 Níveis de Automação

| Nível | Confiança | Comportamento |
|-------|-----------|---------------|
| **Sugestão** | 0-70% | Mostra na interface, aguarda seleção manual |
| **Semi-Auto** | 71-90% | Aplica automaticamente, envia para fila de revisão |
| **Auto Validado** | 91-100% | Aplica e aprova (somente após validação Dr. Cícero) |

---

# 📊 CORREÇÃO DA DRE

## 6.1 DRE Atual vs. Esperada

```
┌─────────────────────────────────────────────────────────────┐
│                   DRE JANEIRO/2025                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ❌ ATUAL (ERRADA):                                         │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ RECEITA BRUTA ............... R$ 600.000,00 ❌        │ │
│  │ (-) Impostos ................ R$   8.000,00          │ │
│  │ RECEITA LÍQUIDA ............. R$ 592.000,00          │ │
│  │ (-) Despesas ................ R$ 150.000,00          │ │
│  │ RESULTADO ................... R$ 442.000,00 ❌       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ✅ ESPERADA (CORRETA):                                     │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ RECEITA BRUTA ............... R$ 136.000,00 ✅        │ │
│  │ (-) Impostos ................ R$   8.000,00          │ │
│  │ RECEITA LÍQUIDA ............. R$ 128.000,00          │ │
│  │ (-) Despesas ................ R$ 150.000,00          │ │
│  │ RESULTADO ................... R$ (22.000,00) ✅      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  DIFERENÇA: R$ 464.000,00 classificados ERRONEAMENTE       │
│  como Receita (eram empréstimos, aportes, ajustes, etc.)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 6.2 Checklist de Verificação DRE

```
ANTES DE APRESENTAR A DRE, VERIFICAR:

□ 1. Receita = SOMENTE contas 3.x
□ 2. Receita de Honorários = cadastro de fee_configurations
□ 3. Nenhum PIX classificado direto como Receita
□ 4. Empréstimos estão no Passivo (2.x)
□ 5. Transitórias zeradas
□ 6. ∑ Débitos = ∑ Créditos por conta
□ 7. Total honorários ≈ R$ 136.000,00 (Jan/2025)
```

---

# 🔧 IMPLEMENTAÇÃO TÉCNICA

## 7.1 Novas Tabelas Necessárias

```sql
-- Tabela para reclassificações (split contábil)
CREATE TABLE accounting_reclassifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    parent_entry_id UUID NOT NULL REFERENCES accounting_entries(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, pending, approved, rejected, applied
    total_amount DECIMAL(15,2) NOT NULL,
    justification TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    applied_at TIMESTAMP
);

-- Linhas da reclassificação
CREATE TABLE accounting_reclassification_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reclassification_id UUID NOT NULL REFERENCES accounting_reclassifications(id),
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Regras de aprendizado da IA
CREATE TABLE classification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Padrão
    description_keywords TEXT[],
    amount_min DECIMAL(15,2),
    amount_max DECIMAL(15,2),
    payer_name_like TEXT,
    cnpj_cpf VARCHAR(20),
    transaction_type VARCHAR(10), -- credit, debit
    
    -- Classificação sugerida
    destination_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    
    -- Estatísticas
    times_applied INTEGER DEFAULT 0,
    times_approved INTEGER DEFAULT 0,
    times_rejected INTEGER DEFAULT 0,
    confidence_score DECIMAL(5,2) DEFAULT 50.00,
    last_applied_at TIMESTAMP,
    last_reviewed_at TIMESTAMP,
    
    -- Controle
    status VARCHAR(20) DEFAULT 'learning', -- learning, semi_auto, disabled
    created_by UUID,
    approved_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Histórico de aplicação de regras
CREATE TABLE classification_rule_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES classification_rules(id),
    bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id),
    entry_id UUID REFERENCES accounting_entries(id),
    was_approved BOOLEAN,
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 7.2 Funções RPC Necessárias

```sql
-- Criar reclassificação com split
CREATE OR REPLACE FUNCTION rpc_create_reclassification(
    p_tenant_id UUID,
    p_parent_entry_id UUID,
    p_lines JSONB,
    p_justification TEXT,
    p_created_by UUID
) RETURNS JSONB AS $$
DECLARE
    v_reclassification_id UUID;
    v_total DECIMAL(15,2);
    v_parent_amount DECIMAL(15,2);
    v_line JSONB;
BEGIN
    -- Verificar total do lançamento pai
    SELECT COALESCE(SUM(debit), SUM(credit)) INTO v_parent_amount
    FROM accounting_entry_lines
    WHERE entry_id = p_parent_entry_id;
    
    -- Calcular total das linhas
    SELECT SUM((line->>'amount')::DECIMAL) INTO v_total
    FROM jsonb_array_elements(p_lines) AS line;
    
    -- Validar que soma é igual
    IF ABS(v_total - v_parent_amount) > 0.01 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Total (%s) difere do lançamento original (%s)', v_total, v_parent_amount)
        );
    END IF;
    
    -- Criar reclassificação
    INSERT INTO accounting_reclassifications (tenant_id, parent_entry_id, total_amount, justification, created_by)
    VALUES (p_tenant_id, p_parent_entry_id, v_total, p_justification, p_created_by)
    RETURNING id INTO v_reclassification_id;
    
    -- Criar linhas
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO accounting_reclassification_lines (reclassification_id, account_id, amount, description)
        VALUES (
            v_reclassification_id,
            (v_line->>'account_id')::UUID,
            (v_line->>'amount')::DECIMAL,
            v_line->>'description'
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'reclassification_id', v_reclassification_id
    );
END;
$$ LANGUAGE plpgsql;

-- Aplicar sugestão de classificação (IA)
CREATE OR REPLACE FUNCTION rpc_apply_classification_rule(
    p_rule_id UUID,
    p_bank_transaction_id UUID,
    p_approved BOOLEAN,
    p_reviewed_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_rule RECORD;
BEGIN
    -- Buscar regra
    SELECT * INTO v_rule FROM classification_rules WHERE id = p_rule_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Regra não encontrada');
    END IF;
    
    -- Registrar aplicação
    INSERT INTO classification_rule_applications (rule_id, bank_transaction_id, was_approved, reviewed_by, reviewed_at)
    VALUES (p_rule_id, p_bank_transaction_id, p_approved, p_reviewed_by, 
            CASE WHEN p_reviewed_by IS NOT NULL THEN NOW() ELSE NULL END);
    
    -- Atualizar estatísticas da regra
    UPDATE classification_rules
    SET 
        times_applied = times_applied + 1,
        times_approved = times_approved + CASE WHEN p_approved THEN 1 ELSE 0 END,
        times_rejected = times_rejected + CASE WHEN NOT p_approved THEN 1 ELSE 0 END,
        last_applied_at = NOW(),
        last_reviewed_at = CASE WHEN p_reviewed_by IS NOT NULL THEN NOW() ELSE last_reviewed_at END,
        confidence_score = CASE 
            WHEN times_applied > 0 THEN 
                (times_approved::DECIMAL / times_applied * 100)
            ELSE 50 
        END,
        status = CASE
            WHEN confidence_score >= 90 AND times_approved >= 5 THEN 'auto'
            WHEN confidence_score >= 70 AND times_approved >= 3 THEN 'semi_auto'
            ELSE 'learning'
        END
    WHERE id = p_rule_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
```

## 7.3 Alterações no FinancialIntelligenceService.ts

```typescript
// NOVA REGRA: Banco NUNCA gera Receita diretamente
async analyzeBankTransaction(
    amount: number, 
    date: string, 
    description: string,
    bankAccountCode: string = "1.1.1.05"
): Promise<ClassificationSuggestion> {
    
    // REGRA 1: Entrada de dinheiro → SEMPRE transitória primeiro
    if (amount > 0) {
        // Verificar se existe regra de aprendizado
        const rule = await this.findMatchingRule(amount, description, 'credit');
        
        if (rule) {
            return {
                description: `Sugestão IA: ${rule.destination_account_name}`,
                type: "ai_suggestion",
                rule_id: rule.id,
                confidence: rule.confidence_score,
                entries: [{
                    // Lançamento de importação (SEMPRE)
                    debit: { account: bankAccountCode, name: 'Banco' },
                    credit: { account: '2.1.9.01', name: 'Transitória Créditos' },
                    value: amount
                }, {
                    // Lançamento de classificação (sugerido)
                    debit: { account: '2.1.9.01', name: 'Transitória Créditos' },
                    credit: { account: rule.destination_account_code, name: rule.destination_account_name },
                    value: amount
                }],
                reasoning: `Regra aprendida (${rule.confidence_score.toFixed(0)}% confiança)`
            };
        }
        
        // Sem regra: pendente de classificação
        return {
            description: "PENDENTE DE CLASSIFICAÇÃO - Dr. Cícero",
            type: "pending_classification",
            entries: [{
                debit: { account: bankAccountCode, name: 'Banco' },
                credit: { account: '2.1.9.01', name: 'Transitória Créditos' },
                value: amount
            }],
            reasoning: "Entrada sem padrão identificado. Aguardando classificação manual."
        };
    }
    
    // ... código para saídas (amount < 0)
}
```

---

# ✅ RESULTADO ESPERADO

Após implementação:

1. **DRE Jan/2025**: R$ 136.000,00 em Receita (não R$ 600.000)
2. **Transitórias**: Zeradas após fechamento
3. **PIX**: Nunca gera receita automaticamente
4. **Empréstimos**: Classificados no Passivo
5. **Honorários**: Nascem do cadastro, não do banco
6. **Reclassificações**: Trilha de auditoria completa
7. **IA**: Sugere, usuário classifica, Dr. Cícero valida

---

# 📋 PRÓXIMOS PASSOS

| # | Tarefa | Prioridade | Responsável |
|---|--------|------------|-------------|
| 1 | Criar migrations das novas tabelas | Alta | Dev |
| 2 | Implementar tela Super-Conciliação v2 | Alta | Dev |
| 3 | Corrigir FinancialIntelligenceService | Alta | Dev |
| 4 | Migrar lançamentos existentes | Crítica | Dev + Dr. Cícero |
| 5 | Recalcular DRE Jan/2025 | Crítica | Dr. Cícero |
| 6 | Documentar regras de aprendizado | Média | Dev |
| 7 | Testes de regressão | Alta | Dev |

---

**Documento elaborado para aprovação do Dr. Cícero**  
**Aguardando autorização para iniciar implementação**

