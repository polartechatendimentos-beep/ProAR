export const ROLE_PERMISSION_PRESETS:Record<string,string[]>={
  "Gerência":["clientes.visualizar","clientes.editar","os.visualizar","os.editar","equipamentos.visualizar","equipamentos.editar","comercial.editar","comercial.preco.alterar","comercial.desconto.liberar","compras.visualizar","compras.editar","financeiro.visualizar","integridade.visualizar","auditoria.visualizar"],
  "Financeiro":["financeiro.visualizar","financeiro.editar","financeiro.baixar","financeiro.estornar","financeiro.conciliar","fiscal.consultar","fiscal.preparar","fiscal.emitir","fiscal.cancelar"],
  "Vendedor":["clientes.visualizar","clientes.editar","equipamentos.visualizar","comercial.editar","os.visualizar"],
  "Técnico":["clientes.visualizar","equipamentos.visualizar","os.visualizar","os.editar"],
  "Estoquista":["estoque.visualizar","estoque.editar","estoque.ajustar","compras.visualizar","compras.receber"],
  "Consulta":["clientes.visualizar","equipamentos.visualizar","os.visualizar","financeiro.visualizar","licitacoes.visualizar"],
};

export function rolePermissionPreset(role:string){return ROLE_PERMISSION_PRESETS[role]||[];}