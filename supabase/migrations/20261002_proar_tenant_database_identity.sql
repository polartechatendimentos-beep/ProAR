-- ProAR multiempresa: metadados de isolamento por tenant.
-- MIGRATION ADITIVA. Não executar automaticamente em produção.
-- A aplicação continua compatível sem estas colunas até a ativação controlada.

alter table public.proar_tenant_instances
  add column if not exists database_name text,
  add column if not exists tenant_role text default 'customer',
  add column if not exists environment text default 'production',
  add column if not exists isolation_mode text default 'dedicated-project';

create unique index if not exists proar_tenant_instances_database_name_uidx
  on public.proar_tenant_instances(database_name)
  where database_name is not null and database_name <> '';

create index if not exists proar_tenant_instances_role_idx
  on public.proar_tenant_instances(tenant_role, environment);

comment on column public.proar_tenant_instances.database_name is
  'Nome lógico estável do banco/ambiente operacional do tenant, ex.: proar_polartech.';
comment on column public.proar_tenant_instances.tenant_role is
  'primary-pilot para o Tenant 1 PolarTech; customer para empresas locatárias.';
comment on column public.proar_tenant_instances.environment is
  'pilot para o ambiente operacional piloto; production para clientes locatários.';
comment on column public.proar_tenant_instances.isolation_mode is
  'Estratégia de isolamento, inicialmente dedicated-project.';
