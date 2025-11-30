# Roadmap - Ampla Contabilidade SaaS

## Fase 1: Fundação (Atual)
**Status**: 90% Concluído ✅
**Objetivo**: Estabilizar arquitetura e preparar para multi-tenancy
**Última Atualização**: 2025-11-30

### 1.1 Arquitetura de Dados ✅ (100% Concluído)
- [x] Criar views materializadas para consultas
  - `mv_client_balances` - Saldos por cliente via `client_ledger`
  - `mv_default_summary` - Resumo de inadimplência
  - `mv_dre_monthly` - DRE mensal via `accounting_entry_items`
  - `mv_cash_flow` - Fluxo de caixa via invoices/expenses
  - `mv_trial_balance` - Balancete via `accounting_entry_items`
- [x] Implementar CQRS (Commands/Queries separados)
  - `cmd_create_accounting_entry()` - Criação de lançamentos
  - `qry_client_dashboard()` - Dashboard do cliente
  - `qry_executive_summary()` - Resumo executivo
- [x] Event Sourcing com `domain_events`
  - Tabela criada com campos: aggregate_type, event_type, payload, correlation_id
  - Triggers automáticos em clients, invoices, expenses, bank_transactions
- [x] Triggers para captura automática de eventos
- [x] **Migration aplicada em produção (28/11/2025)**

### 1.2 Multi-Tenancy 🔄 (40% Concluído)
- [x] Tabela `tenants` e `tenant_users`
  - Estrutura: id, name, slug, plan, status, settings
  - Roles: owner, admin, manager, member, viewer
- [x] Tabela `tenant_features` para feature flags
- [x] Função `get_current_tenant_id()`
- [x] Função `user_has_permission()`
- [ ] Adicionar `tenant_id` em todas as tabelas existentes
- [ ] Implementar RLS policies com tenant_id
- [ ] Migrar dados existentes para tenant padrão
- [ ] Função de switch de tenant no frontend
- [ ] UI de seleção de tenant

### 1.3 API Unificada 📋
- [ ] Versionamento de API (v1, v2)
- [ ] Rate limiting por tenant/plano
- [ ] Documentação OpenAPI/Swagger
- [ ] SDK JavaScript para integrações

### 1.4 Autenticação Avançada 📋
- [ ] SSO (SAML, OAuth)
- [ ] MFA (TOTP, SMS)
- [ ] Gestão de sessões
- [ ] Audit log de acessos

---

## Fase 2: Recursos Avançados
**Timeline**: 2-3 meses após Fase 1
**Objetivo**: Diferenciação competitiva

### 2.1 IA Contábil Avançada 🔄 (90% Concluído)
- [x] **Contador IA Automático** - Valida lançamentos em background
  - Tabela `ai_validation_queue` para fila
  - Tabela `ai_accountant_activity` para log
  - Edge Function `ai-accountant-background`
  - Widget `AIAccountantWidget` no dashboard
- [x] **Gestor Empresarial IA (MBA)** - Análises empresariais
  - Perfil MBA (Harvard, Wharton, INSEAD, CFA)
  - Metodologias: Balanced Scorecard, OKRs, ZBB, Six Sigma
  - Detecção de anomalias em despesas
  - Gestão de inadimplência (régua de cobrança)
  - Edge Function `ai-business-manager`
  - Página `BusinessManager.tsx`
- [x] **Equipe de 8 Agentes IA** - Cada tela tem agente responsável
  - Dr. Cícero (Contador), Prof. Milton (Finanças), Dra. Helena (Gestão)
  - Atlas (Rede Neural), Dr. Advocato (Trabalhista), Sr. Empresário
  - Sr. Vendedor (Comercial), Sra. Marketing (Marketing)
- [x] **Sistema de Aprendizado** - IA aprende com humano
  - Tabelas: ai_known_entities, ai_classification_patterns
  - Diálogo IA-Humano para classificação
- [x] Detecção de anomalias (benchmark por setor)
- [ ] Previsão de inadimplência (machine learning)
- [ ] Sugestões de otimização fiscal
- [ ] Chat com documentos (OCR + RAG)

### 2.2 Automação Total 🔄 (70% Concluído)
- [x] Validação automática de lançamentos (Contador IA)
- [x] Lançamentos contábeis automáticos para faturas (triggers)
- [x] **CI/CD GitHub Actions** - Deploy automático
  - Supabase migrations automáticas
  - Edge Functions deploy
  - Vercel frontend deploy
  - Notificações de status
- [x] **Sistema de Evolução Contínua** - Lovable.dev interno
  - Funcionários solicitam melhorias
  - IA analisa e orienta
  - Templates prontos (6 tipos)
