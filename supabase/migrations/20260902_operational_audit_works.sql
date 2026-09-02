-- Expansão incremental do ProAR.
-- Não remove nem reescreve proar_state, registros, vínculos ou históricos existentes.

create table if not exists public.proar_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  entity_type text not null,
  entity_id text not null,
  category text not null default 'documento',
  storage_url text not null,
  file_name text,
  mime_type text,
  byte_size bigint,
  caption text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists proar_attachments_entity_idx
  on public.proar_attachments(company_id, entity_type, entity_id, created_at desc);

create table if not exists public.proar_audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists proar_audit_events_entity_idx
  on public.proar_audit_events(company_id, entity_type, entity_id, created_at desc);

create table if not exists public.proar_work_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  work_id text not null,
  contact_type text not null check (contact_type in ('engenharia','fiscalizacao')),
  name text not null,
  company_name text,
  role_name text,
  registry text,
  phone text,
  whatsapp text,
  email text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  starts_at date,
  ends_at date,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proar_work_contacts_work_idx
  on public.proar_work_contacts(company_id, work_id, contact_type, is_active);

create table if not exists public.proar_work_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  work_id text not null,
  block_code text,
  unit_code text,
  environment_name text,
  work_stage text,
  change_type text,
  original_measure text,
  new_measure text,
  measure_unit text,
  description text,
  reason text,
  requested_by text,
  requested_at timestamptz not null default now(),
  status text not null default 'solicitada' check (status in ('solicitada','em_analise','aprovada','em_execucao','executada','conferida','concluida','rejeitada','cancelada')),
  approved_by text,
  executed_by text,
  checked_by text,
  revision integer not null default 1,
  parent_request_id uuid references public.proar_work_change_requests(id),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proar_work_change_requests_work_idx
  on public.proar_work_change_requests(company_id, work_id, status, requested_at desc);

create table if not exists public.proar_work_consumptions (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  work_id text not null,
  block_code text,
  unit_code text,
  work_stage text not null,
  product_id text not null,
  stock_movement_id uuid references public.proar_stock_movements(id),
  planned_quantity numeric(14,3) not null default 0,
  waste_percent numeric(6,3) not null default 0,
  final_quantity numeric(14,3) not null,
  status text not null default 'confirmado' check (status in ('previsto','confirmado','estornado')),
  created_by text,
  created_at timestamptz not null default now(),
  unique(company_id, work_id, block_code, unit_code, work_stage, product_id, status)
);
create index if not exists proar_work_consumptions_work_idx
  on public.proar_work_consumptions(company_id, work_id, work_stage, created_at desc);

alter table public.proar_attachments enable row level security;
alter table public.proar_audit_events enable row level security;
alter table public.proar_work_contacts enable row level security;
alter table public.proar_work_change_requests enable row level security;
alter table public.proar_work_consumptions enable row level security;
