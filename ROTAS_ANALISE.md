# Análise Completa de Rotas - Front-end vs Back-end

## 📋 Status Geral
**Data da Análise:** 15/11/2025  
**Total de Páginas:** 48  
**Total de Edge Functions:** 24  
**Rotas Configuradas:** 42

---

## 🎯 FRONT-END - Páginas e Rotas

### ✅ Rotas Configuradas no App.tsx (42 rotas)

#### Autenticação e Dashboards
- ✅ `/auth` → Auth.tsx
- ✅ `/dashboard` → Dashboard.tsx (Dashboard Principal)
- ✅ `/executive-dashboard` → ExecutiveDashboard.tsx
- ✅ `/client-dashboard` → ClientDashboard.tsx
- ✅ `/collection-dashboard` → CollectionDashboard.tsx

#### Gestão de Clientes
- ✅ `/clients` → Clients.tsx
- ✅ `/client-enrichment` → ClientEnrichment.tsx
- ✅ `/batch-enrichment` → BatchEnrichment.tsx
- ✅ `/merge-clients` → MergeClients.tsx

#### Contratos e Receitas
- ✅ `/contracts` → Contracts.tsx
- ✅ `/invoices` → Invoices.tsx
- ✅ `/revenue-types` → RevenueTypes.tsx
- ✅ `/fees-analysis` → FeesAnalysis.tsx
- ✅ `/client-ledger` → ClientLedger.tsx

#### Cobrança e Inadimplência
- ✅ `/collection-letters` → CollectionLetters.tsx
- ✅ `/collection-work-orders` → CollectionWorkOrders.tsx
- ✅ `/boleto-gaps` → BoletoGapsAnalysis.tsx

#### Conciliação Bancária
- ✅ `/bank-reconciliation` → BankReconciliation.tsx
- ✅ `/pix-reconciliation` → PixReconciliation.tsx
- ✅ `/reconciliation-dashboard` → ReconciliationDashboard.tsx
- ✅ `/reconciliation-discrepancies` → ReconciliationDiscrepancies.tsx
- ✅ `/unmatched-pix` → UnmatchedPixReport.tsx

#### Contabilidade
- ✅ `/chart-of-accounts` → ChartOfAccounts.tsx (Plano de Contas)
- ✅ `/livro-diario` → LivroDiario.tsx
- ✅ `/livro-razao` → LivroRazao.tsx
- ✅ `/balancete` → Balancete.tsx
- ✅ `/balance-sheet` → BalanceSheet.tsx (Balanço Patrimonial)
- ✅ `/dre` → DRE.tsx (DRE)
- ✅ `/trial-balance` → TrialBalance.tsx

#### Despesas
- ✅ `/expenses` → Expenses.tsx
- ✅ `/cost-center-analysis` → CostCenterAnalysis.tsx

#### Análises Estratégicas
- ✅ `/profitability-analysis` → ProfitabilityAnalysis.tsx
- ✅ `/economic-group-analysis` → EconomicGroupAnalysis.tsx

#### Importações
- ✅ `/import` → Import.tsx
- ✅ `/import-boletos` → ImportBoletos.tsx
- ✅ `/import-companies` → ImportCompanies.tsx
- ✅ `/import-invoices` → ImportInvoices.tsx

#### Ferramentas e IA
- ✅ `/ai-agents` → AIAgents.tsx
- ✅ `/fix-revenue-entries` → FixRevenueEntries.tsx
- ✅ `/regularize-accounting` → RegularizeAccounting.tsx
- ✅ `/audit-logs` → AuditLogs.tsx

#### Configurações
- ✅ `/settings` → Settings.tsx
- ✅ `/reports` → Reports.tsx

---

### ❌ Páginas SEM Rota Configurada (6 páginas)

1. **EconomicGroups.tsx**
   - Status: Arquivo existe mas não tem rota
   - Recomendação: Adicionar rota `/economic-groups`
   - Relacionado a: EconomicGroupAnalysis.tsx

2. **GeneralLedger.tsx**
   - Status: Arquivo existe mas não tem rota
   - Recomendação: Adicionar rota `/general-ledger`
   - Alternativa: Pode ser mesclado com Livro Razão

3. **Index.tsx**
   - Status: Página inicial (provavelmente redirecionamento)
   - Ação: Verificar se é necessário

4. **Journal.tsx**
   - Status: Arquivo existe mas não tem rota
   - Recomendação: Adicionar rota `/journal`
   - Alternativa: Pode ser mesclado com Livro Diário

