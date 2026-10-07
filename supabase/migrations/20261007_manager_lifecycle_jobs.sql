-- ProAR Manager - ciclo de vida, rollout e jobs administrativos
-- Migração aditiva. Nenhuma ação destrutiva é executada automaticamente.

alter table public.proar_manager_controls
  add column if not exists rollout_channel text not null default 'general'
    check (rollout_channel in ('pilot','staged','general')),
  add column if not exists target_version text,
  add column if not exists support_access_reason text;

create table if not exists public.proar_manager_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id text references public.proar_companies(id) on delete cascade,
  job_type text not null check (job_type in (
    'backup','restore','test_environment','export','termination','archive'
  )),
  status text not null default 'requested' check (status in (
    'requested','running','ready','error','cancelled'
  )),
  requested_by text,
  details jsonb not null default '{}'::jsonb,
  provider_reference text,
  error_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists proar_manager_jobs_company_status_idx
  on public.proar_manager_jobs(company_id, status, requested_at desc);

alter table public.proar_manager_jobs enable row level security;

comment on table public.proar_manager_jobs is
  'Fila auditável de ações administrativas do SaaS. Jobs são registrados antes de qualquer execução em provedor.';
