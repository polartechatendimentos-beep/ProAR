-- ProAR Licitações IA + Bid Agent — migração aditiva e sem perda de dados
-- Executar no banco Vercel Postgres/Neon vinculado ao projeto antes de habilitar os fluxos reais.

ALTER TABLE licitacoes
  ADD COLUMN IF NOT EXISTS company_id integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS licitacoes_company_id_idx ON licitacoes (company_id);

CREATE TABLE IF NOT EXISTS licitacao_documents (
  id serial PRIMARY KEY,
  company_id integer NOT NULL DEFAULT 1,
  licitacao_id integer,
  tipo text NOT NULL,
  empresa text NOT NULL,
  cnpj text NOT NULL,
  emissao timestamp,
  validade timestamp,
  orgao_emissor text,
  situacao text NOT NULL DEFAULT 'valido',
  arquivo_nome text,
  arquivo_url text,
  ia_validou boolean NOT NULL DEFAULT false,
  ultima_utilizacao text,
  metadados_ia jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamp NOT NULL DEFAULT now(),
  atualizado_em timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS licitacao_documents_company_licitacao_idx ON licitacao_documents (company_id, licitacao_id);

CREATE TABLE IF NOT EXISTS licitacao_checklist_items (
  id serial PRIMARY KEY,
  company_id integer NOT NULL DEFAULT 1,
  licitacao_id integer NOT NULL,
  categoria text NOT NULL,
  requisito text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  risco text DEFAULT 'medio',
  justificativa_ia text,
  pagina_clausula text,
  documento_relacionado text,
  historico jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamp NOT NULL DEFAULT now(),
  atualizado_em timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS licitacao_checklist_company_licitacao_idx ON licitacao_checklist_items (company_id, licitacao_id);

CREATE TABLE IF NOT EXISTS licitacao_bid_sessions (
  id serial PRIMARY KEY,
  company_id integer NOT NULL DEFAULT 1,
  licitacao_id integer NOT NULL,
  portal_nome text NOT NULL,
  portal_endereco text,
  perfil_portal text,
  confianca_reconhecimento integer NOT NULL DEFAULT 0,
  modo_operacao text NOT NULL DEFAULT 'observador',
  status text NOT NULL DEFAULT 'aguardando',
  kill_switch_ativado boolean NOT NULL DEFAULT false,
  gravacao_ativa boolean NOT NULL DEFAULT false,
  iniciado_em timestamp,
  encerrado_em timestamp,
  criado_em timestamp NOT NULL DEFAULT now(),
  atualizado_em timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS licitacao_bid_sessions_company_licitacao_idx ON licitacao_bid_sessions (company_id, licitacao_id);

CREATE TABLE IF NOT EXISTS licitacao_bid_events (
  id serial PRIMARY KEY,
  company_id integer NOT NULL DEFAULT 1,
  licitacao_id integer NOT NULL,
  bid_session_id integer,
  hora_evento timestamp NOT NULL DEFAULT now(),
  melhor_mercado text,
  nosso_lance text,
  posicao text,
  acao text NOT NULL,
  origem text NOT NULL DEFAULT 'agente',
  mensagem_pregoeiro text,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS licitacao_bid_events_company_licitacao_idx ON licitacao_bid_events (company_id, licitacao_id);
