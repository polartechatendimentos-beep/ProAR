-- Migração incremental: não remove nem substitui dados existentes.
alter table public.proar_companies
  add column if not exists last_manager_check_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists auto_registered boolean not null default false;

create index if not exists proar_companies_last_manager_check_idx
  on public.proar_companies(last_manager_check_at desc);
