export type EquipmentPhotoPhase = "before" | "after";
export type EquipmentPhotoReference = {phase:EquipmentPhotoPhase; index:number};
export type FieldEquipmentResult = {equipmentId:string; status:"completed"|"pending"; note:string; photo?:EquipmentPhotoReference};
type Counts = Partial<Record<EquipmentPhotoPhase,number>>;
const record = (value:unknown):value is Record<string,unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const statusOk = (status:unknown):status is FieldEquipmentResult["status"] => status === "completed" || status === "pending";
const photoOk = (value:unknown, counts:Counts):value is EquipmentPhotoReference => record(value) && (value.phase === "before" || value.phase === "after") && typeof value.index === "number" && Number.isInteger(value.index) && value.index >= 0 && value.index < Number(counts[value.phase] || 0);

export function fieldEquipmentIds(order:Record<string,unknown>):string[] {
  return [...new Set((Array.isArray(order.equipmentIds)?order.equipmentIds:[order.equipmentId]).filter((id):id is string=>typeof id==="string" && Boolean(id.trim()) && id.length<=100))];
}

/** Keep mobile read projections bounded and never copy arbitrary nested evidence. */
export function projectEquipmentResults(value:unknown, ids:readonly string[], counts:Counts):FieldEquipmentResult[] {
  if (!Array.isArray(value)) return [];
  const seen=new Set<string>();
  return value.slice(0,20).flatMap(row=>{
    if(!record(row)||typeof row.equipmentId!=="string"||!ids.includes(row.equipmentId)||seen.has(row.equipmentId)||!statusOk(row.status))return [];
    seen.add(row.equipmentId);
    return [{equipmentId:row.equipmentId,status:row.status,note:typeof row.note==="string"?row.note.trim().slice(0,500):"",...(photoOk(row.photo,counts)?{photo:{phase:row.photo.phase,index:row.photo.index}}:{})}];
  });
}

/** Check new commands (including old cached or offline clients) against the saved OS scope. */
export function equipmentResultsIssue(value:unknown, ids:readonly string[], counts:Counts) {
  if (!Array.isArray(value)||value.length>20)return "Informe resultados válidos por aparelho.";
  const seen=new Set<string>();
  for(const row of value){
    if(!record(row)||typeof row.equipmentId!=="string"||!ids.includes(row.equipmentId)||seen.has(row.equipmentId)||!statusOk(row.status)||typeof row.note!=="string"||row.note.length>500)return "Resultado inválido ou duplicado para um aparelho desta OS.";
    if(row.status==="pending"&&!row.note.trim())return "Informe o motivo de cada aparelho pendente antes de salvar.";
    if(row.photo!==undefined&&!photoOk(row.photo,counts))return "A foto selecionada para o aparelho não está mais disponível. Confira a evidência.";
    seen.add(row.equipmentId);
  }
  return null;
}

export function equipmentCompletionIssue(ids:readonly string[], results:readonly FieldEquipmentResult[]) {
  if(results.some(row=>ids.includes(row.equipmentId)&&row.status==="pending"))
    return "Há aparelho pendente. Salve o progresso e mantenha a OS em aberto.";
  if(ids.length>1&&!ids.every(id=>results.some(row=>row.equipmentId===id&&row.status==="completed")))
    return "Informe o resultado de todos os aparelhos antes de concluir a OS.";
  return null;
}

/** Removing or annotating a new photo must not silently point a different photo at the same appliance. */
export function updateEquipmentPhotoReferences(results:readonly FieldEquipmentResult[],phase:EquipmentPhotoPhase,existing:number,oldPhotos:readonly string[],newPhotos:readonly string[]) {
  return results.map(({photo,...row})=>{
    if(!photo||photo.phase!==phase||photo.index<existing)return photo?{...row,photo}:row;
    const original=oldPhotos[photo.index-existing];
    const replacement=original?newPhotos.indexOf(original):-1;
    return replacement>=0?{...row,photo:{phase,index:existing+replacement}}:row;
  });
}
