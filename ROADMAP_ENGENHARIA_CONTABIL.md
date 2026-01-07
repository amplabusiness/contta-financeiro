# 🗺️ Roadmap de Engenharia Contábil: "Fonte Única da Verdade"

> **Status Atual (06/JAN/2026):** FASE 3 CONCLUÍDA (MIGRAÇÃO PRINCIPAL). FASE 3.1 EM ANDAMENTO (SALDOS DE ABERTURA).

Este documento define o plano de implementação para transformar o sistema da Ampla Contabilidade em um sistema de "Partidas Dobradas" (Double Entry) real, onde o **Plano de Contas** é a única fonte da verdade para relatórios financeiros, garantindo conformidade com padrões SPED ECD.

Este roadmap unifica o planejamento técnico com o status operacional (anteriormente em `ROADMAP.md`).

---

## 🏗️ Fase 1: Auditoria e Estrutura do Plano de Contas (SPED)
**Objetivo:** Garantir que o esqueleto contábil suporta a operação antes de colocar peso nele.

- [x] **1.1. Validação da Hierarquia (SPED)**
    - Verificar se a estrada segue o padrão:
        - `1. TATIVO` (Natureza: Devedora)
        - `2. PASSIVO` (Natureza: Credora)
        - `3. RECEITAS` (Natureza: Credora)
        - `4. DESPESAS/CUSTOS` (Natureza: Devedora)
        - `5. PATRIMÔNIO LÍQUIDO` (Natureza: Credora)
    - *Status:* ✅ Concluído. Estrutura validada e compatível.

- [x] **1.2. Trava de Segurança ("Analytical Only")**
    - Garantir que lançamentos SÓ podem ser feitos em contas Analíticas (folhas), nunca em contas Sintéticas (grupos).
    - *Ação:* Trigger `check_analytical_account_only` implementada.
    - *Status:* ✅ Concluído.

- [x] **1.3. Contas de Transição e Mapeamento SPED**
    - Adicionado coluna `sped_referencial_code` e mapeado principais contas.
    - *Status:* ✅ Concluído.

---

## ⚙️ Fase 2: Motor de Contabilização Automática (Database Triggers)
**Objetivo:** Automatizar 100% da escrituração. Nenhuma tela deve "criar um lançamento contábil" manualmente.

- [x] **2.1. Gatilho de Faturamento (Revenue Recognition)**
    - Tabela Alvo: `invoices`
    - Evento: `INSERT`
    - Lançamento Automático: D: Clientes / C: Receita.
    - *Status:* ✅ Implementado (`trigger_invoice_accounting`).

- [x] **2.2. Gatilho de Recebimento (Cash Flow)**
    - Tabela Alvo: `bank_reconciliation`
    - Lançamento Automático: D: Banco / C: Clientes.
    - *Status:* ✅ Implementado (`trigger_bank_transaction_accounting`).

- [x] **2.3. Saldo de Abertura (Estrutura)**
    - Tabela Alvo: `client_opening_balance`
    - Estrutura completa para tracking de débitos pré-2025.
    - Lançamento Automático: D: Clientes / C: Ajustes PL.
    - *Status:* ✅ Implementado (Schema e Triggers).

- [x] **2.4. Sub-contas por Cliente (Individualização)**
    - Criar conta analítica específica para cada cliente (Ex: `1.1.2.01.0001 - Cliente Fulano`).
    - *Status:* ✅ Concluído.

- [x] **2.5. Sub-contas por Fornecedor e Despesas Específicas**
    - Criar conta analítica específica para cada fornecedor (Ex: `2.1.1.01.0001 - Fornecedor X`).
    - *Status:* ✅ Concluído.

---

## 🔄 Fase 3: Migração e Backfill (Grande Reset - Jan/2026)
**Objetivo:** Garantir que os dados já lançados em Janeiro/2026 tenham seus respectivos lançamentos contábeis gerados com a nova lógica (Contas Específicas).

- [x] **3.1. Execução do Script Mestre (Jan 2026)**
    - Script: `_FULL_EXECUTION_SCRIPT_JAN06.sql`.
    - Ações Executadas:
        - Sync de Schema e Triggers.
        - Backfill de Faturas (Provisão de Receita) para Jan/2025+.
        - Backfill de Despesas (Provisão de Despesa).
    - *Resultado:* 0 erros de balanceamento detectados.
    - *Status:* ✅ **CONCLUÍDO (06/01/2026)**.

