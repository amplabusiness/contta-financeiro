create table if not exists accounting_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  year int not null,
  month int not null,

  status text not null default 'DRAFT', -- DRAFT | APPROVED | CLOSED | INVALIDATED
  input_hash text not null,

  model text not null,
  prompt_version text not null,

  decision jsonb not null,     -- CiceroDecision
  reasoning text not null,     -- redundante pra busca
  confidence numeric not null,

  created_at timestamptz not null default now(),
  created_by uuid not null,

  approved_at timestamptz,
  closed_at timestamptz,

  unique (tenant_id, year, month, input_hash)
);

create index if not exists idx_closures_tenant_period
  on accounting_closures (tenant_id, year, month);

create index if not exists idx_closures_status
  on accounting_closures (status);

create index if not exists idx_closures_decision_gin
  on accounting_closures using gin (decision);
