# 🤖 MATRIZ DE RESPONSABILIDADE DOS AGENTES IA

## Governança de Inteligência Artificial - Contta Financeiro
**Versão:** 1.0  
**Data:** 31/01/2026  
**Autoridade:** Dr. Cícero (RAG Master)

---

# 1. HIERARQUIA DOS AGENTES

```
                    ┌─────────────────────────────────────┐
                    │         🎓 DR. CÍCERO               │
                    │         (RAG MASTER)                │
                    │                                     │
                    │  Autoridade máxima do sistema       │
                    │  Aprovação final de todas as ações  │
                    │  Guardião das normas contábeis      │
                    └─────────────────┬───────────────────┘
                                      │
                                      │ Supervisiona
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│  💰 AGENTE        │      │  📒 AGENTE        │      │  🔍 AGENTE        │
│  FINANCEIRO       │      │  CONTÁBIL         │      │  AUDITORIA        │
│                   │      │                   │      │                   │
│  Classificação    │      │  Validação        │      │  Verificação      │
│  Identificação    │      │  Lançamentos      │      │  Fechamento       │
│  Cobrança         │      │  Demonstrativos   │      │  Compliance       │
└─────────┬─────────┘      └─────────┬─────────┘      └─────────┬─────────┘
          │                          │                          │
          │                          │                          │
          ▼                          ▼                          ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│  🏷️ Classificador │      │  📊 Gerador       │      │  ⚠️ Detector      │
│     de Despesas   │      │    de Relatórios  │      │    de Anomalias   │
│                   │      │                   │      │                   │
│  🔎 Identificador │      │  ✅ Validador     │      │  📋 Verificador   │
│     de Pagadores  │      │    de Partidas    │      │    de Integridade │
│                   │      │                   │      │                   │
│  💳 Reconciliador │      │  📈 Analisador    │      │  🔒 Guardião      │
│     Bancário      │      │    DRE/BP         │      │    de Períodos    │
└───────────────────┘      └───────────────────┘      └───────────────────┘
```

---

# 2. DESCRIÇÃO DOS AGENTES

## 2.1 🎓 Dr. Cícero (RAG Master)

**Edge Function:** `dr-cicero-brain`

**Papel:** Contador virtual com 35 anos de experiência, autoridade máxima em decisões contábeis.

**Características:**
- Conhecimento completo das NBCs (Normas Brasileiras de Contabilidade)
- Contexto específico da Ampla Contabilidade
- Capacidade de aprendizado contínuo (RAG)
- Integração com múltiplos LLMs (Claude, OpenAI, Gemini)

**Poderes:**
| Ação | Pode Executar? | Condição |
|------|----------------|----------|
| Aprovar classificações | ✅ Sim | Sempre |
| Rejeitar classificações | ✅ Sim | Sempre |
| Sugerir lançamentos | ✅ Sim | Sempre |
| Criar lançamentos | ⚠️ Parcial | Apenas via workflow aprovado |
| Fechar períodos | ✅ Sim | Após validação completa |
| Estornar lançamentos | ✅ Sim | Com justificativa |
| Reabrir períodos | ✅ Sim | Casos excepcionais |

**Limitações:**
- Nunca executa ação destrutiva sem confirmação
- Sempre documenta justificativa
- Pede esclarecimento quando incerto

## 2.2 💰 Agente Financeiro

**Edge Functions:**
- `mcp-financeiro-chat`
- `ai-financial-analyst`
- `ai-expense-classifier`
- `ai-payer-identifier`

**Papel:** Assistente do departamento financeiro para operações do dia a dia.

**Capacidades:**
| Função | Descrição | Autonomia |
|--------|-----------|-----------|
| Classificar transações | Sugere conta contábil baseado em padrões | Sugere |
| Identificar pagadores | Extrai CNPJ/CPF e vincula a clientes | Sugere |
| Analisar fluxo de caixa | Projeções baseadas em histórico | Executa |
| Detectar inadimplência | Alerta sobre atrasos | Alerta |
| Sugerir cobranças | Prioriza clientes para contato | Sugere |

**Subordinação:**
```
Agente Financeiro → Dr. Cícero (para aprovações)
                  → Agente Contábil (para lançamentos)
```

