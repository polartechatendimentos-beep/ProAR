create table if not exists public.proar_companies (
  id text primary key,
  cnpj text not null unique check (cnpj ~ '^[0-9]{14}$'),
  legal_name text not null,
  trade_name text not null,
  city text not null,
  state char(2) not null,
  phone text,
  email text,
  address text,
  logo_path text,
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proar_company_states (
  company_id text primary key references public.proar_companies(id) on delete cascade,
  state jsonb not null default '{"customers":[],"serviceOrders":[],"moduleRecords":{}}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.proar_companies enable row level security;
alter table public.proar_company_states enable row level security;

-- O backend do ProAR usa exclusivamente a service role. Nenhuma tabela multiempresa
-- fica acessível diretamente pelo navegador; o CNPJ é validado em cada rota da API.