5. **ServiceOrders.tsx**
   - Status: Arquivo existe mas não tem rota
   - Recomendação: Adicionar rota `/service-orders`
   - Relacionado a: Ordens de serviço de cobrança

---

## ⚙️ BACK-END - Edge Functions (24 funções)

### ✅ Edge Functions Implementadas

#### Inteligência Artificial (8 funções)
1. ✅ `ai-chatbot` - Chatbot com IA
2. ✅ `ai-churn-predictor` - Predição de churn
3. ✅ `ai-expense-classifier` - Classificação de despesas
4. ✅ `ai-financial-analyst` - Análise financeira
5. ✅ `ai-fraud-detector` - Detecção de fraudes
6. ✅ `ai-pix-reconciliation` - Reconciliação PIX com IA
7. ✅ `ai-pricing-optimizer` - Otimização de preços
8. ✅ `ai-reconciliation-agent` - Agente de reconciliação

#### Conciliação e Automação (3 funções)
9. ✅ `auto-reconciliation` - Reconciliação automática
10. ✅ `automation-scheduler` - Agendador de automações
11. ✅ `notification-dispatcher` - Dispatcher de notificações

#### Integração Bancária (5 funções)
12. ✅ `cora-banking-service` - Serviço Cora Banking
13. ✅ `pluggy-integration` - Integração Pluggy
14. ✅ `parse-cnab-file` - Parser de CNAB
15. ✅ `parse-ofx-statement` - Parser de OFX (extrato bancário)
16. ✅ `process-bank-statement` - Processamento de extrato

#### Processamento de Dados (3 funções)
17. ✅ `process-billing-data` - Processamento de faturamento
18. ✅ `process-boleto-report` - Processamento de relatório de boletos
19. ✅ `update-invoice-status` - Atualização de status de faturas

#### Contabilidade (2 funções)
20. ✅ `create-accounting-entry` - Criação de lançamentos contábeis
21. ✅ `regularize-accounting` - Regularização contábil

#### Enriquecimento de Dados (2 funções)
22. ✅ `enrich-client-data` - Enriquecimento de dados do cliente
23. ✅ `sync-client-enrichment` - Sincronização de enriquecimento

#### Correções (1 função)
24. ✅ `fix-revenue-entries` - Correção de lançamentos de receita

---

## 🔴 FUNCIONALIDADES FALTANDO (Back-end)

### Edge Functions que Deveriam Existir

1. **`generate-collection-letters`**
   - Página existe: CollectionLetters.tsx
   - Necessidade: Gerar cartas de cobrança automaticamente
   - Prioridade: ALTA

2. **`process-service-orders`**
   - Página existe: ServiceOrders.tsx (sem rota)
   - Necessidade: Processar ordens de serviço
   - Prioridade: MÉDIA

3. **`calculate-profitability`**
   - Página existe: ProfitabilityAnalysis.tsx
   - Necessidade: Cálculos complexos de rentabilidade
   - Prioridade: ALTA

4. **`generate-dre-report`**
   - Página existe: DRE.tsx
   - Necessidade: Gerar relatório DRE automaticamente
   - Prioridade: ALTA

5. **`generate-balance-sheet`**
   - Página existe: BalanceSheet.tsx
   - Necessidade: Gerar balanço patrimonial
   - Prioridade: ALTA

6. **`export-accounting-reports`**
   - Páginas: Balancete, LivroDiario, LivroRazao
   - Necessidade: Exportar relatórios contábeis (PDF/Excel)
   - Prioridade: MÉDIA

7. **`process-economic-groups`**
   - Página existe: EconomicGroups.tsx (sem rota)
   - Necessidade: Processamento de grupos econômicos
   - Prioridade: BAIXA

8. **`sync-contract-billing`**
   - Página existe: Contracts.tsx
   - Necessidade: Sincronizar faturamento de contratos
   - Prioridade: ALTA

9. **`calculate-fees`**
   - Página existe: FeesAnalysis.tsx
   - Necessidade: Calcular honorários automaticamente
   - Prioridade: ALTA

---

## 🐛 PROBLEMAS IDENTIFICADOS

### Build Errors Críticos (12+ erros)

1. **AutoReconciliation.tsx**
   - `setSelectedTransaction` não definido
   - Propriedades `clients`, `competence`, `amount` ausentes em tipos
   - Prioridade: CRÍTICA

2. **Balancete.tsx**
   - Tentando usar tabela `accounting_entry_items` (não existe)
   - Tentando usar view `vw_balancete` (não existe)
   - Propriedades `account_type`, `nature` não existem em `chart_of_accounts`
   - Prioridade: CRÍTICA (usuário reportou sem dados)

