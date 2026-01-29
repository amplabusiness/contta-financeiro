# 📋 TAREFAS PENDENTES - CONTTA/AMPLA
## Baseado na Especificação `reoganizacao_28_01_2026.md`

**Data de Criação**: 28/01/2026  
**Última Atualização**: 28/01/2026  
**Responsável**: Claude/IA  

---

## 📊 RESUMO EXECUTIVO

| Fase | Total | Concluído | Pendente | % |
|------|-------|-----------|----------|---|
| Fase 1 - Correção Contábil | 3 | 1 | 2 | 33% |
| Fase 2 - Conciliação Bancária | 2 | 1 | 1 | 50% |
| Fase 3 - Receber/Inadimplência | 5 | 2 | 3 | 40% |
| Fase 4 - Pagar | 3 | 2 | 1 | 67% |
| Fase 5 - SaaS | 3 | 1 | 2 | 33% |
| **TOTAL** | **16** | **7** | **9** | **44%** |

---

## 🔴 FASE 1 - CORREÇÃO CONTÁBIL (CRÍTICO)

### 1.1 Saldo de Abertura
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F1-01 | Criar lançamento tipo ABERTURA em 01/01/2025 | ❌ PENDENTE | 🔴 CRÍTICA | Não existe entry_type='ABERTURA' |
| F1-02 | Lançamento com origem `saldo_inicial` | ❌ PENDENTE | 🔴 CRÍTICA | Campo existe mas não usado formalmente |
| F1-03 | Débito/Crédito por conta analítica | ⚠️ PARCIAL | 🔴 CRÍTICA | Existem entries mas não no formato oficial |
| F1-04 | Incluir client_id no ledger auxiliar | ✅ CONCLUÍDO | 🟢 OK | `client_ledger` implementado |

**Regra da Especificação (Seção 4/6)**:
```
❌ Saldo inicial não é campo solto
❌ Saldo inicial não é cálculo dinâmico
✅ Saldo inicial é lançamento contábil
```

**Script existente**: `scripts/correcao_contabil/33_lancamentos_saldo_abertura.cjs`  
**Ação necessária**: Verificar e executar/ajustar o script

---

### 1.2 Continuidade do Período
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F1-05 | Saldo 31/12/N = Saldo inicial 01/01/N+1 | ⚠️ PARCIAL | 🔴 CRÍTICA | Funciona manual, falta automação |
| F1-06 | Trigger/função para carregar saldos automaticamente | ❌ PENDENTE | 🟡 ALTA | Não existe trigger |
| F1-07 | Contas patrimoniais carregam saldo | ✅ CONCLUÍDO | 🟢 OK | Balancete funciona |
| F1-08 | Contas resultado zeram no encerramento | ⚠️ PARCIAL | 🟡 ALTA | Falta processo de encerramento |

---

### 1.3 Ledger por Cliente
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F1-09 | Tabela client_ledger | ✅ CONCLUÍDO | 🟢 OK | Tabela existe e funciona |
| F1-10 | Saldo por cliente | ✅ CONCLUÍDO | 🟢 OK | Implementado |
| F1-11 | Integração com accounting_entries | ✅ CONCLUÍDO | 🟢 OK | Via AccountingService |

---

## 🟡 FASE 2 - CONCILIAÇÃO BANCÁRIA

### 2.1 OFX / Cora / PIX
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F2-01 | Importação OFX | ✅ CONCLUÍDO | 🟢 OK | Funcionando |
| F2-02 | Classificação automática (IA) | ✅ CONCLUÍDO | 🟢 OK | Dr. Cícero implementado |
| F2-03 | Classificação por regras | ✅ CONCLUÍDO | 🟢 OK | ai_learned_patterns |
| F2-04 | Confirmação gera lançamento | ✅ CONCLUÍDO | 🟢 OK | fn_classificar_transacao_bancaria |

### 2.2 Conta Transitória
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F2-05 | Conta 1.1.9.99 (entradas pendentes) | ✅ CONCLUÍDO | 🟢 OK | Migration aplicada |
| F2-06 | Conta 2.1.9.99 (saídas pendentes) | ✅ CONCLUÍDO | 🟢 OK | Migration aplicada |
| F2-07 | Fluxo de confirmação completo | ⚠️ 85% | 🟡 MÉDIA | Falta 15% - edge cases |
| F2-08 | Transação não some sem classificar | ✅ CONCLUÍDO | 🟢 OK | Vai para transitória |

---

## 🟠 FASE 3 - RECEBER / INADIMPLÊNCIA

### 3.1 Aging
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F3-01 | Faixa 0-30 dias | ✅ CONCLUÍDO | 🟢 OK | Views criadas |
| F3-02 | Faixa 31-60 dias | ✅ CONCLUÍDO | 🟢 OK | Views criadas |
| F3-03 | Faixa 61-90 dias | ✅ CONCLUÍDO | 🟢 OK | Views criadas |
| F3-04 | Faixa +90 dias | ✅ CONCLUÍDO | 🟢 OK | Views criadas |
| F3-05 | Dashboard de inadimplência | ✅ CONCLUÍDO | 🟢 OK | Página existe |

### 3.2 Renegociação e Cobrança
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F3-06 | Histórico de renegociação | ❌ PENDENTE | 🟡 MÉDIA | Tabela não existe |
| F3-07 | Confissão de dívida | ⚠️ PARCIAL | 🟡 MÉDIA | Página existe, falta integração |
| F3-08 | Propostas automáticas | ❌ PENDENTE | 🟡 MÉDIA | IA não sugere renegociação |
| F3-09 | Alertas para equipe | ❌ PENDENTE | 🟢 BAIXA | Sistema de notificações não existe |
| F3-10 | WhatsApp cobrança | ✅ CONCLUÍDO | 🟢 OK | Templates e régua implementados |