- [ ] Conciliação 100% automática
- [ ] Fechamento contábil automatizado
- [ ] Geração automática de relatórios
- [ ] Alertas inteligentes (WhatsApp, Email)
- [ ] Workflows personalizáveis

### 2.3 Integrações
- [ ] Bancos via Open Finance
- [ ] Sistemas de NF-e (SEFAZ)
- [ ] ERPs (SAP, TOTVS, Omie)
- [ ] Contabilidade (Domínio, Fortes)
- [ ] Planilhas (Google Sheets, Excel)

### 2.4 Portal do Cliente
- [ ] Dashboard self-service
- [ ] Upload de documentos
- [ ] Chat com contador
- [ ] Assinatura digital
- [ ] Pagamento online de honorários

---

## Fase 3: Escala SaaS
**Timeline**: 3-6 meses após Fase 2
**Objetivo**: Preparar para crescimento

### 3.1 Infraestrutura
- [ ] CDN para assets estáticos
- [ ] Edge Functions globais
- [ ] Database replicas
- [ ] Cache distribuído (Redis)
- [ ] Backup automatizado

### 3.2 Monetização
- [ ] Planos (Starter, Pro, Enterprise)
- [ ] Billing com Stripe
- [ ] Usage metering
- [ ] Upgrade/downgrade self-service
- [ ] Trials e coupons

### 3.3 Onboarding
- [ ] Wizard de configuração
- [ ] Importação de dados legados
- [ ] Templates de plano de contas
- [ ] Vídeos tutoriais
- [ ] Suporte in-app

### 3.4 White Label
- [ ] Customização de branding
- [ ] Domínio personalizado
- [ ] Emails branded
- [ ] Relatórios com logo do cliente

---

## Fase 4: Ecossistema
**Timeline**: 6-12 meses após Fase 3
**Objetivo**: Plataforma completa

### 4.1 Marketplace
- [ ] API pública para parceiros
- [ ] Apps de terceiros
- [ ] Templates de relatórios
- [ ] Integrações prontas

### 4.2 Comunidade
- [ ] Fórum de usuários
- [ ] Base de conhecimento
- [ ] Programa de afiliados
- [ ] Certificações

### 4.3 Mobile
- [ ] App iOS/Android
- [ ] Push notifications
- [ ] Offline mode
- [ ] Biometria

### 4.4 Analytics Avançado
- [ ] Business Intelligence
- [ ] Benchmarking do setor
- [ ] Insights preditivos
- [ ] Dashboards personalizáveis

---

## Métricas de Sucesso

### Técnicas
| Métrica | Meta Fase 1 | Meta Final |
|---------|-------------|------------|
| Uptime | 99.5% | 99.99% |
| Response Time (p95) | < 500ms | < 100ms |
| Error Rate | < 1% | < 0.1% |
| Conciliação automática | 70% | 95% |

### Negócio
| Métrica | Meta Fase 1 | Meta Final |
|---------|-------------|------------|
| Tenants | 5 | 1000+ |
| MRR | R$ 5k | R$ 500k+ |
| Churn | < 10% | < 3% |
| NPS | 30+ | 60+ |

---

## Decisões Técnicas Pendentes

### 1. Background Jobs
**Opções**:
- Supabase Edge Functions + pg_cron
- Inngest
- Trigger.dev
- AWS Lambda + EventBridge

**Recomendação**: Inngest (melhor DX, retry automático)

### 2. Real-time
**Opções**:
- Supabase Realtime (atual)
- Pusher
- Ably
- Socket.io

**Recomendação**: Manter Supabase Realtime (já integrado)

### 3. File Storage
**Opções**:
- Supabase Storage (atual)
- Cloudflare R2
- AWS S3

**Recomendação**: Supabase Storage + CDN

### 4. Email
**Opções**:
- Resend
- Postmark
- SendGrid

**Recomendação**: Resend (melhor DX, bom pricing)

### 5. Monitoring
**Opções**:
- Sentry (errors)
- LogFlare (logs)
- Grafana Cloud

**Recomendação**: Sentry + LogFlare (integração Supabase)

---

## Notas de Implementação

### ✅ Concluído (28/11/2025)
1. ~~Aplicar migration de arquitetura SaaS~~ ✅
2. ~~Criar estrutura de event sourcing~~ ✅
3. ~~Criar views materializadas~~ ✅
4. ~~Criar funções CQRS~~ ✅
5. ~~Linkar Supabase CLI~~ ✅
6. ~~Organizar arquivos de documentação~~ ✅

### Prioridade Alta (Segunda-feira 01/12)
1. ~~Configurar GitHub Actions secrets~~ → Executar `scripts/setup-cicd.ps1`
2. Push para main e testar CI/CD
3. Verificar deploy no Vercel (ampla.app.br)
4. Criar interfaces pendentes para equipe usar

