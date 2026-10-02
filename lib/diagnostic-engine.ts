export type DiagnosticCodeRecord = {
  id: string;
  brand: string;
  models?: string[];
  equipmentTypes?: string[];
  unit?: "Evaporadora" | "Condensadora" | "Controle" | "Sistema";
  capacitiesBtus?: number[];
  code?: string;
  blinkPattern?: string;
  title?: string;
  severity?: "Baixa" | "Média" | "Alta" | "Crítica";
  causes?: string[];
  checks?: string[];
  solutions?: string[];
  notes?: string;
  source?: string;
  sourceUrl?: string;
  verified?: boolean;
};

export type DiagnosticQuery = {
  brand?: string;
  model?: string;
  code?: string;
  blinkPattern?: string;
  symptoms?: string;
  equipmentType?: string;
  unit?: string;
  capacityBtus?: number;
};

const normalize=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR");
const compact=(value:unknown)=>normalize(value).replace(/[^a-z0-9]+/g,"");

export function scoreDiagnosticCode(record:DiagnosticCodeRecord,query:DiagnosticQuery){
  let score=0;
  const brand=normalize(query.brand), model=normalize(query.model), code=compact(query.code), blink=compact(query.blinkPattern);
  const equipmentType=normalize(query.equipmentType), unit=normalize(query.unit);
  const capacity=Number(query.capacityBtus||0);
  if(brand && normalize(record.brand)===brand) score+=40;
  else if(brand && normalize(record.brand).includes(brand)) score+=20;
  if(model && (record.models||[]).some(item=>normalize(item)===model)) score+=20;
  else if(model && (record.models||[]).some(item=>normalize(item).includes(model)||model.includes(normalize(item)))) score+=10;
  const recordCode=compact(record.code);
  if(code && recordCode && code===recordCode) score+=100;
  else if(code && recordCode && (recordCode.includes(code)||code.includes(recordCode))) score+=45;
  else if(code && recordCode) score-=60;
  else if(code && !recordCode) score-=25;
  const recordBlink=compact(record.blinkPattern);
  if(blink && recordBlink && blink===recordBlink) score+=90;
  else if(blink && recordBlink && (recordBlink.includes(blink)||blink.includes(recordBlink))) score+=35;
  else if(blink && recordBlink) score-=60;
  else if(blink && !recordBlink) score-=30;
  if(equipmentType){
    const types=(record.equipmentTypes||[]).map(normalize);
    if(types.some(type=>type===equipmentType)) score+=35;
    else if(types.some(type=>type.includes(equipmentType)||equipmentType.includes(type))) score+=20;
    else if(types.length) score-=60;
  }
  if(unit){
    const recordUnit=normalize(record.unit);
    if(recordUnit===unit) score+=35;
    else if(recordUnit&&unit&&recordUnit!==unit) score-=90;
  }
  if(capacity>0 && (record.capacitiesBtus||[]).length){
    const capacities=record.capacitiesBtus||[];
    if(capacities.includes(capacity)) score+=30;
    else score-=18;
  }
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
    equipmentTypes:list(record.equipmentTypes||record.types||record.tipos||record.tipoEquipamento),
    unit:(["Evaporadora","Condensadora","Controle","Sistema"].includes(String(record.unit||record.unidade))?String(record.unit||record.unidade):undefined) as DiagnosticCodeRecord["unit"],
    capacitiesBtus:(Array.isArray(record.capacitiesBtus||record.capacidadesBtus)?(record.capacitiesBtus||record.capacidadesBtus) as unknown[]:list(record.capacitiesBtus||record.capacidadesBtus)).map(value=>Number(String(value).replace(/\D/g,""))).filter(value=>Number.isFinite(value)&&value>0),
    code:String(record.code||record.codigo||"").trim()||undefined,
    blinkPattern:String(record.blinkPattern||record.blinks||record.piscadas||"").trim()||undefined,
    title:String(record.title||record.name||record.titulo||"").trim()||undefined,
    severity:(["Baixa","Média","Alta","Crítica"].includes(String(record.severity||record.gravidade))?String(record.severity||record.gravidade):undefined) as DiagnosticCodeRecord["severity"],
    causes:list(record.causes||record.causas),
    checks:list(record.checks||record.verificacoes),
    solutions:list(record.solutions||record.solucoes),
    notes:String(record.notes||record.description||record.observacoes||"").trim()||undefined,
    source:String(record.source||record.fonte||"").trim()||undefined,
    sourceUrl:String(record.sourceUrl||record.urlFonte||"").trim()||undefined,
    verified:record.verified===true||record.verificado===true,
  };
}


const knownBrands=["admiral","agratto","comfee","consul","daikin","delonghi","electrolux","elgin","fujitsu","gree","hitachi","komeco","lg","midea","panasonic","philco","rheem","rinetto","samsung","trane","tivah","ventisol","vulcano","york","carrier","tcl","springer","mitsubishi electric"];
export function parseDiagnosticSearch(value:string):DiagnosticQuery{
  const raw=normalize(value);
  const brand=knownBrands.find(item=>raw.includes(item))||"";
  const equipmentType=/piso[ -]?teto/.test(raw)?"Piso Teto":/cassete/.test(raw)?"Cassete":/vrf|vrv/.test(raw)?"VRF / VRV":/janela/.test(raw)?"Janela":/split|hi[ -]?wall/.test(raw)?"Split Hi-Wall":"";
  const unit=/condensadora|unidade externa|externa/.test(raw)?"Condensadora":/evaporadora|unidade interna|interna/.test(raw)?"Evaporadora":/controle|termostato/.test(raw)?"Controle":"";
  const blinkMatch=raw.match(/(?:pisca|piscando|piscadas?|piscar)\D{0,16}(\d{1,2})|(?:\b(\d{1,2})\b)\s*(?:x|vezes?)\s*(?:pisca|piscando|piscadas?)?/);
  const blinkCount=Number(blinkMatch?.[1]||blinkMatch?.[2]||0);
  const capacityMatch=raw.match(/(\d{1,3})(?:\s*[.]?\s*000|\s*mil)\s*(?:btu|btus|btu\/h)?/);
  const directBtu=raw.match(/\b(\d{4,6})\s*(?:btu|btus|btu\/h)\b/);
  const capacityBtus=capacityMatch?Number(capacityMatch[1])*1000:directBtu?Number(directBtu[1]):0;
  const codeMatch=raw.match(/\b(?:erro|codigo|código)\s*([a-z]{1,3}\d{0,3}|\d{1,3})\b/i);
  return {
    brand,
    equipmentType,
    unit,
    capacityBtus:capacityBtus||undefined,
    code:codeMatch?.[1]?.toUpperCase()||"",
    blinkPattern:blinkCount?`${blinkCount} piscadas`:"",
    symptoms:value,
  };
}
