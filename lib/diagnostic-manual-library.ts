export type DiagnosticManual = {
  id:string;
  brand:string;
  equipmentTypes?:string[];
  models?:string[];
  capacityBtus?:number[];
  year?:string;
  title:string;
  url:string;
  source:"Fabricante"|"WebArCondicionado"|"PolarTech";
  verified:boolean;
  notes?:string;
};

export const DEFAULT_DIAGNOSTIC_MANUALS:DiagnosticManual[]=[
  {id:"WEBAR-INDEX",brand:"*",title:"Índice de códigos de erro HVAC",url:"https://www.webarcondicionado.com.br/codigos-de-erro",source:"WebArCondicionado",verified:true},
  {id:"ELGIN-SPLIT-CODES",brand:"Elgin",equipmentTypes:["Split Hi-Wall"],title:"Elgin • tabela de códigos Split",url:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-split-elgin.pdf",source:"WebArCondicionado",verified:true},
  {id:"ELGIN-PT-CODES",brand:"Elgin",equipmentTypes:["Piso Teto","Cassete"],title:"Elgin • tabela de códigos Piso-Teto/Cassete",url:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-piso-teto-elgin.pdf",source:"WebArCondicionado",verified:true},
];

const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR");

export function normalizeDiagnosticManual(record:Record<string,unknown>):DiagnosticManual|null{
  const id=String(record.id||"").trim(),brand=String(record.brand||record.marca||"").trim();
  const title=String(record.title||record.name||record.titulo||"").trim();
  const url=String(record.url||record.link||record.sourceUrl||record.urlFonte||"").trim();
  if(!id||!brand||!title||!url)return null;
  const list=(value:unknown)=>Array.isArray(value)?value.map(String).map(x=>x.trim()).filter(Boolean):String(value||"").split(/\n|;/).map(x=>x.trim()).filter(Boolean);
  return {
    id,brand,title,url,
    equipmentTypes:list(record.equipmentTypes||record.tipos||record.tipoEquipamento),
    models:list(record.models||record.modelos),
    capacityBtus:list(record.capacityBtus||record.capacidadesBtus).map(x=>Number(x.replace(/\D/g,""))).filter(Boolean),
    year:String(record.year||record.ano||"").trim()||undefined,
    source:(["Fabricante","WebArCondicionado","PolarTech"].includes(String(record.source||record.fonte))?String(record.source||record.fonte):"PolarTech") as DiagnosticManual["source"],
    verified:record.verified===true||record.verificado===true,
    notes:String(record.notes||record.observacoes||"").trim()||undefined,
  };
}

export function rankDiagnosticManuals(manuals:DiagnosticManual[],query:{brand?:string;equipmentType?:string;model?:string;capacityBtus?:number},limit=8){
  const all=[...DEFAULT_DIAGNOSTIC_MANUALS,...manuals];
  const seen=new Map<string,DiagnosticManual>(); for(const manual of all)seen.set(manual.id,manual);
  return [...seen.values()].map(manual=>{
    let score=manual.brand==="*"?1:0;
    const brand=norm(query.brand),type=norm(query.equipmentType),model=norm(query.model),manualBrand=norm(manual.brand);
    if(brand&&manualBrand===brand)score+=50; else if(brand&&manualBrand!=="*"&&manualBrand!==brand)score-=100;
    if(type&&(manual.equipmentTypes||[]).some(x=>norm(x)===type))score+=30;
    if(model&&(manual.models||[]).some(x=>model.includes(norm(x))||norm(x).includes(model)))score+=35;
    if(query.capacityBtus&&(manual.capacityBtus||[]).includes(query.capacityBtus))score+=20;
    if(manual.source==="Fabricante")score+=15;
    if(manual.verified)score+=5;
    return {manual,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}