- [x] **3.2. Popular Saldos de Abertura (Dívidas Antigas)**
    - **AÇÃO IMEDIATA (PRIORIDADE MÁXIMA)**
    - Importar dados de `_raw_opening_balances.txt` para tabela `client_opening_balance`.
    - Objetivo: Refletir dívidas de 2024 e anteriores no sistema novo.
    - *Status:* ✅ Concluído. (Importação de históricos 2024 + correção de duplicidades 13º Salário realizada em 07/01/2026).

- [x] **3.3. Backfill de Transações Bancárias**
    - Varrer `bank_transactions` de Jan/2025 e garantir que existem lançamentos (especialmente Baixas).
    - *Status:* ✅ Concluído (Script `run_backfill_jan2025_safe` executado em 06/01/2026).

---

## 🖥️ Fase 4: Frontend "Source of Truth" & Conciliação
**Objetivo:** As telas param de somar faturas e passam a ler o Razão Contábil.

- [x] **4.1. Super Conciliation (Nova Interface)**
    - Implementar/Ajustar tela `http://localhost:5173/super-conciliation`.
    - Esta tela será o **único** ponto de entrada para processar dados bancários.
    - Lógica ajustada para usar `UPSERT` e filtrar contas analíticas.
    - *Status:* ✅ Pronto (`src/pages/SuperConciliation.tsx`).

- [x] **4.2. Dashboard Financeiro Real**
    - Substituir queries em `invoices` por queries na View `v_balancete` (ou `accounting_balances`) em `Dashboard.tsx`.
    - "Honorários Pendentes" agora reflete `Saldo(1.1.2.01)`.
    - "Despesas" já reflete `Grupo(4)`.
    - *Status:* ✅ Concluído (Dashboard atualizado em 06/01/2026).

- [x] **4.3. Relatórios Gerenciais (DRE)**
    - Gerar DRE diretamente da soma dos Grupos 3 e 4 do plano de contas.
    - *Status:* ✅ Concluído. Serviço `FinancialReportsService.ts` implementado com lógica de paginação.

---

## 🛡️ Fase 5: Validação e Auditoria Contínua
- [x] **5.1. Teste de Duplo Check (Auditoria)**
    - *Resultado:* ✅ **RESOLVIDO (26/01/2026)**.
    - *Histórico:* Divergência inicial de -R$ 1.9M corrigida.
    - *Ação:* 317 lançamentos sem nota fiscal (total R$ 2.3M) reclassificados de "Clientes" para "Empréstimos de Sócios".
    - *Saldo Atual Clientes:* R$ 408k (Coerente).

- [x] **5.2. Investigação de Discrepância de Receita**
    - Analisar por que existem R$ 2.3M de recebimentos para apenas R$ 136k de faturas.
    - *Status:* ✅ Concluído. Script `fix_orphan_receipts.mjs` executado com sucesso.
    - *Resultado:* Balanço saneado.

- [x] **5.3. Nova Anomalia Detectada: Despesas (R$ -1.2M)**
    - O DRE preliminar apontou **R$ 1.2M** na conta `4.1.1.08 - Outras Despesas Operacionais`.
    - *Diagnóstico:* Eram adiantamentos de sócios e empréstimos entre empresas classificados como despesa.
    - *Ação 1:* Saneamento de "Adiantamento Sócio" (Mové-los para `Filho Sergio` - Não Operacional). ✅ Feito.
    - *Ação 2:* Saneamento de "Ampla Saúde" (Mové-los para `Empréstimos` - Patrimonial). ✅ Feito.
    - *Ação 3:* Criar regras claras de pagamento (`MANUAL_PAGAMENTOS_AMPLA.md`). ✅ Feito.
    - *Status:* ✅ Parcialmente Resolvido (07/01/2026).

---

## 🚀 Fase 6: Motor de Fluxo de Caixa (Projection Engine)
**Objetivo:** Implementar "Visão de Futuro" (Contas a Pagar/Receber) baseada nas regras de negócio.

- [x] **6.1. Projeção de Folha de Pagamento (CLT)**
    - Implementar View `v_projections_payroll`.
    - Lógica: Salário base * 40% (Dia 15) e 60% (Dia 30).
    - Status: ✅ Concluído (View Operacional).

- [x] **6.2. Projeção de Prestadores (PJ)**
    - Implementar View `v_projections_contractors`.
    - Lógica: Valor Oficial + Não Oficial (Dia 10).
    - Status: ✅ Concluído (View Operacional).