## 2.3 📒 Agente Contábil

**Edge Functions:**
- `ai-accountant-agent`
- `ai-accountant-background`

**Papel:** Validador de lançamentos e gerador de demonstrativos.

**Capacidades:**
| Função | Descrição | Autonomia |
|--------|-----------|-----------|
| Validar partidas dobradas | Verifica D = C | Executa |
| Gerar balancete | Compila saldos | Executa |
| Gerar DRE | Calcula resultado | Executa |
| Verificar transitórias | Alerta se ≠ 0 | Alerta |
| Sugerir ajustes | Propõe correções | Sugere |

**Subordinação:**
```
Agente Contábil → Dr. Cícero (para ajustes)
               → Agente Auditoria (para validação)
```

## 2.4 🔍 Agente Auditoria

**Edge Functions:**
- `mcp-guardiao`
- Funções de validação em background

**Papel:** Guardião da integridade e compliance do sistema.

**Capacidades:**
| Função | Descrição | Autonomia |
|--------|-----------|-----------|
| Verificar integridade | Soma débitos = créditos | Executa |
| Detectar anomalias | Padrões suspeitos | Alerta |
| Validar fechamento | Checklist completo | Bloqueia/Libera |
| Gerar relatórios de auditoria | Inconsistências | Executa |
| Verificar compliance NBC | Conformidade | Alerta |

**Subordinação:**
```
Agente Auditoria → Dr. Cícero (para fechamento final)
```

---

# 3. MATRIZ DE RESPONSABILIDADES (RACI)

## 3.1 Legenda RACI

| Letra | Significado | Descrição |
|-------|-------------|-----------|
| **R** | Responsible | Executa a tarefa |
| **A** | Accountable | Aprova/Autoriza |
| **C** | Consulted | Consultado antes |
| **I** | Informed | Informado depois |

## 3.2 Matriz de Operações

| Operação | Dr. Cícero | Ag. Financeiro | Ag. Contábil | Ag. Auditoria | Usuário |
|----------|------------|----------------|--------------|---------------|---------|
| Importar OFX | I | C | I | I | **R** |
| Classificar transação simples | A | **R** | C | I | C |
| Classificar transação complexa | **R**/A | C | C | C | I |
| Split de recebimento | A | **R** | C | C | I |
| Criar lançamento manual | A | I | **R** | C | I |
| Validar lançamento | C | I | **R** | C | I |
| Aprovar lançamento | **R**/A | I | I | C | I |
| Gerar demonstrativo | I | I | **R** | C | I |
| Detectar anomalia | I | I | C | **R** | I |
| Fechar período | **R**/A | I | C | **R** | I |
| Reabrir período | **R**/A | I | I | C | I |
| Estornar lançamento | **R**/A | I | C | C | I |

## 3.3 Matriz de Dados

| Dado | Quem Cria | Quem Lê | Quem Atualiza | Quem Deleta |
|------|-----------|---------|---------------|-------------|
| bank_transactions | Sistema (OFX) | Todos | Ag. Financeiro | Nunca |
| accounting_entries | Ag. Contábil | Todos | Dr. Cícero | Nunca (estorno) |
| accounting_entry_lines | Ag. Contábil | Todos | Dr. Cícero | Nunca (estorno) |
| classification_rules | Ag. Financeiro | Todos | Ag. Financeiro | Dr. Cícero |
| invoices | Sistema | Todos | Ag. Financeiro | Nunca |
| clients | Usuário | Todos | Usuário | Nunca |

---

# 4. FLUXO DE DECISÃO DOS AGENTES

