# Arquitetura Enterprise-Grade SaaS

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                 │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   Web App       │   Mobile App    │   Public API    │   Webhooks            │
│   (React)       │   (React Native)│   (REST/GraphQL)│   (Event Push)        │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                  │                    │
         ▼                 ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    Auth     │  │ Rate Limit  │  │   Tenant    │  │     Versioning      │ │
│  │   (JWT)     │  │ (per plan)  │  │  Resolver   │  │    (v1, v2, ...)    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
├───────────────────────────────┬─────────────────────────────────────────────┤
│        COMMAND SIDE           │              QUERY SIDE                      │
│  ┌─────────────────────────┐  │  ┌─────────────────────────────────────────┐│
│  │   Command Handlers      │  │  │           Query Handlers                ││
│  │   - CreateInvoice       │  │  │   - GetClientDashboard                  ││
│  │   - ReconcilePayment    │  │  │   - GetExecutiveSummary                 ││
│  │   - CreateEntry         │  │  │   - GetTrialBalance                     ││
│  │   - UpdateClient        │  │  │   - GetCashFlow                         ││
│  └───────────┬─────────────┘  │  └───────────────────────────────────────┬─┘│
│              │                │                                          │  │
│              ▼                │                                          │  │
│  ┌─────────────────────────┐  │                                          │  │
│  │    Domain Services      │  │                                          │  │
│  │   - AccountingRules     │  │                                          │  │
│  │   - ReconciliationAI    │  │                                          │  │
│  │   - ValidationEngine    │  │                                          │  │
│  └───────────┬─────────────┘  │                                          │  │
│              │                │                                          │  │
│              ▼                │                                          ▼  │
│  ┌─────────────────────────┐  │  ┌─────────────────────────────────────────┐│
│  │    Event Emitter        │──┼──│       Materialized Views               ││
│  │   (domain_events)       │  │  │   - mv_client_balances                 ││
│  └─────────────────────────┘  │  │   - mv_default_summary                 ││
└───────────────────────────────┴──│   - mv_trial_balance                   │─┘
                                   │   - mv_cash_flow                       │
                                   │   - mv_dre_monthly                     │
                                   └─────────────────────────────────────────┘
         │                                          ▲
         ▼                                          │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
├───────────────────────────────────────┬─────────────────────────────────────┤
│           WRITE DB                    │            READ DB                   │
│  ┌─────────────────────────────────┐  │  ┌───────────────────────────────┐  │
│  │   accounting_entries            │  │  │   Materialized Views          │  │
│  │   invoices                      │  │  │   (refreshed every 5 min)     │  │
│  │   expenses                      │  │  │                               │  │
│  │   clients                       │  │  │   Cache Layer (Redis)         │  │
│  │   bank_transactions             │  │  │   (hot data, sessions)        │  │
│  │   domain_events                 │  │  │                               │  │
│  └─────────────────────────────────┘  │  └───────────────────────────────┘  │
│                                       │                                      │
│   Row Level Security (RLS)            │   Read Replicas                      │
│   tenant_id on all tables             │   (for heavy queries)                │
└───────────────────────────────────────┴─────────────────────────────────────┘
```

## Componentes Principais

### 1. Multi-Tenancy

```sql
-- Estrutura de tenant
tenants
├── id (UUID)
├── name
├── slug (único)
├── cnpj
├── plan (starter, professional, enterprise)
├── status (active, suspended, cancelled, trial)
└── settings (JSONB)

tenant_users
├── tenant_id
├── user_id
├── role (owner, admin, manager, member, viewer)
├── permissions (JSONB array)
└── is_active

-- RLS Policy padrão
CREATE POLICY tenant_isolation ON clients
  USING (tenant_id = get_current_tenant_id());
```

### 2. Event Sourcing

```sql
-- Todos os eventos do sistema
domain_events
├── id
├── tenant_id
├── aggregate_type (client, invoice, expense, transaction)
├── aggregate_id
├── event_type (created, updated, deleted, status_changed)
├── event_version
├── payload (JSONB - dados completos)
├── metadata (JSONB)
├── user_id
├── correlation_id (rastrear operações relacionadas)
├── causation_id (evento que causou este)
├── created_at
└── processed_at

-- Exemplo de uso
INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload)
VALUES ('invoice', '123', 'paid', '{"amount": 1500, "payment_date": "2025-11-28"}');
```

### 3. CQRS Pattern

```typescript
// COMMAND - Escrita
async function cmd_create_accounting_entry(
  accountId: string,
  entryDate: Date,
  entryType: 'debit' | 'credit',
  amount: number,
  description: string
): Promise<string> {
  // 1. Validação
  // 2. Inserção em accounting_entries
  // 3. Emissão de evento
  // 4. Notificação para refresh de views
  return newId;
}

