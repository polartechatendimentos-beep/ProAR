-- ProAR | Licitações IA + Bid Agent
-- Migration exclusivamente aditiva e idempotente. Não executar durante restauração.
create table if not exists procurement_sources(
 id text primary key,company_id text,name text not null,base_url text not null,source_type text not null,
 integration_mode text not null check(integration_mode in('official_api','official_open_data','public_search','authorized_partner_api','manual_link','disabled')),
 enabled boolean not null default true,priority integer not null default 100,status text not null default 'pending',health_message text,last_sync_at timestamptz,last_success_at timestamptz,last_error_at timestamptz,
 supports_items boolean not null default false,supports_documents boolean not null default false,supports_status boolean not null default false,supports_deadlines boolean not null default false,supports_results boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists procurement_sync_runs(
 id uuid primary key default gen_random_uuid(),company_id text,source_id text references procurement_sources(id),started_at timestamptz not null default now(),finished_at timestamptz,status text not null default 'running',
 imported_count integer not null default 0,rejected_count integer not null default 0,error_message text,metadata jsonb not null default '{}'::jsonb
);
create table if not exists procurement_opportunities(
 id uuid primary key default gen_random_uuid(),company_id text,canonical_id text not null,pncp_id text,source text not null,source_external_id text,source_url text,buyer_name text,buyer_cnpj text,unit_name text,state text,city text,modality text,process_number text,notice_number text,object text not null,legal_basis text,dispute_mode text,
 is_price_registration boolean not null default false,estimated_value numeric,published_at timestamptz,proposal_start_at timestamptz,proposal_end_at timestamptz,session_at timestamptz,status text not null default 'draft',score integer not null default 0 check(score between 0 and 100),
 raw_payload jsonb not null default '{}'::jsonb,normalized_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,canonical_id)
);
create table if not exists procurement_opportunity_sources(
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null references procurement_opportunities(id),source_id text references procurement_sources(id),external_id text,source_url text,original_payload jsonb not null default '{}'::jsonb,imported_at timestamptz not null default now(),unique(opportunity_id,source_id,external_id)
);
create table if not exists procurement_documents(
 id uuid primary key default gen_random_uuid(),company_id text,opportunity_id uuid references procurement_opportunities(id),document_type text not null,name text not null,storage_url text,required boolean not null default false,expires_at timestamptz,status text not null default 'pending',metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create table if not exists procurement_checklist(
 id uuid primary key default gen_random_uuid(),company_id text,opportunity_id uuid not null references procurement_opportunities(id),requirement_key text not null,label text not null,severity text not null default 'attention' check(severity in('ok','attention','blocker','not_applicable')),required boolean not null default true,status text not null default 'pending',source_reference text,action_hint text,validated_by text,validated_at timestamptz,created_at timestamptz not null default now(),unique(opportunity_id,requirement_key)
);
create table if not exists procurement_proposals(
 id uuid primary key default gen_random_uuid(),company_id text,opportunity_id uuid not null references procurement_opportunities(id),status text not null default 'draft',total numeric not null default 0,minimum_authorized_value numeric,ready_to_submit boolean not null default false,ready_calculated_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists procurement_bid_authorizations(
 id uuid primary key default gen_random_uuid(),company_id text,opportunity_id uuid not null references procurement_opportunities(id),previous_limit numeric not null,new_limit numeric not null,justification text not null,authorized_by text not null,authorized_at timestamptz not null default now()
);
create table if not exists procurement_audit_events(
 id uuid primary key default gen_random_uuid(),company_id text,opportunity_id uuid references procurement_opportunities(id),event_type text not null,actor text,payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
insert into procurement_sources(id,name,base_url,source_type,integration_mode,enabled,priority,status,health_message,supports_items,supports_documents,supports_status,supports_deadlines,supports_results) values
 ('pncp','PNCP','https://pncp.gov.br','national','official_api',true,1,'pending','Aguardando primeira sincronização.',true,true,true,true,true),
 ('compras-gov','Compras.gov.br','https://www.gov.br/compras','federal','official_open_data',true,2,'pending','Aguardando primeira sincronização.',true,false,true,true,false),
 ('bll','BLL Compras','https://bll.org.br','marketplace','manual_link',true,10,'manual','Sem API autorizada configurada; acesso pelo link oficial.',false,false,false,false,false),
 ('portal-compras-publicas','Portal de Compras Públicas','https://www.portaldecompraspublicas.com.br','marketplace','manual_link',true,11,'manual','Sem API autorizada configurada; acesso pelo link oficial.',false,false,false,false,false),
 ('licitanet','Licitanet','https://licitanet.com.br','marketplace','manual_link',true,12,'manual','Sem API autorizada configurada; acesso pelo link oficial.',false,false,false,false,false)
on conflict(id) do nothing;
create index if not exists idx_procurement_sync_runs_company_started on procurement_sync_runs(company_id,started_at desc);
create index if not exists idx_procurement_opportunities_company_score on procurement_opportunities(company_id,score desc,last_seen_at desc);
create index if not exists idx_procurement_opportunities_company_deadline on procurement_opportunities(company_id,proposal_end_at);
create index if not exists idx_procurement_opportunity_sources_opportunity on procurement_opportunity_sources(opportunity_id,imported_at desc);
create index if not exists idx_procurement_documents_company_opportunity on procurement_documents(company_id,opportunity_id,created_at desc);
create index if not exists idx_procurement_checklist_company_opportunity on procurement_checklist(company_id,opportunity_id);
create index if not exists idx_procurement_proposals_company_opportunity on procurement_proposals(company_id,opportunity_id,updated_at desc);
create index if not exists idx_procurement_bid_authorizations_company_opportunity on procurement_bid_authorizations(company_id,opportunity_id,authorized_at desc);
create index if not exists idx_procurement_audit_events_company_created on procurement_audit_events(company_id,created_at desc);
create index if not exists idx_procurement_audit_events_opportunity on procurement_audit_events(opportunity_id,created_at desc);
alter table procurement_sources enable row level security;
alter table procurement_sync_runs enable row level security;
alter table procurement_opportunities enable row level security;
alter table procurement_opportunity_sources enable row level security;
alter table procurement_documents enable row level security;
alter table procurement_checklist enable row level security;
alter table procurement_proposals enable row level security;
alter table procurement_bid_authorizations enable row level security;
alter table procurement_audit_events enable row level security;