## 4.1 Classificação de Transação

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE CLASSIFICAÇÃO COM IA                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────┐
                    │  Transação Importada  │
                    │  (bank_transactions)  │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  AGENTE FINANCEIRO    │
                    │  Analisa a transação  │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────▼───────┐       ┌───────▼───────┐
            │ Tem regra     │       │ Não tem regra │
            │ automática?   │       │ ou baixa      │
            │ (>80% conf.)  │       │ confiança     │
            └───────┬───────┘       └───────┬───────┘
                    │                       │
                    ▼                       ▼
            ┌───────────────┐       ┌───────────────┐
            │ Aplica regra  │       │ Consulta      │
            │ e sugere ao   │       │ DR. CÍCERO    │
            │ usuário       │       └───────┬───────┘
            └───────┬───────┘               │
                    │               ┌───────┴───────┐
                    │               │               │
                    │       ┌───────▼───────┐ ┌─────▼───────┐
                    │       │ Dr. Cícero    │ │ Dr. Cícero  │
                    │       │ sugere        │ │ pede mais   │
                    │       │ classificação │ │ informação  │
                    │       └───────┬───────┘ └─────────────┘
                    │               │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────────────┐
                    │  Usuário confirma ou  │
                    │  ajusta a sugestão    │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  AGENTE CONTÁBIL      │
                    │  Valida e lança       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Transação            │
                    │  Classificada ✓       │
                    └───────────────────────┘
```

## 4.2 Fechamento de Período

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE FECHAMENTO MENSAL                                │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────────┐
    │  Usuário solicita     │
    │  fechamento           │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │  AGENTE AUDITORIA     │
    │  Executa checklist    │
    └───────────┬───────────┘
                │
    ┌───────────┴───────────────────────────────────────┐
    │                                                    │
    │  □ Transitórias = 0?                              │
    │  □ Banco contábil = extrato?                      │
    │  □ Partidas dobradas OK?                          │
    │  □ Sem transações pendentes?                      │
    │  □ Provisões lançadas?                            │
    │                                                    │
    └───────────┬───────────────────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
┌───────▼───────┐ ┌─────▼─────────┐
│ Tudo OK       │ │ Problemas     │
│               │ │ encontrados   │
└───────┬───────┘ └───────┬───────┘
        │                 │
        ▼                 ▼
┌───────────────┐ ┌───────────────┐
│ Encaminha     │ │ BLOQUEIA      │
│ para          │ │ Retorna lista │
│ DR. CÍCERO    │ │ de pendências │
└───────┬───────┘ └───────────────┘
        │
        ▼
┌───────────────────────┐
│  DR. CÍCERO           │
│  Revisão final        │
└───────────┬───────────┘
        │
┌───────┴───────┐
│               │
▼               ▼
┌───────┐   ┌───────┐
│APROVA │   │REJEITA│
└───┬───┘   └───────┘
    │
    ▼
┌───────────────────────┐
│  PERÍODO FECHADO      │
│  Bloqueado para       │
│  edição               │
└───────────────────────┘
```

---

# 5. REGRAS DE AUTONOMIA

## 5.1 Níveis de Autonomia

| Nível | Descrição | Exemplo |
|-------|-----------|---------|
| **0 - Nenhuma** | Apenas observa | Monitoramento |
| **1 - Sugere** | Propõe ação ao usuário | Classificação |
| **2 - Sugere+** | Propõe com alta confiança | Classificação automática |
| **3 - Executa com aprovação** | Faz se aprovado | Lançamentos |
| **4 - Executa** | Faz automaticamente | Validações |
| **5 - Total** | Controle completo | Apenas Dr. Cícero |

## 5.2 Autonomia por Agente e Contexto

| Agente | Valor < R$100 | R$100-1000 | R$1000-10000 | > R$10000 |
|--------|---------------|------------|--------------|-----------|
| Ag. Financeiro | Nível 2 | Nível 2 | Nível 1 | Nível 1 |
| Ag. Contábil | Nível 3 | Nível 3 | Nível 3 | Nível 3 |
| Ag. Auditoria | Nível 4 | Nível 4 | Nível 4 | Nível 4 |
| Dr. Cícero | Nível 5 | Nível 5 | Nível 5 | Nível 5 |

## 5.3 Regras de Escalonamento

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REGRAS DE ESCALONAMENTO                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. SE confiança < 80%                                                       │
│     → Escalar para Dr. Cícero                                               │
│                                                                              │
│  2. SE valor > R$ 10.000                                                     │
│     → Escalar para Dr. Cícero                                               │
│                                                                              │
│  3. SE envolve conta transitória com saldo                                   │
│     → Escalar para Agente Auditoria                                         │
│                                                                              │
│  4. SE é reclassificação de lançamento aprovado                             │
│     → Escalar para Dr. Cícero                                               │
│                                                                              │
│  5. SE é fechamento de período                                               │
│     → Obrigatório aprovação Dr. Cícero                                      │
│                                                                              │
│  6. SE detectada anomalia de auditoria                                       │
│     → BLOQUEAR e escalar para Dr. Cícero                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 6. APRENDIZADO E EVOLUÇÃO

