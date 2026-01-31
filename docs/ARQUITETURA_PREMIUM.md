# 🏗️ ARQUITETURA SISTEMA CONTTA - NÍVEL PREMIUM

## Documento de Arquitetura Completa

**Versão:** 2.0.0  
**Data:** 31/01/2026  
**Autor:** Sistema Contta  
**Aprovado por:** Dr. Cícero - Contador Responsável

---

## 📋 Sumário Executivo

O Contta evoluiu de um ERP contábil tradicional para um **Sistema de Inteligência Financeira AI-First**. Esta documentação descreve a arquitetura completa após a implementação das 3 melhorias premium.

### O que torna o Contta único?

| Característica | ERP Tradicional | Contta |
|----------------|-----------------|--------|
| Classificação | Manual, repetitiva | IA com aprendizado |
| Feedback | Erro genérico | Agente Educador explica o "porquê" |
| Impacto | Descobre depois | Visualiza ANTES de confirmar |
| Documentos | Pasta local | Data Lake com RAG |
| Governança | Auditoria posterior | Dr. Cícero em tempo real |

---

## 1. HIERARQUIA DE AGENTES DE IA

### 1.1 Visão Geral

```
                    ┌──────────────────────┐
                    │     Dr. Cícero       │
                    │   🧠 BRAIN/GUARDIÃO  │
                    │   Autoridade Final   │
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│    Agente     │    │    Agente      │    │    Agente      │
│  Financeiro   │    │   Contábil     │    │    Auditor     │
│      💰       │    │      📊        │    │      🔍        │
└───────┬───────┘    └───────┬────────┘    └───────┬────────┘
        │                    │                     │
   ┌────┼────┐          ┌────┼────┐          ┌────┼────┐
   │    │    │          │    │    │          │    │    │
   ▼    ▼    ▼          ▼    ▼    ▼          ▼    ▼    ▼
 Caixa C/R C/P     Class Recl P.Contas   Banco Trans DRE

                               │
                    ┌──────────┴───────────┐
                    │     Agente           │
                    │    Educador          │
                    │       🎓             │
                    └──────────────────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
                 Explica   Impacto   Treina
```

### 1.2 Responsabilidades por Agente

| Agente | Função | Capabilities | Requer Aprovação |
|--------|--------|--------------|------------------|
| **Dr. Cícero** | Coordenador/Guardião | approve, reject, validate, block | N/A (autoridade final) |
| **Financeiro** | Operações diárias | reconcile, forecast, report | Algumas ações |
| **Contábil** | Classificação | classify, reclassify, split | Reclassificações |
| **Auditor** | Verificações | audit, validate, block | Bloqueios |
| **Educador** | Ensino | explain, suggest | Não |

### 1.3 Fluxo de Decisão

```
Usuário solicita ação
         │
         ▼
┌─────────────────────┐
│ Agente Responsável  │
│ analisa e processa  │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │ Requer      │
    │ aprovação?  │
    └──────┬──────┘
           │
    [SIM]──┴──[NÃO]
      │         │
      ▼         ▼
┌───────────┐  ┌───────────┐
│Dr. Cícero │  │ Executa   │
│ analisa   │  │ direto    │
└─────┬─────┘  └───────────┘
      │
  [Aprova/Rejeita]
      │
      ▼
  Feedback ao usuário
  (via Agente Educador)
```

---

## 2. PAINEL DE IMPACTO CONTÁBIL

### 2.1 Conceito

O usuário vê as **consequências ANTES de confirmar** qualquer classificação.

