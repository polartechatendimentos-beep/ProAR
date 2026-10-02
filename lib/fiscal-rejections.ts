export type FiscalRejectionHint = { title: string; field?: string; action: string; severity: "error"|"warning" };

const rules: Array<[RegExp,FiscalRejectionHint]> = [
  [/ie .*inv[aá]lid|inscri[cç][aã]o estadual/i,{title:"Inscrição Estadual inválida",field:"customer.stateRegistration",action:"Revise IE e indicador de contribuinte.",severity:"error"}],
  [/ncm/i,{title:"NCM inválido ou ausente",field:"items.ncm",action:"Revise o NCM no cadastro do produto.",severity:"error"}],
  [/cfop/i,{title:"CFOP incompatível",field:"items.cfop",action:"Revise CFOP conforme entrada/saída, UF e finalidade.",severity:"error"}],
  [/cest/i,{title:"CEST precisa de revisão",field:"items.cest",action:"Revise CEST e enquadramento de substituição tributária.",severity:"error"}],
  [/csc/i,{title:"CSC da NFC-e não configurado",field:"config.csc",action:"Confira CSC e ID CSC no ambiente correto.",severity:"error"}],
  [/certificado|certificate/i,{title:"Certificado digital",field:"config.certificate",action:"Confira certificado A1, senha e validade.",severity:"error"}],
  [/cclass|classifica[cç][aã]o tribut[aá]ria|ibs|cbs/i,{title:"Classificação IBS/CBS",field:"items.ibsCbsClassCode",action:"Revise CST, cClassTrib e dados IBS/CBS conforme tabela vigente.",severity:"error"}],
  [/endere[cç]o|cep|logradouro|bairro|munic[ií]pio/i,{title:"Endereço fiscal incompleto",field:"customer.address",action:"Complete o endereço fiscal do destinatário/tomador.",severity:"error"}],
  [/duplic|j[aá] existe|repetid/i,{title:"Possível emissão duplicada",action:"Consulte a situação da chave/protocolo antes de reenviar.",severity:"warning"}],
  [/servi[cç]o|item.*lista|c[oó]digo.*serv/i,{title:"Código de serviço",field:"service.serviceCode",action:"Revise o código de serviço municipal/nacional e NBS.",severity:"error"}],
];

export function translateFiscalRejection(code: unknown, message: unknown): FiscalRejectionHint {
  const input = `${String(code ?? "")} ${String(message ?? "")}`;
  for (const [pattern,hint] of rules) if (pattern.test(input)) return hint;
  return { title: String(code || "Rejeição fiscal"), action: String(message || "Consulte o retorno do autorizador e revise os dados da nota."), severity: "error" };
}
