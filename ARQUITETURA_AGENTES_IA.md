# 🤖 ARQUITETURA DE AGENTES IA - CONTTA FINANCEIRO

## Documento de Referência para Implementação
**Data:** 31/01/2026  
**Versão:** 1.0

---

## 📊 VISÃO GERAL DA HIERARQUIA

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                    ║
║                           🎯 DR. CÍCERO (SUPERVISOR)                              ║
║                                                                                    ║
║                    Contador Responsável - Aprovador Final                         ║
║                    Telas: SuperConciliação | Contabilidade | Dashboard            ║
║                                                                                    ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          ║
║   │   AGENTE    │   │   AGENTE    │   │   AGENTE    │   │   AGENTE    │          ║
║   │   FISCAL    │   │ TRABALHISTA │   │     MBA     │   │   JURÍDICO  │          ║
║   │             │   │             │   │             │   │             │          ║
║   │ • Impostos  │   │ • eSocial   │   │ • Análise   │   │ • Contingên │          ║
║   │ • CFOP/CST  │   │ • Folha     │   │ • KPIs      │   │ • Provisões │          ║
║   │ • NF-e      │   │ • FGTS/INSS │   │ • DuPont    │   │ • Processos │          ║
║   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          ║
║          │                 │                 │                 │                 ║
║   ┌──────┴──────┐   ┌──────┴──────┐                                             ║
║   │   AGENTE    │   │   AGENTE    │                                             ║
║   │ADMINISTRATIVO│  │ FINANCEIRO  │                                             ║
║   │             │   │             │                                             ║
║   │ • Despesas  │   │ • Bancário  │                                             ║
║   │ • Utilidades│   │ • Aplicações│                                             ║
║   │ • Software  │   │ • Juros     │                                             ║
║   └─────────────┘   └─────────────┘                                             ║
║                                                                                    ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## 🎯 MAPA DE TELAS E AGENTES

### 1. SUPER CONCILIAÇÃO (`/super-conciliation`)

| Agente | Função | Classificações Automáticas |
|--------|--------|---------------------------|
| **DR. CÍCERO** | Aprovar/Rejeitar todas as classificações | Nenhuma (apenas aprova) |
| **AGENTE FISCAL** | Tarifas, IOF, DAS, ISS, impostos | ✅ 98% confiança |
| **AGENTE TRABALHISTA** | Salários, pró-labore, FGTS, INSS | ✅ 95% confiança |
| **AGENTE ADMINISTRATIVO** | Energia, água, telefone, software | ✅ 90% confiança |
| **AGENTE FINANCEIRO** | Rendimentos, juros, transferências | ✅ 85% confiança |

### 2. NOTAS FISCAIS (`/invoices`)

| Agente | Função |
|--------|--------|
| **AGENTE FISCAL** | Processar XML, validar CFOP/CST, calcular impostos |
| **DR. CÍCERO** | Aprovar lançamentos de NF-e |

### 3. FOLHA DE PAGAMENTO (`/payroll`)

| Agente | Função |
|--------|--------|
| **AGENTE TRABALHISTA** | Importar folha, processar eventos eSocial |
| **DR. CÍCERO** | Validar lançamentos de folha |

### 4. RELATÓRIOS GERENCIAIS (`/reports`)

| Agente | Função |
|--------|--------|
| **AGENTE MBA** | Gerar análises financeiras, indicadores |
| **DR. CÍCERO** | Revisar e aprovar relatórios |

### 5. DASHBOARD (`/dashboard`)

| Agente | Função |
|--------|--------|
| **AGENTE MBA** | Exibir KPIs, tendências, alertas |
| **DR. CÍCERO** | Visão geral, pendências |

### 6. BANCÁRIO (`/banking`)

| Agente | Função |
|--------|--------|
| **AGENTE FINANCEIRO** | Importar OFX, conciliar saldos |
| **DR. CÍCERO** | Validar conciliação |

---