3. **CollectionLetters.tsx**
   - Tentando usar tabela `message_templates` (não existe)
   - Múltiplos erros de tipo
   - `setIsSending` não definido
   - Prioridade: ALTA

4. **CollectionWorkOrders.tsx**
   - `setIsLoading` não definido
   - `setSelectedOrder` não definido
   - Prioridade: ALTA

5. **Contracts.tsx**
   - Erro de tipo incompatível ao setar clientes
   - Prioridade: MÉDIA

6. **EconomicGroupAnalysis.tsx**
   - Mencionado nos erros (não detalhado)
   - Prioridade: MÉDIA

---

## 📊 TABELAS DO BANCO FALTANDO

Baseado nos erros de build, estas tabelas/views não existem:

1. ❌ `accounting_entry_items` (usado em Balancete.tsx)
   - Alternativa: Usar `accounting_entry_lines`
   
2. ❌ `vw_balancete` (view usada em Balancete.tsx)
   - Solução: Criar view ou calcular em runtime

3. ❌ `message_templates` (usado em CollectionLetters.tsx)
   - Solução: Criar tabela para templates de mensagens

4. ❌ `service_orders` (ServiceOrders.tsx sem rota)
   - Solução: Criar tabela se funcionalidade for necessária

---

## ✅ RECOMENDAÇÕES DE CORREÇÃO

### Prioridade CRÍTICA (Resolver Imediatamente)

1. **Corrigir Balancete.tsx**
   - Usar `accounting_entry_lines` ao invés de `accounting_entry_items`
   - Remover referências a `vw_balancete`
   - Usar `type` ao invés de `account_type` e `nature`
   - Status: EM PROGRESSO

2. **Corrigir AutoReconciliation.tsx**
   - Adicionar estado `setSelectedTransaction`
   - Corrigir interfaces de tipos

### Prioridade ALTA (Resolver nos Próximos Dias)

3. **Criar Edge Functions Faltantes**
   - `generate-collection-letters`
   - `calculate-profitability`
   - `generate-dre-report`
   - `generate-balance-sheet`
   - `sync-contract-billing`
   - `calculate-fees`

4. **Adicionar Rotas Faltantes**
   - `/economic-groups` → EconomicGroups.tsx
   - `/service-orders` → ServiceOrders.tsx
   - `/general-ledger` → GeneralLedger.tsx
   - `/journal` → Journal.tsx

5. **Corrigir CollectionLetters.tsx**
   - Criar tabela `message_templates`
   - Adicionar estados faltantes
   - Corrigir tipos

### Prioridade MÉDIA

6. **Criar Funcionalidade de Exportação**
   - Edge function `export-accounting-reports`
   - Suporte a PDF/Excel

7. **Melhorar Estrutura de Dados**
   - Criar views otimizadas para relatórios
   - Adicionar índices necessários

### Prioridade BAIXA

8. **Organizar Código**
   - Decidir se mesclará GeneralLedger com LivroRazao
   - Decidir se mesclará Journal com LivroDiario
   - Limpar arquivos não utilizados

---

## 📈 MÉTRICAS

- **Completude de Rotas:** 87% (42/48 páginas)
- **Cobertura Back-end:** ~75% (18/24 funcionalidades principais)
- **Build Errors:** 50+ erros TypeScript
- **Edge Functions Faltantes:** ~9 funções críticas

---

## 🎯 PLANO DE AÇÃO SUGERIDO

### Fase 1 - Correções Críticas (1-2 dias)
- [ ] Corrigir Balancete.tsx completamente
- [ ] Corrigir AutoReconciliation.tsx
- [ ] Corrigir erros de build em todas as páginas

### Fase 2 - Back-end Essencial (3-5 dias)
- [ ] Criar `generate-collection-letters`
- [ ] Criar `calculate-fees`
- [ ] Criar `sync-contract-billing`
- [ ] Criar `calculate-profitability`

### Fase 3 - Relatórios Contábeis (2-3 dias)
- [ ] Criar `generate-dre-report`
- [ ] Criar `generate-balance-sheet`
- [ ] Criar `export-accounting-reports`

### Fase 4 - Organização (1-2 dias)
- [ ] Adicionar rotas faltantes
- [ ] Criar tabelas faltantes
- [ ] Limpar código não utilizado

---

**Conclusão:** A aplicação está ~80% completa, mas com erros críticos que impedem funcionalidade total. Priorizar correção de Balancete e AutoReconciliation, seguido de implementação de edge functions essenciais.
