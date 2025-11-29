# Roadmap - Ampla Contabilidade SaaS

## Fase 1: Fundação (Atual)
**Status**: 85% Concluído ✅
**Objetivo**: Estabilizar arquitetura e preparar para multi-tenancy
**Última Atualização**: 2025-11-29

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

### 1.1b Contabilidade Inteligente ✅ (100% Concluído)
- [x] Edge Function `smart-accounting` (v3)
  - Inicialização automática do plano de contas
  - Criação de contas por cliente
  - Lançamentos contábeis inteligentes
  - Geração retroativa de lançamentos
- [x] UI com feedback visual em tempo real
- [x] Correção do bug `.single()` vs `.maybeSingle()`
- [x] Tratamento robusto de datas (extractDate)
- [x] Deploy em produção

### 1.1c Funcionalidades Financeiras ✅ (100% Concluído)
- [x] Sistema de Negociação de Dívidas
  - Parcelamento de faturas em atraso
  - 13º honorário automático
  - Registro de acordos
- [x] Reajuste de Honorários por Salário Mínimo
  - Integração API Banco Central
  - Cálculo automático de reajuste
  - Histórico de ajustes
- [x] Edição de Clientes Pro-Bono
  - Conversão para cliente pago
  - Campos condicionais por status
- [x] Saldo de Abertura no Dashboard

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

### 2.1 IA Contábil Avançada
- [ ] Classificação automática de lançamentos
- [ ] Detecção de anomalias
- [ ] Previsão de inadimplência
- [ ] Sugestões de otimização fiscal
- [ ] Chat com documentos (OCR + RAG)

### 2.2 Automação Total
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

### Prioridade Alta (Próximas tarefas)
1. Testar views materializadas no frontend
2. Criar job de refresh periódico (pg_cron)
3. Migrar dashboard para usar views
4. Implementar tenant padrão com dados existentes
5. Adicionar `tenant_id` nas tabelas principais

### Prioridade Média
1. RLS completo por tenant
2. API versionada
3. Testes automatizados
4. CI/CD pipeline
5. Documentação OpenAPI

### Prioridade Baixa (Backlog)
1. Mobile app
2. White label
3. Marketplace
4. Analytics avançado

---

## Histórico de Migrações Aplicadas

| Data | Migration | Descrição |
|------|-----------|-----------|
| 2025-11-29 | `smart-accounting` v3 | Edge Function - correção maybeSingle |
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

### Erros Comuns em Edge Functions (Supabase)

5. **`.single()` vs `.maybeSingle()` (29/11/2025)**
   - `.single()` lança erro se não encontrar registro
   - `.maybeSingle()` retorna `null` sem erro
   - Sempre verificar `data && !error` para confirmar existência

6. **Campos NOT NULL em INSERTs**
   - Sempre ter fallback para campos obrigatórios
   - Usar função auxiliar para parsing de datas
   - Fallback para `new Date().toISOString().split('T')[0]`

7. **Ordem de criação de registros hierárquicos**
   - Ordenar por nível antes de criar (pais primeiro)
   - Verificar existência do pai antes de criar filho