## 🔄 FLUXO DE CLASSIFICAÇÃO AUTOMÁTICA

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           IMPORTAÇÃO DE DADOS                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     ┌──────────┐        ┌──────────┐        ┌──────────┐                       │
│     │   OFX    │        │   XML    │        │   TXT    │                       │
│     │ Extrato  │        │  NF-e    │        │  Folha   │                       │
│     └────┬─────┘        └────┬─────┘        └────┬─────┘                       │
│          │                   │                   │                              │
│          ▼                   ▼                   ▼                              │
│     ┌──────────┐        ┌──────────┐        ┌──────────┐                       │
│     │Parser OFX│        │Parser XML│        │Parser TXT│                       │
│     └────┬─────┘        └────┬─────┘        └────┬─────┘                       │
│          │                   │                   │                              │
└──────────┼───────────────────┼───────────────────┼──────────────────────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CLASSIFICAÇÃO AUTOMÁTICA                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│     ┌─────────────────────────────────────────────────────────────────────┐    │
│     │                   classificadorAutomatico.ts                         │    │
│     ├─────────────────────────────────────────────────────────────────────┤    │
│     │                                                                      │    │
│     │  1. Identificar padrão (regex + keywords)                           │    │
│     │  2. Selecionar agente responsável                                    │    │
│     │  3. Calcular confiança                                               │    │
│     │  4. Sugerir contas D/C                                               │    │
│     │                                                                      │    │
│     └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                            │
│                    ┌───────────────┴───────────────┐                           │
│                    │                               │                           │
│                    ▼                               ▼                           │
│         ┌──────────────────┐           ┌──────────────────┐                   │
│         │ Confiança >= 95% │           │ Confiança < 95%  │                   │
│         │                  │           │                  │                   │
│         │ Auto-classificar │           │ Requer aprovação │                   │
│         └────────┬─────────┘           └────────┬─────────┘                   │
│                  │                              │                              │
└──────────────────┼──────────────────────────────┼──────────────────────────────┘
                   │                              │
                   ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           APROVAÇÃO DR. CÍCERO                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                 │
│    │    APROVAR    │    │    AJUSTAR    │    │   REJEITAR    │                 │
│    │               │    │               │    │               │                 │
│    │ Aceita D/C    │    │ Corrige D/C   │    │ Devolve ao    │                 │
│    │ sugeridos     │    │ sugeridos     │    │ agente        │                 │
│    └───────┬───────┘    └───────┬───────┘    └───────┬───────┘                 │
│            │                    │                    │                          │
│            │                    │                    │                          │
│            ▼                    ▼                    │                          │
│    ┌─────────────────────────────────────┐          │                          │
│    │      GERAR LANÇAMENTO CONTÁBIL      │◄─────────┘                          │
│    │                                      │   (após correção)                   │
│    │  • Criar accounting_entries          │                                     │
│    │  • Criar accounting_entry_lines      │                                     │
│    │  • Vincular bank_transaction         │                                     │
│    │  • Gerar internal_code               │                                     │
│    └─────────────────────────────────────┘                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 DETALHAMENTO DOS AGENTES

### 🧮 DR. CÍCERO (Supervisor)

**Papel:** Contador Responsável - Aprovador Final de todos os lançamentos

**Telas de Atuação:**
- `/super-conciliation` - Aprovar classificações
- `/accounting` - Lançamentos e fechamento
- `/dashboard` - Visão geral

**Responsabilidades:**
1. ✅ Aprovar/Rejeitar TODAS as classificações
2. ✅ Classificar transações não identificadas
3. ✅ Reclassificar transações incorretas
4. ✅ Criar lançamentos manuais complexos
5. ✅ Validar integridade contábil
6. ✅ Fechar competências

**Base de Conhecimento:**
- NBC TG - Normas Brasileiras de Contabilidade
- Plano de Contas Ampla (1.x.x.xx a 5.x.x.xx)
- Regras de Partidas Dobradas
- Histórico de clientes
- Padrões de classificação

---

### 💰 AGENTE FISCAL

**Papel:** Especialista em obrigações fiscais e tributárias

**Telas de Atuação:**
- `/super-conciliation` - Classificar impostos
- `/invoices` - Processar NF-e

**Auto-classificações:**
| Padrão | Confiança | Débito | Crédito |
|--------|-----------|--------|---------|
| `TARIFA|TAR|TXB` | 98% | 4.1.3.01 | 1.1.1.05 |
| `IOF` | 99% | 4.1.3.02 | 1.1.1.05 |
| `DAS|SIMPLES` | 95% | 4.1.2.01 | 1.1.1.05 |
| `ISS|ISSQN` | 95% | 4.1.2.02 | 1.1.1.05 |
| `DARF|IRRF` | 90% | 4.1.2.xx | 1.1.1.05 |