```
┌─────────────────────────────────────────────────────────────┐
│              IMPACTO DA CLASSIFICAÇÃO                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────┐    ▶    ┌───────────────────┐      │
│  │      ANTES        │         │      DEPOIS       │      │
│  ├───────────────────┤         ├───────────────────┤      │
│  │ Receita: R$ 668k  │         │ Receita: R$ 136k  │ ↓    │
│  │ Despesas: R$ 45k  │         │ Despesas: R$ 60k  │ ↑    │
│  │ Resultado: R$ 623k│         │ Resultado: R$ 76k │ ↓    │
│  └───────────────────┘         └───────────────────┘      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ TRANSITÓRIAS                                         │  │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%        │  │
│  │ Débitos: R$ 90.725 → R$ 0 ✓                         │  │
│  │ Créditos: R$ 0 → R$ 0 ✓                             │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ⚠️ Esta classificação reduz o resultado em R$ 547.000     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `ImpactPreviewPanel` | `src/components/ImpactPreviewPanel.tsx` | UI do painel |
| `useImpactCalculation` | `src/hooks/useImpactCalculation.ts` | Cálculo de impacto |

### 2.3 Métricas Exibidas

- **Receita Líquida**: Antes → Depois
- **Despesas Totais**: Antes → Depois
- **Resultado Líquido**: Antes → Depois (com highlight)
- **Transitórias**: Progresso para zerar
- **Contas Afetadas**: Lista com variações
- **Warnings**: Alertas de impacto significativo

---

## 3. DATA LAKE LOCAL + RAG

### 3.1 Estrutura de Diretórios

```
📁 contta-datalake/
│
├── 📁 banco/
│   ├── 📁 ofx/           # Extratos OFX importados
│   ├── 📁 csv/           # Extratos CSV
│   └── 📁 comprovantes/  # Comprovantes de transferência
│
├── 📁 clientes/
│   ├── 📁 boletos/       # Boletos gerados
│   ├── 📁 comprovantes/  # Comprovantes de pagamento
│   ├── 📁 cadastros/     # Documentos de cadastro
│   └── 📁 nfse/          # Notas fiscais emitidas
│
├── 📁 honorarios/
│   ├── 📁 contratos/     # Contratos de prestação
│   ├── 📁 reajustes/     # Reajustes anuais
│   ├── 📁 excecoes/      # Acordos especiais
│   └── 📁 propostas/     # Propostas comerciais
│
├── 📁 fornecedores/
│   ├── 📁 nfe/           # Notas de entrada
│   ├── 📁 boletos/       # Boletos a pagar
│   └── 📁 comprovantes/  # Comprovantes de pagamento
│
├── 📁 fiscal/
│   ├── 📁 sped/          # Arquivos SPED (10 anos)
│   ├── 📁 guias/         # DARF, GPS, etc.
│   └── 📁 certidoes/     # Certidões negativas
│
├── 📁 folha/
│   ├── 📁 holerites/     # Contracheques
│   ├── 📁 esocial/       # Eventos eSocial
│   ├── 📁 ferias/        # Avisos e recibos
│   └── 📁 rescisoes/     # Rescisões (nunca delete)
│
├── 📁 auditoria/
│   ├── 📁 pareceres/     # Pareceres contábeis
│   ├── 📁 logs/          # Logs do sistema
│   └── 📁 conciliacoes/  # Relatórios de conciliação
│
├── 📁 relatorios/
│   ├── 📁 balancetes/    # Balancetes mensais
│   ├── 📁 dre/           # DREs
│   └── 📁 fluxo-caixa/   # Fluxo de caixa
│
└── 📁 ia/
    ├── 📁 knowledge/     # Base de conhecimento
    ├── 📁 embeddings/    # Vetores para RAG
    └── 📁 feedback/      # Feedback de classificações
