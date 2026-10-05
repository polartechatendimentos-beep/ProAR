-- Migração aditiva do faturamento central do ProAR Manager.
-- Não altera nem remove lançamentos operacionais dos tenants.

alter table public.proar_companies
  add column if not exists billing_enabled boolean not null default false,
  add column if not exists monthly_fee_cents integer,
  add column if not exists billing_day smallint not null default 10,
  add column if not exists billing_issue_lead_days smallint not null default 7,
  add column if not exists billing_method text not null default 'pix',
  add column if not exists billing_auto_block boolean not null default true,
  add column if not exists billing_email text,
  add column if not exists access_block_source text,
  add column if not exists access_blocked_at timestamptz;

alter table public.proar_companies
  drop constraint if exists proar_companies_monthly_fee_nonnegative;
alter table public.proar_companies
  add constraint proar_companies_monthly_fee_nonnegative
  check (monthly_fee_cents is null or monthly_fee_cents >= 0);

alter table public.proar_companies
  drop constraint if exists proar_companies_billing_day_range;
alter table public.proar_companies
  add constraint proar_companies_billing_day_range
  check (billing_day between 1 and 28);

alter table public.proar_companies
  drop constraint if exists proar_companies_billing_issue_lead_range;
alter table public.proar_companies
  add constraint proar_companies_billing_issue_lead_range
  check (billing_issue_lead_days between 0 and 20);

alter table public.proar_companies
  drop constraint if exists proar_companies_billing_method_check;
alter table public.proar_companies
  add constraint proar_companies_billing_method_check
  check (billing_method in ('pix','boleto','card'));

create table if not exists public.proar_manager_receivables (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.proar_companies(id) on delete cascade,
  reference_month date not null,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending','paid','canceled','refunded')),
  payment_method text not null default 'pix'
    check (payment_method in ('pix','boleto','card','manual')),
  provider text not null default 'mercado_pago',
  provider_order_id text,
  provider_transaction_id text,
  provider_status text,
  public_token uuid not null default gen_random_uuid() unique,
  external_reference text not null unique,
  idempotency_key text not null unique,
  payment_url text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  boleto_digitable_line text,
  paid_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, reference_month)
);

create index if not exists proar_manager_receivables_company_due_idx
  on public.proar_manager_receivables(company_id, due_date desc);

create index if not exists proar_manager_receivables_status_due_idx
  on public.proar_manager_receivables(status, due_date);

alter table public.proar_manager_receivables enable row level security;


alter table public.proar_companies
  drop constraint if exists proar_companies_access_block_source_check;
alter table public.proar_companies
  add constraint proar_companies_access_block_source_check
  check (access_block_source is null or access_block_source in ('manual','trial','billing'));


create table if not exists public.proar_manager_module_entitlements (
  company_id text not null references public.proar_companies(id) on delete cascade,
  module_name text not null,
  enabled boolean not null default true,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  plan_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(company_id,module_name)
);

create index if not exists proar_manager_module_entitlements_company_idx
  on public.proar_manager_module_entitlements(company_id, enabled);

alter table public.proar_manager_module_entitlements enable row level security;