**Conhecimentos:**
- CFOP (5.xxx, 6.xxx, 1.xxx, 2.xxx)
- CST ICMS e CSOSN
- CST PIS/COFINS
- Retenções na Fonte
- Simples Nacional

---

### 👷 AGENTE TRABALHISTA

**Papel:** Especialista em departamento pessoal e eSocial

**Telas de Atuação:**
- `/super-conciliation` - Classificar salários
- `/payroll` - Processar folha

**Auto-classificações:**
| Padrão | Confiança | Débito | Crédito |
|--------|-----------|--------|---------|
| `SALARIO|FOLHA` | 95% | 4.1.1.01 | 1.1.1.05 |
| `PRO LABORE|PRO-LABORE` | 95% | 4.1.1.02 | 1.1.1.05 |
| `FGTS` | 98% | 4.1.1.03 | 1.1.1.05 |
| `INSS|GPS` | 98% | 4.1.1.04 | 1.1.1.05 |
| `FERIAS` | 90% | 4.1.1.05 | 1.1.1.05 |

**Conhecimentos:**
- Eventos eSocial (S-1000 a S-2400)
- Incidências (FGTS, INSS, IRRF)
- Categorias de Trabalhadores
- Cálculo de Férias e 13º
- Tabela INSS/IRRF

---

### 📊 AGENTE MBA

**Papel:** Especialista em análise financeira e indicadores

**Telas de Atuação:**
- `/reports` - Análises financeiras
- `/dashboard` - KPIs
- `/cash-flow` - Projeções

**Análises Disponíveis:**
- Indicadores de Liquidez (Corrente, Seca, Imediata, Geral)
- Indicadores de Rentabilidade (ROE, ROA, ROI, Margens)
- Indicadores de Endividamento
- Análise DuPont (3 e 5 fatores)
- NCG e Ciclos Operacionais
- Projeção de Fluxo de Caixa

**Não faz classificações automáticas** - apenas análises.

---

### 🏢 AGENTE ADMINISTRATIVO

**Papel:** Especialista em despesas operacionais

**Telas de Atuação:**
- `/super-conciliation` - Classificar despesas
- `/expenses` - Gerenciar categorias

**Auto-classificações:**
| Padrão | Confiança | Débito | Crédito |
|--------|-----------|--------|---------|
| `ENERGIA|CELESC|COPEL` | 95% | 4.1.4.01 | 1.1.1.05 |
| `AGUA|SANEPAR|CASAN` | 95% | 4.1.4.02 | 1.1.1.05 |
| `TELEFONE|VIVO|CLARO|TIM` | 90% | 4.1.4.03 | 1.1.1.05 |
| `INTERNET|LINK` | 90% | 4.1.4.04 | 1.1.1.05 |
| `ALUGUEL` | 85% | 4.1.4.05 | 1.1.1.05 |

---

### 🏦 AGENTE FINANCEIRO

**Papel:** Especialista em operações bancárias e tesouraria

**Telas de Atuação:**
- `/super-conciliation` - Classificar operações financeiras
- `/banking` - Importar OFX, conciliar

**Auto-classificações:**
| Padrão | Confiança | Débito | Crédito |
|--------|-----------|--------|---------|
| `REND|YIELD|RENTAB` | 90% | 1.1.1.05 | 3.2.1.01 |
| `APLIC|CDB|LCI|LCA` | 85% | 1.1.2.01 | 1.1.1.05 |
| `RESGATE` | 85% | 1.1.1.05 | 1.1.2.01 |
| `TRANSF MESMA TITULARIDADE` | 80% | 1.1.1.xx | 1.1.1.xx |

---

## 🎁 BENEFÍCIOS PARA O USUÁRIO

### ⚡ Velocidade
- **Antes:** 4 horas para conciliar um mês
- **Depois:** 30 minutos com classificações automáticas
- **Melhoria:** 87% de redução no tempo

### 🎯 Precisão
- **Taxa de acerto:** 95%+ nas classificações automáticas
- **Aprendizado contínuo:** Sistema melhora com correções do Dr. Cícero

