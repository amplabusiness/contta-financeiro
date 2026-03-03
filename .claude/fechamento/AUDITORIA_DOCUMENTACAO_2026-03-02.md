# AUDITORIA DA DOCUMENTAÇÃO DE FECHAMENTO CONTÁBIL

**Data:** 02/03/2026  
**Auditor:** Especialista Contábil Sênior + Dr. Cícero  
**Escopo:** Validar se TODA a documentação de fechamento, especificações contábeis, prompts de agentes e instruções do sistema estão atualizadas e corretas antes de executar o fechamento de todos os meses.  
**Versão:** 1.0

---

## ÍNDICE

1. [Resumo Executivo](#1-resumo-executivo)
2. [Metodologia](#2-metodologia)
3. [Inventário de Documentos Analisados](#3-inventário-de-documentos-analisados)
4. [Schema Real do Banco de Dados](#4-schema-real-do-banco-de-dados)
5. [Erros Críticos (C1-C6)](#5-erros-críticos)
6. [Erros de Estrutura (E1-E5)](#6-erros-de-estrutura)
7. [Inconsistências de Dados (D1-D4)](#7-inconsistências-de-dados)
8. [O Que Está Correto](#8-o-que-está-correto)
9. [RPCs e Views — Status Completo](#9-rpcs-e-views--status-completo)
10. [Cobertura de Dados por Mês](#10-cobertura-de-dados-por-mês)
11. [Conflito de Tabelas de Controle de Fechamento](#11-conflito-de-tabelas-de-controle-de-fechamento)
12. [Conflito de Formatos de Output dos Prompts](#12-conflito-de-formatos-de-output-dos-prompts)
13. [Plano de Ação Obrigatório (P0/P1/P2)](#13-plano-de-ação-obrigatório)
14. [Decisão Final](#14-decisão-final)

---

## 1. RESUMO EXECUTIVO

### Classificação: **PARCIALMENTE DESATUALIZADA — CORREÇÕES P0 OBRIGATÓRIAS**

A documentação de fechamento contábil da Ampla Contabilidade contém **6 erros críticos**, **5 erros de estrutura** e **4 inconsistências de dados** que **impedem a execução segura do fechamento mensal**.

Os problemas mais graves são:

- Uma especificação contábil (`ESPECIFICACAO_CONTABIL_CONTTA.md`) descreve um schema **errado** para a tabela central `accounting_entry_lines`
- **Todas as 9 RPCs** referenciadas nos documentos de fechamento **NÃO EXISTEM** no banco de dados
- Duas tabelas de controle de fechamento (`accounting_closures` e `monthly_closings`) apresentam **status conflitante** para Janeiro/2025
- Views materializadas críticas estão **vazias** ou **inexistentes**

### Dados do Ambiente

| Aspecto              | Valor                                                        |
| -------------------- | ------------------------------------------------------------ |
| **Supabase Project** | `xdtlhzysrpoinqtsglmr` (us-west-2)                           |
| **Banco**            | PostgreSQL 17.6                                              |
| **Tenant**           | Ampla Contabilidade (`a53a4957-fe97-4856-b3ca-70045157b421`) |
| **Repo**             | `amplabusiness/contta-financeiro` (branch: `main`)           |
| **Stack**            | Node.js 22, React/TypeScript, Vite, Supabase                 |

---

## 2. METODOLOGIA

A auditoria foi realizada em 5 etapas:

1. **Leitura completa** de todos os 11 arquivos em `.claude/fechamento/`
2. **Leitura completa** de ambas as especificações contábeis (`ESPECIFICACAO_CONTABIL_DR_CICERO.md` e `ESPECIFICACAO_CONTABIL_CONTTA.md`)
3. **Leitura completa** de todos os 6 prompts em `/prompts/`
4. **Verificação do schema real** do banco via queries diretas ao Supabase (tabelas, views, RPCs, contagem de registros, distribuição por mês)
5. **Cruzamento** documentação vs realidade do banco, identificando divergências

---

## 3. INVENTÁRIO DE DOCUMENTOS ANALISADOS

### 3.1. Pasta `.claude/fechamento/` (11 arquivos)

| Arquivo                                                  | Descrição                                  | Versão |
| -------------------------------------------------------- | ------------------------------------------ | ------ |
| `CHECKLIST DE FECHAMENTO CONTÁBIL–FINANCEIRO MENSAL.ini` | Checklist de 9 etapas para fechar um mês   | s/v    |
| `DR_CICERO_FECHAMENTO_TOTAL_v1.md`                       | Fluxo de fechamento em 7 passos            | v1.0   |
| `DR_CICERO_PROMPT_v1.md`                                 | Prompt RAG-ready com output JSON           | v1.0   |
| `DR_CICERO_CONTEXT_BUILDER_v1.md`                        | Pipeline de construção de contexto         | v1.0   |
| `DR_CICERO_DELTA_CHECK_v1.md`                            | Analisador de delta pós-aprovação          | v1.0   |
| `DR_CICERO_FECHAMENTO_EXECUCAO_OFICIAL_v1.md`            | Comando de execução do fechamento Jan/2025 | v1.0   |
| `contrato cicero.md`                                     | Interfaces TypeScript do Dr. Cícero        | s/v    |
| `MANUAL INTERNO AMPLA.md`                                | Manual interno com SQL de fechamento       | s/v    |
| `PROMPT OFICIAL CÍCERO.md`                               | Prompt identidade Dr. Cícero               | v1     |
| `PARECER_DR_CICERO_012025.md`                            | Parecer de Jan/2025 (já emitido)           | s/v    |
| `proxima tarefa 30012026.md`                             | Lista de tarefas de 30/01/2026             | s/v    |

### 3.2. Especificações Contábeis (raiz do projeto)

| Arquivo                               | Linhas | Versão | Status         |
| ------------------------------------- | ------ | ------ | -------------- |
| `ESPECIFICACAO_CONTABIL_DR_CICERO.md` | 1046   | s/v    | **CORRETO** ✅ |
| `ESPECIFICACAO_CONTABIL_CONTTA.md`    | 1115   | s/v    | **ERRADO** ❌  |

### 3.3. Prompts dos Agentes (`/prompts/`)

| Arquivo                          | Agente                   | Versão | Data       |
| -------------------------------- | ------------------------ | ------ | ---------- |
| `DR_CICERO_SYSTEM_PROMPT.md`     | Dr. Cícero (principal)   | v3.0   | 01/02/2026 |
| `AGENTE_CLASSIFICADOR_PROMPT.md` | Classificador            | v2.0   | 31/01/2026 |
| `AGENTE_FINANCEIRO_PROMPT.md`    | Financeiro               | v2.0   | 31/01/2026 |
| `AGENTE_EDUCADOR_PROMPT.md`      | Educador                 | s/v    | s/d        |
| `FALLBACK_PROMPT.md`             | Fallback (sem histórico) | v2.0   | 31/01/2026 |
| `PARECER_PDF_PROMPT.md`          | Gerador de PDF           | v2.0   | 31/01/2026 |

### 3.4. Instrução GitHub Copilot

| Arquivo                           | Descrição                       |
| --------------------------------- | ------------------------------- |
| `.github/copilot-instructions.md` | Regras obrigatórias para IAs    |
| `.claude/CLAUDE.md`               | Memória do projeto (34 sessões) |

---

## 4. SCHEMA REAL DO BANCO DE DADOS

> **Fonte:** Query direta ao Supabase em 02/03/2026

### 4.1. `accounting_entry_lines` — TABELA MAIS IMPORTANTE

```
Colunas REAIS (9):
  id, created_at, entry_id, account_id, debit, credit,
  description, cost_center_id, tenant_id
```

| Coluna      | Tipo Real      | O que CONTTA.md diz      | O que DR_CICERO.md diz |
| ----------- | -------------- | ------------------------ | ---------------------- |
| `debit`     | DECIMAL        | ❌ Não documenta         | ✅ Correto             |
| `credit`    | DECIMAL        | ❌ Não documenta         | ✅ Correto             |
| `type`      | **NÃO EXISTE** | ❌ Diz que existe (ENUM) | ✅ Não referencia      |
| `amount`    | **NÃO EXISTE** | ❌ Diz que existe        | ✅ Não referencia      |
| `client_id` | **NÃO EXISTE** | ❌ Diz que existe        | ✅ Não referencia      |

**VEREDITO:** `ESPECIFICACAO_CONTABIL_DR_CICERO.md` é a especificação correta.  
`ESPECIFICACAO_CONTABIL_CONTTA.md` está **ERRADA e deve ser eliminada ou corrigida**.

### 4.2. `accounting_entries` (35 colunas)

```
id, created_at, entry_date, description, entry_type, reference_type,
reference_id, tenant_id, competence_date, status, notes, is_automated,
ai_generated, ai_validated, ai_validation_status, ai_validation_score,
ai_confidence, ai_model, updated_at, internal_code, source_transaction_id,
reversal_of, reversed_by, is_reversal, batch_id, fiscal_period,
closing_status, locked, locked_at, locked_by, hash, previous_hash,
version, metadata, dr_cicero_approved
```

### 4.3. `bank_transactions` (51 colunas)

```
id, created_at, bank_account_id, transaction_date, description, amount,
type, fitid, category, reconciled, reconciliation_id, tenant_id, memo,
check_number, ref_number, payee, transaction_type, import_batch_id,
ofx_type, ofx_memo, matched_invoice_id, match_confidence, matched_by,
match_date, balance_after, original_description, normalized_description,
hash, duplicate_of, is_duplicate, ai_category, ai_confidence,
ai_suggested_account, ai_suggested_cost_center, client_id,
client_match_method, competence_date, fiscal_period, dr_cicero_status,
dr_cicero_entry_id, dr_cicero_classified_at, dr_cicero_notes,
classification_source, updated_at, accounting_entry_id, is_split,
split_parent_id, split_index, bank_account_code, status, source
```

### 4.4. `chart_of_accounts` (23 colunas)

```
id, created_at, code, name, type, parent_id, level, is_analytical,
is_active, tenant_id, description, nature, account_type, updated_at,
allow_direct_posting, is_system, system_role, metadata, opening_balance,
opening_balance_date, cost_center_id, display_order, tags
```

### 4.5. Contas-Chave Confirmadas

| Conta                | Código     | UUID                                   | Status        |
| -------------------- | ---------- | -------------------------------------- | ------------- |
| Banco Sicredi        | `1.1.1.05` | `10d5892d-a843-4034-8d62-9fec95b8fd56` | ✅ Confirmado |
| Transitória Débitos  | `1.1.9.01` | `3e1fd22f-fba2-4cc2-b628-9d729233bca0` | ✅ Confirmado |
| Transitória Créditos | `2.1.9.01` | `28085461-9e5a-4fb4-847d-c9fc047fe0a1` | ✅ Confirmado |

---

## 5. ERROS CRÍTICOS

> Impedem o fechamento seguro. Devem ser corrigidos ANTES de qualquer operação.

### C1 — Schema Errado em ESPECIFICACAO_CONTABIL_CONTTA.md

**Arquivo:** `ESPECIFICACAO_CONTABIL_CONTTA.md`  
**Problema:** Descreve `accounting_entry_lines` com colunas `type` (ENUM 'debit'/'credit'), `amount` e `client_id`.  
**Realidade:** A tabela usa `debit` (DECIMAL) e `credit` (DECIMAL). Não existe `type`, `amount` nem `client_id`.  
**Risco:** Qualquer script, IA ou agente que seguir este documento vai gerar SQL inválido, lançamentos errados ou erros de execução.  
**Ação:** Eliminar este arquivo ou corrigir completamente. `ESPECIFICACAO_CONTABIL_DR_CICERO.md` é o documento canônico.

### C2 — RPC `rpc_check_accounting_integrity` não existe

**Referenciado em:** `CHECKLIST DE FECHAMENTO CONTÁBIL–FINANCEIRO MENSAL.ini` (Etapa 1)  
**Problema:** O checklist de fechamento inicia com "Executar `rpc_check_accounting_integrity()`" mas esta função **não existe** no banco.  
**Risco:** Etapa 1 do fechamento é inexecutável.

### C3 — RPC `rpc_monthly_closing_check` não existe

**Referenciado em:** `MANUAL INTERNO AMPLA.md`  
**Problema:** O manual interno referencia esta RPC como validação principal de fechamento. Não existe.

### C4 — 6 RPCs do DR_CICERO_SYSTEM_PROMPT v3.0 não existem

**Referenciado em:** `prompts/DR_CICERO_SYSTEM_PROMPT.md` v3.0  
**RPCs inexistentes:**

1. `reconcile_transaction()` — Conciliação bancária
2. `unreconcile_transaction()` — Desfazer conciliação
3. `search_documents_for_rag()` — Busca RAG
4. `get_divergence_context()` — Contexto de divergências
5. `get_decision_timeline()` — Linha do tempo de decisões
6. `verify_version_chain()` — Verificação de cadeia de versões

**Risco:** O prompt principal do Dr. Cícero referencia ferramentas que não existem. Qualquer LLM que executar o prompt vai "alucinar" chamadas de função que falharão.

### C5 — View `vw_trial_balance_month` não existe

**Referenciado em:** `DR_CICERO_CONTEXT_BUILDER_v1.md`  
**Problema:** O Context Builder usa esta view para montar o contexto de fechamento. A view **não existe**.  
**Alternativas disponíveis:** `mv_trial_balance` (existe mas está EMPTY), `vw_transitory_balances` (existe mas está EMPTY)

### C6 — Status de Fechamento Conflitante entre Duas Tabelas

**Tabela 1 — `accounting_closures`:**
| Mês | Status | is_balanced | bank_reconciled | dr_cicero_approved | transitories_cleared |
|-----|--------|-------------|-----------------|--------------------|-----------------------|
| Jan/2025 | `closed` | true | true | true | true |
| Fev/2025 | `open` | false | false | false | false |

**Tabela 2 — `monthly_closings`:**
| Mês | Status | total_revenue | total_expenses | net_result |
|-----|--------|---------------|----------------|------------|
| Jan/2025 | `open` | 0.00 | 0.00 | 0.00 |
| Fev/2025 | `open` | 0.00 | 0.00 | 0.00 |

**Problema:** `accounting_closures` diz que Jan/2025 está **fechado** com todas as flags `true`. `monthly_closings` diz que Jan/2025 está **aberto** com todos os valores **zero**. São duas verdades conflitantes.

---

## 6. ERROS DE ESTRUTURA

> Não impedem execução imediata, mas causam confusão e risco de erros futuros.

### E1 — Duas Especificações Contábeis Divergentes

**Documentos:** `ESPECIFICACAO_CONTABIL_DR_CICERO.md` (correto) vs `ESPECIFICACAO_CONTABIL_CONTTA.md` (errado)  
**Problema:** Ambos descrevem o mesmo sistema com schemas diferentes.  
**Ação:** Definir `DR_CICERO` como canônico. Eliminar ou atualizar `CONTTA`.

### E2 — Coluna `client_id` Documentada mas Inexistente

**Documento:** `ESPECIFICACAO_CONTABIL_CONTTA.md`  
**Problema:** Documenta `client_id` em `accounting_entry_lines`. Não existe.  
**Impacto:** Médio — queries que tentarem filtrar por `client_id` falharão.

### E3 — Views Materializadas Vazias

| View                     | Status             | Esperado                              |
| ------------------------ | ------------------ | ------------------------------------- |
| `mv_trial_balance`       | EMPTY              | Deveria ter dados do balancete        |
| `mv_dre_monthly`         | EMPTY              | Deveria ter dados da DRE mensal       |
| `mv_client_balances`     | EXISTS (com dados) | OK                                    |
| `vw_transitory_balances` | EMPTY              | Correto se transitórias estão zeradas |

**Problema:** `mv_trial_balance` e `mv_dre_monthly` nunca foram populadas. As views materializadas precisam de `REFRESH MATERIALIZED VIEW` para terem dados.

### E4 — Tabela `bank_accounts` Vazia

**Problema:** A query à tabela `bank_accounts` retornou vazio.  
**Nota:** A conta Banco Sicredi está em `chart_of_accounts` (confirmado pelo UUID), mas a tabela operacional `bank_accounts` parece não ter registros visíveis via API.

### E5 — Contrato TypeScript Não Implementado

**Documento:** `contrato cicero.md`  
**Define:** Interfaces `ClosingInput`, `CiceroResult`, `CiceroAlert`, `DrCiceroService`, sistema de hash SHA-256  
**Realidade:** Nenhuma dessas interfaces foi implementada no código-fonte TypeScript da aplicação.

---

## 7. INCONSISTÊNCIAS DE DADOS

### D1 — Lacuna de Cobertura Contábil (Mai/2025 em diante)

Transações bancárias (OFX) existem para todos os meses, mas lançamentos contábeis param em Abril/2025:

| Mês      | bank_transactions | accounting_entries | GAP?       |
| -------- | ----------------- | ------------------ | ---------- |
| Dez/2024 | —                 | 9                  | —          |
| Jan/2025 | 183               | 332                | Não        |
| Fev/2025 | 211               | 356                | Não        |
| Mar/2025 | 148               | 161                | Não        |
| Abr/2025 | 168               | 142                | Não        |
| Mai/2025 | 198               | **0**              | **SIM** ⚠️ |
| Jun/2025 | 92                | **0**              | **SIM** ⚠️ |
| Jul/2025 | —                 | **0**              | —          |
| Ago/2025 | sim               | **0**              | **SIM** ⚠️ |
| Set/2025 | sim               | **0**              | **SIM** ⚠️ |
| Out/2025 | sim               | **0**              | **SIM** ⚠️ |
| Nov/2025 | sim               | **0**              | **SIM** ⚠️ |
| Dez/2025 | sim               | **0**              | **SIM** ⚠️ |
| Jan/2026 | sim               | **0**              | **SIM** ⚠️ |

**Implicação:** 8+ meses de transações bancárias sem contabilização. Esses meses precisam ser processados antes do fechamento.

### D2 — Proporção Entries vs Lines Suspeita

| Métrica                  | Quantidade           |
| ------------------------ | -------------------- |
| `accounting_entries`     | 3.313                |
| `accounting_entry_lines` | 1.124                |
| **Proporção**            | **0,34 lines/entry** |

**Esperado:** Mínimo 2 lines por entry (partida dobrada).  
**Problema potencial:** ~2.189 entries sem lines (entries órfãos) ou lines foram deletadas sem deletar os entries.

### D3 — Totais Gerais

| Tabela                   | Total de Registros |
| ------------------------ | ------------------ |
| `bank_transactions`      | 2.357              |
| `accounting_entries`     | 3.313              |
| `accounting_entry_lines` | 1.124              |
| `chart_of_accounts`      | ~400+              |

### D4 — Saldos das Transitórias

| Conta                | Código   | Débito Total | Crédito Total | Saldo       |
| -------------------- | -------- | ------------ | ------------- | ----------- |
| Transitória Débitos  | 1.1.9.01 | 0.00         | 0.00          | **ZERO** ✅ |
| Transitória Créditos | 2.1.9.01 | 0.00         | 0.00          | **ZERO** ✅ |

**Interpretação:** Bom para meses já fechados. Porém, se meses abertos (Mai/2025+) não passaram pela transitória, o saldo zero pode ser enganoso — significaria que esses meses simplesmente não foram processados.

---

## 8. O QUE ESTÁ CORRETO

| Item                                                         | Documento(s)                             | Status                         |
| ------------------------------------------------------------ | ---------------------------------------- | ------------------------------ |
| IDs das contas transitórias (1.1.9.01 e 2.1.9.01)            | Todos os docs                            | ✅ Correto                     |
| UUID Banco Sicredi (`10d5892d...`)                           | copilot-instructions, specs              | ✅ Confirmado no banco         |
| UUID Transitória Débitos (`3e1fd22f...`)                     | copilot-instructions                     | ✅ Confirmado                  |
| UUID Transitória Créditos (`28085461...`)                    | copilot-instructions                     | ✅ Confirmado                  |
| Tenant Ampla (`a53a4957...`)                                 | Todos os docs                            | ✅ Correto                     |
| Fluxo OFX: Entrada → D Banco / C Transitória Créditos        | ESPECIFICACAO_DR_CICERO                  | ✅ Correto                     |
| Fluxo OFX: Saída → D Transitória Débitos / C Banco           | ESPECIFICACAO_DR_CICERO                  | ✅ Correto                     |
| Regra de ouro: transitórias devem zerar ao final             | Todos os docs                            | ✅ Correto                     |
| Hierarquia: Dr. Cícero > Classificador, Financeiro, Educador | prompts/                                 | ✅ Consistente                 |
| Regras de PIX de sócio ≠ receita                             | DR_CICERO, copilot-instructions          | ✅ Correto                     |
| Checklist conceitual de 9 etapas                             | Checklist                                | ✅ Correto conceitualmente     |
| Tabelas auxiliares existem                                   | learned_rules, document_catalog, etc.    | ✅ Infraestrutura RAG presente |
| Prompts dos agentes subordinados atualizados                 | Classificador, Financeiro, Fallback, PDF | ✅ v2.0 de 31/01/2026          |
| Schema `accounting_entry_lines` = debit/credit               | ESPECIFICACAO_DR_CICERO                  | ✅ Correto                     |

---

## 9. RPCs E VIEWS — STATUS COMPLETO

### 9.1. RPCs Referenciadas nos Documentos

| RPC                                | Referenciada Em              | Existe? |
| ---------------------------------- | ---------------------------- | ------- |
| `rpc_check_accounting_integrity()` | Checklist (Etapa 1)          | ❌ NÃO  |
| `rpc_monthly_closing_check()`      | Manual Interno               | ❌ NÃO  |
| `reconcile_transaction()`          | DR_CICERO_SYSTEM_PROMPT v3.0 | ❌ NÃO  |
| `unreconcile_transaction()`        | DR_CICERO_SYSTEM_PROMPT v3.0 | ❌ NÃO  |
| `search_documents_for_rag()`       | DR_CICERO_SYSTEM_PROMPT v3.0 | ❌ NÃO  |
| `get_divergence_context()`         | DR_CICERO_SYSTEM_PROMPT v3.0 | ❌ NÃO  |
| `get_decision_timeline()`          | DR_CICERO_SYSTEM_PROMPT v3.0 | ❌ NÃO  |
| `verify_version_chain()`           | DR_CICERO_SYSTEM_PROMPT v3.0 | ❌ NÃO  |
| `approve_closure()`                | Contrato TypeScript          | ❌ NÃO  |

**TOTAL: 0 de 9 RPCs existem.**

### 9.2. Views

| View                     | Referenciada Em            | Existe? | Tem Dados?     |
| ------------------------ | -------------------------- | ------- | -------------- |
| `vw_trial_balance_month` | Context Builder            | ❌ NÃO  | —              |
| `vw_transitory_balances` | Checklist, Context Builder | ✅ SIM  | EMPTY          |
| `mv_trial_balance`       | MEMORY.md                  | ✅ SIM  | EMPTY          |
| `mv_dre_monthly`         | MEMORY.md                  | ✅ SIM  | EMPTY          |
| `mv_client_balances`     | MEMORY.md                  | ✅ SIM  | Com dados      |
| `mv_cash_flow`           | MEMORY.md                  | ✅ SIM  | Não verificado |

### 9.3. Tabelas de Apoio ao Fechamento

| Tabela                     | Existe? | Tem Dados?                     |
| -------------------------- | ------- | ------------------------------ |
| `accounting_closures`      | ✅ SIM  | Jan/2025=closed, Fev/2025=open |
| `monthly_closings`         | ✅ SIM  | Jan/2025=open, Fev/2025=open   |
| `monthly_closing_status`   | ✅ SIM  | EMPTY                          |
| `learned_rules`            | ✅ SIM  | Com dados                      |
| `document_catalog`         | ✅ SIM  | Com dados                      |
| `reconciliation_audit_log` | ✅ SIM  | Com dados                      |
| `ai_learned_patterns`      | ✅ SIM  | Com dados                      |
| `ai_validation_queue`      | ✅ SIM  | Com dados                      |

---

## 10. COBERTURA DE DADOS POR MÊS

### Legenda

- ✅ = tem dados
- ❌ = sem dados
- ⚠️ = lacuna que precisa ser resolvida

| Mês          | OFX Importado | bank_transactions | accounting_entries | accounting_entry_lines | Status Fechamento          |
| ------------ | ------------- | ----------------- | ------------------ | ---------------------- | -------------------------- |
| Dez/2024     | —             | —                 | ✅ (9)             | ✅                     | n/a (anterior)             |
| **Jan/2025** | ✅            | ✅ (183)          | ✅ (332)           | ✅                     | **CONFLITO** (closed/open) |
| **Fev/2025** | ✅            | ✅ (211)          | ✅ (356)           | ✅                     | Aberto                     |
| **Mar/2025** | ✅            | ✅ (148)          | ✅ (161)           | ✅                     | Aberto                     |
| **Abr/2025** | ✅            | ✅ (168)          | ✅ (142)           | ✅                     | Aberto                     |
| **Mai/2025** | ✅            | ✅ (198)          | ❌                 | ❌                     | ⚠️ Não processado          |
| **Jun/2025** | ✅            | ✅ (92)           | ❌                 | ❌                     | ⚠️ Não processado          |
| **Jul/2025** | ?             | ?                 | ❌                 | ❌                     | ⚠️ Não processado          |
| **Ago/2025** | ✅            | ✅                | ❌                 | ❌                     | ⚠️ Não processado          |
| **Set/2025** | ✅            | ✅                | ❌                 | ❌                     | ⚠️ Não processado          |
| **Out/2025** | ✅            | ✅                | ❌                 | ❌                     | ⚠️ Não processado          |
| **Nov/2025** | ✅            | ✅                | ❌                 | ❌                     | ⚠️ Não processado          |
| **Dez/2025** | ✅            | ✅                | ❌                 | ❌                     | ⚠️ Não processado          |
| **Jan/2026** | ✅            | ✅                | ❌                 | ❌                     | ⚠️ Não processado          |

**Resumo:** 4 meses com contabilidade (Jan-Abr/2025), 8+ meses sem contabilidade.

---

## 11. CONFLITO DE TABELAS DE CONTROLE DE FECHAMENTO

Existem **3 tabelas** que controlam o status de fechamento mensal. Precisamos definir **UMA** como fonte oficial.

### 11.1. `accounting_closures`

```
Colunas: id, tenant_id, fiscal_period, status, is_balanced,
         bank_reconciled, dr_cicero_approved, transitories_cleared,
         hash, previous_hash, version, metadata, created_at, updated_at,
         closed_at, closed_by, notes
```

- **Jan/2025:** status=`closed`, is_balanced=true, bank_reconciled=true, dr_cicero_approved=true, transitories_cleared=true
- Tem sistema de hash para integridade

### 11.2. `monthly_closings`

```
Colunas: id, tenant_id, month, year, status, total_revenue,
         total_expenses, net_result, closed_at, closed_by,
         created_at, updated_at
```

- **Jan/2025:** status=`open`, total_revenue=0, total_expenses=0, net_result=0
- Não tem hash nem flags de validação

### 11.3. `monthly_closing_status`

- EMPTY — sem dados
- Provavelmente view ou tabela auxiliar não implementada

### RECOMENDAÇÃO

Usar `accounting_closures` como tabela oficial porque:

- Tem sistema de hash e versão
- Tem flags granulares (is_balanced, bank_reconciled, etc.)
- Tem aprovação do Dr. Cícero
- É referenciada no contrato TypeScript

`monthly_closings` pode manter os totais financeiros como cache, mas o status oficial deve vir de `accounting_closures`.

---

## 12. CONFLITO DE FORMATOS DE OUTPUT DOS PROMPTS

Três documentos diferentes definem formatos JSON diferentes para a resposta do Dr. Cícero:

### Formato 1 — `DR_CICERO_PROMPT_v1.md`

```json
{
  "decision": "APPROVED" | "INVALIDATED" | "DRAFT",
  "confidence": 0.95,
  "fiscal_period": "2025-01",
  "key_numbers": { ... },
  "critical_checks": [ ... ],
  "important_checks": [ ... ],
  "alert_checks": [ ... ],
  "signoff": "Dr. Cícero — CRC/GO 008074"
}
```

### Formato 2 — `PROMPT OFICIAL CÍCERO.md`

```json
{
  "status": "APROVADO" | "REPROVADO",
  "confianca": 0.95,
  "periodo": "2025-01",
  "resumo": "...",
  "alertas": [ ... ],
  "hash_verificacao": "sha256:..."
}
```

### Formato 3 — `DR_CICERO_SYSTEM_PROMPT.md` v3.0

```json
{
  "decision_type": "CLOSING_APPROVAL" | "CLASSIFICATION" | ...,
  "status": "APPROVED" | "REJECTED" | "PENDING",
  "confidence": 0.95,
  "reasoning": "...",
  "actions_taken": [ ... ],
  "hash": "sha256:..."
}
```

### RECOMENDAÇÃO

Adotar o **Formato 3** (v3.0) como padrão único, por ser o mais recente e completo. Atualizar os documentos v1 para referenciá-lo ou removê-los.

---

## 13. PLANO DE AÇÃO OBRIGATÓRIO

### P0 — BLOQUEADORES (devem ser resolvidos ANTES de qualquer fechamento)

| #    | Ação                                                          | Abordagem Recomendada                                                                                                             |
| ---- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P0.1 | Eliminar ou corrigir `ESPECIFICACAO_CONTABIL_CONTTA.md`       | Adicionar aviso de DEPRECAÇÃO no topo + link para DR_CICERO como canônico                                                         |
| P0.2 | Resolver RPCs inexistentes                                    | **Abordagem pragmática:** remover referências das RPCs dos docs de fechamento e usar queries SQL diretas. Implementar RPCs depois |
| P0.3 | Resolver conflito `accounting_closures` vs `monthly_closings` | Definir `accounting_closures` como oficial. Atualizar `monthly_closings` de Jan/2025 para `closed` com os totais corretos         |
| P0.4 | Criar ou substituir `vw_trial_balance_month`                  | Usar query direta ao `accounting_entry_lines` agrupada por conta e período                                                        |
| P0.5 | Investigar entries órfãos (3.313 entries vs 1.124 lines)      | Query para encontrar entries sem lines e decidir: deletar ou recriar lines                                                        |

### P1 — IMPORTANTES (devem ser resolvidos antes de fechar meses futuros)

| #    | Ação                                                                              |
| ---- | --------------------------------------------------------------------------------- |
| P1.1 | Popular views materializadas (`REFRESH MATERIALIZED VIEW mv_trial_balance`, etc.) |
| P1.2 | Processar contabilidade de Mai/2025-Jan/2026 (8+ meses sem lançamentos contábeis) |
| P1.3 | Unificar formato de output JSON do Dr. Cícero (adotar v3.0)                       |

### P2 — MELHORIAS (podem ser feitas depois dos fechamentos)

| #    | Ação                                                                  |
| ---- | --------------------------------------------------------------------- |
| P2.1 | Implementar RPCs no PostgreSQL (rpc_check_accounting_integrity, etc.) |
| P2.2 | Implementar contrato TypeScript do Dr. Cícero                         |
| P2.3 | Unificar especificações em documento único                            |
| P2.4 | Verificar/popular tabela `bank_accounts`                              |

---

## 14. DECISÃO FINAL

### ⛔ NÃO INICIAR FECHAMENTOS até que os itens P0 sejam resolvidos.

### Sequência correta de trabalho:

```
1. Corrigir documentos errados (P0.1-P0.4)
2. Investigar e limpar entries órfãos (P0.5)
3. Fechar Jan/2025 (resolver conflito de status)
4. Fechar Fev/2025, Mar/2025, Abr/2025
5. Processar contabilidade Mai/2025+ (P1.2)
6. Fechar Mai/2025 em diante progressivamente
7. Implementar melhorias (P2.x)
```

---

**Assinatura:**  
**Dr. Cícero — Contador IA Responsável**  
CRC/GO 008074  
Ampla Contabilidade LTDA  
CNPJ: 21.565.040/0001-07

**Hash do Parecer:** _a ser calculado após aprovação_

---

_Documento gerado em 02/03/2026. Válido até resolução dos itens P0._
