# 🔄 FLUXO DE AUDITORIA AUTOMATIZADA — DR. CÍCERO

**Versão:** 1.0  
**Data:** 30/01/2026  
**Autor:** Sérgio Carneiro Leão (CRC/GO 008074)

---

## 📋 VISÃO GERAL

O sistema de auditoria automatizada do Dr. Cícero foi projetado para garantir
que nenhum fechamento mensal seja realizado sem validação completa dos dados
contábeis.

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║  "Você nunca mais terá DRE inflada, PIX virando receita ou relatórios    ║
║   inconsistentes. O Dr. Cícero garante isso automaticamente."            ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 🏗️ ARQUITETURA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE ENTRADA                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │
│  │ Importação OFX  │   │ Fechamento Mês  │   │ Agendamento     │       │
│  │ (automático)    │   │ (manual)        │   │ (cron)          │       │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘       │
│           │                     │                     │                 │
│           └─────────────────────┼─────────────────────┘                 │
│                                 ▼                                        │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT BUILDER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Coleta automática de:                                                   │
│  ├── Extratos bancários (OFX)                                           │
│  ├── Lançamentos contábeis (accounting_entries + lines)                 │
│  ├── Honorários cadastrados                                             │
│  ├── Transações bancárias (bank_transactions)                           │
│  └── Plano de contas ativo                                              │
│                                                                          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAG ENGINE                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Prompt:  /rag/prompts/dr_cicero_auditoria_mensal.md                    │
│  Context: Dados coletados pelo Context Builder                          │
│  Output:  Relatório estruturado + Parecer                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      DR. CÍCERO (IA)                            │   │
│  │                                                                  │   │
│  │  • Executa testes obrigatórios (A-E)                           │   │
│  │  • Identifica inconsistências                                   │   │
│  │  • Gera checklist técnico                                       │   │
│  │  • Emite parecer fundamentado                                   │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DECISÃO                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                    ┌─────────────────────┐                              │
│                    │   PARECER FINAL     │                              │
│                    └──────────┬──────────┘                              │
│                               │                                          │
│              ┌────────────────┼────────────────┐                        │
│              │                                 │                         │
│              ▼                                 ▼                         │
│     ┌────────────────┐              ┌────────────────┐                  │
│     │  ✅ APPROVED   │              │  ❌ INVALIDATED │                  │
│     └────────┬───────┘              └────────┬───────┘                  │
│              │                                │                          │
│              ▼                                ▼                          │
│     Libera fechamento               Bloqueia fechamento                 │
│     Gera relatórios                 Lista pendências                    │
│     Arquiva docs                    Notifica responsável                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUTURA DE ARQUIVOS

```
/rag
├── prompts/
│   ├── dr_cicero_auditoria_mensal.md    # Prompt principal (RAG permanente)
│   └── dr_cicero_classificacao.md       # Prompt para classificação
│
/reports
├── templates/
│   └── RELATORIO_AUDITORIA_MENSAL.md    # Template do relatório
├── 2025/
│   ├── 01/
│   │   └── AUDITORIA_202501_xxx.md      # Relatório gerado
│   └── ...
│
/src/services/auditoria/
├── DrCiceroAuditService.ts              # Serviço principal
├── ContextBuilder.ts                    # Construtor de contexto
├── ReportGenerator.ts                   # Gerador de relatórios
└── types.ts                             # Tipos TypeScript
│
/docs
└── FLUXO_AUDITORIA_DR_CICERO.md         # Este documento
```

---

## 🔧 IMPLEMENTAÇÃO

### 1. Trigger Automática

O sistema dispara auditoria automaticamente quando:

```typescript
// Após fechar importação do mês
async function onImportFinished(tenantId: string, competencia: Date) {
  const allImported = await checkAllOFXImported(tenantId, competencia);
  
  if (allImported) {
    await scheduleAudit(tenantId, competencia);
  }
}

// Quando usuário solicita fechamento
async function onCloseMonthRequested(tenantId: string, competencia: Date) {
  const auditResult = await executarAuditoriaMensal(tenantId, competencia);
  
  if (auditResult.status === 'INVALIDATED') {
    throw new Error('Fechamento bloqueado: ' + auditResult.parecer);
  }
  
  return proceedWithClosing(tenantId, competencia);
}
```

### 2. Context Builder