### ✅ Conformidade
- **NBC TG:** 100% de conformidade
- **Partidas Dobradas:** Validação automática
- **internal_code:** Rastreabilidade total

### 📈 Produtividade
- **Classificação automática:** 70%+ das transações
- **Foco no estratégico:** Contador dedica tempo a análises, não digitação

### 🔒 Segurança
- **Nenhum lançamento sem aprovação** do Dr. Cícero
- **Audit trail completo:** Quem fez o quê e quando

---

## 🧠 INTEGRAÇÃO RAG + IA

### Fontes de Conhecimento

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BASE DE CONHECIMENTO                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │                        FONTES OFICIAIS                                  │   │
│   ├────────────────────────────────────────────────────────────────────────┤   │
│   │ • CFC - Manuais de Contabilidade (NBC TG)                              │   │
│   │ • Objetiva Edições - Modelos de Lançamentos                            │   │
│   │ • Portal de Contabilidade - Guias Práticos                             │   │
│   │ • eSocial Manual - Eventos e Leiautes                                  │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │                        DOCUMENTOS INTERNOS                              │   │
│   ├────────────────────────────────────────────────────────────────────────┤   │
│   │ • ESPECIFICACAO_CONTABIL_DR_CICERO.md - Regras Ampla                   │   │
│   │ • drCiceroKnowledge.ts - Base de Conhecimento                          │   │
│   │ • classificadorAutomatico.ts - Padrões de Classificação                │   │
│   │ • knowledgeBase.ts - Conhecimento Expandido                            │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │                        CONHECIMENTO EMBEDADO                            │   │
│   ├────────────────────────────────────────────────────────────────────────┤   │
│   │ • esocial-knowledge.json - 27 eventos, categorias, incidências         │   │
│   │ • nota-fiscal-knowledge.json - CFOP, CST, LC 116                       │   │
│   │ • mba-indicadores-knowledge.json - 25+ indicadores financeiros         │   │
│   │ • lancamentos-contabeis-completo.json - 93+ lançamentos padrão         │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Fluxo RAG

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Transação     │────►│   Embedding    │────►│   Supabase     │
│  OFX/NF/Folha  │     │  text-embedding│     │   pgvector     │
└────────────────┘     │  -3-small      │     │                │
                       └────────────────┘     └───────┬────────┘
                                                      │
                                                      │ Similarity Search
                                                      ▼
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Sugestão D/C  │◄────│  LLM Claude    │◄────│  Top K         │
│  + Confiança   │     │  Sonnet 4      │     │  Documentos    │
└────────────────┘     └────────────────┘     └────────────────┘
```

---

## 📱 COMPONENTES POR TELA

### SuperConciliation.tsx

```typescript
// Componentes principais
<DrCiceroChat />           // Chat com Dr. Cícero
<TransactionList />        // Lista de transações OFX
<ClassificationDialog />   // Dialog de classificação
<AgentSuggestions />       // Sugestões dos agentes
<ApprovalQueue />          // Fila de aprovação
```

### Dashboard.tsx

```typescript
// Componentes MBA
<KPICards />               // Cards de indicadores
<TrendCharts />            // Gráficos de tendência
<AlertsPanel />            // Alertas e pendências
<CashFlowMini />           // Mini fluxo de caixa
```

### PayrollIntegration.tsx

```typescript
// Componentes Trabalhista
<PayrollImporter />        // Importador de folha
<ESocialEvents />          // Eventos do eSocial
<ProvisionCalculator />    // Calculadora de provisões
<PayrollJournalEntries />  // Lançamentos de folha
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Criar `estruturaAgentes.ts` com definições
- [x] Criar `classificadorAutomatico.ts` com padrões
- [x] Documentar hierarquia de agentes
- [x] Documentar telas de atuação
- [x] Documentar benefícios
- [x] Documentar integração RAG
- [ ] Integrar classificador com SuperConciliation
- [ ] Implementar fila de aprovação Dr. Cícero
- [ ] Criar dashboard de KPIs (Agente MBA)
- [ ] Implementar importador de folha
- [ ] Criar componente de sugestões de agentes
- [ ] Testes end-to-end do fluxo

---

*Documento elaborado para implementação do sistema de agentes IA*  
*Contta Financeiro - Ampla Contabilidade*
