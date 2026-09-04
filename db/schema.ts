import { pgTable, serial, text, timestamp, boolean, jsonb, integer, numeric } from "drizzle-orm/pg-core";

// 1. Licitações e Monitoramento PNCP
export const licitacoes = pgTable("licitacoes", {
  id: serial("id").primaryKey(),
  numeroControlePncp: text("numero_controle_pncp"),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  orgao: text("orgao").notNull(),
  uf: text("uf").default("SP"),
  modalidade: text("modalidade").default("Pregão Eletrônico"),
  valorEstimado: text("valor_estimado"),
  dataAbertura: timestamp("data_abertura"),
  dataFimProposta: timestamp("data_fim_proposta"),
  linkEdital: text("link_edital"),
  categoria: text("categoria"),
  status: text("status").default("em_andamento").notNull(),
  notificadoWhatsapp: boolean("notificado_whatsapp").default(false).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// 2. Ordens de Serviço & Relatórios de Tarefa (PMOC)
export const ordensServico = pgTable("ordens_servico", {
  id: serial("id").primaryKey(),
  numeroTarefa: text("numero_tarefa").notNull(),
  companyId: integer("company_id").default(1),
  clienteNome: text("cliente_nome").notNull(),
  clienteCnpjCpf: text("cliente_cnpj_cpf").notNull(),
  clienteContato: text("cliente_contato"),
  clienteTelefone: text("cliente_telefone"),
  clienteEmail: text("cliente_email"),
  equipe: text("equipe").default("TEAM 11"),
  tipoTarefa: text("tipo_tarefa").default("Higienização").notNull(),
  dataAgendamento: timestamp("data_agendamento"),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  duracao: text("duracao"),
  kmInformado: text("km_informado").default("0,00 Km"),
  endereco: text("endereco").notNull(),
  orientacao: text("orientacao"),
  relatoExecucao: text("relato_execucao"),
  checklist: jsonb("checklist").notNull(),
  fotosAntes: jsonb("fotos_antes"),
  fotosDepois: jsonb("fotos_depois"),
  assinaturaTecnicoNome: text("assinatura_tecnico_nome"),
  assinaturaTecnicoDoc: text("assinatura_tecnico_doc"),
  assinaturaClienteNome: text("assinatura_cliente_nome"),
  assinaturaClienteDoc: text("assinatura_cliente_doc"),
  status: text("status").default("Concluído").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// 3. Multi-empresa e Gestão de Tenants
export const companies = pgTable("proar_companies", {
  id: serial("id").primaryKey(),
  cnpj: text("cnpj").unique().notNull(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  subdomain: text("subdomain").unique(),
  emailContato: text("email_contato"),
  telefone: text("telefone"),
  cidade: text("cidade").default("Mirassol"),
  uf: text("uf").default("SP"),
  plano: text("plano").default("proar_complete"),
  status: text("status").default("ativo").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// 4. Gestão do Portal Manager & Acessos
export const managerTrials = pgTable("manager_trials", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  nomeResponsavel: text("nome_responsavel").notNull(),
  email: text("email").notNull(),
  telefone: text("telefone"),
  dataInicio: timestamp("data_inicio").defaultNow().notNull(),
  dataFim: timestamp("data_fim").notNull(),
  status: text("status").default("ativo").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const managerDailyAccess = pgTable("manager_daily_access", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  usuarioEmail: text("usuario_email").notNull(),
  ip: text("ip"),
  dataAcesso: timestamp("data_acesso").defaultNow().notNull(),
});

// 5. Módulo de Obras & Operações em Campo
export const works = pgTable("works", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").default(1).notNull(),
  codigo: text("codigo").notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  clienteNome: text("cliente_nome").notNull(),
  clienteCnpj: text("cliente_cnpj"),
  endereco: text("endereco").notNull(),
  cidade: text("cidade").default("Mirassol"),
  uf: text("uf").default("SP"),
  dataInicio: timestamp("data_inicio"),
  previsaoTermino: timestamp("previsao_termino"),
  dataConclusao: timestamp("data_conclusao"),
  valorContrato: numeric("valor_contrato", { precision: 12, scale: 2 }).default("0.00"),
  progresso: integer("progresso").default(0).notNull(),
  status: text("status").default("em_andamento").notNull(),
  engenheiroResponsavel: text("engenheiro_responsavel"),
  equipe: text("equipe").default("TEAM 11"),
  tokenPublico: text("token_publico").unique().notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const workFindings = pgTable("work_findings", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull(),
  companyId: integer("company_id").default(1).notNull(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  tipo: text("tipo").default("nao_conformidade").notNull(),
  gravidade: text("gravidade").default("media").notNull(),
  status: text("status").default("aberto").notNull(),
  fotos: jsonb("fotos").default([]),
  resolvidoEm: timestamp("resolvido_em"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const workContacts = pgTable("work_contacts", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull(),
  companyId: integer("company_id").default(1).notNull(),
  nome: text("nome").notNull(),
  cargo: text("cargo").notNull(),
  telefone: text("telefone"),
  email: text("email"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const workChanges = pgTable("work_changes", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull(),
  companyId: integer("company_id").default(1).notNull(),
  data: timestamp("data").defaultNow().notNull(),
  tipo: text("tipo").default("diario_bordo").notNull(),
  descricao: text("descricao").notNull(),
  impacto: text("impacto"),
  responsavel: text("responsavel").notNull(),
  aprovado: boolean("aprovado").default(true).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const workConsumptions = pgTable("work_consumptions", {
  id: serial("id").primaryKey(),
  workId: integer("work_id").notNull(),
  companyId: integer("company_id").default(1).notNull(),
  item: text("item").notNull(),
  categoria: text("categoria").default("material").notNull(),
  quantidade: numeric("quantidade", { precision: 10, scale: 2 }).notNull(),
  unidade: text("unidade").default("un").notNull(),
  valorUnitario: numeric("valor_unitario", { precision: 10, scale: 2 }).default("0.00"),
  valorTotal: numeric("valor_total", { precision: 10, scale: 2 }).default("0.00"),
  data: timestamp("data").defaultNow().notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// 6. Auditoria e Anexos
export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").default(1),
  userId: integer("user_id"),
  acao: text("acao").notNull(),
  entidade: text("entidade").notNull(),
  entidadeId: text("entidade_id"),
  detalhes: jsonb("detalhes"),
  ip: text("ip"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").default(1).notNull(),
  parentType: text("parent_type").notNull(),
  parentId: text("parent_id").notNull(),
  nomeArquivo: text("nome_arquivo").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  tamanhoBytes: integer("tamanho_bytes").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// 7. Configurações Fiscais, WhatsApp e Sistema
export const fiscalConfig = pgTable("fiscal_config", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").default(1),
  cnpj: text("cnpj").notNull(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  regimeTributario: text("regime_tributario").notNull(),
  inscricaoEstadual: text("inscricao_estadual"),
  aliquotaEfetiva: text("aliquota_efetiva"),
  endereco: text("endereco"),
  bairro: text("bairro"),
  cidade: text("cidade").default("Mirassol"),
  uf: text("uf").default("SP"),
  cep: text("cep").default("15130-000"),
  telefone: text("telefone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  site: text("site").default("polartechsolucoes.com.br"),
  logoUrl: text("logo_url"),
  slogan: text("slogan").default("Mais conforto, mais qualidade de vida!"),
  certidoesValidas: jsonb("certidoes_validas"),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const whatsappSettings = pgTable("whatsapp_settings", {
  id: serial("id").primaryKey(),
  numeroDestino: text("numero_destino").notNull(),
  notificarNovasLicitacoes: boolean("notificar_novas_licitacoes").default(true).notNull(),
  notificarAlertasFiscais: boolean("notificar_alertas_fiscais").default(true).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const systemState = pgTable("system_state", {
  id: serial("id").primaryKey(),
  chave: text("chave").unique().notNull(),
  valor: jsonb("valor").notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// 8. Usuários
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").default(1),
  email: text("email").unique().notNull(),
  nome: text("nome").notNull(),
  senhaHash: text("senha_hash").notNull(),
  role: text("role").default("admin").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});
