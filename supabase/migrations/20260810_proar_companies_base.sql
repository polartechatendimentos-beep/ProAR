-- Estrutura mestre mínima do ProAR Manager.
-- Incremental e segura: não remove nem substitui dados existentes.
create table if not exists public.proar_companies (
  id text primary key,
  cnpj text,
  legal_name text not null default '',
  trade_name text not null default '',
  city text not null default '',
  state text not null default 'SP',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