// QUERY - Leitura (usa view materializada)
async function qry_client_dashboard(clientId: string): Promise<Dashboard> {
  // Lê de mv_client_balances + mv_default_summary
  // Resposta instantânea, sem joins complexos
  return dashboard;
}
```

### 4. Views Materializadas

| View | Fonte | Atualização | Uso |
|------|-------|-------------|-----|
| `mv_client_balances` | accounting_entries + clients | 5 min | Dashboard cliente |
| `mv_default_summary` | invoices + clients | 5 min | Inadimplência |
| `mv_trial_balance` | accounting_entries + chart_of_accounts | 5 min | Balancete |
| `mv_cash_flow` | bank_transactions | 5 min | Fluxo de caixa |
| `mv_dre_monthly` | accounting_entries | 5 min | DRE |

### 5. Segurança em Camadas

```
┌─────────────────────────────────────────────────────────┐
│ Camada 1: Autenticação (Supabase Auth)                  │
│ - JWT tokens                                            │
│ - Refresh tokens                                        │
│ - MFA (TOTP)                                           │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│ Camada 2: Autorização (tenant_users + permissions)      │
│ - Role-based access control                             │
│ - Feature flags por tenant                              │
│ - Permissions granulares                                │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│ Camada 3: RLS (Row Level Security)                      │
│ - Isolamento por tenant                                 │
│ - Políticas automáticas                                 │
│ - Auditoria                                             │
└────────────────────────────┬────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────┐
│ Camada 4: Validação (Application Layer)                 │
│ - Schema validation (Zod)                               │
│ - Business rules                                        │
│ - Rate limiting                                         │
└─────────────────────────────────────────────────────────┘
```

## Fluxo de Dados

### Escrita (Command)

```
1. Request → API Gateway
2. Auth + Tenant Resolution
3. Validation
4. Command Handler
5. Domain Service (business logic)
6. Write to accounting_entries (fonte única)
7. Emit domain_event
8. Notify pg_notify('refresh_views', 'view_name')
9. Response
```

### Leitura (Query)

```
1. Request → API Gateway
2. Auth + Tenant Resolution
3. Cache Check (Redis)
4. Query Handler
5. Read from Materialized View
6. Cache Update
7. Response
```

### Refresh de Views

```
1. pg_notify recebido OU cron (5 min)
2. REFRESH MATERIALIZED VIEW CONCURRENTLY
3. Log em materialized_view_refresh_log
4. Invalidar cache relacionado
```

## API Design

### Versionamento

```
/api/v1/clients       → Versão atual
/api/v2/clients       → Nova versão (breaking changes)
/api/legacy/clients   → Compatibilidade
```

### Endpoints Padrão

```
GET    /api/v1/clients              → Listar
GET    /api/v1/clients/:id          → Detalhe
POST   /api/v1/clients              → Criar
PATCH  /api/v1/clients/:id          → Atualizar
DELETE /api/v1/clients/:id          → Remover

# CQRS específico
POST   /api/v1/commands/create-entry     → Command
GET    /api/v1/queries/client-dashboard  → Query
GET    /api/v1/queries/executive-summary → Query
```

### Headers

```
Authorization: Bearer <jwt>
X-Tenant-ID: <tenant_id> (opcional, inferido do JWT)
X-Request-ID: <uuid> (para correlation)
X-API-Version: v1
```

## Escalabilidade

### Horizontal

```
┌──────────────────────────────────────────────────────────┐
│                     Load Balancer                         │
└──────────────────┬───────────────────┬───────────────────┘
                   │                   │
          ┌────────▼────────┐ ┌────────▼────────┐
          │   App Server 1  │ │   App Server 2  │
          └────────┬────────┘ └────────┬────────┘
                   │                   │
          ┌────────▼───────────────────▼────────┐
          │         Connection Pooler           │
          │         (PgBouncer/Supavisor)       │
          └────────┬───────────────────┬────────┘
                   │                   │
          ┌────────▼────────┐ ┌────────▼────────┐
          │  Primary DB     │ │  Read Replica   │
          │  (writes)       │ │  (reads)        │
          └─────────────────┘ └─────────────────┘
```

### Caching Strategy

```
L1: Browser Cache (static assets, 1 year)
L2: CDN Edge (API responses, 1 min)
L3: Redis (hot data, sessions, 5 min)
L4: Materialized Views (derived data, 5 min)
L5: Database (source of truth)
```

## Monitoramento

### Métricas

```typescript
// Performance
response_time_p50
response_time_p95
response_time_p99

// Availability
uptime_percentage
error_rate
success_rate

// Business
active_tenants
daily_transactions
reconciliation_rate
```

### Alertas

```yaml
- name: High Error Rate
  condition: error_rate > 1%
  severity: critical
  notify: pagerduty

- name: Slow Queries
  condition: query_time_p95 > 2s
  severity: warning
  notify: slack

- name: View Refresh Failed
  condition: refresh_error = true
  severity: critical
  notify: pagerduty
```

## Disaster Recovery

### Backup Strategy

```
- Full backup: Daily (3am)
- Incremental: Every 6 hours
- WAL archiving: Continuous
- Retention: 30 days
- Geo-redundancy: 2 regions
```

### Recovery Objectives

```
RPO (Recovery Point Objective): 1 hour
RTO (Recovery Time Objective): 4 hours
```

### Failover Process

```
1. Detect primary failure
2. Promote read replica
3. Update DNS/connection strings
4. Verify data integrity
5. Resume operations
6. Post-mortem
```
