# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [2.0.0] - 2026-01-31

### 🚀 RELEASE ENTERPRISE-GRADE

Esta versão representa uma **evolução significativa** do sistema, incorporando
funcionalidades enterprise-grade aprovadas pelo Dr. Cícero.

### ✨ Adicionado

#### 🔒 Compliance & Auditoria

- **Audit Log Imutável (WORM)** - Trilha de auditoria com hash encadeado estilo blockchain
  - Tabela `audit_log_immutable` com proteção contra UPDATE/DELETE
  - Triggers de segurança que impedem modificação
  - Hash SHA256 encadeado para verificação de integridade
  - Função `verify_chain_integrity()` para validação completa

- **Decisões Dr. Cícero Assinadas** - Registro de decisões com hash verificável
  - Tabela `dr_cicero_decisions` com assinatura digital SHA256
  - Níveis de autoridade: `auto`, `supervised`, `expert`
  - Verificação de integridade via `verify_decision_hash()`
  - View `v_decision_integrity_report` para relatórios

- **Educação Obrigatória** - Flag para erros críticos
  - Tabela `education_requirements` para requisitos educacionais
  - Tabela `education_acknowledgments` para reconhecimentos
  - Modal bloqueante até acknowledgment com hash
  - Funções `can_proceed_after_education()` e `acknowledge_education()`

- **Compliance Dashboard** - Nova página `/compliance-dashboard`
  - Visualização do audit log WORM
  - Verificação de integridade da cadeia
  - Monitoramento de decisões Dr. Cícero
  - Status de educação obrigatória

#### 🧠 Base de Conhecimento Expandida

- **KnowledgeBase Completa** (~700 linhas)
  - eSocial: Eventos, categorias, incidências tributárias
  - Nota Fiscal: CFOP, CST, CSOSN, LC 116
  - Indicadores MBA: Liquidez, rentabilidade, endividamento
  - Lançamentos Contábeis: 50+ templates por categoria

#### 📊 Novas Páginas

- **Data Lake Page** - Central de documentos com RAG
- **Educator Page** - Agente educador interativo
- **Premium Features** - Demonstração de funcionalidades premium

#### 🔧 Serviços

- **ClassificationService** - Classificação inteligente com validações Dr. Cícero
- **DrCiceroAuditService** - Auditoria automatizada de fechamento

### 🗄️ Banco de Dados

- 3 migrations enterprise-grade (audit_log_immutable, dr_cicero_decisions, education_requirements)
- 8+ novas funções SQL para compliance

### 🛡️ Segurança

- RLS em todas as novas tabelas
- Triggers de proteção contra modificação
- Hash encadeado blockchain-style

---

## [1.30.5] - 2026-01-06

### Corrigido
- **Contabilidade Invertida**: Correção crítica na lógica de importação bancária. Pagamentos (débitos) estavam entrando como receitas (créditos) e vice-versa. Agora valida explicitamente o `transaction_type` ('credit'/'debit').
- **Classificação Econet**: Transações "Econet" não caem mais na vala comum de "Outras Despesas". Criada conta específica `4.1.2.16 - Assinaturas Econet` e regra de mapeamento automática.
- **Calendário SuperConciliação**: O seletor de Mês/Ano agora lembra a última seleção mesmo após recarregar a página (persistência via localStorage).

### Dados
- **Regeneração Fev/2025**: Todos os lançamentos de Fevereiro 2025 foram regenerados com a nova lógica e contas corretas.

---

## [1.21.0] - 2025-12-10

### Adicionado
- **Sistema de Honorários Especiais**: Gestão completa de honorários diferenciados
  - **Honorários Variáveis**: % sobre faturamento (ex: Mata Pragas 2.87% dia 20)
  - **Abertura/Alteração de Empresas**: Controle de valor cobrado vs taxas pagas = lucro
  - **Comissões por Indicação**: 10% do honorário por X meses para quem indicou (com PIX)
  - **IRPF**: Declarações anuais dos sócios e particulares (média R$ 300)
