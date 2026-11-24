-- Base persistente para cadastro de clientes e catálogo comercial, segregada por empresa.
CREATE TABLE IF NOT EXISTS proar_customers (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  tipo_pessoa TEXT NOT NULL DEFAULT 'PF',
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  documento TEXT,
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT proar_customers_document_length CHECK (documento IS NULL OR length(documento) IN (11, 14)),
  CONSTRAINT proar_customers_uf_length CHECK (uf IS NULL OR length(uf) = 2)
);

CREATE INDEX IF NOT EXISTS proar_customers_company_name_idx ON proar_customers (company_id, nome);
CREATE UNIQUE INDEX IF NOT EXISTS proar_customers_company_document_uidx ON proar_customers (company_id, documento) WHERE documento IS NOT NULL;

CREATE TABLE IF NOT EXISTS proar_products (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  codigo TEXT NOT NULL,
  codigo_barras TEXT,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'PRODUTO' CHECK (tipo IN ('PRODUTO', 'SERVICO')),
  unidade TEXT NOT NULL DEFAULT 'UN',
  ncm TEXT,
  custo NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (custo >= 0),
  preco_venda NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),
  estoque_atual NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (estoque_atual >= 0),
  estoque_minimo NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT proar_products_ncm_length CHECK (ncm IS NULL OR length(ncm) = 8)
);

CREATE UNIQUE INDEX IF NOT EXISTS proar_products_company_code_uidx ON proar_products (company_id, codigo);
CREATE INDEX IF NOT EXISTS proar_products_company_description_idx ON proar_products (company_id, descricao);