```

### 3.2 Política de Retenção

| Categoria | Retenção | Motivo |
|-----------|----------|--------|
| `fiscal/sped` | 10 anos | Legislação fiscal |
| `honorarios/contratos` | 10 anos | Prazo prescricional |
| `folha/rescisoes` | ∞ (nunca) | Trabalhista |
| `auditoria/pareceres` | ∞ (nunca) | Responsabilidade |
| `banco/*` | 6 anos | Padrão fiscal |
| `ia/embeddings` | 1 ano | Regenerável |

### 3.3 Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `DataLakeConfig` | `src/config/dataLakeConfig.ts` | Configuração e estrutura |
| `useDataLake` | `src/hooks/useDataLake.ts` | Upload, busca, indexação |

### 3.4 Fluxo RAG

```
Documento Upload
       │
       ▼
┌──────────────┐    ┌───────────────┐    ┌───────────────┐
│   Extrair    │───▶│    Gerar      │───▶│   Armazenar   │
│    Texto     │    │   Embedding   │    │   Supabase    │
└──────────────┘    └───────────────┘    └───────────────┘

Usuário Pergunta
       │
       ▼
┌──────────────┐    ┌───────────────┐    ┌───────────────┐
│   Embedding  │───▶│    Busca      │───▶│   Contexto    │
│   da Query   │    │   Vetorial    │    │   para LLM    │
└──────────────┘    └───────────────┘    └───────────────┘
```

---

## 4. AGENTE EDUCADOR

### 4.1 Conceito

Transforma erros em oportunidades de aprendizado. O usuário não apenas corrige, **ele aprende**.

### 4.2 Tópicos Pré-definidos

| Tópico | Template Key | Quando Ativar |
|--------|--------------|---------------|
| PIX de sócio não é receita | `pix_socio_nao_receita` | Tentativa de classificar como receita |
| Transitórias devem zerar | `transitorias_devem_zerar` | Saldo pendente no fechamento |
| Reclassificação não altera saldo | `reclassificacao_nao_altera_saldo` | Ao reclassificar |
| Conta define natureza | `conta_define_natureza` | Dúvida sobre débito/crédito |
| Split soma exata | `split_soma_exata` | Ao dividir transação |

### 4.3 Estrutura da Explicação

```typescript
interface Explanation {
  title: string;           // "Por que PIX de sócio NÃO é receita?"
  summary: string;         // Resumo em 1-2 frases
  details: Array<{
    topic: string;         // "Conceito Contábil"
    content: string;       // Explicação detalhada
    importance: 'critical' | 'important' | 'informative';
    icon: string;          // 📚
  }>;
  relatedConcepts: Array<{
    term: string;          // "Capital Social"
    definition: string;    // "Valor investido pelos sócios"
  }>;
  examples: Array<{
    scenario: string;      // Situação
    correct: string;       // Lançamento correto
    incorrect?: string;    // Lançamento errado
    why: string;           // Explicação
  }>;
  level: 'beginner' | 'intermediate' | 'advanced';
}
```

### 4.4 Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `EducatorPanel` | `src/components/EducatorPanel.tsx` | UI do painel educacional |
| `useEducatorExplanation` | `src/hooks/useEducatorExplanation.ts` | Geração de explicações |

---

## 5. NOVA ESTRUTURA DE MENUS

### 5.1 Princípio

> "O usuário não quer menu. Ele quer resolver um problema."

### 5.2 Organização

| Seção | Ícone | Função | Itens |
|-------|-------|--------|-------|
| **OPERAR** | 💰 | Dia a dia | Caixa, C/R, C/P, Super Conciliação |
| **CONTROLAR** | 📑 | Cadastros | Honorários, Contratos, Clientes, Fornecedores |
| **ANALISAR** | 📊 | Relatórios | Dashboard, Fluxo, Inadimplência, Aging |
| **CONTABILIZAR** | 🧮 | Demonstrativos | Balancete, DRE, Balanço, Livros |
| **AUDITAR** | 🔍 | Verificações | Auditoria, Aprovações, Pareceres |
| **IA & AUTOMAÇÃO** | ✨ | Inteligência | Central IA, Treinar, Regras, Educador |
| **CONFIGURAÇÕES** | ⚙️ | Setup | Plano de Contas, Centros, Usuários, Integrações |

### 5.3 Ações Rápidas

| Ação | Atalho | Path |
|------|--------|------|
| Nova Transação | `Ctrl+N` | `/caixa/nova` |
| Importar OFX | `Ctrl+I` | `/super-conciliacao?action=import` |
| Classificar Pendentes | `Ctrl+K` | `/super-conciliacao?filter=pending` |
| Perguntar ao Dr. Cícero | `Ctrl+Space` | `/ia` |

---

## 6. ARQUIVOS CRIADOS

### 6.1 Hooks

| Arquivo | Função | Linhas |
|---------|--------|--------|
| `src/hooks/useImpactCalculation.ts` | Cálculo de impacto ANTES/DEPOIS | ~400 |
| `src/hooks/useDataLake.ts` | Gerenciamento do Data Lake | ~350 |
| `src/hooks/useEducatorExplanation.ts` | Explicações educacionais | ~350 |

### 6.2 Componentes

| Arquivo | Função | Linhas |
|---------|--------|--------|
| `src/components/ImpactPreviewPanel.tsx` | Painel de impacto visual | ~450 |
| `src/components/EducatorPanel.tsx` | Painel do agente educador | ~350 |

### 6.3 Configurações

| Arquivo | Função | Linhas |
|---------|--------|--------|
| `src/config/dataLakeConfig.ts` | Estrutura do Data Lake | ~350 |
| `src/config/agentHierarchy.ts` | Hierarquia de agentes | ~300 |
| `src/config/menuStructure.ts` | Nova estrutura de menus | ~350 |

---

## 7. MÉTRICAS DE SUCESSO

| Métrica | Meta | Como Medir |
|---------|------|------------|
| Transitórias Zeradas | 100% | `saldo_1.1.9.01 + saldo_2.1.9.01 = 0` |
| Classificação IA Correta | > 95% | `feedback_positivo / total_sugestoes` |
| Tempo de Classificação | < 5s | Timestamp `click → confirmed` |
| Aprovações Pendentes | < 24h | SLA de resposta Dr. Cícero |
| Uso do Educador | > 30% | % usuários que abrem explicações |
| Documentos Indexados | > 90% | `indexed / total_files` |

---

## 8. PRÓXIMOS PASSOS

### 8.1 Integração Imediata

1. **Integrar `ImpactPreviewPanel`** no modal de classificação
2. **Adicionar `EducatorPanel`** no sidebar ou como drawer
3. **Implementar upload** para Data Lake na importação OFX
4. **Substituir sidebar** pela nova `menuStructure`

### 8.2 Evolução Futura

1. **Agente de Previsão**: Forecast de fluxo de caixa com ML
2. **Voz do Dr. Cícero**: Text-to-speech para explicações
3. **Mobile App**: Aprovações e consultas pelo celular
4. **API Pública**: Integração com outros sistemas

---

**Documento elaborado por:** Sistema Contta  
**Aprovado por:** Dr. Cícero - Contador Responsável  
**Data:** 31/01/2026  
**Versão:** 2.0.0
