export type DiagnosticCodeRecord = {
  id: string;
  brand: string;
  models?: string[];
  code?: string;
  blinkPattern?: string;
  title?: string;
  severity?: "Baixa" | "Média" | "Alta" | "Crítica";
  causes?: string[];
  checks?: string[];
  solutions?: string[];
  notes?: string;
  source?: string;
  verified?: boolean;
};

export type DiagnosticQuery = {
  brand?: string;
  model?: string;
  code?: string;
  blinkPattern?: string;
  symptoms?: string;
};

const normalize=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR");
const compact=(value:unknown)=>normalize(value).replace(/[^a-z0-9]+/g,"");

export function scoreDiagnosticCode(record:DiagnosticCodeRecord,query:DiagnosticQuery){
  let score=0;
  const brand=normalize(query.brand), model=normalize(query.model), code=compact(query.code), blink=compact(query.blinkPattern);
  if(brand && normalize(record.brand)===brand) score+=40;
  else if(brand && normalize(record.brand).includes(brand)) score+=20;
  if(model && (record.models||[]).some(item=>normalize(item)===model)) score+=20;
  else if(model && (record.models||[]).some(item=>normalize(item).includes(model)||model.includes(normalize(item)))) score+=10;
  const recordCode=compact(record.code);
  if(code && recordCode && code===recordCode) score+=100;
  else if(code && recordCode && (recordCode.includes(code)||code.includes(recordCode))) score+=45;
  const recordBlink=compact(record.blinkPattern);
  if(blink && recordBlink && blink===recordBlink) score+=90;
  else if(blink && recordBlink && (recordBlink.includes(blink)||blink.includes(recordBlink))) score+=35;
  if(query.symptoms){
    const hay=normalize([record.title,record.notes,...(record.causes||[]),...(record.checks||[])].join(" "));
    const terms=normalize(query.symptoms).split(/\s+/).filter(term=>term.length>3);
    score+=Math.min(20,terms.filter(term=>hay.includes(term)).length*4);
  }
  return score;
}

export function findDiagnosticMatches(records:DiagnosticCodeRecord[],query:DiagnosticQuery,limit=8){
  return records
    .map(record=>({record,score:scoreDiagnosticCode(record,query)}))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score||a.record.brand.localeCompare(b.record.brand,"pt-BR"))
    .slice(0,limit);
}

export function normalizeDiagnosticRecord(record:Record<string,unknown>):DiagnosticCodeRecord|null{
  const id=String(record.id||"").trim();
  const brand=String(record.brand||record.marca||"").trim();
  if(!id||!brand)return null;
  const list=(value:unknown)=>Array.isArray(value)?value.map(item=>String(item).trim()).filter(Boolean):String(value||"").split(/\n|;/).map(item=>item.trim()).filter(Boolean);
  return {
    id,
    brand,
    models:list(record.models||record.modelos),
    code:String(record.code||record.codigo||"").trim()||undefined,
    blinkPattern:String(record.blinkPattern||record.blinks||record.piscadas||"").trim()||undefined,
    title:String(record.title||record.name||record.titulo||"").trim()||undefined,
    severity:(["Baixa","Média","Alta","Crítica"].includes(String(record.severity||record.gravidade))?String(record.severity||record.gravidade):undefined) as DiagnosticCodeRecord["severity"],
    causes:list(record.causes||record.causas),
    checks:list(record.checks||record.verificacoes),
    solutions:list(record.solutions||record.solucoes),
    notes:String(record.notes||record.description||record.observacoes||"").trim()||undefined,
    source:String(record.source||record.fonte||"").trim()||undefined,
    verified:record.verified===true||record.verificado===true,
  };
}
