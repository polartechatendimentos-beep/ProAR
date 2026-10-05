-- ProAR Manager - Centro operacional SaaS
-- Migração aditiva. Não remove nem substitui dados existentes.

create table if not exists public.proar_manager_controls (
  company_id text primary key references public.proar_companies(id) on delete cascade,
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'Sistema em manutenção. Tente novamente mais tarde.',
  support_access_enabled boolean not null default false,
  support_access_until timestamptz,
  custom_domain text,
  domain_status text not null default 'not_configured' check (domain_status in ('not_configured','pending','online','error')),
  feature_flags jsonb not null default '{}'::jsonb,
  limit_overrides jsonb not null default '{}'::jsonb,
  backup_status text not null default 'not_requested' check (backup_status in ('not_requested','requested','running','ready','error')),
  backup_reference text,
  last_backup_at timestamptz,
  backup_retention_days integer not null default 30 check (backup_retention_days between 1 and 3650),
  updated_at timestamptz not null default now()
);

create table if not exists public.proar_manager_incidents (
  id uuid primary key default gen_random_uuid(),
  company_id text references public.proar_companies(id) on delete cascade,
  severity text not null default 'warning' check (severity in ('info','warning','error','critical')),
  status text not null default 'open' check (status in ('open','resolved')),
  title text not null,
  description text,
  source text not null default 'manager',
  code text,
  created_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists proar_manager_incidents_company_status_idx
  on public.proar_manager_incidents(company_id, status, created_at desc);

alter table public.proar_manager_controls enable row level security;
alter table public.proar_manager_incidents enable row level security;

comment on table public.proar_manager_controls is
  'Controles SaaS por tenant: manutenção, suporte, feature flags, domínio, limites e backup.';
comment on table public.proar_manager_incidents is
  'Central de incidentes operacionais do ProAR Manager.';