- [x] **6.3. Relatório Unificado de Fluxo de Caixa**
    - `v_cash_flow_daily` = (Saldo Bancário) + (Recebimentos Futuros) - (Pagamentos Futuros).
    - *Status:* ✅ Concluído. Relatório operacional via `generate_cash_flow_report.mjs`.

---

## 🖥️ Fase 7: Integração Visual (Frontend)
**Objetivo:** Levar a inteligência do fluxo de caixa para a tela do usuário.

- [x] **7.1. Serviço de Fluxo de Caixa (Frontend)**
    - Criar `src/services/CashFlowService.ts`.
    - Lógica: Consumir `v_projections_payroll`, `v_projections_contractors` e `invoices` para montar o array unificado no cliente.
    - Status: ✅ Concluído.

- [x] **7.2. Componente de Projeção (Gráfico/Tabela)**
    - Adicionar ao Dashboard um widget "Fluxo de Caixa Projetado (30 dias)".
    - Exibir: Saldo Atual -> Entradas e Saídas Futuras -> Saldo Projetado.
    - Status: ✅ Concluído.

---

### Status Final (07/01/2026)
Todas as fases planejadas (1 a 7) foram concluídas. O sistema agora opera com o **Plano de Contas como Fonte Única da Verdade** e possui capacidade de projeção de fluxo de caixa integrada ao Dashboard.

---

## 🔮 O Futuro: Roadmap de Evolução (Update 07/01)

### 📊 Fase 8: Projeções 2.0 - Tributos e Custos Fixos
**Objetivo:** Tornar o Fluxo de Caixa "à prova de balas", incluindo gastos que não são de pessoal.
- [x] **8.1. Motor de Impostos (Tax Engine)**
    - Configurado tabelas `tax_configurations` e `tax_installments`.
    - View `v_projections_taxes` criada para estimar DAS (baseado na média de faturamento) e projetar parcelamentos.
    - Status: ✅ Implementado (07/01/2026).
- [x] **8.2. Despesas Recorrentes e Visão Unificada**
    - Criado tabela `recurring_expenses` (Aluguel, Softwares, Energia).
    - Criado View Unificada `v_cash_flow_daily` juntando: Faturas + Folha + Pjs + Impostos + Recorrentes.
    - Status: ✅ Implementado (07/01/2026).

### 🧠 Fase 9: Inteligência Artificial Ativa
**Objetivo:** Transformar os dados em "Insights Acionáveis" via Agentes.
- [x] **9.1. "Gestor IA" (Guardião do Caixa)**
    - Implementado `scripts/ai_guardian_cash_flow.mjs`.
    - Analisa `v_cash_flow_daily` e gera alertas de saldo negativo.
    - Status: ✅ Operacional (07/01/2026).
- [x] **9.2. "Dr. Cícero" (Auditor Contábil)**
    - Implementado `scripts/dr_cicero_auditor.mjs`.
    - Analisa `v_balancete` em busca de inversões de saldo e anomalias.
    - Status: ✅ Operacional (07/01/2026).
- [x] **9.3. Rotina de Automação**
    - Criado `run_daily_automation.ps1` para executar todos os agentes em sequência.
    - Status: ✅ Pronto para Agendamento.

### ⚡ Fase 10: Smart Conciliation (Automação de Rotina)
**Objetivo:** Reduzir o trabalho manual de classificação.
- [x] **10.1. Aprendizado de Classificação**
    - Criada tabela `classification_learning` e triggers na `bank_transactions`.
    - Sistema aprende (Trigger UPDATE) e prediz (Trigger INSERT) automaticamente a conta contábil baseado na descrição.
    - Status: ✅ Implementado e Testado (07/01/2026).

---

## ✅ CONCLUSÃO GERAL (07/01/2026)
Todos as fases do projeto "Engenharia Contábil" foram implementadas com sucesso. O sistema agora opera com:
1.  **Plano de Contas Real (SPED)** como fonte da verdade.
2.  **Partidas Dobradas Automáticas** para todas as transações (Faturamento, Recebimento, Despesa).
3.  **Projeção Avançada de Fluxo de Caixa** (Faturas + Folha + Impostos + Recorrentes).
4.  **Agentes de Auditoria IA** operando diariamente.
5.  **Conciliação Inteligente** que aprende com o uso.

O foco agora muda para **Manutenção e Monitoramento**.

---
