export type TechnicalQuery = { brand?: string; model?: string; code?: string; symptoms: string; equipmentType?: string };
export function normalizeTechnicalQuery(input: TechnicalQuery) {
  const clean=(value?:string,max=120)=>typeof value==="string"?value.trim().slice(0,max):"";
  return {brand:clean(input.brand),model:clean(input.model),code:clean(input.code,32).toUpperCase(),symptoms:clean(input.symptoms,1500),equipmentType:clean(input.equipmentType)};
}
export function assessTechnicalEvidence(input: TechnicalQuery, officialDocumentFound: boolean) {
  const query=normalizeTechnicalQuery(input);
  const missing=[...(!query.brand?["fabricante"]:[]),...(!query.model?["modelo"]:[]),...(!query.symptoms?["sintomas"]:[])];
  if(query.code&&!query.model)missing.push("interpretação do código depende do modelo exato");
  return {status:officialDocumentFound&&missing.length===0?"EVIDENCE_AVAILABLE":"NEEDS_VERIFICATION",missing,canConfirmFailure:false,canAuthorizeRepair:false,query};
}