- 8 novas tabelas: `client_variable_fees`, `client_monthly_revenue`, `company_services`, `company_service_costs`, `referral_partners`, `client_referrals`, `referral_commission_payments`, `irpf_declarations`
- Trigger `trg_update_service_costs` para calcular lucro automaticamente
- Trigger `trg_calculate_referral_end_date` para data fim de comissões
- Função `generate_irpf_forecast()` para gerar IRPF dos sócios automaticamente
- Função `calculate_variable_fee()` para calcular honorário baseado em faturamento
- Views: `vw_pending_commissions`, `vw_clients_variable_fees`, `vw_irpf_summary`
- Página `/special-fees` centralizada no menu Honorários > Especiais

### Menu
- Item "Especiais" adicionado ao grupo "Honorários" no sidebar

---

## [1.20.0] - 2025-12-10

### Adicionado
- **Identificação por CNPJ**: Dr. Cícero agora identifica clientes pelo CNPJ presente na descrição do PIX
- **Grupos Econômicos**: Suporte completo a grupos econômicos com rateio de pagamentos
- **Grupo Cezário criado**: A.I EMPREENDIMENTOS como pagador principal (3 empresas: Alliance, Mamute Jeans, Papelaria Jardim Goiás)
- Novas actions: `identify_client_by_cnpj`, `get_economic_group_members`
- Função `extractCnpjFromDescription()` para extrair CNPJ com/sem formatação
- Função `findRelatedCompaniesByQsa()` para encontrar empresas relacionadas pelo QSA
- Script de teste: `test-cnpj-identification.mjs`, `create-grupo-cezario.mjs`

### Melhorado
- `ruleBasedClassificationAsync()` agora busca primeiro por CNPJ, depois por nome
- Quando cliente pertence a grupo econômico, mostra opções de rateio
- Quando cliente tem empresas relacionadas (pelo QSA), sugere vinculação

### Fluxo de Classificação Atualizado
1. Extrai CNPJ da descrição (se houver)
2. Busca cliente pelo CNPJ
3. Verifica se cliente pertence a grupo econômico
4. Se grupo: oferece opções de rateio entre empresas
5. Se não grupo: verifica empresas relacionadas pelo QSA
6. Se não encontrou por CNPJ: busca por nome no QSA dos clientes

---

## [1.19.0] - 2025-12-10

### Adicionado
- **Verificação de Saldo de Abertura**: Dr. Cícero agora verifica se cliente tem débitos antigos antes de classificar
- Função `clienteTemSaldoAbertura()` para consultar saldos pendentes
- Pergunta interativa quando cliente tem dívida antiga: "É pagamento de dívida antiga ou honorário atual?"
- Opção para dividir pagamento entre dívida antiga e competência atual

### Melhorado
- Classificação de recebimentos agora considera o histórico de débitos do cliente
- Janeiro/2025 sempre classifica como baixa de Clientes a Receber (período de abertura)
- Fevereiro+ pergunta ao usuário quando cliente tem saldo devedor antigo

### Corrigido
- Adicionada função `ruleBasedClassificationSync()` para fallback do Gemini

---

## [1.18.0] - 2025-12-10

### Adicionado
- **Identificação de Sócios nos Pagamentos**: Dr. Cícero agora consulta QSA (Quadro de Sócios) para identificar quem está pagando
- Novas actions: `identify_payer_by_name`, `build_client_index`
- Classificação automática quando sócio tem apenas uma empresa
- Pergunta interativa quando sócio tem múltiplas empresas
- Scripts de teste: `explore-qsa.mjs`, `test-payer-identification.mjs`

### Corrigido
- Coluna `fantasy_name` → `nome_fantasia` na Edge Function

---

## [1.17.0] - 2025-12-10

