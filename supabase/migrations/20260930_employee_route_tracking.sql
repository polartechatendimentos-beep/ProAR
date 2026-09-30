-- ProAR Mobile - histórico de rotas de trabalho
-- Migração estritamente aditiva. Não remove nem altera registros existentes.

create table if not exists proar_employee_route_sessions (
  id bigserial primary key,
  company_id bigint not null,
  employee_id bigint not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  distance_km numeric(12,3) not null default 0,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists proar_employee_route_points (
  id bigserial primary key,
  route_session_id bigint not null references proar_employee_route_sessions(id) on delete cascade,
  company_id bigint not null,
  employee_id bigint not null,
  service_order_id bigint,
  captured_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m numeric(10,2),
  speed_mps numeric(10,3),
  heading numeric(8,3),
  source text not null default 'mobile',
  created_at timestamptz not null default now()
);

create table if not exists proar_employee_route_stops (
  id bigserial primary key,
  route_session_id bigint not null references proar_employee_route_sessions(id) on delete cascade,
  company_id bigint not null,
  employee_id bigint not null,
  service_order_id bigint,
  arrived_at timestamptz,
  departed_at timestamptz,
  latitude double precision,
  longitude double precision,
  accuracy_m numeric(10,2),
  address_snapshot text,
  created_at timestamptz not null default now()
);

create index if not exists idx_route_sessions_company_employee_date on proar_employee_route_sessions(company_id, employee_id, started_at desc);
create index if not exists idx_route_points_session_time on proar_employee_route_points(route_session_id, captured_at);
create index if not exists idx_route_points_employee_time on proar_employee_route_points(company_id, employee_id, captured_at desc);
create index if not exists idx_route_stops_session on proar_employee_route_stops(route_session_id, arrived_at);
