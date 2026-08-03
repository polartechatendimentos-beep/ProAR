import { pgTable, serial, text, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";

// Tabela de Licitações com suporte completo a Licitações em Andamento e PNCP
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
  // Status: em_andamento, recebendo_proposta, fase_lance, analisada, proposta_enviada, encerrada, descartada
  status: text("status").default("em_andamento").notNull(),
  notificadoWhatsapp: boolean("notificado_whatsapp").default(false).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Tabela de Ordens de Serviço / Relatórios de Tarefa (Modelo Polartech/Landsol)
export const ordensServico = pgTable("ordens_servico", {
  id: serial("id").primaryKey(),
  numeroTarefa: text("numero_tarefa").notNull(),
  
  // Cliente
  clienteNome: text("cliente_nome").notNull(),
  clienteCnpjCpf: text("cliente_cnpj_cpf").notNull(),
  clienteContato: text("cliente_contato"),
  clienteTelefone: text("cliente_telefone"),
  clienteEmail: text("cliente_email"),
  
  // Atividade
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
  
  // Checklist de Higienização/Limpeza (JSON)
  checklist: jsonb("checklist").notNull(), // { limpezaFiltros: boolean, limpezaSerpentinaBandeja: boolean, limpezaDreno: boolean, aplicacaoBactericida: boolean, limpezaUnidadeExterna: boolean, testeFinal: boolean }
  
  // Fotos (URLs / Base64)
  fotosAntes: jsonb("fotos_antes"), // Array de URLs
  fotosDepois: jsonb("fotos_depois"), // Array de URLs
  
  // Assinaturas
  assinaturaTecnicoNome: text("assinatura_tecnico_nome"),
  assinaturaTecnicoDoc: text("assinatura_tecnico_doc"),
  assinaturaClienteNome: text("assinatura_cliente_nome"),
  assinaturaClienteDoc: text("assinatura_cliente_doc"),
  
  status: text("status").default("Concluído").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Configurações Fiscais
export const fiscalConfig = pgTable("fiscal_config", {
  id: serial("id").primaryKey(),
  cnpj: text("cnpj").notNull(),
  razaoSocial: text("razao_social").notNull(),
  regimeTributario: text("regime_tributario").notNull(),
  inscricaoEstadual: text("inscricao_estadual"),
  aliquotaEfetiva: text("aliquota_efetiva"),
  certidoesValidas: jsonb("certidoes_validas"),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Configurações do WhatsApp
export const whatsappSettings = pgTable("whatsapp_settings", {
  id: serial("id").primaryKey(),
  numeroDestino: text("numero_destino").notNull(),
  notificarNovasLicitacoes: boolean("notificar_novas_licitacoes").default(true).notNull(),
  notificarAlertasFiscais: boolean("notificar_alertas_fiscais").default(true).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Estado do Sistema
export const systemState = pgTable("system_state", {
  id: serial("id").primaryKey(),
  chave: text("chave").unique().notNull(),
  valor: jsonb("valor").notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Usuários
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  nome: text("nome").notNull(),
  senhaHash: text("senha_hash").notNull(),
  role: text("role").default("admin").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});