### Interfaces Pendentes (Prioridade Alta)
1. Tela para funcionário preencher entidades pendentes
2. Interface de Configurações com cadastros
3. Interface de Estoque/Compras para Lilian
4. Interface de Folha de Pagamento com comparativo
5. Interface de Consultoria Trabalhista
6. Interface de Vídeos e TVs com player
7. Interface de Incentivos e PLR
8. Interface de Feature Requests

### Prioridade Média
1. RLS completo por tenant
2. API versionada
3. Testes automatizados
4. Documentação OpenAPI
5. Testar views materializadas no frontend

### Prioridade Baixa (Backlog)
1. Mobile app
2. White label
3. Marketplace
4. Analytics avançado

---

## Histórico de Migrações Aplicadas

| Data | Migration | Descrição |
|------|-----------|-----------|
| 2025-11-30 | `20251130140000_continuous_improvement_system.sql` | Sistema evolução contínua (Lovable interno) |
| 2025-11-30 | `20251130130000_openai_sora2_video_generation.sql` | Integração OpenAI Sora 2 vídeos |
| 2025-11-30 | `20251130120000_business_maturity_analysis.sql` | Análise maturidade empresarial |
| 2025-11-30 | `20251130110000_video_content_generation.sql` | Geração de conteúdo IA |
| 2025-11-30 | `20251130100000_marketing_employee_incentives.sql` | Incentivos, comissões, PLR |
| 2025-11-30 | `20251130090000_business_development_solutions.sql` | Soluções de negócios, vendas |
| 2025-11-30 | `20251130080000_ai_governance_automation.sql` | Governança IA, reuniões |
| 2025-11-30 | `20251130070000_payroll_esocial_system.sql` | Folha pagamento eSocial |
| 2025-11-30 | `20251130060000_labor_law_advisory_system.sql` | Consultoria trabalhista IA |
| 2025-11-30 | `20251130050000_inventory_purchasing_system.sql` | Estoque e compras |
| 2025-11-30 | `20251130040000_company_profile_employees.sql` | Perfil empresa, funcionários |
| 2025-11-30 | `20251130030000_sergio_expense_categories.sql` | Categorias despesas sócio |
| 2025-11-30 | `20251130020000_partner_expense_accounts.sql` | Contas centros de custo |
| 2025-11-30 | `20251130010000_reset_january_transactions.sql` | Reset transações Janeiro |
| 2025-11-30 | `20251130000000_cleanup_duplicate_bank_accounts.sql` | Limpeza contas duplicadas |
| 2025-11-29 | `20251129280000_ai_transaction_learning.sql` | Sistema aprendizado IA |
| 2025-11-29 | `20251129270000_opening_balance_entry.sql` | Lançamento abertura |
| 2025-11-29 | `20251129260000_register_sicredi_account.sql` | Conta Sicredi |
| 2025-11-29 | `20251129250000_complete_chart_of_accounts.sql` | Plano de contas completo |
| 2025-11-29 | `20251129130000_ai_validation_queue.sql` | Sistema de fila para validação IA |
| 2025-11-29 | `20251129120000_ai_accountant_automation.sql` | Contador IA automático |
| 2025-11-29 | `20251129110000_auto_accounting_for_invoices.sql` | Lançamentos automáticos faturas |
| 2025-11-29 | `20251129100000_fix_opening_balance_to_pl.sql` | Fix saldo abertura → PL |
| 2025-11-29 | `20251129000000_remove_automatic_accounting_triggers.sql` | Remove triggers órfãos |
| 2025-11-28 | `20251128_saas_architecture_foundation.sql` | Arquitetura SaaS completa |
| 2025-11-28 | `20251128000000_add_clients_notes_column.sql` | Coluna notes em clients |
| 2025-11-20 | `20251120000200_grant_rpc_permissions.sql` | Permissões RPC |
| 2025-11-20 | `20251120000300_create_super_conciliador_functions.sql` | Super Conciliador |

## Lições Aprendidas

### Erros Comuns em Migrations

1. **`ALTER TABLE IF NOT EXISTS` inválido no PostgreSQL**
   - Usar `DO $$ BEGIN IF NOT EXISTS... END $$;` para DDL condicional

2. **Referência a colunas inexistentes em views**
   - Sempre verificar schema real antes de criar views
   - `accounting_entries` não tem `client_id` - usar `accounting_entry_items`
   - `bank_transactions` pode não ter `transaction_type`

3. **Conflitos de timestamp em migrations**
   - Usar timestamps com precisão de segundos: `20251120000200` ao invés de `20251120`

4. **Usar tabelas corretas para cada contexto**
   - `client_ledger` para saldos de clientes
   - `accounting_entry_items` para itens de lançamento
   - `invoices.due_date` (não `payment_date`)