## 6.1 Como os Agentes Aprendem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CICLO DE APRENDIZADO                                     │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────┐
    │  1. OBSERVAR      │
    │  Transação nova   │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │  2. SUGERIR       │
    │  Classificação    │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │  3. FEEDBACK      │
    │  Usuário aceita,  │
    │  ajusta ou rejeita│
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │  4. APRENDER      │
    │  Atualiza regras  │
    │  classification_  │
    │  rules            │
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────┐
    │  5. APLICAR       │
    │  Na próxima       │
    │  transação similar│
    └───────────────────┘
```

## 6.2 Métricas de Aprendizado

| Métrica | Descrição | Meta |
|---------|-----------|------|
| Taxa de acerto | Sugestões aceitas / Total | > 90% |
| Tempo de classificação | Média de tempo até classificar | < 1 min |
| Escalonamentos | Casos que precisaram do Dr. Cícero | < 10% |
| Regras ativas | Total de regras com status "auto" | Crescente |

## 6.3 Ciclo de Vida das Regras

```
learning → semi_auto → auto → (disabled se obsoleta)
   ▲                              │
   │                              │
   └──────────────────────────────┘
         Se padrão mudar
```

---

# 7. SEGURANÇA E GOVERNANÇA

## 7.1 O que a IA NUNCA faz

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                     PROIBIÇÕES ABSOLUTAS                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ❌ NUNCA deleta dados                                                     ║
║  ❌ NUNCA altera lançamentos de períodos fechados                         ║
║  ❌ NUNCA executa pagamentos                                               ║
║  ❌ NUNCA acessa sistemas externos sem autorização                        ║
║  ❌ NUNCA toma decisão sem justificativa                                  ║
║  ❌ NUNCA viola partidas dobradas                                         ║
║  ❌ NUNCA ignora escalonamento obrigatório                                ║
║  ❌ NUNCA modifica regras de auditoria                                    ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

## 7.2 Auditoria das Ações de IA

Toda ação dos agentes é logada:

```json
{
  "timestamp": "2026-01-31T14:30:00Z",
  "agent": "dr-cicero-brain",
  "action": "approve_classification",
  "input": {
    "transaction_id": "uuid",
    "suggested_account": "1.1.2.01"
  },
  "output": {
    "approved": true,
    "confidence": 0.95,
    "justification": "Pagamento identificado como Cliente X conforme CNPJ"
  },
  "user_confirmation": true,
  "execution_time_ms": 450
}
```

---

# 8. EDGE FUNCTIONS MAPEADAS

## 8.1 Inventário Completo

| Agente | Edge Functions | Descrição |
|--------|---------------|-----------|
| **Dr. Cícero** | `dr-cicero-brain` | Cérebro principal |
| | `dr-cicero-contador` | Versão especializada |
| **Financeiro** | `mcp-financeiro-chat` | Chat interativo |
| | `mcp-financeiro-v2` | Versão atualizada |
| | `ai-expense-classifier` | Classificador de despesas |
| | `ai-payer-identifier` | Identificador de pagadores |
| | `ai-pix-reconciliation` | Conciliação PIX |
| | `smart-reconciliation` | Conciliação inteligente |
| **Contábil** | `ai-accountant-agent` | Agente contábil |
| | `ai-accountant-background` | Processamento em background |
| **Auditoria** | `mcp-guardiao` | Guardião de integridade |
| **Orquestração** | `ai-orchestrator` | Coordena agentes |
| | `ai-agent-orchestrator` | Versão avançada |

---

**Documento aprovado por:**

**Dr. Cícero**  
RAG Master - Autoridade Contábil  
Data: 31/01/2026

---

*A hierarquia e autonomia dos agentes são definidas pelo Dr. Cícero e não podem ser alteradas sem sua aprovação explícita.*
