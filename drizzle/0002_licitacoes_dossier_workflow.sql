-- Campos aditivos para os prazos do edital, acompanhamento pós-disputa e aprovação do dossiê.
-- Valores existentes são preservados; os novos fluxos iniciam com estruturas vazias.
ALTER TABLE licitacoes
  ADD COLUMN IF NOT EXISTS prazos_edital jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resultado_detalhado jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS aprovacao_dossie jsonb NOT NULL DEFAULT '{}'::jsonb;
