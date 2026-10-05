-- ProAR Manager - Contas a receber e bloqueio financeiro automático
-- Migração aditiva. Não remove nem altera dados operacionais dos tenants.

alter table public.proar_companies
  add column if not exists billing_auto_block boolean not null default true,
  add column if not exists billing_grace_days integer not null default 0 check (billing_grace_days between 0 and 90);

create table if not exists public.proar_manager_receivables (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.proar_companies(id) on delete cascade,
  description text not null default 'Mensalidade ProAR',
  amount numeric(14,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'open' check (status in ('open','paid','cancelled')),
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proar_manager_receivables_company_due_idx
  on public.proar_manager_receivables(company_id, due_date);

create index if not exists proar_manager_receivables_status_due_idx
  on public.proar_manager_receivables(status, due_date);

alter table public.proar_manager_receivables enable row level security;

comment on table public.proar_manager_receivables is
  'Contas a receber do SaaS ProAR. Usada pelo ProAR Manager para cobrança e bloqueio financeiro automático.';
