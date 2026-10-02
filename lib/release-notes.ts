export type ReleaseNoteType = "Novidade" | "Melhoria" | "Correção" | "Segurança";

export type ReleaseNote = {
  type: ReleaseNoteType;
  title: string;
  description: string;
  module?: string;
};

export type ProARRelease = {
  version: string;
  date: string;
  title: string;
  summary: string;
  notes: ReleaseNote[];
};

export const PROAR_RELEASES: ProARRelease[] = [
  {
    version: "2.1.0",
    date: "02/10/2026",
    title: "Operação, Fiscal e Usabilidade",
    summary: "Pacote de melhorias de operação, visibilidade, fiscal, aprovações e experiência de uso.",
    notes: [
      { type:"Novidade", module:"Fiscal", title:"Central Fiscal", description:"Novo módulo operacional com visão geral, NF-e, NFC-e, NFS-e, DF-e e saúde da configuração fiscal." },
      { type:"Novidade", module:"Sistema", title:"Notificações globais", description:"Confirmações padronizadas de sucesso, atenção, erro e informação após salvar, alterar, excluir, sincronizar ou executar operações." },
      { type:"Melhoria", module:"Licitações", title:"Filtro por distância de Mirassol", description:"Índice geográfico ampliado para municípios de SP, MG, MS, PR e GO, com consulta por código IBGE e nome + UF." },
      { type:"Melhoria", module:"Funcionários", title:"Tela de funcionários reorganizada", description:"Correção de sobreposição de colunas, perfil de acesso correto e melhor adaptação para diferentes larguras de tela." },
      { type:"Correção", module:"Obras", title:"Acesso de engenheiros e fiscais", description:"Correção do botão Adicionar acesso, separação da sincronização de credenciais e feedback visual de salvamento." },
      { type:"Correção", module:"Aprovações", title:"Liberação automática por alçada", description:"Compras e orçamentos deixam de ficar bloqueados quando valor ou desconto voltam para dentro da alçada automática." },
      { type:"Melhoria", module:"Operação", title:"Fluxos encadeados", description:"Reforços nos vínculos entre compras, estoque, financeiro, orçamentos, vendas, OS, fiscal e pós-venda." },
      { type:"Segurança", module:"Fiscal", title:"Permissões fiscais", description:"Rotas fiscais exigem permissões específicas e respeitam o contexto da empresa autenticada." },
    ],
  },
  {
    version: "2.0.0",
    date: "21/09/2026",
    title: "Base ProAR 3.0",
    summary: "Consolidação da operação completa do ProAR com módulos integrados e base multiempresa.",
    notes: [
      { type:"Novidade", module:"Sistema", title:"Central de operações", description:"Navegação consolidada para clientes, equipamentos, orçamentos, vendas, OS, obras, financeiro e gestão." },
      { type:"Melhoria", module:"Clientes", title:"Estrutura hierárquica", description:"Suporte a cliente, unidade, setor, sala e ambiente vinculados ao cadastro principal." },
      { type:"Melhoria", module:"Obras", title:"Acompanhamento de obra", description:"Etapas, progresso, histórico, fotos, perdas, roubos e acesso externo vinculados à obra." },
      { type:"Melhoria", module:"Segurança", title:"Controle por perfil", description:"Permissões separadas para Administração, Gerência, Financeiro, Vendedor, Técnico, Estoquista e Consulta." },
    ],
  },
];

export const CURRENT_PROAR_RELEASE = PROAR_RELEASES[0];
