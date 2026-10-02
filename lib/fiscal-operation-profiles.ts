export type FiscalOperationProfile = {
  id: string;
  label: string;
  documentType: "NF-e"|"NFC-e"|"NFS-e"|"MIXED";
  operationNature: string;
  direction?: "0"|"1";
  destination?: "1"|"2"|"3";
  finalConsumer?: boolean;
  notes: string[];
};

export const fiscalOperationProfiles: FiscalOperationProfile[] = [
  { id:"sale-sp-b2b",label:"Venda de equipamento dentro de SP",documentType:"NF-e",operationNature:"Venda de mercadoria",direction:"1",destination:"1",notes:["Confirmar CFOP/CST/CSOSN conforme tributação real do produto.","Consumidor final deve ser definido por operação."] },
  { id:"sale-retail-sp",label:"Venda varejo consumidor final em SP",documentType:"NFC-e",operationNature:"Venda a consumidor final",direction:"1",destination:"1",finalConsumer:true,notes:["Confirmar elegibilidade da operação para NFC-e.","Forma de pagamento deve refletir a venda."] },
  { id:"service-mirassol",label:"Prestação de serviço em Mirassol",documentType:"NFS-e",operationNature:"Prestação de serviços",notes:["Confirmar código de serviço, NBS, ISS e retenções.","Para obra, revisar CNO e dados da construção civil."] },
  { id:"mixed-equipment-installation",label:"Venda de equipamento + instalação",documentType:"MIXED",operationNature:"Operação mista",notes:["Separar mercadorias e serviços antes da emissão.","Revisar com responsável fiscal se o cenário exige documentos distintos."] },
  { id:"return",label:"Devolução/retorno",documentType:"NF-e",operationNature:"Devolução/retorno",direction:"1",notes:["Referenciar o documento de origem.","Copiar itens e bases da nota original e ajustar apenas quantidades devolvidas."] },
  { id:"complement",label:"NF-e complementar",documentType:"NF-e",operationNature:"Complemento de operação",direction:"1",notes:["Referenciar a NF-e original.","Informar somente o componente efetivamente complementado."] },
];

export function suggestFiscalProfiles(input: { hasProducts?: boolean; hasServices?: boolean; state?: string; finalConsumer?: boolean }) {
  if (input.hasProducts && input.hasServices) return fiscalOperationProfiles.filter(item=>item.id==="mixed-equipment-installation");
  if (input.hasServices) return fiscalOperationProfiles.filter(item=>item.id==="service-mirassol");
  if (input.hasProducts && input.finalConsumer && String(input.state||"SP").toUpperCase()==="SP") return fiscalOperationProfiles.filter(item=>item.id==="sale-retail-sp");
  return fiscalOperationProfiles.filter(item=>item.id==="sale-sp-b2b");
}
