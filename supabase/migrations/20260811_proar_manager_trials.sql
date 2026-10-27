alter table public.proar_companies alter column cnpj drop not null;

alter table public.proar_companies
  add column if not exists person_type text default 'PJ',
  add column if not exists cpf text,
  add column if not exists responsible_name text,
  add column if not exists whatsapp text,
  add column if not exists zip_code text,
  add column if not exists street text,
  add column if not exists address_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists state_registration text,
  add column if not exists municipal_registration text,
  add column if not exists company_type text,
  add column if not exists tax_regime text,
  add column if not exists segment text,
  add column if not exists slug text,
  add column if not exists plan_code text default 'trial',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_expires_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists modules jsonb not null default '["Painel inicial","Agenda","Clientes","Equipamentos","Orçamentos","Vendas","Ordens de serviço","Obras","Serviços","Produtos","Estoque","Compras","Fornecedores","Financeiro","Funcionários","Relatórios","Configurações"]'::jsonb,
  add column if not exists brand_config jsonb not null default '{}'::jsonb;

create unique index if not exists proar_companies_slug_uidx on public.proar_companies(slug) where slug is not null;
create unique index if not exists proar_companies_cpf_uidx on public.proar_companies(cpf) where cpf is not null and cpf <> '';

create table if not exists public.proar_trial_users (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.proar_companies(id) on delete cascade,
  username text not null,
  display_name text not null,
  password_hash text not null,
  role text not null default 'Administrador',
  permissions jsonb not null default '["*"]'::jsonb,
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, username)
);

create table if not exists public.proar_tenant_instances (
  company_id text primary key references public.proar_companies(id) on delete cascade,
  provider text not null default 'supabase',
  project_ref text,
  project_name text,
  api_url text,
  encrypted_secret text,
  provisioning_status text not null default 'pending' check (provisioning_status in ('pending','creating','ready','error','manual')),
  provisioning_error text,
  last_health_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proar_manager_audit (
  id bigserial primary key,
  company_id text,
  action text not null,
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.proar_trial_users enable row level security;
alter table public.proar_tenant_instances enable row level security;
alter table public.proar_manager_audit enable row level security;


create table if not exists public.proar_trial_attempts (
  id bigserial primary key,
  ip_hash text not null,
  document_hash text,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists proar_trial_attempts_ip_created_idx on public.proar_trial_attempts(ip_hash, created_at desc);
alter table public.proar_trial_attempts enable row level security;