---

## 🔵 FASE 4 - PAGAR

### 4.1 Fornecedores
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F4-01 | Cadastro de fornecedores | ✅ CONCLUÍDO | 🟢 OK | Tabela suppliers |
| F4-02 | Ledger por fornecedor | ❌ PENDENTE | 🟡 MÉDIA | supplier_ledger não existe |
| F4-03 | Provisão gera lançamento | ✅ CONCLUÍDO | 🟢 OK | Via AccountingService |
| F4-04 | Pagamento gera lançamento | ✅ CONCLUÍDO | 🟢 OK | Via AccountingService |

### 4.2 Folha e Tributos
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F4-05 | Folha de pagamento | ✅ CONCLUÍDO | 🟢 OK | Rubricas eSocial |
| F4-06 | Rescisão CLT | ✅ CONCLUÍDO | 🟢 OK | 8 tipos implementados |
| F4-07 | Ledger por tributo | ❌ PENDENTE | 🟡 MÉDIA | Não existe estrutura |
| F4-08 | Controle de vencimentos | ✅ CONCLUÍDO | 🟢 OK | accounts_payable |

---

## 🟣 FASE 5 - SAAS

### 5.1 Multi-Tenant
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F5-01 | office_id em todas tabelas | ✅ CONCLUÍDO | 🟢 OK | Migration aplicada |
| F5-02 | RLS Supabase | ✅ CONCLUÍDO | 🟢 OK | Policies criadas |
| F5-03 | Isolamento total | ✅ CONCLUÍDO | 🟢 OK | Testado |

### 5.2 Onboarding
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F5-04 | Fluxo de criação de escritório | ❌ PENDENTE | 🟢 BAIXA | Não existe |
| F5-05 | Plano AMPLA como default | ⚠️ PARCIAL | 🟢 BAIXA | Plano existe, falta copiar automático |
| F5-06 | Onboarding do usuário | ❌ PENDENTE | 🟢 BAIXA | Não existe |

### 5.3 IA Avançada
| ID | Tarefa | Status | Prioridade | Evidência |
|----|--------|--------|------------|-----------|
| F5-07 | Detectar crescimento de cliente | ❌ PENDENTE | 🟢 BAIXA | IA não analisa |
| F5-08 | Sugerir reajuste de honorários | ❌ PENDENTE | 🟢 BAIXA | IA não sugere |
| F5-09 | Comparativo com mercado | ✅ CONCLUÍDO | 🟢 OK | Tabela referência Goiânia |

---

## 📝 PLANO DE CONTAS - VALIDAÇÃO

### Campos Obrigatórios (Seção 4.3)
| Campo | Status | Observação |
|-------|--------|------------|
| codigo | ✅ | Existe |
| descricao | ✅ | Existe |
| nivel | ✅ | Existe |
| tipo (SINTETICA/ANALITICA) | ✅ | Existe como is_analytical |
| natureza (D/C) | ✅ | Existe |
| grupo | ⚠️ | Inferido pelo código, não campo explícito |
| codigo_referencial_sped | ⚠️ | Campo existe mas não preenchido em todas |
| aceita_lancamento | ✅ | Derivado de is_analytical |

---

## 🎯 PRÓXIMAS AÇÕES (ORDEM DE PRIORIDADE)

### 🔴 IMEDIATO (Esta Sessão)
1. [ ] **F1-01/02/03**: Criar migration para lançamentos de abertura 01/01/2025
   - Tipo: ABERTURA
   - Origem: saldo_inicial
   - Data: 01/01/2025
   - Partida dobrada por conta analítica

### 🟡 CURTO PRAZO (Esta Semana)
2. [ ] **F1-05/06**: Implementar continuidade automática de período
3. [ ] **F2-07**: Completar 15% restante da conciliação bancária
4. [ ] **F4-02**: Criar supplier_ledger

### 🟢 MÉDIO PRAZO (Este Mês)
5. [ ] **F3-06/07/08**: Sistema completo de renegociação
6. [ ] **F4-07**: Ledger por tributo
7. [ ] **F1-08**: Processo de encerramento anual

### 🔵 LONGO PRAZO (Próximo Trimestre)
8. [ ] **F5-04/05/06**: Onboarding SaaS
9. [ ] **F5-07/08**: IA avançada para reajustes
10. [ ] **F3-09**: Sistema de alertas/notificações

---

## 📊 MÉTRICAS DE PROGRESSO

```
FASE 1 ████████░░░░░░░░░░░░ 33%
FASE 2 ██████████████████░░ 85%
FASE 3 ████████░░░░░░░░░░░░ 40%
FASE 4 ██████████████░░░░░░ 67%
FASE 5 ██████░░░░░░░░░░░░░░ 33%
─────────────────────────────
TOTAL  ████████░░░░░░░░░░░░ 44%
```

---

## 📚 REFERÊNCIAS

- **Especificação Oficial**: `.claude/reoganizacao_28_01_2026.md`
- **Resumo de Correções**: `.claude/RESUMO_CORRECOES_28_01_2026.md`
- **Histórico Completo**: `.claude/MEMORY.md`
- **Base de Conhecimento**: `mcp-financeiro/src/knowledge/base-conhecimento.ts`

---

## 📝 HISTÓRICO DE ATUALIZAÇÕES

| Data | Autor | Alteração |
|------|-------|-----------|
| 28/01/2026 | Claude | Criação inicial do documento |

---

> **IMPORTANTE**: Este documento deve ser atualizado a cada sessão de trabalho.
> Marcar tarefas como ✅ CONCLUÍDO somente após verificação no banco de dados.