### Adicionado
- **Regra de Período de Abertura**: Janeiro/2025 configurado como período de abertura
- Action `validate_transaction_signs` no Dr. Cícero
- Recebimentos em janeiro classificados como baixa de recebíveis (não receita)

### Corrigido
- Sinais das transações bancárias (31 transações DEBIT corrigidas)
- Mapeamento `type` → `transaction_type` no SuperConciliador

---

## [1.16.0] - 2025-12-10

### Adicionado
- **Dr. Cícero - Contador IA Guardian**: Edge Function responsável por toda classificação contábil
- Tabela `ai_learned_patterns` com 28 padrões iniciais
- Integração com SuperConciliador (Dialog de classificação)
- Contexto da família Leão para separação de despesas pessoais
- Contas de Adiantamento a Sócios (1.1.3.xx)
- Conta de Investimentos - Ampla Saúde (1.2.1.01)
- Centros de Custo para família Leão

### Padrões Aprendidos
- Tarifas bancárias: TARIFA, TED, DOC
- Recebimentos: LIQ.COBRANCA, PIX
- Despesas: ENERGIA, CEMIG, TELEFONE, INTERNET, ALUGUEL
- Família Leão: 18 padrões específicos

---

## [1.15.0] - 2025-12-06

### Corrigido
- **Lint Errors Zerados**: Todos os 52 erros de lint corrigidos
- Chamadas duplicadas de `loadClients` no Layout.tsx
- Tipagem incorreta no AIExecutionHistory.tsx
- Código duplicado no Clients.tsx
- Função `useSuggestion` → `applySuggestion` (falso positivo de hook)
- Tipo genérico `Function` → `LogFunction` tipado em Edge Functions

### Modificado
- Edge Functions: ai-accounting-engine, ai-automation-agent, ai-bank-transaction-processor, ai-initial-load, ai-orchestrator

---

## [1.14.0] - 2025-12-06

### Corrigido
- **5 Bugs Críticos**:
  1. Rotas duplicadas no App.tsx (`/import-invoices`, `/ai-agents`, `/settings`)
  2. Memory leak no DefaultReportImporter.tsx (setInterval não limpo)
  3. DOMParser indisponível em ambientes não-browser (ofxParser.ts)
  4. Race condition no ExpenseUpdateContext.tsx (useState → useRef)
  5. Variável não utilizada no AccountingService.ts

### Modificado
- Null safety no FileImporter.tsx
- Error handling no Auth.tsx
- Validação NaN no AppSidebar.tsx

---

## [1.13.0] - 2025-06-09

### Adicionado
- **Sistema de Realtime**: Hook `useRealtimeSubscription` para atualizações em tempo real
- Páginas com Realtime: RecurringExpenses, AccountsPayable, Clients, Invoices
- Badge "Ao vivo" nas páginas com realtime ativo
- Script `import_jan2025.py` para importação de despesas

### Importado
- 46 despesas de Janeiro/2025 totalizando R$ 166.157,37

### Removido
- 42 branches do Copilot coding agent no GitHub

---

## [1.12.0] - 2025-11-30

### Corrigido
- Logo na tela de login
- Deploy #78 bem-sucedido no Vercel

---

## [1.11.0] - 2025-11-30

### Adicionado
- **CI/CD GitHub Actions**: Deploy automático para Supabase + Vercel
- Sistema de Folha de Pagamento (eSocial)
- Sistema de Estoque e Compras
- Sistema de Consultoria Trabalhista IA
- Sistema de PLR e Incentivos
- Integração OpenAI Sora 2 para vídeos
- Tela de Login redesenhada

### Novas Páginas
- `/payroll` - Folha de Pagamento
- `/inventory` - Estoque e Compras
- `/video-content` - Vídeos e TVs
- `/labor-advisory` - Consultoria Trabalhista
- `/feature-requests` - Solicitações de Melhoria
- `/ai-network` - Rede Neural (21 agentes)