```typescript
interface AuditContext {
  // Período
  competencia: Date;
  inicio: Date;
  fim: Date;
  
  // Banco
  transacoesBancarias: BankTransaction[];
  extratos: OFXFile[];
  
  // Contábil
  lancamentos: AccountingEntry[];
  linhas: AccountingEntryLine[];
  planoContas: ChartOfAccounts[];
  
  // Honorários
  honorarios: Honorario[];
  faturas: Invoice[];
  
  // Calculados
  saldoTransitoriaDebitos: number;
  saldoTransitoriaCreditos: number;
  totalDebitos: number;
  totalCreditos: number;
  receitaPeriodo: number;
}
```

### 3. Execução do RAG

```typescript
async function executarAuditoria(context: AuditContext): Promise<AuditResult> {
  // Carregar prompt permanente
  const prompt = await loadPrompt('dr_cicero_auditoria_mensal.md');
  
  // Executar com contexto
  const response = await ragEngine.execute({
    prompt,
    context,
    outputFormat: 'structured'
  });
  
  // Validar e parsear resposta
  return parseAuditResult(response);
}
```

### 4. Persistência

```sql
-- Tabela de resultados de auditoria
CREATE TABLE audit_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  protocolo VARCHAR(50) NOT NULL UNIQUE,
  competencia DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('APPROVED', 'INVALIDATED')),
  resultado JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, competencia)
);

-- Índices
CREATE INDEX idx_audit_results_tenant ON audit_results(tenant_id);
CREATE INDEX idx_audit_results_competencia ON audit_results(competencia);
CREATE INDEX idx_audit_results_status ON audit_results(status);
```

### 5. Interface do Usuário

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 AUDITORIA MENSAL — JANEIRO/2025                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Status: ❌ INVALIDATED                                                  │
│  Protocolo: AUD-202501-XYZ123                                           │
│  Data: 30/01/2026 às 14:32:15                                           │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  📋 TESTES REALIZADOS                                                    │
│                                                                          │
│  ✅ Conciliação Banco × Contábil                                        │
│  ❌ Validação de Receita                                                │
│  ❌ Contas Transitórias                                                 │
│  ❌ Integridade Contábil                                                │
│  ✅ Coerência de Relatórios                                             │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ⚠️ INCONSISTÊNCIAS (3)                                                 │
│                                                                          │
│  1. Receita inflada em R$ 45.920,25                                     │
│  2. Transitória Créditos com saldo R$ 193.084,96                        │
│  3. 106 lançamentos desbalanceados                                      │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  [📄 Download Relatório]  [🔄 Executar Novamente]  [📧 Enviar por Email] │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 DASHBOARD

### Histórico de Auditorias

| Competência | Status | Protocolo | Data | Ações |
|-------------|--------|-----------|------|-------|
| 01/2025 | ❌ | AUD-202501-XYZ | 30/01/26 | 📄 🔄 |
| 12/2024 | ✅ | AUD-202412-ABC | 05/01/26 | 📄 |
| 11/2024 | ✅ | AUD-202411-DEF | 04/12/25 | 📄 |

### Métricas

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Taxa de Aprovação │  │ Tempo Médio      │  │ Inconsistências  │
│                   │  │                   │  │                   │
│     92.3%         │  │     4.2 min       │  │      2.1/mês     │
│                   │  │                   │  │                   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 🔐 SEGURANÇA

### Imutabilidade

- Prompts RAG são versionados e assinados
- Relatórios gerados têm hash de integridade
- Alterações requerem nova versão do prompt

### Auditoria da Auditoria

```sql
-- Log de execuções
CREATE TABLE audit_execution_log (
  id UUID PRIMARY KEY,
  audit_result_id UUID REFERENCES audit_results(id),
  prompt_version VARCHAR(20),
  prompt_hash VARCHAR(64),
  context_hash VARCHAR(64),
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 ROADMAP

### Fase 1 (Atual)
- [x] Prompt RAG do Dr. Cícero
- [x] Template de relatório
- [x] Serviço de auditoria básico
- [ ] Integração com UI

### Fase 2
- [ ] Dashboard de auditorias
- [ ] Notificações automáticas
- [ ] API REST para integração

### Fase 3
- [ ] Machine Learning para classificação
- [ ] Detecção de anomalias
- [ ] Previsão de inconsistências

---

## 📚 REFERÊNCIAS

- [NBC ITG 2000 (R1)](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/nbc-tg-itg/) - Escrituração Contábil
- [NBC TG 1000 (R1)](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/nbc-tg-1000/) - Contabilidade para PMEs
- [ESPECIFICACAO_CONTABIL_DR_CICERO.md](../ESPECIFICACAO_CONTABIL_DR_CICERO.md) - Especificação interna

---

*Documento elaborado por Sérgio Carneiro Leão (CRC/GO 008074)*  
*Sistema Ampla Contabilidade — Dr. Cícero v1.0*