### Equipe de 8 Agentes IA
- Dr. Cícero (Contador), Prof. Milton (MBA), Dra. Helena (Gestora)
- Atlas (Rede Neural), Dr. Advocato (Trabalhista), Sr. Empresário (Estratégia)
- Sr. Vendedor (Comercial), Sra. Marketing

---

## [1.10.0] - 2025-11-29

### Adicionado
- **Migração Lovable → Gemini**: Todas Edge Functions migradas para Google Gemini API
- Helper `_shared/gemini.ts` para chamadas à API
- Contador IA Automático (Background)
- Gestor Empresarial IA (MBA-Trained)
- Widget AIAccountantWidget no dashboard

### Corrigido
- Saldo de Abertura: Agora vai para PL (5.2.1.02), não para Receita
- Balanço Patrimonial: Incluído Resultado do Exercício no PL
- DRE: Refatorado para usar accounting_entry_lines

---

## [1.9.0] - 2025-11-29

### Corrigido
- Balancete com cálculo de saldo incorreto
- Triggers automáticos criando entries órfãos (removidos)
- Supabase `.or()` e `!inner` com comportamento inesperado

### Adicionado
- Função `queue_entry_for_ai_validation`
- Tabela `ai_validation_queue`

---

## [1.8.0] - 2025-11-28

### Corrigido
- Conflito de timestamp em migrations
- Coluna `payment_date` → `due_date` em invoices

---

## [1.7.0] - 2025-11-28

### Corrigido
- ALTER TABLE IF NOT EXISTS inválido no PostgreSQL
- Coluna `client_id` não existe em `accounting_entries`
- Coluna `transaction_type` não existe em `bank_transactions`

---

## [1.6.0] - 2025-11-28

### Adicionado
- Views Materializadas (CQRS): mv_client_balances, mv_default_summary, mv_dre_monthly, mv_cash_flow, mv_trial_balance
- Funções CQRS: cmd_create_accounting_entry, qry_client_dashboard, qry_executive_summary

---

## [1.5.0] - 2025-11-27

### Adicionado
- Trigger automático para faturas: `trg_auto_accounting_invoice`
- Função `create_invoice_accounting_entry()`
- Função `process_invoices_without_accounting()`

---

## [1.4.0] - 2025-11-26

### Adicionado
- Super Conciliador: Split de transações para múltiplos clientes
- Event Sourcing: Tabela `domain_events` com triggers

---

## [1.3.0] - 2025-11-25

### Adicionado
- Multi-Tenancy (SaaS): RLS com tenant_id
- Tabelas: `tenants`, `tenant_users`
- Função `get_current_tenant_id()`

---

## [1.2.0] - 2025-11-24

### Adicionado
- Sistema de Saldo de Abertura
- Integração completa: client_opening_balance → invoices → client_ledger → accounting_entries

---

## [1.1.0] - 2025-11-23

### Adicionado
- 21 Edge Functions de IA (Gemini 2.0)
- Páginas: AIAccountant, AIAgents, AIInsights, BusinessManager
- Conciliação Bancária com importação OFX/CNAB

---

## [1.0.0] - 2025-11-22

### Adicionado
- **Versão Inicial**
- Gestão de Clientes (CNPJ/CPF, Pro-Bono, Barter)
- Honorários (Invoices) com geração recorrente
- Contabilidade: Plano de Contas, Lançamentos, Balancete, DRE, Balanço
- Stack: React 18.3 + TypeScript + Vite + TailwindCSS + shadcn/ui + Supabase

---

## Convenções de Versionamento

- **MAJOR (X.0.0)**: Mudanças incompatíveis na API ou arquitetura
- **MINOR (0.X.0)**: Novas funcionalidades compatíveis
- **PATCH (0.0.X)**: Correções de bugs compatíveis

## Links

- **Produção**: https://ampla.vercel.app
- **Repositório**: https://github.com/amplabusiness/data-bling-sheets-3122699b
- **Supabase**: https://xdtlhzysrpoinqtsglmr.supabase.co
